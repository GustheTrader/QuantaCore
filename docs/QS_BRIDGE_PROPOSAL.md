# QuantaCore to QS Terminal bridge proposal

Status: wider research-proposal handoff remains proposed. A narrower manual read-only Quanta adapter is now prepared; see [QS_READ_ONLY_BRIDGE.md](QS_READ_ONLY_BRIDGE.md). No QS service, endpoint pin or trading behavior was activated by this work.

Verified source locations: C:\QuantaCore and C:\Users\jeffg\Desktop\QS.Terminal.
Historical startup blocker: ProviderStore.getOAuthCredentials failed during bootstrap-secret migration. The Quanta server now responds on port 3000 with local APIs. Protected files were preserved. A built-UI-only preview still does not provide API services.

## Recommended first bridge
Use a narrow server-to-server HTTP JSON adapter over loopback, plus SSE for research job status. Keep QS existing market WebSocket feeds within QS. Avoid a shared database and a general-purpose agent tool interface for the trading path.

QS provides allowlisted, read-only market snapshots and feed health. Quanta returns versioned, expiring research proposals. QS remains authoritative for risk checks, paper simulation, operator approval, orders and fills. Start in shadow/read-only mode.

Observed QS interfaces: /api/health, /api/markets, /api/markets/{market_key}/history, /api/report/signals, /api/settlements, /api/system/overview. Confirm actual response schemas and active checkout at runtime before binding. Existing mutating QS requests use X-QS-Token; never expose that trading credential to Quanta. Provision a distinct research-only scope if required.

## Contract
Each snapshot/proposal carries schema version, correlation ID, market ID, separate outcome token IDs, source timestamps, received timestamp, source attribution and content hash. Include executable bid/ask and depth separately for both outcomes, feed age and settlement definition. Do not infer NO from YES. Proposal includes forecast provenance, calibration status, assumptions, supporting and opposing evidence, invalidation conditions and expiry. Missing or stale evidence produces abstain. Research ratings are not settlement probabilities.

## Operational gates
Use fixed allowlisted routes, bounded payloads, timeouts, no redirect following, schema validation, finite-number checks and a local audit ledger. Deduplicate proposals by stable ID; reconnect status streams using sequence IDs. No auto execution or paid inference enabled by bridge setup.

Earlier inspection found Honcho on port 8000. During October 17 bridge preparation, neither candidate port 8000 nor 8010 responded. Do not assume a port identifies QS; the prepared adapter verifies the reviewed service title/version and pins the OpenAPI hash before accepting inventory. Activating QS needs its own concrete scope.

## Review and validation
1. Restore full Quanta startup without resetting credentials.
2. Confirm which QS checkout is canonical and inspect its launch settings.
3. Approve the port and narrow contract before changes to either architecture.
4. Implement an isolated adapter with recorded fixtures first.
5. Test wrong-service detection, stale/nonfinite evidence, missing opposite-side quotes, duplicate proposals, timeouts, reconnects and forbidden write routes.
6. Validate a live read-only snapshot and proposal round trip with visible UI evidence.
7. Evaluate paper results with fees, point-in-time data and authoritative settlement labels before any execution promotion.

Alternative review: HTTP/SSE reuses Quanta REST/job interfaces and QS API contracts with fewer dependencies. WebSocket relay may be justified by measured throughput needs later. MCP is useful for operator research tools but should not define the execution boundary. Shared storage tightly couples schemas and writers and is unnecessary for this first bridge. These are source-based architecture judgments, not measured latency benchmarks.
