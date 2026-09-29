import json
import os
import traceback
from uuid import uuid4

PROVIDER_SECRETS = (
    "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY",
    "AZURE_OPENAI_API_KEY", "XAI_API_KEY", "DEEPSEEK_API_KEY", "DASHSCOPE_API_KEY",
    "DASHSCOPE_CN_API_KEY", "ZHIPU_API_KEY", "ZHIPU_CN_API_KEY", "MINIMAX_API_KEY",
    "MINIMAX_CN_API_KEY", "OPENROUTER_API_KEY", "MISTRAL_API_KEY", "MOONSHOT_API_KEY",
    "GROQ_API_KEY", "NVIDIA_API_KEY", "OPENAI_COMPATIBLE_API_KEY",
    "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN",
    "LANGCHAIN_API_KEY", "LANGSMITH_API_KEY",
    "TYPESAFE_API_KEY",
)


def redact(text, settings):
    for secret in (settings.service_token, settings.gateway_token):
        if secret:
            text = text.replace(secret, "[redacted]")
    return text


def run_child(body, settings, operation, output):
    from .watchdog import start_watchdog

    watchdog = start_watchdog([settings.owner_pid, os.getppid()], lambda: os._exit(0))
    from .contracts import attempt_dir, event
    from .evidence import EvidenceRecorder

    directory = None
    for key in PROVIDER_SECRETS:
        os.environ.pop(key, None)
    # The sole SDK credential is the local gateway credential.
    os.environ["OPENAI_COMPATIBLE_API_KEY"] = settings.gateway_token
    os.environ["LANGSMITH_TRACING"] = "false"
    os.environ["LANGCHAIN_TRACING_V2"] = "false"
    try:
        directory = attempt_dir(settings, body["run_id"], body["attempt"])
        if operation == "settle":
            directory = directory / "settlements" / str(uuid4())
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "request.json").write_text(json.dumps(body, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
        run_directory = settings.data_dir / "runs" / body["run_id"]
        recorder = EvidenceRecorder(directory, body["request"]["trade_date"],
                                    artifact_prefix=directory.relative_to(run_directory).as_posix() + "/",
                                    expected_symbol=body["request"]["ticker"])
        if settings.test_mode and body["request"]["mode"] == "fixture":
            from .fixture import run_fixture

            decision = run_fixture(body, recorder, output.put, operation)
        else:
            from .engine import run_research

            decision = run_research(body, settings, recorder, output.put, operation)
        (directory / "evidence-index.json").write_text(json.dumps(recorder.items, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
        if decision is not None:
            (directory / "decision.json").write_text(json.dumps(decision, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
            output.put(event("result", payload=decision))
    except BaseException as exc:
        error_id = str(uuid4())
        detail = redact(f"{type(exc).__name__}: {exc}", settings)
        if directory is not None:
            (directory / f"error-{error_id}.txt").write_text(redact(traceback.format_exc(), settings), encoding="utf-8")
        body_error = getattr(exc, "body", None)
        code = "WORKER_FAILED"
        if isinstance(body_error, dict):
            provider_error = body_error.get("error", body_error)
            if isinstance(provider_error, dict):
                code = provider_error.get("code", code)
        if not isinstance(code, str):
            code = "WORKER_FAILED"
        output.put(event("error", payload={"code": code, "message": detail[:1200], "error_id": error_id}))
    finally:
        output.put(None)
        watchdog.set()
