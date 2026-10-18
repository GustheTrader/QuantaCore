# QS read-only bridge and observed runtime panels

Approved scope on October 17, 2026: connect AgenticOS, IronClaw and EdgeMech to real local evidence and prepare a read-only QS bridge. The Quanta application owns this change; the QS checkout is inspected without modification.

## Acceptance criteria

- The panels default to observed metadata from existing local journals. Unknown runtime measurements remain unknown. HTTP samples include settings/status reads and do not certify completed agent tasks, sandbox confinement or deployed worker infrastructure.
- AgenticOS shows workflow/native-run evidence; IronClaw shows observed access decisions and custody; EdgeMech summarizes measured adapter HTTP response times. Refresh is manual. No model request or external runtime activation follows a page visit.
- Preserve the prior design demonstrations as explicitly labeled previews. EdgeMech previews use local example logs and never call a model on a timer.
- `lib/qs-bridge-contract.ts` owns the normalized bridge contract, limits and runtime normalization shared by server and UI.
- The QS adapter accepts a reviewed literal loopback HTTP origin, no credentials/query/path, and exactly three GET routes: `/openapi.json`, `/api/health`, `/api/markets`. No arbitrary proxy, writes, order routes, background polling, process launcher or trading credential is exposed.
- A manual inspection verifies the expected QS service title/version and required read routes, then bounds/normalizes health and inventory. A separate exact endpoint/schema pin is required for subsequent manual reads. Schema drift and changed configuration stop reads.
- Unknown/stale/future source times, missing opposite outcome identities and missing executable-book/settlement evidence remain visible. Discovery percentages are not executable prices; never compute DOWN as `1 - UP`. This inventory always abstains from trade proposals.
- Only metadata/hash receipts enter the local evidence journal. The current source snapshot is returned for operator review, with capture/expiry, source IDs, a correlation ID and hash. No source text enters model prompts or training.

## Source and activation boundary

Inspected source: `C:\Users\jeffg\Desktop\QS.Terminal`, remote `https://github.com/GustheTrader/QS.terminal`. Its current Python app declares `Polymarket Terminal API` version `0.4.0`. The bridge checks that identity and pins the served OpenAPI hash; this is local compatibility checking, not cryptographic service attestation. A compromised local process is outside that guarantee.

The existing QS launcher cleans up ports and starts strategy components. This scope does not run it. Ports 8000 and 8010 did not respond during preparation. The operator must select a separately running, verified QS endpoint before pinning it. No QS service activation, paid experiment, automatic execution or migration is approved here.

The current QS market inventory lacks independently verified executable books and full settlement provenance. Preparing this bridge does not complete the previously proposed research-proposal round trip or authorize QS trading. Full proposals, SSE and production execution require separate contracts and scope.

## Local entry points

- `/#/agentic-os`: workflow evidence.
- `/#/iron-claw`: security and access evidence; a connected WASM runtime is not claimed.
- `/#/edge-mech`: adapter HTTP timing evidence; deployed Redis/worker metrics are not claimed.
- `/#/qs-bridge`: inspect and pin an independently running QS read endpoint.

Protected configuration stays in `.quanta/qs-readonly.json`. The bridge stores no QS token. Reading its local status never contacts QS.

## Validation · October 17, 2026

Synthetic in-process QS fixtures verify origin restrictions, identity rejection before inventory reads, the exact three GET calls, explicit endpoint pinning, schema drift rejection, separate outcome preservation, nonfinite percentage rejection, source staleness and always-abstain behavior. They establish adapter behavior, not a live QS integration. Local status returned HTTP 200 with no pin; missing local operator headers returned 403, and an unsupported order route returned 404. A manual browser inspection of unavailable port 8010 recorded a failed read and retained no pin or source snapshot. No QS service was started.

The three evidence panels were checked against the live local snapshot, which now contains thirteen module contracts and eight journal coverage sources. AgenticOS displays thirteen four-stage readiness strips. IronClaw labels absent runtime attestation; EdgeMech labels absent Redis/worker measurements. Mobile layouts remain within 390 pixels. The overall 45-check suite, TypeScript and production build passed.
