import json
import time
import threading
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from svc.contracts import validate
from svc.jobs import JobManager


AUTH = {"Authorization": "Bearer test-service"}


def events(response):
    return [json.loads(line) for line in response.text.splitlines() if line.strip()]


def test_service_auth_and_fixture_stream(app, worker_request):
    with TestClient(app) as client:
        assert client.get("/health").status_code == 401
        assert client.post("/execute", json=worker_request).status_code == 401
        assert client.post("/settle", json=worker_request).status_code == 401
        assert client.get("/health", headers=AUTH).json()["name"] == "Gnoesis Agenic Research"
        response = client.post("/execute", json=worker_request, headers=AUTH)
        assert response.status_code == 200
        output = events(response)
        for event in output:
            validate("WorkerEvent", event)
        completed = [event["node_id"] for event in output if event["type"] == "node.completed"]
        assert len(completed) == len(set(completed)) == 12
        assert output[-1]["type"] == "result"
        decision = output[-1]["payload"]
        validate("Decision", decision)
        assert decision["source"] == "fixture"
        assert decision["research_only"] is True
        assert "FIXTURE" in decision["warnings"][0]


def test_invalid_uuid_calendar_date_and_nonfinite_rejected(app, worker_request):
    with TestClient(app) as client:
        worker_request["run_id"] = "-" * 36
        assert client.post("/execute", json=worker_request, headers=AUTH).status_code == 422
        worker_request["run_id"] = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        worker_request["request"]["trade_date"] = "2026-02-31"
        assert client.post("/execute", json=worker_request, headers=AUTH).status_code == 422
        worker_request["request"]["trade_date"] = "2026-09-25"
        worker_request["request"]["portfolio"] = {"cash": float("nan"), "currency": "USD", "positions": []}
        response = client.post("/execute", content=json.dumps(worker_request),
                               headers={**AUTH, "Content-Type": "application/json"})
        assert response.status_code == 422


def test_fixture_never_enabled_by_request_alone(settings, worker_request):
    from svc.main import create_app

    settings.test_mode = False
    with TestClient(create_app(settings)) as client:
        assert client.post("/execute", json=worker_request, headers=AUTH).status_code == 403


def test_cancel_terminates_blocked_process(settings, worker_request):
    worker_request["past_decisions"] = [{"fixture_block_seconds": 60}]
    manager = JobManager(settings)
    job = manager.start(worker_request)
    started = threading.Event()
    actual_pid = []
    def read_output():
        output = []
        for item in manager.iter_events(job):
            output.append(item)
            if item["type"] == "node.started":
                actual_pid.append(item["payload"]["worker_pid"])
                started.set()
        return output
    with ThreadPoolExecutor() as pool:
        waiter = pool.submit(read_output)
        assert started.wait(30), "Blocked fixture did not reach its worker node"
        assert manager.cancel(job.run_id) is True
        output = waiter.result(timeout=5)
    assert not job.process.is_alive()
    from svc.watchdog import process_alive
    assert not process_alive(actual_pid[0])
    assert output[-1]["type"] == "error"
    assert output[-1]["payload"]["code"] == "CANCELLED"
    assert manager.active is None


def test_single_active_job_rejects_duplicate_and_other_run(settings, worker_request):
    from svc.jobs import BusyError

    worker_request["past_decisions"] = [{"fixture_block_seconds": 60}]
    manager = JobManager(settings)
    job = manager.start(worker_request)
    try:
        import pytest

        with pytest.raises(BusyError):
            manager.start(worker_request)
    finally:
        manager.cancel(job.run_id)
        list(manager.iter_events(job))
