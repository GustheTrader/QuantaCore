from copy import deepcopy
from uuid import uuid4

import pytest


@pytest.fixture
def worker_request():
    return {
        "run_id": str(uuid4()),
        "attempt": 1,
        "request": {
            "ticker": "AAPL",
            "trade_date": "2026-09-25",
            "asset_type": "stock",
            "models": {"deep": "openai/gpt-6-sol", "quick": "openai/gpt-6-luna"},
            "selected_analysts": ["market", "social", "news", "fundamentals"],
            "debate_rounds": 1,
            "risk_rounds": 1,
            "budget": {"max_calls": 50, "max_tokens": 100000,
                       "max_output_tokens": 512, "max_duration_seconds": 60,
                       "max_cost_usd": None},
            "portfolio": None,
            "mode": "fixture",
            "confirmed": True,
        },
        "past_decisions": [],
    }


@pytest.fixture
def settings(tmp_path):
    from svc.config import Settings

    return Settings(service_token="test-service", gateway_token="test-gateway",
                    data_dir=tmp_path / "data", test_mode=True)


@pytest.fixture
def app(settings):
    from svc.main import create_app

    return create_app(settings)


def clone(value):
    return deepcopy(value)
