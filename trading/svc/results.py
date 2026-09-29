import re

from .contracts import validate
from .evidence import numeric


RATINGS = {"Buy", "Overweight", "Hold", "Underweight", "Sell", "REVIEW"}
REPORT_FIELDS = ("market_report", "sentiment_report", "news_report", "fundamentals_report",
                 "investment_plan", "trader_investment_plan", "final_trade_decision")


def section(raw, label):
    match = re.search(rf"\*\*{re.escape(label)}\*\*:\s*(.*?)(?=\n\s*\*\*[^*]+\*\*:|\Z)", raw, re.S)
    return match.group(1).strip() if match else ""


def build_decision(state, recorder, *, structured=None, trader=None, source=None, benchmark="SPY"):
    raw = str(state.get("final_trade_decision") or "")
    warnings = list(recorder.warnings)
    fields = structured or {}
    rating = fields.get("rating") or section(raw, "Rating")
    rating = rating.strip(" *\n") if isinstance(rating, str) else "REVIEW"
    if rating not in RATINGS:
        rating = "REVIEW"
        warnings.append("The engine returned no parseable final rating; manual review is required.")
    decision = {
        "rating": rating,
        "executive_summary": fields.get("executive_summary") or section(raw, "Executive Summary") or "Review the original research output.",
        "investment_thesis": fields.get("investment_thesis") or section(raw, "Investment Thesis") or raw,
        "price_target": None, "time_horizon": fields.get("time_horizon") or None,
        "entry_price": None, "stop_loss": None,
        "position_sizing": (trader or {}).get("position_sizing") or None,
        "raw_text": raw,
        "reports": {field: str(state[field]) for field in REPORT_FIELDS if state.get(field)},
        "evidence": list(recorder.items), "warnings": warnings,
        "data_status": "ready" if recorder.price_ready else "insufficient",
        "research_only": True,
        "source": source or ("structured" if structured is not None else "rendered_text"),
        "baseline": ({"entry_date": recorder.latest_price["date"],
                      "entry_close": recorder.latest_price["close"], "benchmark": benchmark,
                      "holding_period_days": 5, "method": "close_to_close",
                      "costs_included": False, "predictive_performance_validated": False}
                     if recorder.price_ready else None),
    }
    for field, value in (("price_target", fields.get("price_target")),
                         ("entry_price", (trader or {}).get("entry_price")),
                         ("stop_loss", (trader or {}).get("stop_loss"))):
        decision[field] = numeric(value)
        if value is not None and decision[field] is None:
            warnings.append(f"{field} was not a finite positive price and was left unset.")
    if not recorder.price_ready:
        decision.update(rating="REVIEW", price_target=None, entry_price=None, stop_loss=None,
                        position_sizing=None, time_horizon=None)
        warnings.append("Essential price evidence is missing, stale, or non-finite. The run requires manual review.")
    if decision["source"] == "rendered_text":
        warnings.append("The native engine returned rendered text; missing numeric fields remain null.")
    warnings.append("Tool evidence is retained for review; narrative claims and predictive edge are not independently validated.")
    return validate("Decision", decision)
