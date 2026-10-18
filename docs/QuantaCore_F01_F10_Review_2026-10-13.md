# QuantaCore F01–F10 review — October 13, 2026

## Scope and current result

Second source review of the parallel fixes in `C:\QuantaCore`, followed by a restart of the compiled local app. This supplements the October 12 audit; it does not replace its historical evidence or claim that every finding is closed.

The checkout is on local `main`, commit `14b1b7963bba332aedd3e90725a9665e23f977c2`, with substantial uncommitted source from several work streams. No commit, push or deployment was performed for this review.

The combined TypeScript check passed. The current frontend built successfully with 3,220 modules, in 6m 24s under observed local resource pressure. The main JavaScript bundle remains about 2.09 MB before compression; Vite reports a large-bundle warning. Development requests timed out, so the current browser uses the compiled app through the local Express server on `http://127.0.0.1:3000`.

## Findings and completion status

| Finding | Current status | Evidence and work remaining |
| --- | --- | --- |
| F01 — Paperclip authentication and first workflow | **Completed for the approved local HTTP service scope** | Protected existing credentials authenticate; the signed-in user's organization persists. `QUAAAA-3` completed through actual heartbeat `296fcff0-deaa-4132-8ac6-14546c2b633e`, four passing checks, explicit user approval, one stored review, worker paused, $0 inference. Other worker presets remain unchanged. Generative/coding workers still require a separately qualified runtime. |
| F02 — Real research failures | **Code changes present; live qualification remains open** | Graph-budget checks, input reservation changes, provider-auth preflight and clearer 401/403 error mapping exist in the source. Token/context reservation is still an estimate. The current journal contains five real runs, all errors, and zero active runs. No new model run or provider spend was authorized or performed by this review. A bounded approved real run must demonstrate completion and independent source review. |
| F03 — Private knowledge and prompt improvement | **Partial** | Learning and reflection are opt-in. New model-distilled notes default to the originating agent and are marked unreviewed; sharing and prompt replacement require UI approval. Malformed reflection is an error. Pending prompt suggestions still lack a binding to their originating agent/request; see the second-look finding below. Auxiliary inference accounting and legacy shared-note review remain open. |
| F04 — Production localhost memory routing | **Local production default corrected in source** | `lib/memory-target.ts` selects local memory on loopback even for production builds. Explicit `VITE_QUANTA_MEMORY_TARGET` overrides the default; neither local env file currently sets it. The service and tooltip use the selected target. Hosted custody and hosted runtime qualification remain separate work. |
| F05 — Read-only harness enforcement | **Admission guard present; full runtime qualification remains open** | Local server checks the advertised tool list and rejects missing/blocked profiles before submitting a test task. Unknown named tools default to side effects. Tool names alone do not prove runtime permissions, workspace mounts or network restrictions. Unnamed tool entries are filtered out before checking; see the second-look finding below. Hosted allowlists and a configured restricted harness still need qualification. |
| F06 — Local/hosted release mismatch | **Open** | The mixed local working tree has not been packaged or deployed as a reviewed release. The local Express integrations require an explicit hosted-runtime plan. This review does not verify a new Vercel deployment revision. |
| F07 — Browser provider credentials and remote script | **Open** | `index.html` still loads the Tailwind runtime from its CDN. Legacy Gemini code still supports a browser-resident key. Server transport, compiled Tailwind and a reviewed CSP remain needed. No credential theft or currently stored browser secret was established. |
| F08 — Memory Defense and per-agent custody | **Approved pilot completed; general admission still open** | The dedicated Obsidian bank has Memory Defense enabled and completed one local `Welcome.md` retain/recall with zero LLM traces. General local and hosted chat-bank creation still omits defense policy and uses per-user Hindsight identity. The pilot does not qualify those banks, redact existing content, authorize ongoing ingestion, or establish per-agent isolation. |
| F09 — Simulated runtime labels | **Labels implemented on reviewed screens; real tracing remains open** | Prototype banners exist in Agentic OS, AgentZero, Edge Mech and IronClaw; the Langfuse label identifies simulation. These features remain prototypes. A displayed simulated stage is not sandbox, telemetry or execution evidence. |
| F10 — Tests and CI | **Partial** | Hermes assertion semantics and Python sidecar startup diagnostics were improved. The parallel author's report states 21 focused tests passed; that is not a fresh full-suite result from this review. No `.github` CI directory exists. A full Windows validation pass and CI/release command remain open. |

## New findings from the second source review

### F03 follow-up: bind a prompt candidate to the agent that produced it

`components/ChatInterface.tsx` retains `lastReflection` as a bare `ReflectionResult`. Its active-agent effect does not clear that candidate. `approveSuggestedPrompt` applies the retained candidate to the **current** `activeAgent`. `App.tsx` renders the same unkeyed `/chat` component when route state changes. A pending result can therefore survive an agent switch in the source-defined lifecycle and be applied to the wrong agent. An asynchronous reflection can also finish after the switch.

This is a source-level finding; no inference was run to reproduce it in the browser. Bind the candidate to immutable agent ID, baseline prompt hash and request ID; invalidate stale completions; refuse approval when the current agent or baseline differs. Reset the loaded prompt when the newly selected agent has no saved configuration. This is required before F03 is marked closed.

### F05 follow-up: fail closed on unnamed tools

`server/harness-router.ts` maps advertised tools to names and calls `.filter(Boolean)` before `checkProfile`. A mixed list containing a recognized read tool and an unnamed tool can reach the guard with the unnamed entry removed. `lib/capability-profiles.ts` would reject an empty name if it received it, but the caller drops it first.

Reject malformed/unnamed entries before capability classification. Require a stable reviewed tool manifest and verify the downstream harness enforces that manifest. No write-capable task or destructive probe was executed by this review.

## Operational boundaries

- Operations Verifier is the one explicitly approved standard HTTP service worker. It uses an expiring one-task capability, validates company/worker/task/run ownership, makes no model calls, and exposes no shell, browser or financial action.
- Its report, native heartbeat, human review and final pause are actual operational evidence. Earlier failed attempts remain visible.
- Obsidian ingestion is limited to the approved 203-byte `Welcome.md`. The source vault is unchanged and read-only; the watcher is off. General Hindsight still has a cloud route, which the pilot bank bypasses for chunk ingestion. This is not a global egress firewall.
- Five existing real research failures remain in the immutable journal. None was turned into a success by changing error labels or running a fixture.
- No broad test suite, provider inference, financial action, external message, Git push or hosted deployment was performed in this follow-up.

## Reports

- [Paperclip completed workflow](C:/QuantaCore/docs/Paperclip_First_Workflow_2026-10-13.md)
- [Obsidian completed pilot](C:/QuantaCore/docs/Obsidian_Sync_2026-10-13.md)
- [Parallel fixes and their reported test scope](C:/QuantaCore/docs/Audit_Fixes_2026-10-13.md)
- [Original audit](C:/QuantaCore/docs/QuantaCore_Audit_2026-10-12.md)

Machine-local sanitized restart and source-manifest evidence is stored under `.quanta/workzone-repair-2026-10-13/`, ignored by Git.
