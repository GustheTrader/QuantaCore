# Local hybrid cloud operations

Implemented October 3, 2026. Open http://127.0.0.1:3000/hybrid.html or Settings -> Hybrid Cloud in QuantaCore. The standalone local panel has bundled application code and local styling; it does not need a cloud login or a styling CDN. The full Quanta application retains its existing authentication and styling setup.

## What is implemented

- Separate Business and Trading provider settings and encrypted credentials using the existing ProviderStore (Windows current-user DPAPI).
- Zo operations/report jobs through its documented ask API; catalog authentication check.
- Abacus forecasts from an existing managed deployment using a deployment token. Model training, deployment creation and platform monitoring remain in the Abacus managed workspace.
- Fireworks supervised fine-tuning jobs using existing uploaded training and validation dataset IDs, durable status polling, and bounded inference jobs. RFT is a later research option, not an implemented capability.
- Local immutable job inputs, payload and result hashes, request metadata, domain-specific monthly spending reservations, exact-data/spend approval, and explicit submission.
- No automatic replay of uncertain paid submissions. Interrupted submissions retain their reservations; reconcile them in the vendor console.
- Trading expiry checks and paper mode. No broker or order capability exists in this module.
- Operator-recorded independent evaluations, Fireworks tuned-model registry promotion, pinned future domain inference jobs, and rollback. Promotion does not change the existing default provider for Quanta text agents.
- A local CLI and a paired-prediction holdout scorer. Evaluation records are operator claims supported by attached evidence; this module does not independently certify vendor metrics or settlement sources.

Business/Trading separation is a local logical boundary for one operator, not multi-user RBAC or guaranteed upstream tenant isolation. Use separate vendor workspaces/accounts and appropriately scoped credentials when stronger isolation is required. Zo's token has full workspace authority; a report prompt is not an enforceable tool permission boundary. Configure the Zo workspace's available integrations accordingly.

## Activation

1. Start the local app: run `npm run dev` from `C:\QuantaCore`, or run the project launcher `Start-Hybrid-Local.ps1` to use the built production app.
2. Open the local Hybrid Cloud panel. Select Business or Trading, then the provider.
3. Enter its credential directly in the local form. Abacus requires a forecast deployment token and pinned deployment ID; Fireworks requires an account ID for training and an exact baseline model ID for inference. These fields are never saved in browser storage or returned by the status API.
4. Set this domain's monthly reservation cap and enable the provider. The default cap is zero and no domain is enabled automatically. Catalog checks for Zo/Fireworks verify authentication, not an inference or training response. Abacus is verified by an explicitly approved forecast job.
5. Prepare a JSON payload and source metadata. A Fireworks training job references existing approved cloud datasets; this implementation does not automatically upload local files. Hash the canonical dataset separately. Training and validation IDs must be distinct; keep the final independent holdout out of optimization.
6. Create a local draft. Review its exact payload, source availability time, dataset hash, label definition, schema, code version, expiry and estimated cost. Approve export/use and the spending reservation, then submit.
7. Refresh local status for reports/inference. Training status is polled every minute while the local server is running and resumes after restart. Cloud training itself can continue while the PC is off.
8. Evaluate against the local/untuned baseline on an untouched holdout. Record measured results and limitations. Promote an improving Fireworks candidate explicitly; subsequent Fireworks response jobs in that domain use the pinned model. Rollback returns to the previous candidate or the configured baseline.

Spending reservations limit the estimates accepted by this local job gateway. They do not measure invoices or enforce provider charges: configure provider-side spending limits and use conservative estimates. Uncertain, completed and failed submissions remain reserved for their approval month. Cancelling an unsubmitted job releases its reservation. Paid resources and remote jobs must be stopped in their provider console; a local rollback does not delete them. Budget months use UTC consistently.

Changing saved credentials/configuration invalidates unsubmitted approvals; cancel and recreate those jobs for review. Polling an existing Fireworks job requires its original account ID. There is no automatic cloud-to-local fallback with a claim of identical model behavior; retain and explicitly use your independently tested local baseline.

## CLI

From `C:\QuantaCore`:

```powershell
node scripts/hybrid-cloud.mjs status
node scripts/hybrid-cloud.mjs draft C:\path\approved-request.json
node scripts/hybrid-cloud.mjs job JOB_ID
node scripts/hybrid-cloud.mjs approve JOB_ID --data-export --spend
node scripts/hybrid-cloud.mjs run JOB_ID
node scripts/hybrid-cloud.mjs poll JOB_ID
node scripts/hybrid-cloud.mjs evaluate JOB_ID --file C:\path\report.json
node scripts/hybrid-cloud.mjs promote JOB_ID --approve
node scripts/hybrid-cloud.mjs rollback business
```

Repeated CLI draft creation from the same exact request file is idempotent. The browser drafts have unique creation keys. Submissions are allowed exactly once per approved local job; duplicate clicks or lost responses do not resubmit it.

A request file contains `domain`, `operation`, `label`, `estimatedUpperBoundUsd`, `datasetHash` (SHA-256), `schemaVersion`, `labelDefinition`, `sourceAvailableAt` (ISO with timezone), `codeCommit`, optional `expiresAt` (required for Trading), and `payload`. Supported operations: `zo_report`, `abacus_forecast`, `fireworks_sft`, `fireworks_infer`. The UI shows payload templates. Use an approved source snapshot hash; hashing a prompt is not equivalent to hashing a referenced dataset.

## Independent pilot scoring

Prepare JSONL with one paired prediction per row:

```json
{"id":"example-1","availableAt":"2026-01-02T00:00:00Z","decisionAt":"2026-01-02T00:15:00Z","resolvedAt":"2026-01-02T00:30:00Z","target":1,"baseline":0.5,"candidate":0.8,"settlementSource":"official outcome reference"}
```

```powershell
node scripts/evaluate-hybrid-pilot.mjs trading C:\path\holdout.jsonl C:\path\new-report.json 2026-01-01T00:00:00Z 1
```

The final argument is an embargo in hours: select it from label overlap and feature availability, not from this example. Trading scoring computes Brier loss and checks binary outcomes, bounded probabilities, chronology, ordering, provenance presence and duplicate IDs. Business scoring computes MAE on numeric paired predictions with the same chronology checks. This is a forecast-quality pilot, not a cost-aware executable backtest, significance test or full calibration audit. A small score improvement alone does not establish trading edge.

For promotion of a trading specialist, provide external evidence of point-in-time holdout selection, untouched final evaluation, calibration where probabilities are produced, cost-aware causal replay where decisions are produced, authoritative outcomes and operational failure tests. Keep the LLM research specialist distinct from the calibrated predictive model.

## Local state and recovery

Encrypted keys: `C:\QuantaCore\.quanta\providers.json`. Jobs, policy, artifacts and model registry: `C:\QuantaCore\.quanta\hybrid-cloud.json`. Both are ignored by Git. Payloads/results may contain private data and are stored locally in plaintext; protect the machine and backups. Windows DPAPI credentials are tied to the current user and cannot be assumed portable to another machine.

On restart, in-flight POSTs become `uncertain` and are not replayed. Submitted Fireworks jobs retain their remote ID and resume GET polling. Timeout, malformed response, wrong job identity or provider failure never promotes a model. Keep the local state file backed up before migrating the runtime; do not run two independent Quanta servers against this state directory.

The previous direct browser Abacus agent call used an unverified endpoint and has been retired. Its UI now leads to Hybrid Cloud; this is not a claim that a legacy agent ID is compatible with a forecast deployment.

## Validation and remaining activation requirements

Run `npm run lint`, `npm run build`, and `npm run test:hybrid`. Automated tests use simulated providers and never spend credits or export real datasets. Live activation requires account/entitlement checks, approved spending caps and approved pilot data. At delivery, no live cloud training, inference or forecast pilot has been submitted.

Sources: https://www.zo.computer/guide/api ; https://api.abacus.ai/help/developer-platform/deployment/deploying-model ; https://docs.fireworks.ai/api-reference/create-supervised-fine-tuning-job ; https://docs.fireworks.ai/api-reference/get-supervised-fine-tuning-job
