from unittest.mock import AsyncMock

import httpx
from fastapi.testclient import TestClient


def test_proxy_freezes_destination_model_and_attempt(app, worker_request, monkeypatch):
    worker_request["past_decisions"] = [{"fixture_block_seconds": 60}]
    with TestClient(app) as client:
        route = f"/llm/{worker_request['run_id']}/v1/chat/completions"
        assert client.post(route, json={"model": "openai/gpt-6-sol"}).status_code == 401
        headers = {"Authorization": "Bearer test-gateway", "X-Gnoesis-Attempt": "1"}
        assert client.post(route, json={"model": "openai/gpt-6-sol"}, headers=headers).status_code == 404
        job = app.state.jobs.start(worker_request)
        try:
            assert client.post(route, json={"model": "other/model"}, headers=headers).status_code == 403
            stale = {**headers, "X-Gnoesis-Attempt": "2"}
            assert client.post(route, json={"model": "openai/gpt-6-sol"}, headers=stale).status_code == 409
            mocked = AsyncMock(return_value=httpx.Response(200, json={"choices": [], "usage": {}}))
            monkeypatch.setattr(app.state.gateway, "post", mocked)
            response = client.post(route, json={"model": "openai/gpt-6-sol", "messages": [], "max_tokens": 99999}, headers=headers)
            assert response.status_code == 200
            forwarded = mocked.call_args.kwargs
            assert mocked.call_args.args[0] == "http://127.0.0.1:3000/v1/chat/completions"
            assert forwarded["headers"]["X-Gnoesis-Run"] == job.run_id
            assert forwarded["headers"]["X-Gnoesis-Attempt"] == "1"
            assert forwarded["json"]["max_tokens"] == 512
            assert forwarded["headers"]["Authorization"] == "Bearer test-gateway"
        finally:
            app.state.jobs.cancel(job.run_id)
            list(app.state.jobs.iter_events(job))


def test_gateway_error_preserved_without_service_token(app, worker_request, monkeypatch):
    worker_request["past_decisions"] = [{"fixture_block_seconds": 60}]
    with TestClient(app) as client:
        job = app.state.jobs.start(worker_request)
        try:
            mocked = AsyncMock(return_value=httpx.Response(429, json={"error": {"code": "BUDGET_EXCEEDED"}}))
            monkeypatch.setattr(app.state.gateway, "post", mocked)
            response = client.post(f"/llm/{job.run_id}/v1/chat/completions",
                                   json={"model": "openai/gpt-6-sol", "messages": []},
                                   headers={"Authorization": "Bearer test-gateway", "X-Gnoesis-Attempt": "1"})
            assert response.status_code == 429
            assert response.json()["error"]["code"] == "BUDGET_EXCEEDED"
        finally:
            app.state.jobs.cancel(job.run_id)
            list(app.state.jobs.iter_events(job))
