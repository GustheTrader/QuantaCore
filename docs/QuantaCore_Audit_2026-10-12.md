# QuantaCore: engineering and capability audit

**Audit date:** October 12, 2026, America/Los_Angeles
**Checkout:** `C:\QuantaCore`
**Verdict:** **52/100 production readiness — Risky. Suitable for supervised local R&D and a limited internal beta. The full public, autonomous product has unresolved launch blockers.**

This is a readiness assessment of the current code, running services, persisted outcomes, and deployed frontend. The score is a disclosed triage judgment, not the percentage of the product that is complete. A page, installed dependency, healthy container, saved key, or passing fixture is not proof that its complete user workflow works.

## 1. Executive summary

Quanta has a substantial working application shell and several real service integrations. The local frontend builds, TypeScript checks pass, Hindsight and Honcho respond, Hermes connects, HarnessRouter Community Edition responds, and the research sidecar is ready. There are meaningful controls around local credentials, research budgets, review ownership, and RSI experiments.

The complete system is not operational across all advertised workflows:

- **Work Zone / QuantaTrade organization management:** Paperclip itself is healthy, but the existing local operator's build and trade workspaces fail operator login. The signed-in browser user's separate workspace has no organization provisioned.
- **Research outcomes:** all five runs in the real research journal failed. Three reached a provider authentication failure; two exhausted their frozen inference budgets. No real completed decision is present in that journal.
- **Memory ownership:** legacy Neural Chat automatically distills conversations into knowledge assigned to `All Agents`, within that user's legacy store. It also automatically replaces live agent prompts after certain reflection results. These behaviors do not follow the private-agent KB and reviewed-improvement model used elsewhere.
- **Local production memory:** the production frontend selects hosted memory solely because it was built in production mode, even when it is running on localhost. Hosted memory is not currently configured to reach the required memory services.
- **Product truthfulness:** some Agentic OS, IronClaw, AgentZero, edge metrics, and Langfuse displays use simulated data or generated logs. They need explicit prototype labels and separation from measured operational results.
- **Release state:** GitHub main matches local HEAD, but 94 working-tree entries were modified or untracked at the start of the audit. The public Vercel bundle does not include several recent local routes. The whole current local system is not released.

No application fixes, credential changes, provisioning, trading, paid inference, memory writes, commit, push, or deployment were performed for this audit. The audit created this report, its structured companion, and ignored local evidence files. The production build refreshed `dist`.

## 2. What is complete, partial, or blocked

**Status definitions:**

- **Implemented / checked:** the named bounded feature was checked; this does not certify the surrounding end-to-end workflow.
- **Connected / partial:** a real service or implementation exists, with important completion evidence still missing.
- **Blocked:** a necessary runtime, configuration, or observed outcome prevents the intended workflow.
- **Prototype:** at least a material part of the presented result is simulated or illustrative.
- **Unverified:** the audit deliberately did not execute the required live action.

| Capability | Current status | Evidence and remaining work |
| --- | --- | --- |
| Local application shell, navigation and current source | Implemented / checked | App responds at `http://127.0.0.1:3000`; fresh TypeScript and production build pass. Full visual/mobile regression remains incomplete. |
| Sovereign branding, agent cards and composability surfaces | Implemented UI | Thirteen role tracks exist, including Credit Analyst, RWA/DeFi, Asset Recovery and Prediction Team. Role cards and prompts are not thirteen separately verified workers. |
| Mission Control / blue agent control plane | Implemented UI / partial runtime | Routes and activation surfaces exist. Verify complete task, memory, cancellation and review paths for each selected runtime. |
| Provider configuration | Implemented / partially configured | Eleven provider adapters are listed. OpenRouter and Ollama Cloud have saved key/model configurations. Other routes require setup; no successful fresh inference was requested. |
| Scoped text gateway and budget controls | Implemented / checked | Broad legacy gateway keys are disabled. Local UI has text-only, model-scoped reservations, rate and monthly limits; offline coverage exists. Latest recorded local UI request failed. |
| OpenAI-compatible API transport | Implemented / unverified live | Adapter exists; current official OpenAI route has no API key. Native account login is a different capability. |
| Local Ollama / OmniRoute | Blocked | No current listeners on the expected local ports; model configuration is blank. |
| FireRouter, Fireworks Nexus and fine-tuning / RL | Partial integration / unverified | Product surfaces and setup paths exist. Fireworks provider is unconfigured; no qualified trained-model promotion or successful Nexus workflow was verified. |
| Hindsight / Gnoesis Neural Core and Honcho | Connected / partial | Both local services respond. Actual retain → restart → recall isolation was not exercised. Policy admission and agent-specific Hindsight scoping need work. |
| Obsidian second brain | Partial / inactive | Read-only vault mount configuration exists. No Obsidian sync container is running; current ingestion was not verified. |
| Memory Defense | Partial | Landing copy correctly explains opt-in, future writes only and default-off behavior. Bank creation does not install a policy; the active bank policy could not be read within the bounded timeout. |
| Open House agent naming, roles and KBs | Implemented / partial | Workspace and ownership logic and private/shared KB filtering have offline coverage. A complete multi-worker conversation, role assignment and reviewed master-KB promotion was not exercised. |
| Paperclip Work Zone and QuantaTrade organization / training | Blocked | Container health passes; existing local operator login fails. Signed-in browser user sees the create-organization empty state. Provisioning, onboarding, training and task dispatch remain unverified. |
| HarnessRouter Community Edition | Connected / partial | Loopback container responds with UHP discovery and Quanta status. Initial discovery timeout was transient. No live harness task was executed; tool permissions need independent enforcement. |
| Coding harnesses and CLI / pop-out terminal | Partial | Code and settings exist. Native Claude/Grok credentials report expired; Gemini is disconnected. No fresh coding task or terminal interaction was exercised. CLI help contains an outdated agent count. |
| Hermes work and personal profiles | Connected / partial | Gateway reports connected and chat ready. Profile isolation and approvals have tests, with one stale error-message assertion failing. No new real Hermes task was launched. |
| OpenMuse Consumer / Personal runtime | Blocked | Current OpenMuse status is unavailable; agent and browser runtime configuration report false. Previously saved credentials do not demonstrate present readiness. |
| QuantaOpenDots / optional agent computer | Connected backend / blocked reasoning | Docker service responds and two dots exist. Browser is configured; Intelligence and model keys are missing. Cloud computer/session execution is unverified. |
| Agentic OS / IronClaw / AgentZero | Prototype / partial | Some metrics, memory results, sandbox stages and process logs are simulated. A mounted route or downloaded repository does not prove a real operating-system integration. |
| FPT Omega specialist routing | Partial / illustrative | FPT prompt injection and a manual toggle exist. No evidence of a production smart router invoking a separate solver in the Hindsight facts/observation pipeline. |
| QuantaTrade TradingAgents research | Implemented controls / blocked real outcome | Pinned worker is ready; immutable request/event/error artifacts and budget enforcement exist. Five real runs failed; no completed real decision in the inspected journal. |
| Historical grid / trading research results | Research only | Independent decision workflows exist; they do not establish portfolio fills, fees, slippage or profitable alpha. Fixture results must remain distinct from measured research. |
| RRSI Lab | Implemented scaffold / unverified experiment | Actual pinned RRSI checkout and isolated worker/review/export paths exist; seven Python tests pass. No live experiment or approved candidate promotion is recorded. |
| Dream-RSI, Intent and QS Systems Lab subpages | Partial / research drafts | Recorded-branch replay, local drafts/import and eight labeled demos exist. Official Dream-RSI execution and measured gate-passing experiments are not demonstrated. Hosted QS redesign is awaiting editor access. |
| Firecrawl Alexandria | Implemented adapter / unverified paid retrieval | Local module and route exist; key is present server-side. No paid capability was called. Discovery before retrieval, published price confirmation and actual returned cost must remain mandatory. |
| Hybrid / Zo cloud access | Partial / deliberately restricted | Business connection configuration exists; trading cloud connections are disabled, trading cap is zero and paper/local mode is selected. No live cloud job or promotion verified. |
| SMB, ERP and other business planning | Local planning / partial | Local drafts and planning surfaces exist. ERP synchronization and autonomous external business execution are not demonstrated. |
| Whitepaper and downloads | Artifacts present | Version 1.4 and 1.5 PDF/text files exist. Operational claims should be reconciled with this audit; downloading a PDF does not establish its implementation claims. |
| Vercel + Supabase hosted application | Partial deployment | Public frontend responds; three Edge Functions are ACTIVE. Hosted memory/harness configuration is incomplete, local Express APIs are not part of the static Vercel deployment, and recent routes are absent from the public bundle. |

## 3. Priority findings and concrete fixes

Severity uses **P1 = launch-critical**, **P2 = important reliability/security/completeness work**, **P3 = polish**. No confirmed active exploit or P0 incident was established by this audit. An unverified security control is not automatically a confirmed data leak.

### P1 — F01: Paperclip does not complete operator authentication

**Observed:** `/api/work-zone/build/state` and `/api/work-zone/trade/state` returned 503 with `Paperclip operator login failed. Run the local setup script.` The Paperclip health endpoint returned 200.

**Scope:** these read-only probes used the trusted local-operator scope. The signed-in browser uses a different Supabase user scope and currently shows an unprovisioned organization. The audit did not show every user seeing the same login error, and did not attempt to provision an organization.

**Fix:** reconcile the existing bootstrap identity with the current Paperclip database and protected credential store; preserve existing organizations and keys. Then verify one operator organization → named worker → harness assignment → task → stored review → private KB and explicit shared-KB promotion. Capture the underlying auth response without credentials.

### P1 — F02: Real research runs cannot presently demonstrate a completed result

**Observed:** five real runs, five errors, zero completed decisions. Three error artifacts contain upstream 401 `User not found` at Market Analyst. Two runs hit the frozen research budget at Conservative or Neutral Analyst; one was resumed repeatedly with the same already-exhausted configuration.

**Fix:** add provider entitlement preflight and clear authentication error mapping. Estimate worst-case graph context growth before approval; reject insufficient budgets or offer a narrower reviewed graph. Do not silently increase caps or retry an exhausted immutable configuration. Prove one bounded, explicitly approved research run and independently review its sources and result. No live retry or spend was performed in this audit.

**Evidence:** real journal under `data/trading`; sanitized diagnoses in `.quanta/audit-2026-10-12/extra.json`. Worker commit: `35543d0248bf89fcb92b17a15858ad0c0e940687`, TradingAgents v0.5.1. Completed fixtures under the separate verification directory are not live successes.

### P1 — F03: Legacy Neural Chat bypasses private-KB and improvement-review boundaries

**Observed:** after a successful reply, Neural Chat distills recent messages without a separate distillation opt-in. New distilled knowledge is assigned to both the active agent and `All Agents`. Sharing occurs within the user's legacy knowledge store; this audit did not establish cross-user access. Reflection defaults to enabled. Every fourteen messages it can replace the live prompt immediately when a suggested prompt has a low score. Malformed reflection JSON is converted to score 5 / `Bypassed` / `Stability`.

**Risk:** confidential context from a specialist can become available to other agents; model-generated assertions can become recalled knowledge; a failed evaluation can appear successful; prompts can change outside the reviewed RSI workflow.

**Fix:** make memory admission explicit, default to the agent's private scope, and require a separate reviewed promotion into master KB. Keep raw conversation, inferred observation, sourced fact and approved shared knowledge distinct. Store reflection as a candidate with baseline, evaluation evidence and operator review; parsing failure must be an error, never a passing score. Include all auxiliary inference calls in the request budget.

**Code:** [ChatInterface.tsx](C:/QuantaCore/components/ChatInterface.tsx:230), [geminiService.ts](C:/QuantaCore/services/geminiService.ts:299), [automatic prompt replacement](C:/QuantaCore/components/ChatInterface.tsx:255), [reflection parse fallback](C:/QuantaCore/services/geminiService.ts:296).

### P1 — F04: Local production builds route memory to hosted infrastructure

**Observed:** `agentMemoryService` chooses Edge Functions on `import.meta.env.PROD` alone. The inference service separately checks whether the host is loopback. Therefore `npm start --production` can show healthy local Hindsight/Honcho while its frontend attempts hosted memory. The currently running dev frontend does not trigger that production branch.

**Fix:** select the memory backend using an explicit reviewed deployment/runtime configuration with a loopback-safe default; display the actual selected target and custody mode. Test development localhost, production localhost and hosted Vercel separately. Never silently switch private memory from local storage to a cloud destination.

**Code:** [agentMemoryService.ts](C:/QuantaCore/services/agentMemoryService.ts:17), [inferenceService.ts](C:/QuantaCore/services/inferenceService.ts:13).

### P1 — F05: Read-only harness intent is not a deterministic tool restriction

**Observed:** the local HarnessRouter request includes instructions saying not to trade, move money, send messages, deploy or modify external systems, and imposes step/time/output bounds. The inspected request does not disable write-capable shell, filesystem or network tools. It can select a live catalog harness. Hosted harness/model allowlists exist in code, but their deployment secrets are absent.

**Fix:** define server-enforced capability profiles; only expose tools authorized for the task and deployment. Verify the actual HarnessRouter profile's tool restrictions, workspace mounts, network access and side-effect approvals. Reject an unverified harness in research-only mode. A model obeying a prompt is not a permission boundary. No side-effect probe was run.

**Code:** [harness-router.ts](C:/QuantaCore/server/harness-router.ts:153).

### P1 — F06: Current local product and hosted release are different systems

**Observed:** local and remote main both point to `14b1b7963bba332aedd3e90725a9665e23f977c2`, but the checkout had 94 modified/untracked entries before audit artifacts. The public bundle contains Work Zone and QuantaTrade but lacks literal routes for RSI Lab, Alexandria and SMB. Vercel is configured as a static frontend; it does not deploy the local Express service. Exact Vercel deployment commit could not be retrieved because the connector returned access errors.

**Hosted state:** three ACTIVE, JWT-verified functions exist: `quanta-inference` v3, `quanta-memory` v4, `quanta-harness-router` v2. Secret metadata shows OpenRouter and Upstash configuration but no Hindsight/Honcho keys or hosted HarnessRouter URL/key/allowlists. Guest signup is enabled; new signup, email delivery and hosted inference were not exercised.

**Fix:** prepare a reviewed release inventory, reconcile local APIs with hosted capabilities, fail closed or clearly hide unavailable features, and validate the actual deployment revision and runtime environment. Commit intended source in bounded groups, add CI and release/rollback instructions, then deploy the reviewed snapshot. Do not publish the entire mixed worktree without scope review.

### P2 — F07: Optional browser credentials share an execution context with a remote script

**Observed:** legacy Gemini/media code can read a provider key from browser localStorage. `index.html` loads the Tailwind runtime script from an external CDN. This gives that script the same browser origin privileges as the application. The audit did not establish a currently stored browser Gemini key or credential theft. The exact-match scan found no matches for the three nonempty current local secret values in six built JavaScript files; it is not a universal secret scan.

**Fix:** route legacy model/media calls through the authenticated server, compile Tailwind locally, and introduce a restrictive reviewed Content Security Policy. Keep protected server credentials out of the browser and status endpoints.

**Code:** [browserCredentials.ts](C:/QuantaCore/services/browserCredentials.ts:7), [index.html](C:/QuantaCore/index.html:8).

### P2 — F08: Memory admission does not configure defense or distinguish verified facts

**Observed:** local and hosted Hindsight adapters create a bank without `memory_defense`, then retain raw user/assistant text. Hindsight bank identity is per user, rather than per agent. Honcho separates user/thread identities and assistant peers, but this alone does not establish private-agent Hindsight recall. The live bank policy probe timed out, so an existing manually set policy remains unknown.

**Fix:** add a reviewed per-bank policy selector and pre-storage screening with tested redact/block behavior. Define private-agent namespaces and explicit master-KB promotion. Record source, confidence, status, corrections and deletion lineage. Verify retain → recall → export and recovery without exposing pre-redaction text. Existing content requires a separate reviewed remediation plan because policy changes are not retroactive.

**Code:** [memory-router.ts](C:/QuantaCore/server/memory-router.ts:118), [hosted memory bank creation](C:/QuantaCore/supabase/functions/quanta-memory/index.ts:69).

### P2 — F09: Simulated execution and telemetry need truthful status labels

**Observed:** Agentic OS varies metrics randomly; IronClaw uses timed stages reporting input sanitization and WASM execution without a corresponding runtime call; AgentOS tool memory returns fabricated results; AgentZero includes simulated processes; edge Redis/node metrics and execution logs are simulated or model-generated. Langfuse is a console-log simulation, not an integrated telemetry backend.

**Fix:** label these areas `Prototype / simulated` and gate any success status on a persisted runtime result. Keep demos out of production metrics, security evidence and trading records. Implement real tracing for request, tool, model, memory, cost, cancellation and review events, with secret/PII filtering.

**Code:** [AgenticOS.tsx](C:/QuantaCore/components/AgenticOS.tsx:59), [IronClawAgent.tsx](C:/QuantaCore/components/IronClawAgent.tsx:44), [agentos/tools.ts](C:/QuantaCore/services/agentos/tools.ts:30), [edgeService.ts](C:/QuantaCore/services/edgeService.ts:15), [langfuseService.ts](C:/QuantaCore/services/langfuseService.ts:4).

### P2 — F10: Tests are not fully green and no CI covers the entire system

**Observed:** the broad Node suite passed 92 of 93 tests. The Hermes test expects `/Allow once/`, while production code correctly rejects the unoffered `always` choice with a different message. Its isolated rerun fails the same assertion. Later assertions in that test are not reached. The TradingAgents Python suite passed 17 of 18 tests; the real HTTP fixture failed to become ready within 90 seconds, before cancellation or owner-death assertions ran. A focused rerun reproduced that readiness failure (one failed test, 156.65 seconds total). The existing application sidecar still reported ready; the fixture failure is a separate unresolved startup problem. RSI Python tests passed 7 of 7. There is no `.github` CI workflow and no root command covering all suites.

**Fix:** update the approval test to check rejection semantics and absence of a forwarded unauthorized approval; retain coverage of valid scopes and restart behavior. Capture fixture-worker startup stderr, verify cleanup and investigate slow Windows startup before changing readiness deadlines. Add a single documented validation command and CI for the local and hosted contracts. Keep failures visible rather than weakening controls to make tests pass.

### P2 — F11: Database portability, ownership and recovery evidence is incomplete

**Observed:** repository migrations cover test-access contacts and Agent House workspaces, with ownership/RLS definitions. Legacy cloud functions also refer to tables such as memories, prompts, reflections and chat histories without matching migrations in the inspected repository. The live remote schema and its effective RLS grants were not audited. No destructive read/write ownership probe or restore drill was run.

**Fix:** inventory every persisted table and object, version schema/RLS migrations, and test owner A vs owner B vs anonymous access in a disposable environment. Document retention, export, deletion and backup recovery for local volumes and hosted records, then perform a measured restore exercise.

### P2 — F12: Startup footprint and release reproducibility need work

**Observed:** the fresh main JS chunk is 2,078.29 kB (578.60 kB gzip); the HybridCloud chunk is 848.09 kB (235.38 kB gzip). Vite emits a chunk-size warning. Build and tests were unusually slow on this host, and browser automation repeatedly timed out. A point-in-time OS reading showed 15.82 GiB total RAM and 1.14 GiB free. This supports investigating resource pressure; it does not prove the cause of a specific failure. Several Docker images use floating `latest` tags; the root package version remains `0.0.0`.

**Fix:** lazy-load major workspaces, compile styling, isolate optional workers, show current resource usage and start only required services. Pin container digests and upstream commits, introduce release versions and a dependency update/review policy. Measure cold start, memory, p95 requests and browser responsiveness under a defined service profile.

### P2 — F13: Specialist routing and model improvements remain a design promise

**Observed:** FPT Omega is currently a prompt-injection/manual-toggle path. FireRouter/Nexus/fine-tuning surfaces do not demonstrate an active trained-model lifecycle. RSI review/export controls are stronger than the legacy automatic prompt mutation path.

**Fix:** define the specialist-routing contract, eligibility, uncertainty triggers, budget, provenance and independent verifier. Restrict research solvers to approved deep-research/novel-problem workflows; admit only reviewed findings into memory. Use one candidate → evaluation → review → promotion pipeline for prompt changes and trained models. Major architecture changes require a separate reviewed implementation plan.

## 4. Current service and deployment inventory

| Service | Current observation | Meaning |
| --- | --- | --- |
| Quanta local app | Loopback port 3000; dev server | Current local source is running. |
| Hindsight | Loopback 8888; health responds | Service connected; bank policies and live memory workflow unverified. |
| Honcho | Loopback 8000; healthy | Session-memory service connected; live retention not exercised. |
| Paperclip | Loopback 3210; health 200 | Work Zone auth/provisioning still blocks operations. |
| HarnessRouter CE | Loopback 3100; retry status and UHP discovery 200 | Initial timeout does not mean absent installation. Version `463e02c094d0b6f240959c3395b468884f9d7bbb-quanta-font-rangefix`. |
| OpenDots | Loopback 4310; retry succeeds, two dots | Backend exists; model and Intelligence settings are missing. |
| TradingAgents sidecar | Loopback 8788; ready, research-only | Readiness is separate from completed research outcomes. |
| OpenMuse | No active expected listener | Personal/Consumer OpenMuse task path currently offline. |
| Ollama Local / OmniRoute | Expected listeners absent | Local route activation is incomplete. |
| Obsidian sync | Not running | Mount configuration is not live ingestion. |
| Supabase Auth | Public settings 200; anonymous signup enabled | Does not prove contact-table writes, email delivery or isolation in the live database. |
| Supabase Edge Functions | Three ACTIVE functions, verify JWT enabled | Deployment is real; memory and harness dependencies are incompletely configured. |
| Vercel frontend | `https://quanta-core.vercel.app/` returns 200 | Older bundle; exact deployed SHA unverified. |

Protected local API negative probes rejected missing operator headers and a foreign Origin with 403 on the five sampled endpoints. Quanta-owned Docker ports are bound to loopback. These are useful controls, not an exhaustive penetration test or multi-user certification of the trusted local-operator model.

## 5. Validation performed

| Check | Result | Limit |
| --- | --- | --- |
| TypeScript (`tsc --noEmit`) | PASS | Types do not establish runtime integration. |
| Fresh Vite production build | PASS; 3,218 modules | Large-chunk warning; roughly 6m52s under current host load. |
| Broad Node offline suites | **92 passed / 93 total; 1 failed** | Hermes error-message assertion; approximately 10m36s. Includes fixtures, not paid model execution. |
| Isolated Hermes rerun | **Same assertion failed** | Code rejects the unoffered scope; test wording is stale, subsequent test assertions remain unverified. |
| TradingAgents Python suite | **17 passed / 18 total; 1 failed** | HTTP fixture startup exceeded 90s; approximately 13m44s suite duration. |
| Focused HTTP fixture follow-up | **Same 90s readiness failure reproduced** | One failed test, 156.65s total. Worker stderr is suppressed by the current test; exact startup cause remains unknown. |
| RSI Python suite | **7 passed / 7 total** | Fixture/worker tests; approximately 2m40s. No live improvement run. |
| Local GET probes | 21 operational/status endpoints sampled | No task dispatch, write, paid inference or trade. |
| Origin/operator negative probes | Ten requests across five endpoints rejected with 403 | Only the sampled boundaries were checked. |
| Credential exposure check | No current exact-match secret values found in six generated JS files | Three nonempty local secrets checked; not all historic secrets or arbitrary encodings. |
| Dependency advisory check | **Incomplete: no usable result** | `npm audit --omit=dev --json` did not return within the audit's bounded follow-up and was stopped. No clean dependency verdict or vulnerability count is claimed; no upgrades applied. |
| Browser smoke | Work Zone empty/provisioning state observed; screenshot saved | Further tab inspection repeatedly timed out; no full route/mobile/accessibility pass. |
| GitHub main | Local and remote SHA match | Working-tree changes are not part of that SHA. |
| Hosted app/Auth/Edge inventory | Read-only checks succeeded | Deployment commit, active provider inference, live RLS and SMTP delivery remain unverified. |

## 6. Twelve-layer architecture diagnosis

| Layer | Assessment | Main gap |
| --- | --- | --- |
| 1. Provider/tool interfaces | Real adapters and bounded gateways | Runtime configuration is broader in the catalog than in live availability; deterministic tool permissions need work. |
| 2. Context and knowledge | Role/source/KB scaffolding exists | Legacy `All Agents` admission differs from private-agent/master-KB design. |
| 3. Persistent memory | Two real connected backends | Production routing, policy admission, private-agent recall and verified-fact lifecycle. |
| 4. Reasoning/planning | Role prompts and real pinned research graph | No completed live research result; FPT routing is not a solver orchestration pipeline. |
| 5. Multi-agent orchestration | Agent House, Paperclip and Hermes adapters | Auth/provisioning blocks real worker organization; multi-worker collaboration unverified. |
| 6. State, durability and recovery | Research/RSI event artifacts and frozen configuration | Cross-service recovery and a tested restore exercise are missing evidence. |
| 7. Evaluation and learning | Offline tests, replay, review/export scaffolding | Incomplete green baseline, no measured live RSI improvement, automatic legacy prompt changes. |
| 8. Harness and isolation | Docker/loopback boundaries and request budgets | Prompt instructions do not disable tools; computer sessions are not verified. |
| 9. Identity/security | Protected server credentials, scoped APIs, JWT Edge functions | Optional browser key path, remote RLS verification and local trusted-operator assumptions. |
| 10. Observability/cost | Real research journals and gateway reservations | Some telemetry simulated; need unified real traces and complete auxiliary-call accounting. |
| 11. User experience | Broad modern interface and error/empty states | Clearly distinguish demo, configured, connected, authorized, running and completed states. |
| 12. Release/operations/governance | Static hosting and installed service stack | Mixed unreleased checkout, missing CI, optional worker startup load and uneven promotion rules. |

## 7. Readiness score and rollout boundaries

| Area | Awarded / available | Reason |
| --- | --- | --- |
| Build and release | 8 / 15 | Build passes; release parity and CI absent. |
| Identity and credential handling | 12 / 15 | Strong tested local/server boundaries; legacy browser path and live RLS gaps. |
| Inference and cost controls | 10 / 15 | Scoped gateway implemented; fresh successful live flow not demonstrated. |
| Memory and privacy | 5 / 15 | Backends connected; custody/scoping/admission issues. |
| Agent orchestration and tools | 5 / 15 | Real adapters; Paperclip and computer/reasoning workflows incomplete. |
| Research and evaluation | 8 / 15 | Journals, review scaffolding and tests; real runs fail and two suite checks fail. |
| Hosted operations and recovery | 4 / 10 | Frontend/functions live; dependencies, release identity and recovery not fully verified. |
| **Total** | **52 / 100** | **Risky: limited internal beta only after the intended path is explicitly qualified.** |

Public autonomous-operation claims are blocked by F01–F06. A curated local demo can use the existing UI and connected services while clearly identifying simulations and unavailable runtimes. A production workflow must earn its own completion status through observed results.

## 8. Ordered work plan

| Order | Work package | Acceptance evidence |
| --- | --- | --- |
| 1 | Repair Work Zone authentication and qualify one operator workflow | Same owner can load/provision organization, name a worker, assign a permitted harness, complete a bounded task and store a review; cross-owner requests rejected. |
| 2 | Establish a green validation baseline | Hermes semantic rejection test fixed; HTTP readiness/cancellation/owner-death verified; all Node/Python suites plus types/build pass in reproducible commands. |
| 3 | Qualify inference and one research result | Provider preflight succeeds; reviewed graph stays within frozen budget; actual result and provenance persist; retry behavior and error class verified. |
| 4 | Fix memory custody and knowledge promotion | Correct dev/local-prod/hosted targets; opt-in screening; private agent recall; explicit master-KB promotion; raw/derived/verified distinctions. |
| 5 | Enforce tool permissions and stop unreviewed improvement | Server capability profiles, side-effect approvals and candidate review; malicious content cannot broaden tool scope or mutate live prompts. |
| 6 | Reconcile product claims and optional services | Prototype labels; unconfigured routes hidden or show setup guidance; OpenMuse/OpenDots/computer/FPT paths each receive a specific completion test. |
| 7 | Package a reviewed release | Intentional commits, CI, pinned images, schema/RLS inventory, restore plan; hosted feature/environment matrix and exact deployment SHA. |
| 8 | Improve startup and operational visibility | Lazy chunks, optional service profiles, real trace backend and measured resource/latency budgets. |

Changing shared-memory defaults, the automatic reflection workflow, harness permission architecture or deployment topology is a major behavior change. This audit proposes those changes; it does not implement them without a reviewed scope.

## 9. Missing evidence and confidence limits

- No paid provider request, Firecrawl capability retrieval, computer action, financial order, external message, model training or live RSI improvement was launched.
- No new guest account, magic link or email was sent. Anonymous auth settings are enabled, but live contact capture/RLS and SMTP delivery remain unverified.
- No actual memory turn was retained. Hindsight bank policy inspection timed out; existing policies and current stored content remain unknown.
- Current browser account entitlement and key presence were inspected as status, not proven by fresh inference. Claude and Grok native credentials report expired; Gemini reports disconnected. Access-token expiry alone is not proof that every refresh-capable account is unusable.
- No write-capable harness was exercised. The enforcement finding concerns the inspected boundary and requires verification of the downstream profile.
- The browser saw the Work Zone organization empty state. Further browser automation timed out, so visual, responsive and full route coverage are incomplete.
- Exact Vercel source revision was not retrievable through the connected deployment tools. Bundle comparison is direct evidence of missing recent route strings, not an invented deployed commit.
- The dependency advisory attempt produced no usable result and was stopped. Current dependency vulnerabilities remain an explicit verification gap. Source and third-party contract checks do not replace an exhaustive security assessment. No successful backup restoration or disaster-recovery rehearsal was performed.
- Research decisions, demonstration metrics and historical grids do not establish tradable alpha or executable performance. A separate leakage-safe, cost-aware independent evaluation is required for strategy claims.

## 10. Evidence and reproducibility

Sanitized machine-readable findings: [QuantaCore_Audit_2026-10-12.json](C:/QuantaCore/docs/QuantaCore_Audit_2026-10-12.json).

Local audit evidence is under `C:\QuantaCore\.quanta\audit-2026-10-12` and is not intended for publication:

- `runtime.json`: status, journal summary, API boundary and environment-presence probes.
- `extra.json`: service retries, real research error diagnoses, gateway reservations and hosted secret **names only**.
- `production.json`: public bundle route checks and public auth settings.
- `node-tests.tap`, `hermes-retest.tap`, `trading-tests.txt`, `trading-http-retest.txt`, `rsi-tests.txt`: validation outputs.
- `npm-audit.json`: incomplete dependency advisory capture; no usable advisory result and no upgrade applied.
- `work-zone.jpg`: observed organization empty state.
- Supabase function/secret metadata artifacts are kept local; raw credential values are not included in the report.

The audit's fresh checks supersede older integration-status notes. Final acceptance must be tied to a reviewed commit, deployment environment and real workflow result rather than the presence of a feature card.
