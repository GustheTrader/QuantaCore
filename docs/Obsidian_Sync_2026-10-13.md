# Obsidian connection — October 13, 2026

## Result

**The approved one-note pilot completed and was recalled from local Hindsight. Continuous sync is stopped.** The user approved only the current `Welcome.md` note; that approval does not cover future edits, additional notes, or an ongoing watcher.

| Check | Verified result |
|---|---|
| Canonical vault | `C:\Users\jeffg\Desktop\CFB_Edge\docs\Gus`, the vault registered with Obsidian |
| Approved source | `Welcome.md`, 203 bytes; exact SHA-256 checked before and after |
| Destination | Dedicated local Hindsight bank `quanta-obsidian-gus` |
| Persisted document | `Gus/Welcome.md`; one document total |
| Actual worker result | Retain `fa7cb67c-04d1-49ff-a5dd-a0e941a0ee47` completed; its batch also completed |
| Retrieval | One source chunk returned by a real local recall request |
| External model requests | Zero LLM trace entries for this bank |
| Paid inference | $0; ingestion and retrieval use local processing |
| Vault integrity | Source file unchanged; Docker mounted the vault read-only |
| Index | Separate Docker volume `quanta_obsidian_pilot_index`, outside the vault |
| Continuous ingestion | No watcher, active sync container, or background job |
| Agent sharing | No agent automatically connected to this bank; no master KB promotion |

This result is actual ingestion and retrieval, beyond a healthy container or a configured mount.

## Local processing policy

The running Hindsight image is **0.10.1**. Inspection of its installed extraction function confirmed that `chunks` mode returns before invoking an LLM. Its embedding and reranking providers are both `local`.

The dedicated bank has persisted overrides:

```json
{
  "retain_extraction_mode": "chunks",
  "enable_observations": false,
  "enable_auto_consolidation": false,
  "enable_temporal_retrieval": false,
  "enable_graph_retrieval": false,
  "enable_text_search": true,
  "enable_reranking": true,
  "audit_log_enabled": true,
  "memory_defense": {
    "enabled": true,
    "rules": [{ "on": "sensitive_data", "action": "redact" }]
  }
}
```

This stores searchable source chunks. It does **not** synthesize facts, observations, entity relationships, mental models, or answers through `reflect`. No reflect request was made. Memory Defense applies to future retains in this bank and does not change the canonical Obsidian note. The pilot verified its policy configuration; it did not submit additional secret-pattern fixtures outside the approved note scope.

The general Hindsight server still has an OpenRouter model route configured. These bank overrides bypass it for this ingestion workflow. They are not a global egress firewall or permission to run cloud reflection. No settings in another memory bank were changed.

## Files changed

- `docker/obsidian-sync/Dockerfile`: pinned the Node base image digest and created an index directory owned by the unprivileged `node` user. This fixes first-run index-volume write permissions.
- `scripts/obsidian-pilot.mjs`: exact-note approval/hash guard, local runtime checks, persistent bank policy, one-time read-only reconciliation, asynchronous worker completion check, document/recall verification, and a completed-pilot guard. It accepts no watch option.
- This report.

Machine-local evidence remains ignored by Git under `.quanta/obsidian/`: `pilot-before.json`, `pilot-approved.json`, `pilot-result.json`, and `pilot-final-metadata.json`. They contain no provider keys or note bodies. The immutable source hash and scope live in the approval record. The result reports counts and state; it does not expose the returned note content.

## Operator commands

Show the prepared scope without ingestion:

```powershell
cd C:\QuantaCore
node scripts/obsidian-pilot.mjs
```

The already completed `--pilot` is blocked from re-ingesting. The old broad compose `--watch` example remains outside this one-note approval and must not be used to enable continuous ingestion accidentally.

Read-only operational verification:

```powershell
Invoke-RestMethod http://127.0.0.1:8888/v1/default/banks/quanta-obsidian-gus/config
Invoke-RestMethod http://127.0.0.1:8888/v1/default/banks/quanta-obsidian-gus/documents
Invoke-RestMethod http://127.0.0.1:8888/v1/default/banks/quanta-obsidian-gus/operations
docker ps --filter name=quanta-obsidian
```

## Next scope decision

To make ongoing local sync operational, choose the folders or notes to ingest and explicitly authorize watching future changes. Then keep this local chunk policy, recheck it before each admission, retry failed operations without treating acceptance as completion, and grant selected agents explicit retrieval access. Access to a private source bank and promotion into the master KB should remain separate controls.

No application restart, vault modification, shared KB mutation, cloud note export, commit, push, or deployment was performed by this subtask.
