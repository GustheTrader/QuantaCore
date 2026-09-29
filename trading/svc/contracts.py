from datetime import date, datetime, timezone
from functools import lru_cache
import json
import math
from pathlib import Path
from uuid import UUID

from jsonschema import Draft202012Validator


SCHEMA_PATH = Path(__file__).resolve().parents[2] / "contracts" / "research.schema.json"


@lru_cache(maxsize=1)
def schema():
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8-sig"))


@lru_cache(maxsize=16)
def validator(name):
    return Draft202012Validator({**schema(), "$ref": f"#/$defs/{name}"})


def finite_json(value):
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("JSON numbers must be finite")
    if isinstance(value, dict):
        for item in value.values():
            finite_json(item)
    elif isinstance(value, list):
        for item in value:
            finite_json(item)


def validate(name, value):
    finite_json(value)
    validator(name).validate(value)
    return value


def run_id(value):
    try:
        canonical = str(UUID(value))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValueError("run_id must be a canonical UUID") from exc
    if value != canonical:
        raise ValueError("run_id must be a canonical lowercase UUID")
    return canonical


def validate_worker_request(value):
    validate("WorkerRequest", value)
    run_id(value["run_id"])
    parsed = date.fromisoformat(value["request"]["trade_date"])
    if parsed.isoformat() != value["request"]["trade_date"] or parsed > datetime.now(timezone.utc).date():
        raise ValueError("trade_date must be a valid date no later than today")
    return value


def attempt_dir(settings, identifier, attempt):
    run_id(identifier)
    if not isinstance(attempt, int) or isinstance(attempt, bool) or attempt < 1:
        raise ValueError("attempt must be a positive integer")
    root = settings.data_dir.resolve()
    target = (root / "runs" / identifier / "attempts" / str(attempt)).resolve()
    if not target.is_relative_to(root):
        raise ValueError("Run artifact path escaped the data directory")
    return target


def event(kind, node_id=None, payload=None):
    return validate("WorkerEvent", {"type": kind, "node_id": node_id, "payload": payload or {}})
