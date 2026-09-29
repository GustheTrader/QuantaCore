import time
import os

from .contracts import event
from .results import build_decision


ROLE_IDS = (
    "market_analyst", "social_analyst", "news_analyst", "fundamentals_analyst",
    "bull_researcher", "bear_researcher", "research_manager", "trader",
    "aggressive_analyst", "conservative_analyst", "neutral_analyst", "portfolio_manager",
)


def run_fixture(body, recorder, emit, operation):
    emit(event("warning", payload={"message": "FIXTURE: deterministic protocol check; no live research or predictive performance."}))
    if operation == "settle":
        emit(event("heartbeat", payload={"operation": "settle", "complete": True, "settled_count": 0}))
        return None
    for node in ROLE_IDS:
        emit(event("node.started", node, {"fixture": True, "worker_pid": os.getpid()}))
        recorder.current_node = node
        if node == "market_analyst":
            for record in body["past_decisions"]:
                delay = record.get("fixture_block_seconds", 0)
                if isinstance(delay, (int, float)) and delay > 0:
                    time.sleep(min(delay, 60))
            emit(event("tool.started", node, {"tool": "get_stock_data", "vendor": "fixture"}))
            evidence = recorder.capture("get_stock_data", node, "fixture", {"symbol": body["request"]["ticker"]},
                                        {"latest_row": {"date": body["request"]["trade_date"], "close": 100.0}})
            emit(event("tool.completed", node, {"tool": "get_stock_data", "evidence": evidence, "fixture": True}))
        emit(event("node.completed", node, {"report": f"FIXTURE: {node} protocol completed.", "fixture": True}))
    recorder.warn("FIXTURE: deterministic protocol check. Prices and analysis are synthetic; no trading edge is implied.")
    decision = build_decision({"final_trade_decision": "**Rating**: REVIEW\n\n**Executive Summary**: FIXTURE protocol check.\n\n**Investment Thesis**: No market conclusion."},
                              recorder, source="fixture")
    emit(event("usage", payload={"calls": 0, "input_tokens": 0, "output_tokens": 0,
                                 "total_tokens": 0, "cost_usd": None, "price_known": False, "estimated": False}))
    return decision
