# Paperclip first operator workflow — October 13, 2026

## Completed result

**The first local operator workflow completed, including explicit human review.**

| Item | Observed result |
| --- | --- |
| Organization | Quanta Work Zone · 06aba0 (`c855c4dd-5242-4749-869b-d81e4607a951`) |
| Worker | Operations Verifier (`09391c28-cebd-48ff-91c5-2bd4513c19ae`) |
| Task | `QUAAAA-3` (`f0105d0f-92ec-49c9-8380-ec86b08e13fc`) — **done** |
| Actual native heartbeat | `296fcff0-deaa-4132-8ac6-14546c2b633e` — **succeeded** |
| Delivery | `c00cf0af-2220-4eda-ad18-84420831de43` — **approved** |
| Report | Four passing checks: authenticated service, company/worker/task/run ownership, deterministic HTTP harness, private + master KB |
| Review | User approved the displayed delivery; one persisted evaluation review, timestamp `2026-10-13T17:00:31.742Z` |
| Knowledge | One worker-private note and one explicitly shared master note; other workers' private note text was not used |
| Inference / provider spend | Zero calls / $0 |
| Final worker state | **paused**, recurring and assignment heartbeats disabled |
| Report checksum | `eddbee6b1250d61491907cf1162fccdee7ff920a1efb915a163f79fdc0c7e022` |

Native task/run state and the local approval record were read again after approval. The first three failures remain in the history; they were not counted as successful deliveries. This is a qualified deterministic HTTP service workflow, not a qualified generative, coding, trading or sandbox execution workflow.

## Verified progress

- Saved protected Paperclip credentials authenticate successfully; no account or password was reset.
- Quanta's local bridge was reloaded with single-flight login, meaningful auth errors and one refresh after an expired-session 401.
- The existing local build and trade organizations load with HTTP 200 and were preserved.
- The signed-in Quanta user created a separate build organization through the UI: `Quanta Work Zone · 06aba0`, prefix `QUAAAA`, ID `c855c4dd-5242-4749-869b-d81e4607a951`.
- Its first worker is **Operations Verifier**, ID `09391c28-cebd-48ff-91c5-2bd4513c19ae`, with the HTTP adapter, zero model inference, disabled recurring/assignment heartbeats and zero budget.
- One worker-private note and one shared master-KB note exist in this operator's local workspace. Neither was exported to a model or promoted into another agent's memory.
- Actual Paperclip heartbeats were attempted and their failures retained. The fourth attempt produced the successful native run and reviewed delivery above.

## Native isolation finding and approved service exception

Paperclip's `low_trust_review` preset requires all of the following:

1. A concrete company and issue boundary.
2. Isolated workspaces enabled.
3. The task using `isolated_workspace` mode.
4. A real `sandbox` environment driver.

The current worker now has a concrete issue boundary configured through Paperclip's dedicated permissions endpoint. The latest actual run stopped with `low_trust_isolation_unavailable`: isolated workspaces are disabled. Enabling that flag alone is insufficient; a real sandbox provider and task workspace are also required. A fake/test sandbox is not a security boundary and will not be used as evidence of isolation.

Recorded attempts:

| Attempt | Observation |
| --- | --- |
| 1 | Actual heartbeat `8d420c37-d804-470c-8ccf-1c9ecbe47db0` blocked because low-trust issue boundary was missing. |
| 2 | Configuration was rejected because generic agent PATCH forbids changing permissions. No heartbeat ran for this attempt. |
| 3 | Correct dedicated permissions endpoint accepted the issue boundary. Actual heartbeat `44a46f99-777f-404a-bba3-fe1ee5367bc5` blocked because workspace isolation is disabled. |

The three earlier attempts remain in the history. They did not deliver a report or earn an evaluation pass.

The operator subsequently approved **“Approve scoped HTTP verifier.”** Quanta records that exception in the ignored local file `.quanta/workzone-trust-approvals.json`, bound to company `c855c4dd-5242-4749-869b-d81e4607a951` and worker `09391c28-cebd-48ff-91c5-2bd4513c19ae`. It permits the `standard` native preset for this deterministic HTTP verifier only. New verifiers and other worker presets retain their existing settings.

The successful workflow setup cleared this worker's native low-trust boundary using the dedicated permissions endpoint before creating the new planning issue. Callback authorization remained bound to one company, worker, task, heartbeat and expiring capability. The generated report identifies the approved service profile explicitly: it has no native sandbox. The report was then reviewed and approved separately by the human operator.

## Concrete options for the operator

### A. Scoped HTTP service verifier for this first non-AI task

Treat **only Operations Verifier** as a trusted, deterministic service worker under Paperclip's `standard` preset. This changes its native trust classification and removes the sandbox requirement for that one worker. The operator explicitly approved this option on October 13, 2026.

The proposed service remains constrained by the Quanta callback:

- One short-lived, single-task capability bound to its company, worker, issue and actual heartbeat.
- No provider credential, inference, shell, browser, filesystem tool, trade or external business-action capability.
- No agent/skill creation or task assignment permission.
- It reads authenticated local service status and its own assigned task; KB output contains scoped counts, not private note text.
- Result and checksum persist, and the native heartbeat must succeed before delivery approval.
- Human review is required to close the planning task; the worker returns to paused.
- No automatic promotion into the master KB or another memory service.

This is suitable for the initial operational-verification job. It is **not** a sandboxed generative/coding worker and must not be presented as one. Other worker trust presets remain unchanged. Coding, browsing, model-generated actions and untrusted task execution require a separately qualified sandbox.

### B. Keep low-trust and configure a real local sandbox first

Keep the existing preset and add a real sandbox provider, task-owned workspace and bounded runner. The source includes plugin-based providers (including Kubernetes); selecting and installing a real local provider is a separate infrastructure change. Provider permissions, mounts, resource limits, secrets and lifecycle need a reviewed configuration before activation. No fake provider or implicit paid-cloud fallback will be used.

## Implementation files

- `server/workzone-router.ts`: session recovery; bounded verifier setup/callback; ownership checks; native heartbeat observation; persisted evidence; explicit human approval and worker pause.
- `lib/workzone-contract.ts`: delivery contract.
- `services/workzoneService.ts`: setup and approval actions.
- `components/OperatorWorkZone.tsx`: workflow and evidence UI.

TypeScript passed after the scoped profile implementation, and the targeted whitespace check passed. Direct operational checks discovered and corrected the permissions API contract. The production frontend built successfully (3,220 modules; large-bundle warning remains). The compiled app served locally on port 3000 and its browser UI showed the successful heartbeat, approval, completed task and saved review. No unit suite was run for this workflow.

Ignored diagnostic evidence is under `.quanta/workzone-repair-2026-10-13`. No provider keys, session cookies or raw capability tokens are included in this report. The local Quanta app remains running on port 3000; Paperclip remains loopback-only on 3210. No source was committed, pushed or deployed.

## Obsidian parallel task

The separately approved `Welcome.md` pilot completed using local source chunks, local embeddings/reranking, Memory Defense and no synthesis. There was one persisted document and one real recall result, zero LLM traces and $0 inference. Continuous sync remains stopped under the one-note approval. See [Obsidian connection report](C:/QuantaCore/docs/Obsidian_Sync_2026-10-13.md).
