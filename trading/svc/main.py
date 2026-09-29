import asyncio
from contextlib import asynccontextmanager
import hmac
from importlib import metadata
import json
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse
import httpx
from jsonschema import ValidationError

from .config import ENGINE_COMMIT, NAME, Settings
from .contracts import run_id, validate_worker_request
from .jobs import BusyError, JobManager
from .watchdog import start_watchdog


MAX_BODY_BYTES = 2 * 1024 * 1024


def engine_info():
    try:
        distribution = metadata.distribution("tradingagents")
        direct = json.loads(distribution.read_text("direct_url.json") or "{}")
        actual = direct.get("vcs_info", {}).get("commit_id")
        return {"version": distribution.version, "commit": actual, "ready": actual == ENGINE_COMMIT}
    except (metadata.PackageNotFoundError, ValueError):
        return {"version": None, "commit": None, "ready": False}


def require_token(request, token):
    if not token:
        raise HTTPException(503, "Local service token is not configured")
    authorization = request.headers.get("Authorization", "")
    if not hmac.compare_digest(authorization.encode(), f"Bearer {token}".encode()):
        raise HTTPException(401, "Invalid local service credential")


async def json_body(request):
    raw = await request.body()
    if len(raw) > MAX_BODY_BYTES:
        raise HTTPException(413, "Request body is too large")
    try:
        return json.loads(raw)
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(422, "Body must be valid JSON") from exc


def create_app(settings=None):
    configuration = settings or Settings.from_env()
    manager = JobManager(configuration)

    @asynccontextmanager
    async def lifespan(application):
        application.state.gateway = httpx.AsyncClient(timeout=httpx.Timeout(1800, connect=5), follow_redirects=False,
                                                      trust_env=False)
        def owner_exited():
            manager.close()
            os._exit(0)
        # On Windows the venv launcher is a separate process; stopping it must
        # also stop the actual uvicorn interpreter, even while the Node owner lives.
        parents = [configuration.owner_pid, os.getppid()] if configuration.owner_pid else []
        watchdog = start_watchdog(parents, owner_exited)
        try:
            yield
        finally:
            watchdog.set()
            await asyncio.to_thread(manager.close)
            await application.state.gateway.aclose()

    application = FastAPI(title=NAME, lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    application.state.settings = configuration
    application.state.jobs = manager
    application.state.engine = engine_info()

    @application.get("/health")
    async def health(request: Request):
        require_token(request, configuration.service_token)
        return {"name": NAME, "status": "ready", "research_only": True,
                "engine": application.state.engine, "test_mode": configuration.test_mode,
                "active_run_id": manager.active.run_id if manager.active else None}

    async def start_stream(request, operation):
        require_token(request, configuration.service_token)
        body = await json_body(request)
        try:
            validate_worker_request(body)
        except (ValueError, TypeError, KeyError, ValidationError) as exc:
            raise HTTPException(422, "Invalid research worker request") from exc
        if body["request"]["mode"] == "fixture" and not configuration.test_mode:
            raise HTTPException(403, "Fixture mode is disabled")
        if body["request"]["mode"] != "fixture" and not application.state.engine["ready"]:
            raise HTTPException(503, "The pinned research engine is not installed")
        if body["request"]["mode"] != "fixture" and not configuration.gateway_token:
            raise HTTPException(503, "Local gateway token is not configured")
        try:
            job = await asyncio.to_thread(manager.start, body, operation)
        except BusyError as exc:
            raise HTTPException(409, str(exc)) from exc

        def lines():
            for item in manager.iter_events(job):
                yield json.dumps(item, ensure_ascii=False, allow_nan=False) + "\n"

        return StreamingResponse(lines(), media_type="application/x-ndjson",
                                 headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})

    @application.post("/execute")
    async def execute(request: Request):
        return await start_stream(request, "execute")

    @application.post("/settle")
    async def settle(request: Request):
        return await start_stream(request, "settle")

    @application.post("/cancel/{identifier}")
    async def cancel(identifier: str, request: Request):
        require_token(request, configuration.service_token)
        try:
            run_id(identifier)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        cancelled = await asyncio.to_thread(manager.cancel, identifier)
        if not cancelled:
            raise HTTPException(404, "Run is not active")
        return {"run_id": identifier, "cancelled": True}

    @application.post("/llm/{identifier}/v1/chat/completions")
    async def llm_proxy(identifier: str, request: Request):
        require_token(request, configuration.gateway_token)
        job = manager.current(identifier)
        if job is None:
            raise HTTPException(404, "Run is not active")
        if request.headers.get("X-Gnoesis-Attempt") != str(job.attempt):
            raise HTTPException(409, "Stale research attempt")
        body = await json_body(request)
        if not isinstance(body, dict):
            raise HTTPException(422, "Chat request must be an object")
        from .contracts import finite_json
        try:
            finite_json(body)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        frozen = job.request["request"]
        if body.get("model") not in frozen["models"].values():
            raise HTTPException(403, "Model route was not selected for this run")
        if body.get("stream"):
            raise HTTPException(400, "The research SDK uses completed chat responses")
        cap = frozen["budget"]["max_output_tokens"]
        for field in ("max_tokens", "max_completion_tokens"):
            if field in body:
                if not isinstance(body[field], int) or isinstance(body[field], bool) or body[field] < 1:
                    raise HTTPException(422, "Output token cap must be a positive integer")
                body[field] = min(body[field], cap)
        if "max_tokens" not in body and "max_completion_tokens" not in body:
            body["max_tokens"] = cap
        try:
            response = await application.state.gateway.post(
                configuration.gateway_url + "/chat/completions", json=body,
                headers={"Authorization": f"Bearer {configuration.gateway_token}",
                         "X-Gnoesis-Run": identifier, "X-Gnoesis-Attempt": str(job.attempt)},
            )
        except httpx.HTTPError:
            return JSONResponse({"error": {"code": "GATEWAY_UNAVAILABLE", "message": "Local model gateway unavailable."}}, status_code=502)
        if manager.current(identifier) is not job:
            return JSONResponse({"error": {"code": "CANCELLED", "message": "Research run is no longer active."}}, status_code=409)
        return Response(response.content, status_code=response.status_code,
                        media_type=response.headers.get("Content-Type", "application/json"))

    return application


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("svc.main:app", host="127.0.0.1", port=int(os.getenv("GNOESIS_WORKER_PORT", "8788")))
