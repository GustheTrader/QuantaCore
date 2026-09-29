from datetime import date
import json
from uuid import uuid4
from copy import deepcopy

import pytest

from svc.contracts import attempt_dir, validate
from svc.evidence import EvidenceRecorder


def test_actual_compiled_tradingagents_graph_with_fixture_llm(worker_request, settings, tmp_path, monkeypatch):
    """The real pinned graph runs all roles and native lifecycle without network or paid calls."""
    from langchain_core.language_models.chat_models import BaseChatModel
    from langchain_core.messages import AIMessage
    from langchain_core.outputs import ChatGeneration, ChatResult
    from langchain_core.runnables import RunnableLambda
    from tradingagents.agents import context
    from tradingagents.agents.analysts import sentiment_analyst
    from tradingagents.dataflows import router
    from tradingagents.graph import trading_graph

    from svc.engine import NODES, run_research

    schema_payloads = {
        "PortfolioDecision": {"rating": "Hold", "executive_summary": "TEST FIXTURE: synthetic evidence only.",
                              "investment_thesis": "TEST FIXTURE: native graph protocol verified.",
                              "price_target": 110.0, "time_horizon": "5 trading days"},
        "TraderProposal": {"action": "Hold", "reasoning": "TEST FIXTURE", "entry_price": 100.0,
                           "stop_loss": 90.0, "position_sizing": None},
        "ResearchPlan": {"recommendation": "Hold", "rationale": "TEST FIXTURE", "strategic_actions": "Research only."},
        "SentimentReport": {"overall_band": "Neutral", "overall_score": 5.0, "confidence": "low", "narrative": "TEST FIXTURE"},
    }
    control = {"calls": 0, "fail": False}

    class TestLLM(BaseChatModel):
        @property
        def _llm_type(self):
            return "native-integration-test"

        def _generate(self, messages, stop=None, run_manager=None, **kwargs):
            control["calls"] += 1
            if control["fail"] and control["calls"] == 4:
                raise RuntimeError("TEST FIXTURE: interrupted at first bull research call")
            return ChatResult(generations=[ChatGeneration(message=AIMessage(content="TEST FIXTURE: report from supplied synthetic evidence."))],
                              llm_output={"token_usage": {"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20}})

        def bind_tools(self, tools, **kwargs):
            return self

        def with_structured_output(self, schema, **kwargs):
            return RunnableLambda(lambda value: schema.model_validate(schema_payloads[schema.__name__]))

    class TestClient:
        def get_llm(self):
            return TestLLM()

    monkeypatch.setattr(trading_graph, "create_llm_client", lambda *args, **kwargs: TestClient())
    monkeypatch.setattr(context, "get_company_profile", lambda ticker: {"longName": "TEST FIXTURE", "quoteType": "EQUITY"})
    context.resolve_instrument_identity.cache_clear()
    monkeypatch.setattr(sentiment_analyst, "fetch_stocktwits_messages", lambda *args, **kwargs: "TEST FIXTURE: no social messages")
    monkeypatch.setattr(sentiment_analyst, "fetch_reddit_posts", lambda *args, **kwargs: "TEST FIXTURE: no social posts")
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)
    for method, vendors in router.VENDOR_METHODS.items():
        for vendor in list(vendors):
            if method == "get_stock_data":
                monkeypatch.setitem(vendors, vendor, lambda *args, **kwargs: "Date,Open,High,Low,Close,Volume\n2026-09-25,100,101,99,100,1000\n")
            else:
                monkeypatch.setitem(vendors, vendor, lambda *args, **kwargs: "TEST FIXTURE: synthetic source block")
    worker_request["request"]["mode"] = "research"
    recorder = EvidenceRecorder(tmp_path, worker_request["request"]["trade_date"])
    recorder.warn("TEST FIXTURE: actual compiled graph with synthetic model and data inputs.")
    output = []
    decision = run_research(worker_request, settings, recorder, output.append)
    validate("Decision", decision)
    for record in output:
        validate("WorkerEvent", record)
    completed = {record["node_id"] for record in output if record["type"] == "node.completed"}
    assert completed == set(NODES.values())
    assert len(completed) == 12
    assert decision["source"] == "structured"
    assert decision["rating"] == "Hold"
    assert decision["entry_price"] == 100.0
    assert decision["stop_loss"] == 90.0
    assert decision["price_target"] == 110.0
    assert decision["data_status"] == "ready"
    assert decision["research_only"] is True
    assert list((tmp_path / "reports").rglob("*.md"))
    assert list((tmp_path / "native-results").rglob("full_states_log_*.json"))
    assert (tmp_path / "native-memory.md").is_file()
    assert list((settings.data_dir / "runs" / worker_request["run_id"] / "checkpoints").rglob("*.db"))
    assert decision["evidence"]
    # A different attempt resumes the same frozen request after a real native-node failure.
    resumed_request = deepcopy(worker_request)
    resumed_request["run_id"] = str(uuid4())
    interrupted_directory = attempt_dir(settings, resumed_request["run_id"], 1)
    interrupted_directory.mkdir(parents=True)
    interrupted = EvidenceRecorder(interrupted_directory, resumed_request["request"]["trade_date"], artifact_prefix="attempts/1/")
    control.update(calls=0, fail=True)
    with pytest.raises(RuntimeError, match="interrupted at first bull"):
        run_research(resumed_request, settings, interrupted, lambda value: None)
    resumed_request["attempt"] = 2
    resumed_directory = attempt_dir(settings, resumed_request["run_id"], 2)
    resumed_directory.mkdir(parents=True)
    resumed = EvidenceRecorder(resumed_directory, resumed_request["request"]["trade_date"], artifact_prefix="attempts/2/")
    control.update(calls=0, fail=False)
    resumed_output = []
    resumed_decision = run_research(resumed_request, settings, resumed, resumed_output.append)
    assert resumed_decision["rating"] == "Hold"
    resumed_nodes = {record["node_id"] for record in resumed_output if record["type"] == "node.completed"}
    assert "portfolio_manager" in resumed_nodes
    assert not resumed_nodes.intersection({"market_analyst", "social_analyst", "news_analyst", "fundamentals_analyst"})
    assert json.loads((interrupted_directory / "checkpoint-reference.json").read_text())["namespace"] == json.loads((resumed_directory / "checkpoint-reference.json").read_text())["namespace"]
    retained_ids = {item["id"] for item in interrupted.items}
    assert retained_ids.issubset({item["id"] for item in resumed_decision["evidence"]})
    assert any("hash-verified evidence" in warning for warning in resumed_decision["warnings"])


def test_native_memory_settlement_preserves_canonical_source_id(worker_request, settings, tmp_path, monkeypatch):
    from tradingagents.decision_log import TradingMemoryLog

    from svc.engine import seed_memory

    class MemoryEngine:
        memory_log = TradingMemoryLog({"memory_log_path": str(tmp_path / "native-memory.md")})

    source_one, source_two = str(uuid4()), str(uuid4())
    raw = {"raw_text": "**Rating**: Hold\n\n**Executive Summary**: source research"}
    worker_request["past_decisions"] = [
        {"id": source_one, "ticker": "AAPL", "trade_date": "2026-09-15", "decision": raw, "settlement": None},
        {"id": source_two, "ticker": "AAPL", "trade_date": "2026-09-15", "decision": raw, "settlement": None},
    ]
    original = json.dumps(worker_request["past_decisions"], sort_keys=True)
    recorder = EvidenceRecorder(tmp_path, "2026-09-25")
    output = []
    engine = MemoryEngine()
    seed_memory(engine, worker_request, recorder, output.append)
    assert len(engine.memory_log.load_entries()) == 1
    update = {"ticker": "AAPL", "trade_date": "2026-09-15", "raw_return": 0.02,
              "alpha_return": 0.01, "holding_days": 5, "reflection": "TEST FIXTURE: lesson",
              "resolution_date": "2026-09-22"}
    engine.memory_log.batch_update_with_outcomes([update])
    assert output[0]["type"] == "memory.settled"
    assert output[0]["payload"]["source_run_id"] == source_two
    assert output[0]["payload"]["settlement"]["raw_return"] == 0.02
    assert json.dumps(worker_request["past_decisions"], sort_keys=True) == original
    assert (tmp_path / "memory-projection-index.json").is_file()
    assert any("canonical duplicates" in warning for warning in recorder.warnings)


def test_future_settlement_is_not_seeded_or_emitted(worker_request, tmp_path):
    from tradingagents.decision_log import TradingMemoryLog
    from svc.engine import seed_memory

    class MemoryEngine:
        memory_log = TradingMemoryLog({"memory_log_path": str(tmp_path / "memory.md")})
        config = {"benchmark_map": {".T": "^N225", "": "SPY"}}

    worker_request["request"]["trade_date"] = "2026-09-15"
    future = {"raw_return": 0.05, "alpha_return": 0.01, "holding_days": 5,
              "reflection": "Future lesson", "resolution_date": "2026-09-22"}
    worker_request["past_decisions"] = [{"id": str(uuid4()), "ticker": "7203.T", "trade_date": "2026-09-10",
                                         "decision": "**Rating**: Hold", "settlement": future}]
    recorder = EvidenceRecorder(tmp_path, "2026-09-15")
    output = []
    engine = MemoryEngine()
    seed_memory(engine, worker_request, recorder, output.append)
    assert engine.memory_log.get_pending_entries()
    engine.memory_log.batch_update_with_outcomes([{**future, "ticker": "7203.T", "trade_date": "2026-09-10"}])
    assert not output
    eligible = {**future, "resolution_date": "2026-09-15", "ticker": "7203.T", "trade_date": "2026-09-10"}
    engine.memory_log.batch_update_with_outcomes([eligible])
    assert output[0]["payload"]["settlement"]["benchmark"] == "^N225"
    assert any("analysis-date cutoff" in warning for warning in recorder.warnings)


def test_each_risk_role_receives_its_own_report():
    from svc.engine import report_from_update

    update = {"risk_debate_state": {"current_aggressive_response": "aggressive",
              "current_conservative_response": "conservative", "current_neutral_response": "neutral"}}
    assert report_from_update(update, "aggressive_analyst") == "aggressive"
    assert report_from_update(update, "conservative_analyst") == "conservative"
    assert report_from_update(update, "neutral_analyst") == "neutral"
