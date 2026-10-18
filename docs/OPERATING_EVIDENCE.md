# Operating evidence contract

Scope: local readiness, metadata correlation, read-only journal projection, reviewed text-only Starter adapter and a fixed evaluation runner. No external trace collector, automatic routing, runtime activation or training is introduced.

## Contract owner and consumers

`lib/operating-contract.ts` is the authoritative versioned TypeScript contract and runtime validator. The catalog, local API, browser evidence view, production review adapter and fixed benchmark runner share this build/runtime contract. Exported JSON uses `version: 1`; incompatible versions are rejected rather than guessed. Source documents and imported package content are data, not executable instructions.

## Acceptance criteria, fixed before implementation

- Every catalog module displays Configured, Responding, Bounded task completed and Reviewed for a named use case. Missing evidence remains unknown; mismatched configuration becomes stale. A later stage cannot imply earlier stages.
- Local HTTP adapter requests receive a correlation ID and distinct span ID. An explicitly propagated parent span connects child calls. Existing native journal IDs remain intact; historical associations are labeled derived, never presented as captured traces.
- The evidence page reads local metadata and existing journals without probing providers, starting workers, modifying old journals or exporting data. Failure to read one source is visible. Bound result counts and omit prompts, transcripts, credentials, tool arguments and raw error text.
- Evidence custody is this Windows account's local application directory. Retain metadata locally; no automatic outbound export or collector. Export requires an operator action. Local filesystem custody is not encryption or signed multi-user attestation.
- A shared package identifies route/harness/artifact versions, hashes, development/holdout split, runner/rubric, correlation, quality, critical failures, cost and latency. Unknown cost/latency remains null. Imported assertions cannot self-certify an executed benchmark.
- A production review applies only to the named text-only Starter adapter, exact model/endpoint/credential binding, exact instruction artifact, benchmark and expiry. Approval is explicit and records limits, reviewer, note and rollback identity. It grants no tools and never promotes itself.
- Record improvement on a controlled benchmark separately from demonstrated production improvement. A production observation is not automatically a causal improvement claim.
- The Starter runner freezes its instruction/rubric/runner hashes before generating private, unseen case instances. Cases are used once, with no adaptive retry or instruction edits. Record quality, critical failures, token/cost provenance and latency together. A missing model route produces a blocked report, never a synthetic success.

## Evidence levels

`recorded-evaluation` contains operator assertions. `executed-benchmark` needs a locally generated runner receipt matching the full package hash. `production-observation` records observed production use; it does not establish improvement without a controlled comparison. Uploads are retained as recorded evidence, with their declared level preserved for transparency.

## Production boundary

The reviewed production adapter is deliberately restricted to a new text-only Starter pilot for summarizing supplied evidence, comparing options and giving a second look. It consumes exact reviewed instruction text. It cannot install Python/JavaScript, change tool permissions, deploy an RRSI export or rewrite other agents. Existing skill lab adoption remains local lab adoption. Other runtime production adapters require a separate scope.

## Evaluation scope

Six privately generated holdout cases, one fixed route, sequential calls, no tools/memory, 512 output tokens per response, 30 seconds per call, six minutes total, at most twelve calls when comparing a baseline and candidate. Report local provider charge as zero only for an installed, verified local Ollama model; electricity/hardware costs are not included. Cloud experiment execution requires a separately reviewed route and cost scope.

The operator selected preparation of a separate cloud experiment, not execution. The concrete proposed model, payload, limits, budget prerequisites and approval boundary are in [STARTER_CLOUD_EVALUATION_SCOPE.md](STARTER_CLOUD_EVALUATION_SCOPE.md).

## Local operation

- Read-only view: `/#/rsi-lab/evidence`; decision console and bounded production pilot: `/#/rsi-lab/adoption`.
- Local evidence is in `.quanta/evidence/operating.sqlite`. Native journals remain canonical. Metadata projections label captured versus derived legacy correlations and do not claim full chain verification.
- `node --import tsx scripts/evaluate-starter.ts prepare` freezes a new local evaluation. It does not submit model requests. After a concrete local model is configured and responding, preparation pins its installed digest. The [official Ollama schema](https://github.com/ollama/ollama/blob/main/docs/openapi.yaml) identifies remote models with `remote_model` / `remote_host`; the local runner rejects those and cloud aliases.
- `node --import tsx scripts/evaluate-starter.ts run PREPARED_UUID` attempts a prepared local-only bundle once. Changes to frozen code, instruction, rubric, model digest or route invalidate it. Repeated execution of an attempted holdout is rejected.
- Add `--candidate PATH_TO_TEXT_FILE` to preparation for a paired comparison of an explicitly selected additive instruction. The fixed runner never executes that file as code.
- Skill lab's common package export preserves aggregate operator counts, unknown route/cost/latency and unverified unseen status. Importing a package always records it at the assertion level; it cannot mint a trusted runner receipt.
- Production approval binds the exact package, candidate content, route/model digest, runner/rubric revision, limits, reviewer, expiry and expected active slot. Rollback also checks current identity. Only explicit Starter pilot submissions use the approved instructions; the existing agent, Hermes, RRSI and cloud runtimes are not silently modified.
- Readiness snapshots use provider metadata and a protected-store byte hash, without credential decryption. Any protected-store rewrite conservatively invalidates existing readiness assertions. Actual pilot review separately resolves and pins its selected route and credential.

## Correlation coverage

The local server assigns request correlation/span IDs to inference, memory, research, RSI, Hermes, HarnessRouter, Work Zone and Hybrid routes. An explicit valid correlation header propagates a root; a valid parent header identifies a parent span. AgentControlPlane's compatible text stages and local recall/retention share a task root. Research and RSI native run links reconnect asynchronous worker gateway calls via their existing run identity. Gateway reservations and memory audit events also retain side-index links. Native IDs and old journal bytes remain unchanged.

Independent operator actions get independent roots. Hosted/Supabase transports and native/external runtimes do not automatically participate in this local context. There is no claim of complete native tool, provider or cross-process distributed tracing, and IDs grant no authority. Nothing automatically exports trace IDs or payloads to a third-party collector.

## Validation and current status · October 17, 2026

All 39 focused and regression checks passed, covering readiness scope/expiry, evidence validation, measured versus recorded results, source injection grading, metadata redaction, read-only access, correlation inheritance, exact release binding, concurrent rollback, gateway admission, native research storage and RSI gates. Synthetic release and model-metadata fixtures run only in temporary directories; they are not model benchmark results. A separate in-memory skill export check confirms aggregate counts are retained without inventing per-case scores or measured cost/latency.

TypeScript and the production build pass. The build retains the existing large-chunk warning. Live port-3000 review confirms the current bundle, all eleven modules with all four stages, seven available native journal projections, successful correlation/parent-span headers and unchanged evidence-row counts across read-only snapshot requests. A cold-read timeout found during browser review was fixed by removing credential resolution from metadata snapshots; the final live snapshot returned HTTP 200 in approximately 350 ms. Evidence and adoption pages, plus the thirty-component interactive map, were checked at desktop/mobile sizes; the 390-pixel mobile pages have no horizontal overflow or console errors.

The local Starter preparation remains blocked with zero model calls. The separate cloud scope is prepared and explicitly unapproved, also with zero calls. No quality/cost/latency model result, demonstrated production improvement or active Starter release exists. The private local holdout prepared before the final source changes must be regenerated after a real route is configured; its frozen revision cannot be reused with changed code. No automatic routing, learned selection, collector export, model training or paid experiment was activated.

The subsequent [Composability Copilot](COMPOSABILITY_COPILOT.md), observed AgenticOS/IronClaw/EdgeMech views and [prepared QS read-only bridge](QS_READ_ONLY_BRIDGE.md) extend this increment to thirteen catalog modules and eight local journal coverage sources. The combined 45-check suite passed. QS observations capture bridge read metadata and failures; the coverage entry does not imply an available QS service or an accepted source snapshot. QS endpoint pinning invalidates that module's readiness binding. Cloud experiment approval and the Starter release slot remain unchanged.
