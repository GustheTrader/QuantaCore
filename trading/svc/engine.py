from contextlib import contextmanager, ExitStack
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
import functools
import hashlib
import importlib
import inspect
import json
import logging
import math
import re
import threading

import httpx
from langchain_core.callbacks import BaseCallbackHandler

from .contracts import attempt_dir, event, run_id, validate
from .evidence import json_safe
from .results import build_decision
from .worker import redact


NODES = {
    "Market Analyst": "market_analyst", "Sentiment Analyst": "social_analyst",
    "News Analyst": "news_analyst", "Fundamentals Analyst": "fundamentals_analyst",
    "Bull Researcher": "bull_researcher", "Bear Researcher": "bear_researcher",
    "Research Manager": "research_manager", "Trader": "trader",
    "Aggressive Analyst": "aggressive_analyst", "Conservative Analyst": "conservative_analyst",
    "Neutral Analyst": "neutral_analyst", "Portfolio Manager": "portfolio_manager",
}
TOOL_NODE_ROLES = {"tools_market": "market_analyst", "tools_news": "news_analyst",
                   "tools_fundamentals": "fundamentals_analyst"}


@contextmanager
def replace_attribute(target, name, replacement):
    original = getattr(target, name)
    setattr(target, name, replacement)
    try:
        yield
    finally:
        setattr(target, name, original)


class EventCallbacks(BaseCallbackHandler):
    def __init__(self, recorder, emit):
        self.recorder = recorder
        self.emit = emit
        self.started = set()
        self.tools = {}
        self.usage = {"calls": 0, "input_tokens": 0, "output_tokens": 0,
                      "total_tokens": 0, "cost_usd": None, "price_known": False, "estimated": False}
        self._lock = threading.RLock()
        self._llm_started = set()
        self._llm_finished = set()

    def on_chain_start(self, serialized, inputs, *, run_id, metadata=None, **kwargs):
        details = metadata or {}
        native = details.get("langgraph_node")
        node = NODES.get(native) or TOOL_NODE_ROLES.get(native)
        if node is not None:
            self.recorder.current_node = node
        signature = (details.get("langgraph_step"), native)
        if native in NODES and signature not in self.started:
            self.started.add(signature)
            self.emit(event("node.started", node, {"native_node": native, "step": details.get("langgraph_step")}))

    def on_tool_start(self, serialized, input_str, *, run_id, inputs=None, metadata=None, **kwargs):
        name = (serialized or {}).get("name", "unknown_tool")
        node = TOOL_NODE_ROLES.get((metadata or {}).get("langgraph_node")) or self.recorder.current_node
        self.tools[str(run_id)] = (name, node, inputs or {"input": input_str})
        self.emit(event("tool.started", node, {"tool": name, "query": json_safe(inputs or {})}))

    def on_tool_end(self, output, *, run_id, **kwargs):
        name, node, query = self.tools.pop(str(run_id), ("unknown_tool", self.recorder.current_node, {}))
        raw = getattr(output, "content", output)
        item = self.recorder.capture(name, node, "native_tool", query, raw)
        self.emit(event("tool.completed", node, {"tool": name, "evidence": item, "report": str(raw)}))

    def on_tool_error(self, error, *, run_id, **kwargs):
        name, node, query = self.tools.pop(str(run_id), ("unknown_tool", self.recorder.current_node, {}))
        item = self.recorder.capture(name, node, "native_tool", query, "", error=f"{type(error).__name__}: {error}")
        self.emit(event("tool.completed", node, {"tool": name, "evidence": item}))

    def on_chat_model_start(self, serialized, messages, *, run_id, **kwargs):
        with self._lock:
            if str(run_id) not in self._llm_started:
                self._llm_started.add(str(run_id))
                self.usage["calls"] += 1

    def on_llm_end(self, response, *, run_id, **kwargs):
        with self._lock:
            if str(run_id) in self._llm_finished:
                return
            self._llm_finished.add(str(run_id))
            counts = (response.llm_output or {}).get("token_usage", {})
            if not counts:
                for group in response.generations:
                    if group:
                        observed = getattr(group[0].message, "usage_metadata", None) or {}
                        if observed:
                            counts = {"prompt_tokens": observed.get("input_tokens", 0),
                                      "completion_tokens": observed.get("output_tokens", 0),
                                      "total_tokens": observed.get("total_tokens", 0)}
                            break
            for destination, source in (("input_tokens", "prompt_tokens"), ("output_tokens", "completion_tokens"),
                                        ("total_tokens", "total_tokens")):
                self.usage[destination] += max(0, int(counts.get(source, 0)))
            if not counts:
                self.usage["estimated"] = True
            self.emit(event("usage", payload=dict(self.usage)))


class WarningHandler(logging.Handler):
    def __init__(self, recorder, emit, settings):
        super().__init__(logging.WARNING)
        self.recorder, self.dispatch, self.settings = recorder, emit, settings

    def emit(self, record):
        message = redact(record.getMessage(), self.settings)
        self.recorder.warn(message)
        self.emit_event(message)

    def emit_event(self, message):
        self.dispatch(event("warning", self.recorder.current_node, {"message": message}))


def observed_vendor(function, name, vendor, recorder, emit, settings):
    @functools.wraps(function)
    def wrapped(*args, **kwargs):
        try:
            query = inspect.signature(function).bind(*args, **kwargs).arguments
        except (TypeError, ValueError):
            query = {"args": args, **kwargs}
        query = json_safe(query)
        node = recorder.current_node
        emit(event("tool.started", node, {"tool": name, "vendor": vendor, "query": query}))
        try:
            result = function(*args, **kwargs)
        except Exception as exc:
            item = recorder.capture(name, node, vendor, query, "", error=redact(f"{type(exc).__name__}: {exc}", settings))
            emit(event("tool.completed", node, {"tool": name, "vendor": vendor, "evidence": item}))
            raise
        item = recorder.capture(name, node, vendor, query, result)
        emit(event("tool.completed", node, {"tool": name, "vendor": vendor, "evidence": item, "report": item["excerpt"]}))
        return result

    return wrapped


@contextmanager
def observe_native(recorder, emit, settings, structured, structured_directory):
    from tradingagents.agents import context
    from tradingagents.agents.structured import invoke_structured_or_freetext
    from tradingagents.dataflows import router
    from tradingagents.dataflows.vendors.yahoo import snapshot
    from tradingagents.graph import settlement

    with ExitStack() as stack:
        for method, vendors in router.VENDOR_METHODS.items():
            for vendor, implementation in list(vendors.items()):
                original = implementation
                function = implementation[0] if isinstance(implementation, list) else implementation
                wrapper = observed_vendor(function, method, vendor, recorder, emit, settings)
                vendors[vendor] = [wrapper, *implementation[1:]] if isinstance(implementation, list) else wrapper
                stack.callback(vendors.__setitem__, vendor, original)
        stack.enter_context(replace_attribute(snapshot, "_verified_rows",
                            observed_vendor(snapshot._verified_rows, "get_verified_market_snapshot", "yfinance", recorder, emit, settings)))
        stack.enter_context(replace_attribute(context, "get_company_profile",
                            observed_vendor(context.get_company_profile, "instrument_identity", "yfinance", recorder, emit, settings)))
        stack.enter_context(replace_attribute(settlement, "get_closes",
                            observed_vendor(settlement.get_closes, "settlement_prices", "yfinance", recorder, emit, settings)))
        sentiment = importlib.import_module("tradingagents.agents.analysts.sentiment_analyst")
        for name, vendor in (("fetch_reddit_posts", "reddit"), ("fetch_stocktwits_messages", "stocktwits")):
            stack.enter_context(replace_attribute(sentiment, name,
                                observed_vendor(getattr(sentiment, name), name, vendor, recorder, emit, settings)))

        def capture_structured(structured_llm, plain_llm, prompt, render, agent_name):
            def record_and_render(parsed):
                structured[agent_name] = parsed.model_dump(mode="json") if hasattr(parsed, "model_dump") else json_safe(parsed)
                payload = {"agent": agent_name, "parsed": json_safe(structured[agent_name])}
                serialized = json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False)
                native_name = NODES.get(agent_name, "social_analyst") + ".json"
                for destination in (structured_directory, recorder.directory / "structured"):
                    destination.mkdir(parents=True, exist_ok=True)
                    temporary = destination / (native_name + ".tmp")
                    temporary.write_text(serialized, encoding="utf-8")
                    temporary.replace(destination / native_name)
                return render(parsed)
            return invoke_structured_or_freetext(structured_llm, plain_llm, prompt, record_and_render, agent_name)

        for module_name in ("tradingagents.agents.managers.portfolio_manager",
                            "tradingagents.agents.managers.research_manager",
                            "tradingagents.agents.trader.trader",
                            "tradingagents.agents.analysts.sentiment_analyst"):
            module = importlib.import_module(module_name)
            stack.enter_context(replace_attribute(module, "invoke_structured_or_freetext", capture_structured))
        warning_handler = WarningHandler(recorder, emit, settings)
        logging.getLogger("tradingagents").addHandler(warning_handler)
        stack.callback(logging.getLogger("tradingagents").removeHandler, warning_handler)
        yield


def valid_settlement(value, as_of=None):
    if not isinstance(value, dict):
        return False
    for key in ("raw_return", "alpha_return"):
        number = value.get(key)
        if not isinstance(number, (float, int)) or isinstance(number, bool) or not math.isfinite(number):
            return False
    days = value.get("holding_days")
    if not isinstance(days, int) or isinstance(days, bool) or days < 1:
        return False
    try:
        resolved = date.fromisoformat(value.get("resolution_date", ""))
    except (TypeError, ValueError):
        return False
    today = datetime.now(timezone.utc).date()
    cutoff = date.fromisoformat(as_of) if as_of is not None else today
    return resolved <= min(cutoff, today)


def seed_memory(engine, body, recorder, emit):
    selected = {}
    for record in body["past_decisions"]:
        try:
            identifier = run_id(record["id"])
            ticker = record["ticker"]
            trade_date = date.fromisoformat(record["trade_date"]).isoformat()
            raw = record["decision"]
            if not isinstance(ticker, str) or not re.fullmatch(r"[A-Z0-9][A-Z0-9.^=-]{0,23}", ticker) or not isinstance(raw, (dict, str)):
                raise ValueError("Invalid memory entry")
            if trade_date > body["request"]["trade_date"]:
                raise ValueError("Prior decision is beyond the analysis date")
            if isinstance(raw, dict):
                raw = raw.get("raw_text") or f"**Rating**: {raw.get('rating', 'REVIEW')}"
            key = (ticker, trade_date)
            if key in selected:
                recorder.warn("Native memory projects one decision per ticker and date; canonical duplicates remain in the Node journal.")
            selected[key] = {**record, "id": identifier, "raw": str(raw)}
        except (KeyError, TypeError, ValueError):
            recorder.warn("A malformed prior decision was excluded from the derived native memory projection.")
    # The native markdown file is a fresh derived projection for this attempt.
    path = engine.memory_log._log_path
    path.write_text("", encoding="utf-8")
    for (ticker, trade_date), record in selected.items():
        safe_text = record["raw"].replace("<!-- ENTRY_END -->", "[quoted entry delimiter]")
        engine.memory_log.store_decision(ticker, trade_date, safe_text)
        if valid_settlement(record.get("settlement"), body["request"]["trade_date"]):
            settlement = record["settlement"]
            engine.memory_log.update_with_outcome(ticker=ticker, trade_date=trade_date,
                raw_return=settlement["raw_return"], alpha_return=settlement["alpha_return"],
                holding_days=settlement["holding_days"], reflection=str(settlement.get("reflection") or ""),
                resolution_date=settlement["resolution_date"])
    (recorder.directory / "memory-projection-index.json").write_text(json.dumps(
        [{"ticker": ticker, "trade_date": trade_date, "source_run_id": record["id"]} for (ticker, trade_date), record in selected.items()], indent=2), encoding="utf-8")
    original = engine.memory_log.batch_update_with_outcomes

    def settle(updates):
        from tradingagents.graph.settlement import resolve_benchmark

        eligible = [update for update in updates if valid_settlement(update, body["request"]["trade_date"])]
        if len(eligible) != len(updates):
            recorder.warn("Non-finite, invalid, or future native settlement outcomes were excluded at the analysis-date cutoff.")
        original(eligible)
        for update in eligible:
            update = {**update, "benchmark": resolve_benchmark(update["ticker"], getattr(engine, "config", {}))}
            key = (update["ticker"], update["trade_date"])
            if key in selected:
                emit(event("memory.settled", payload={"source_run_id": selected[key]["id"],
                    "ticker": update["ticker"], "trade_date": update["trade_date"],
                    "settlement": {key: json_safe(value) for key, value in update.items() if key not in {"ticker", "trade_date"}}}))
    engine.memory_log.batch_update_with_outcomes = settle
    return selected


def report_from_update(update, node=None):
    texts = []
    for key, value in update.items():
        if isinstance(value, str) and key not in {"sender", "company_of_interest", "trade_date", "asset_type"}:
            texts.append(value)
        elif key in {"investment_debate_state", "risk_debate_state"} and isinstance(value, dict):
            selected = {"aggressive_analyst": "current_aggressive_response",
                        "conservative_analyst": "current_conservative_response",
                        "neutral_analyst": "current_neutral_response"}.get(node)
            if selected:
                texts.append(str(value.get(selected) or ""))
                continue
            texts.append(str(value.get("current_response") or value.get("judge_decision") or
                             value.get("current_aggressive_response") or value.get("current_conservative_response") or
                             value.get("current_neutral_response") or ""))
    return "\n\n".join(texts)


def restore_evidence(recorder, run_directory, attempt, request_hash):
    restored = set()
    for index in (run_directory / "attempts").glob("*/evidence-index.json"):
        try:
            if not index.resolve().is_relative_to(run_directory):
                raise ValueError("Evidence index escaped run directory")
            previous_attempt = int(index.parent.name)
            if previous_attempt >= attempt:
                continue
            reference = json.loads((index.parent / "checkpoint-reference.json").read_text(encoding="utf-8"))
            if reference.get("request_sha256") != request_hash:
                continue
            items = json.loads(index.read_text(encoding="utf-8"))
            for item in items:
                validate("Evidence", item)
                match = re.fullmatch(r"attempts/([1-9][0-9]*)/evidence/([a-f0-9-]{36})\.json", item.get("artifact") or "")
                if match is None or int(match.group(1)) >= attempt or match.group(2) != item["id"]:
                    raise ValueError("Invalid prior evidence artifact path")
                if item["as_of"] != recorder.as_of:
                    raise ValueError("Prior evidence cutoff differs from this run")
                artifact = (run_directory / item["artifact"]).resolve()
                if not artifact.is_relative_to(run_directory):
                    raise ValueError("Evidence artifact escaped run directory")
                content = artifact.read_bytes()
                if hashlib.sha256(content).hexdigest() != item["sha256"]:
                    raise ValueError("Prior evidence artifact hash mismatch")
                raw = json.loads(content)
                recorder.include_prior(item, raw.get("raw"))
                restored.add(int(match.group(1)))
        except Exception as exc:
            recorder.warn(f"Prior evidence was excluded during checkpoint recovery: {type(exc).__name__}: {exc}")
    if restored:
        recorder.warn("Native checkpoint recovery retained hash-verified evidence from attempts " + ", ".join(str(value) for value in sorted(restored)) + ".")


def restore_structured(directory, captured, recorder):
    for file in directory.glob("*.json"):
        try:
            parsed = json.loads(file.read_text(encoding="utf-8"))
            if parsed.get("agent") in NODES and isinstance(parsed.get("parsed"), dict):
                captured[parsed["agent"]] = parsed["parsed"]
        except (ValueError, OSError):
            recorder.warn("A saved native structured output was unreadable during checkpoint recovery.")


def run_research(body, settings, recorder, emit, operation="execute"):
    from tradingagents.dataflows.config import run_config
    from tradingagents.dataflows.router import route_to_vendor
    from tradingagents.default_config import DEFAULT_CONFIG
    from tradingagents.graph import trading_graph
    from tradingagents.graph.settlement import resolve_benchmark
    from tradingagents.portfolio import PortfolioContext

    request = body["request"]
    request_hash = hashlib.sha256(json.dumps(request, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()
    run_directory = attempt_dir(settings, body["run_id"], body["attempt"]).parents[1]
    checkpoint_directory = (run_directory / "checkpoints" / request_hash / "cache").resolve()
    if not checkpoint_directory.is_relative_to(run_directory):
        raise ValueError("Checkpoint namespace escaped the run directory")
    structured_directory = checkpoint_directory.parent / "structured"
    (recorder.directory / "checkpoint-reference.json").write_text(json.dumps(
        {"request_sha256": request_hash, "namespace": checkpoint_directory.relative_to(run_directory).as_posix()}, indent=2), encoding="utf-8")
    configuration = deepcopy(DEFAULT_CONFIG)
    configuration.update({
        "results_dir": str(recorder.directory / "native-results"),
        "data_cache_dir": str(checkpoint_directory),
        "memory_log_path": str(recorder.directory / "native-memory.md"),
        "llm_provider": "openai_compatible", "deep_think_llm": request["models"]["deep"],
        "quick_think_llm": request["models"]["quick"],
        "backend_url": f"{settings.sidecar_url}/llm/{body['run_id']}/v1",
        "llm_max_retries": 0, "max_tokens": request["budget"]["max_output_tokens"],
        "max_debate_rounds": request["debate_rounds"], "max_risk_discuss_rounds": request["risk_rounds"],
        "checkpoint_enabled": True, "output_language": "English",
    })
    benchmark = resolve_benchmark(request["ticker"], configuration)
    callbacks = EventCallbacks(recorder, emit)
    captured = {}
    client = httpx.Client(headers={"X-Gnoesis-Attempt": str(body["attempt"])},
                          timeout=httpx.Timeout(min(180, request["budget"]["max_duration_seconds"]), connect=5),
                          follow_redirects=False, trust_env=False, transport=httpx.HTTPTransport(retries=0))
    factory = trading_graph.create_llm_client

    def local_client(provider, model, base_url=None, **kwargs):
        return factory(provider, model, base_url, **{**kwargs, "api_key": settings.gateway_token, "http_client": client})

    try:
        with replace_attribute(trading_graph, "create_llm_client", local_client), \
                observe_native(recorder, emit, settings, captured, structured_directory):
            engine = trading_graph.TradingAgentsGraph(selected_analysts=request["selected_analysts"],
                                                       config=configuration, callbacks=[callbacks])
            seed_memory(engine, body, recorder, emit)
            portfolio = PortfolioContext.model_validate(request["portfolio"]) if request["portfolio"] is not None else None
            if request["mode"] == "evaluation":
                recorder.warn("Historical runs are workflow evaluations. News, social posts, identity, and fundamentals are not independently audited point-in-time archives.")
            if operation == "settle":
                settlements = []
                original_emit = emit
                # Count only settlement updates emitted for canonical prior run IDs.
                original_batch = engine.memory_log.batch_update_with_outcomes
                def counted(updates):
                    settlements.extend(update for update in updates if valid_settlement(update, request["trade_date"]))
                    original_batch(updates)
                engine.memory_log.batch_update_with_outcomes = counted
                engine.settle_pending(request["ticker"])
                emit(event("usage", payload=callbacks.usage))
                original_emit(event("heartbeat", payload={"operation": "settle", "complete": True, "settled_count": len(settlements)}))
                return None
            prior_step = trading_graph.checkpoint_step(configuration["data_cache_dir"], request["ticker"], request["trade_date"], engine._run_signature("stock", portfolio))
            if prior_step is not None:
                restore_evidence(recorder, run_directory, body["attempt"], request_hash)
                restore_structured(structured_directory, captured, recorder)
            recorder.current_node = "market_analyst"
            start = (date.fromisoformat(request["trade_date"]) - timedelta(days=60)).isoformat()
            with run_config(configuration):
                try:
                    preflight = route_to_vendor("get_stock_data", request["ticker"], start, request["trade_date"])
                    # Preserve final router sentinels as well as individual vendor attempts.
                    recorder.capture("get_stock_data", "market_analyst", "configured_chain",
                                     {"symbol": request["ticker"], "start_date": start, "end_date": request["trade_date"]}, preflight)
                except Exception as exc:
                    recorder.warn(redact(f"Essential price preflight failed: {type(exc).__name__}: {exc}", settings))
            if not recorder.price_ready:
                emit(event("warning", "market_analyst", {"message": "Essential price gate failed; manual review is required."}))
                return build_decision({"final_trade_decision": "**Rating**: REVIEW\n\n**Executive Summary**: Essential price data was unavailable; no supported directional conclusion."}, recorder, benchmark=benchmark)
            final_state = {}
            with run_config(configuration), engine.checkpoint_scope(request["ticker"], request["trade_date"], "stock", portfolio) as checkpoint_id:
                initial = engine.create_run_state(request["ticker"], request["trade_date"], "stock", portfolio)
                args = engine.propagator.get_graph_args(callbacks=[callbacks])
                args["stream_mode"] = ["updates", "values"]
                if checkpoint_id is not None:
                    args["config"].setdefault("configurable", {})["thread_id"] = checkpoint_id
                for mode, chunk in engine.graph.stream(engine.checkpoint_input(initial), **args):
                    if mode == "values":
                        final_state = chunk
                    elif mode == "updates":
                        for native_node, update in chunk.items():
                            node = NODES.get(native_node)
                            if node is not None and isinstance(update, dict):
                                    emit(event("node.completed", node, {"native_node": native_node,
                                                                       "report": report_from_update(update, node),
                                                                       "structured": json_safe(captured.get(native_node))}))
                engine._log_state(request["trade_date"], final_state)
                engine.record_decision(request["ticker"], request["trade_date"], final_state)
                engine.save_reports(final_state, request["ticker"], recorder.directory / "reports")
                engine.clear_checkpoint_on_success(request["ticker"], request["trade_date"], "stock", portfolio)
            emit(event("usage", payload=callbacks.usage))
            return build_decision(final_state, recorder, structured=captured.get("Portfolio Manager"), trader=captured.get("Trader"), benchmark=benchmark)
    finally:
        client.close()
