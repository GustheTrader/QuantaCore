import json

from svc.evidence import EvidenceRecorder
from svc.results import build_decision


def test_no_data_is_review_and_snapshot_hashed(tmp_path):
    recorder = EvidenceRecorder(tmp_path, "2026-09-25")
    evidence = recorder.capture("get_stock_data", "market_analyst", "yfinance",
                                {"symbol": "AAPL"}, "NO_DATA_AVAILABLE: no usable data")
    decision = build_decision({"final_trade_decision": "**Rating**: Buy\n\n**Executive Summary**: confident"},
                              recorder)
    assert evidence["status"] == "no_data"
    assert decision["rating"] == "REVIEW"
    assert decision["data_status"] == "insufficient"
    assert decision["entry_price"] is None
    assert decision["source"] == "rendered_text"
    artifact = tmp_path / evidence["artifact"]
    assert artifact.is_file()
    assert len(evidence["sha256"]) == 64
    assert "NO_DATA_AVAILABLE" in artifact.read_text()


def test_structured_price_finite_and_asof_required(tmp_path):
    recorder = EvidenceRecorder(tmp_path, "2026-09-25")
    recorder.capture("get_verified_market_snapshot", "market_analyst", "yfinance", {},
                     json.dumps({"latest_row": {"date": "2026-09-25", "close": 100.0}}))
    decision = build_decision({"final_trade_decision": "**Rating**: Hold"}, recorder,
                              structured={"rating": "Hold", "executive_summary": "Review",
                                          "investment_thesis": "Evidence", "price_target": float("nan")})
    assert decision["data_status"] == "ready"
    assert decision["price_target"] is None
    assert decision["source"] == "structured"
    assert any("finite" in warning for warning in decision["warnings"])


def test_future_price_and_bare_text_claim_are_not_essential_evidence(tmp_path):
    recorder = EvidenceRecorder(tmp_path, "2026-09-25")
    recorder.capture("get_verified_market_snapshot", "market_analyst", "yfinance", {},
                     json.dumps({"latest_row": {"date": "2026-09-28", "close": 100.0}}))
    recorder.capture("get_stock_data", "market_analyst", "yfinance", {}, "AAPL is at $100.")
    assert build_decision({"final_trade_decision": "**Rating**: Buy"}, recorder)["rating"] == "REVIEW"


def test_other_ticker_cannot_satisfy_price_gate(tmp_path):
    recorder = EvidenceRecorder(tmp_path, "2026-09-25", expected_symbol="AAPL")
    recorder.capture("get_stock_data", "market_analyst", "yfinance", {"symbol": "MSFT"},
                     {"latest_row": {"date": "2026-09-25", "close": 100}})
    assert not recorder.price_ready
    assert any("different ticker" in warning for warning in recorder.warnings)
