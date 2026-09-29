# Gnoesis Agenic Research — product requirements

Version 2 · 2026-09-28 · local integration implemented; predictive value unvalidated.

## Product

A stock research workspace combining QuantaCore provider/UI management with the real TradingAgents graph. Operators select ticker/date, deep/quick routes, roles, rounds and budgets; review an estimate; then explicitly approve model calls.

## Acceptance

| Requirement | Verification |
| --- | --- |
| Native graph with twelve roles | Actual compiled graph passed with synthetic model/data inputs |
| Durable queue, cancel and resume | Owner lock, journal recovery, real subprocess cancellation and native checkpoint recovery passed |
| Console, ledger, evaluation and CLI | Implemented with replayable real events and downloadable artifacts; UI rendering captured |
| Credential and cost boundaries | Scoped auth, configured routes, atomic admission and concurrent-budget tests passed |
| Evidence and history | Strict price gates, hashed snapshots, immutable journal, retained resume evidence and settlement provenance tested |
| Evaluation workflow | Twelve fixture cells passed; predictive performance remains unvalidated |
| Local runtime | Typecheck/build, 12 research tests, 6 gateway tests and 18 Python tests passed |

Stocks and manual portfolio context are the initial scope. No order execution, brokerage connection, autonomous financial action or profitable edge is included. Native indicative outcomes are independent decision annotations, without validated portfolio fills/costs. Unknown cost is shown as unknown.

Historical feeds can be revised and models can contain later knowledge. Real provider inference was not an acceptance gate. Cold-import latency targets are unverified. Further interactive browser verification stopped when the user stopped computer use. A research container topology and cloud research execution are outside this release.

Current setup, commands, contracts and limitations: [GNOESIS_AGENIC_RESEARCH.md](GNOESIS_AGENIC_RESEARCH.md).

The original draft is preserved in [PRD_TRADING_CORE_PROPOSAL_2026-09-28.md](PRD_TRADING_CORE_PROPOSAL_2026-09-28.md).
