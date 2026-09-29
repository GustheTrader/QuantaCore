# PRD — Quanta OS "Trading Research Core"
## Product Requirements Document · QuantaCore × TradingAgents

Version: 1.0 (proposed)  |  Date: 2026-09-28  |  Owner: jeffg  |  Status: Draft for review
Architecture reference: C:/QuantaCore/docs/ARCHITECTURE_TRADING_CORE.md

---

## 1. Problem

Quanta OS sells a trading story it cannot back: Council.tsx shows a 9-agent trading roster with zero pipeline behind it, edgeService renders *simulated* HFT execution logs as if real, and there is no market data, no decision process, no ledger, and no way to evaluate past calls. Meanwhile TradingAgents (Apache-2.0, LangGraph) implements a real, research-validated multi-agent trading pipeline — but it is a headless Python library with no workspace, no provider management, and no key security.

## 2. Goal

One local-first system: Quanta OS as the operator console and LLM gateway; TradingAgents as the decision engine behind it. A user picks a ticker, watches the real debate pipeline run live (analysts → bull/bear → trader → risk → PM), gets a structured decision with full audit trail, and can backtest the whole loop — all inference routed through Quanta's encrypted provider store, nothing leaving the machine except provider API calls.

Non-goals (explicit):
- Live order execution, brokerage integration, or account connections. HARD BOUNDARY — final decisions terminate in the UI, never in a market.
- Rewriting TradingAgents' agent logic or forking its graph.
- Multi-tenant/cloud trading. The hosted Vercel demo stays as-is (free OpenRouter route, rate-limited, no trading features).

## 3. Users & success

Primary: jeffg (single operator, local-first, sovereign-data stance, quant desk habits — wants evidence, full debate trail, honest error surfacing).

Success criteria (v1.0):
1. `POST /api/trading/runs` completes end-to-end for a stock ticker and returns a PortfolioDecision with rating/thesis/price target + complete per-agent report trail.
2. Council surface shows live pipeline state during a run (SSE, node-by-node) — no fake logs anywhere in the trading UI.
3. Decisions persist in a queryable ledger; after holding_period_days the settlement + reflection appears automatically on the ticker's next run.
4. Backtest of ≥3 tickers × ≥4 dates runs to completion with alpha scores per rating.
5. Zero provider keys outside provider-store; sidecar authenticates to /v1 via loopback token.
6. Every data-vendor or LLM failure is surfaced verbatim to the UI (no silent degradation).

## 4. Functional requirements

FR-1 Run orchestration
- FR-1.1 Create run: ticker, optional trade_date, asset_type (stock|crypto), optional portfolio context, optional config overrides (debate rounds, deep/quick models, selected analysts).
- FR-1.2 Runs execute in a Python sidecar (FastAPI, 127.0.0.1:8787) wrapping TradingAgentsGraph.propagate.
- FR-1.3 Node-level state deltas stream to the UI (SSE) mapped onto Council roster slots (analyst seats, bull/bear, trader, risk trio, PM).
- FR-1.4 Run history with status (queued/running/done/error/cancelled), resumable via TradingAgents checkpoint mode.
- FR-1.5 Pre-run cost estimate: models × rounds × expected tokens, shown before confirm.

FR-2 Decision & memory
- FR-2.1 Final decision schema: 5-tier rating, executive summary, thesis, price target, time horizon, trader proposal (entry/stop/size).
- FR-2.2 Full debate trail persisted per decision (every analyst report, every debate turn, every risk turn).
- FR-2.3 Ledger view: filter by ticker/rating/date; settlement status once holding period elapses; benchmark used; realized alpha.
- FR-2.4 Reflections (TradingAgents native) surfaced as "lessons learned" cards on the ticker page.

FR-3 Backtesting
- FR-3.1 Grid runner (tickers × dates × every N days), run_id resume, progress stream.
- FR-3.2 Results table: per rating-settlement alpha, aggregated by ticker and by rating tier.
- FR-3.3 Reuse TA decision log; no parallel truth — one ledger.

FR-4 Provider bridging
- FR-4.1 Sidecar LLM config: llm_provider=openai_compatible, backend_url=http://127.0.0.1:3000/v1, one loopback token minted by provider-store.
- FR-4.2 Model selection UI: deep-think vs quick-think models chosen from the existing provider routes.
- FR-4.3 Cost/latency attribution per run (tokens by agent node) written to the run record.

FR-5 Workspace integration
- FR-5.1 Council.tsx rebuilt as live pipeline view (roster slots bound to real nodes; simulated edgeService HFT output removed from trading surfaces or clearly badged SIMULATED).
- FR-5.2 CLI: `quanta trading run|status|decisions|backtest` subcommands.
- FR-5.3 Trading run artifacts (decision, trail, reports) saved as workspace documents viewable in Notebook/Projects.

## 5. Non-functional requirements

- NFR-1 Local-first: all state under C:/QuantaCore/data/trading/ (results/cache/memory redirected from ~/.tradingagents). No telemetry added.
- NFR-2 Latency: run creation <1s; SSE first event <5s (excluding model time); sidecar cold start <10s.
- NFR-3 Reliability: sidecrash mid-run → job marked error, resumable via checkpoints; Express stays up independent of sidecar.
- NFR-4 Security: /v1 token auth for sidecar calls; keys never in sidecar env or Python process; loopback binding only.
- NFR-5 Auditability: immutable append-only decision ledger; run artifacts keyed by run_id.
- NFR-6 Honesty: simulated/prototype surfaces badged; vendor failures verbatim; no fabricated edge claims (desk rule: evidence over stories).

## 6. Milestones

| Phase | Scope | Exit |
| --- | --- | --- |
| P0 Cleanup (0.5 wk) | npm start fix, port 3000 conflict, dead artifacts, edgeService badge | repo lint-clean, prod entry runs |
| P1 Sidecar MVP (1.5 wk) | FastAPI wrapper, /runs, /events SSE, /v1 token auth, SQLite job queue | SC-1, SC-2, SC-5 on one ticker |
| P2 Ledger+UI (1.5 wk) | Council rebuild on SSE, decisions API, reflections, CLI subcommands | SC-3 + FR-5 |
| P3 Backtest (1 wk) | Grid runner, results table, run resume | SC-4 |
| P4 Hardening (1 wk) | Cost estimates, checkpoint resume, failure surfacing, docs | All SC + NFR verified |

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| TA upstream breaks API on upgrade | Pin version (==0.5.1); wrap all calls in sidecar; contract tests |
| Long runs (minutes) strain UX | Checkpoint resume + SSE progress + explicit cost pre-estimate |
| Social/news feeds reflect "now" for historical dates (TA known issue) | Badge runs by data-freshness; default trade_date=today |
| Data-vendor API keys/quotas | Fallback chains per TA vendor config; failures verbatim (NFR-6) |
| Windows/Python runtime drift | uv-managed venv at trading/.venv, Python ≥3.10 pinned |
| Scope creep toward execution | Non-goal is contractual: no broker code, ever, in v1 |

## 8. Open questions (for owner review)

1. Crypto runs — enable TA's asset_type='crypto' path in v1, or stock-only first?
2. Portfolio context: wire Quanta broker-less portfolio (manual holdings JSON) in P1 or P2?
3. Hindsight memory integration (reflections → vector memory) — P4 or post-v1?
4. Keep the GNOESIS-style naming (Petey/Larry/RLrealm personas) out of Quanta, or brand the Council seats?
5. Hosted demo: explicitly banner "no trading features on hosted demo" (recommended) or omit trading from hosted build?
