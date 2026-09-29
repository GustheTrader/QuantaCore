from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
from uuid import uuid4

import httpx

from svc.config import ENGINE_COMMIT
from svc.contracts import validate
from svc.worker import PROVIDER_SECRETS
from svc.watchdog import process_alive


def test_real_http_fixture_cancel_and_owner_exit(worker_request, tmp_path):
    """Real uvicorn, HTTP stream, graph process cancellation, and owner-death cleanup."""
    project = Path(__file__).resolve().parents[1]
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    base_url = f"http://127.0.0.1:{port}"
    environment = {key: value for key, value in os.environ.items() if key.upper() not in PROVIDER_SECRETS}
    owner = subprocess.Popen([sys.executable, "-c", "import os,time;from svc.watchdog import start_watchdog;start_watchdog([os.getppid()],lambda:os._exit(0));time.sleep(300)"],
                             cwd=project, env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    environment.update(GNOESIS_SERVICE_TOKEN="http-smoke-service", GNOESIS_GATEWAY_TOKEN="http-smoke-gateway",
                       GNOESIS_TEST_MODE="1", GNOESIS_OWNER_PID=str(owner.pid),
                       GNOESIS_DATA_DIR=str(tmp_path / "data"), GNOESIS_SIDECAR_URL=base_url)
    headers = {"Authorization": "Bearer http-smoke-service"}
    server = subprocess.Popen([sys.executable, "-m", "uvicorn", "svc.main:app", "--host", "127.0.0.1", "--port", str(port)],
                              cwd=project, env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        with httpx.Client(base_url=base_url, timeout=60, trust_env=False) as client:
            deadline = time.monotonic() + 90
            while True:
                try:
                    health = client.get("/health", headers=headers, timeout=1)
                    if health.status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                assert server.poll() is None, "Sidecar exited before readiness"
                assert time.monotonic() < deadline, "Sidecar did not become ready"
                time.sleep(0.2)
            assert health.json()["engine"]["commit"] == ENGINE_COMMIT
            assert client.get("/health").status_code == 401
            complete = client.post("/execute", json=worker_request, headers=headers)
            assert complete.status_code == 200
            completed_events = [json.loads(line) for line in complete.text.splitlines()]
            for record in completed_events:
                validate("WorkerEvent", record)
            assert completed_events[-1]["type"] == "result"
            assert completed_events[-1]["payload"]["source"] == "fixture"
            assert len({record["node_id"] for record in completed_events if record["type"] == "node.completed"}) == 12
            blocked_request = deepcopy(worker_request)
            blocked_request["run_id"] = str(uuid4())
            blocked_request["past_decisions"] = [{"fixture_block_seconds": 60}]
            with ThreadPoolExecutor() as pool:
                response_future = pool.submit(client.post, "/execute", json=blocked_request, headers=headers)
                deadline = time.monotonic() + 20
                while client.get("/health", headers=headers).json()["active_run_id"] != blocked_request["run_id"]:
                    assert time.monotonic() < deadline
                    time.sleep(0.05)
                assert client.post("/cancel/" + blocked_request["run_id"], headers=headers).status_code == 200
                cancelled_events = [json.loads(line) for line in response_future.result(timeout=5).text.splitlines()]
                assert cancelled_events[-1]["payload"]["code"] == "CANCELLED"
            # Owner death stops both the authenticated service and an active blocked child.
            orphan_request = deepcopy(blocked_request)
            orphan_request["run_id"] = str(uuid4())
            orphan_ready = threading.Event()
            child_pid = []
            def read_until_owner_exits():
                try:
                    with client.stream("POST", "/execute", json=orphan_request, headers=headers) as stream:
                        for line in stream.iter_lines():
                            record = json.loads(line)
                            if record["type"] == "node.started":
                                child_pid.append(record["payload"]["worker_pid"])
                                orphan_ready.set()
                except httpx.HTTPError:
                    return "owner exited"
                return "stream ended"
            with ThreadPoolExecutor() as pool:
                orphan_future = pool.submit(read_until_owner_exits)
                assert orphan_ready.wait(30)
                owner.terminate()
                owner.wait(timeout=5)
                assert server.wait(timeout=5) == 0
                orphan_future.result(timeout=5)
                assert not process_alive(child_pid[0])
    finally:
        if server.poll() is None:
            server.terminate()
            server.wait(timeout=5)
        if owner.poll() is None:
            owner.terminate()
            owner.wait(timeout=5)
