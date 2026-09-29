# Gnoesis Agenic Research — architecture

Version 2 · 2026-09-28 · implemented locally.

QuantaCore provides the console, durable owner and encrypted provider gateway. TradingAgents provides the stock research graph, pinned to v0.5.1 commit 35543d0248bf89fcb92b17a15858ad0c0e940687.

The current architecture, security boundaries, operational commands and verification evidence are in [GNOESIS_AGENIC_RESEARCH.md](GNOESIS_AGENIC_RESEARCH.md).

Key contracts: sole durable SQLite owner; append-only event journal and verified projections; run/attempt scoped inference with budget admission; real graph callbacks and replayable SSE; strict essential-price gates; stable native checkpoint recovery with verified evidence; isolated evaluation memory; explicit outcome provenance.

Native local deployment uses Quanta on loopback 3000 and Python on loopback 8788. OpenMuse retains 8787. Optional Memgraph Lab uses 3010. Research container deployment is outside this release.

The original proposal is preserved in [ARCHITECTURE_TRADING_CORE_PROPOSAL_2026-09-28.md](ARCHITECTURE_TRADING_CORE_PROPOSAL_2026-09-28.md). Its old API, port and performance assumptions are superseded by the current implementation.
