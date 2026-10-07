# Business model bridge

This bridge reuses the authenticated Paperclip container on port 3210 and the existing Quanta build organization. Open House Channel is Quanta's named-agent interface, not another name for Paperclip. Open House can hand an identity into the separate Paperclip Work Zone.

## Installed bridge

- `/api/business-bridge/v1/models` and `/v1/chat/completions`: non-streaming OpenAI-shaped text requests to Quanta's configured **Ollama Local** connection. Connector model ID is `local`; provider/model settings remain in Quanta. No tools, publications, contacts, transactions or paid-model fallback. A usable local model must actually be running; a prepared connector is not a verified model response.
- `/api/business-bridge/jobs`: create Business-only Zo reports, Abacus forecasts and Fireworks inference drafts. Stable `Idempotency-Key` required. Full source metadata, payload and cost fields follow the existing Hybrid Cloud contract. Review, export/spend approval and submission stay in the Hybrid Cloud panel. This route never auto-approves; it is not an OpenAI-compatible paid chat completion.
- `/api/business-bridge/paperclip/heartbeat`: bound planning worker. Loads the actual assigned Paperclip issue, checks company and agent membership, invokes the local model, saves evidence in `.quanta/business-results`, and posts a planning comment. It does not mark the business task complete or perform any proposed business action. Durable run IDs prevent automatic repeat execution after uncertain failure; inspect the artifact and comment before deliberately issuing a new run.
- `/api/business-bridge/status`: local operator health and binding metadata only. Model-response verification is not inferred from catalog health.

Server-side clients use separate bearer keys; the gateway stores hashes in `.quanta/business-bridge.json`. Recoverable client credentials are encrypted in `.quanta/bootstrap-credentials.json` through ProviderStore (Windows current-user DPAPI), and remain in the private Paperclip adapter configuration. Protect the Windows account and back up Paperclip privately. Model-provider credentials continue using ProviderStore encryption. Revocation: remove a client entry from the hash configuration; the next request is rejected.

## Setup and existing Paperclip

Run `node scripts/setup-business-bridge.mjs` from `C:\QuantaCore`. It reuses the existing build company and provisions one `Business Model Analyst`, paused with automatic heartbeats disabled. It preserves existing Work Lead, Builder, Quality Reviewer and trading workers. Re-running reuses the marker and credentials rather than creating another analyst. Review the new analyst before enabling it.

Paperclip calls `http://host.docker.internal:3000/api/business-bridge/paperclip/heartbeat`. Docker-to-host reachability was verified on this Windows machine. The Compose file opts exactly `http://host.docker.internal:3000` into Paperclip's private HTTP adapter allowlist. Quanta remains loopback-bound; no LAN listener is added. Each request still needs its scoped key, matching worker identity and assigned-company task. Paperclip's HTTP adapter discards response content; posting the planning comment is therefore required for useful visible results.

## Activepieces and Twenty

These applications were not found among the running local containers. The bridge prepares independent keys for each; it does not claim either application is installed or connected.

For a server-side custom OpenAI-compatible action, use base URL `http://127.0.0.1:3000/api/business-bridge/v1`, model `local`, and that application's key. A Docker-hosted connector uses `http://host.docker.internal:3000/api/business-bridge/v1`. Keep credentials on the service, never in frontend code. Use an HTTP/custom connector when the application does not support a configurable OpenAI base URL. Native Twenty model-provider compatibility remains unverified.

Example action request: POST `/api/business-bridge/v1/chat/completions`, Authorization `Bearer YOUR_SCOPED_KEY`, Content-Type `application/json`, body `{ "model": "local", "messages": [{ "role": "user", "content": "Draft a launch experiment with acceptance criteria." }] }`.

For cloud work use POST `/api/business-bridge/jobs` with a stable Idempotency-Key and the documented hybrid job request, for example operation `fireworks_infer`, payload `{ "input": "Analyze the approved evidence." }`. The server forces domain `business`; operations for training and all approval/run/promotion endpoints are rejected. Retrieve the result from the operator panel, not the connector. Zo can invoke workspace tools after an operator submits an approved job; use a report-only workspace with restricted integrations.

Each connector allows at most ten requests per minute and one concurrent local model call. These are service safeguards, not invoice enforcement. No cloud call occurs through the local model route. Connector calls do not get broad Quanta gateway keys or trading access. Single-owner deployment; hosted tenant identity is not implemented.

## Operational limits

Diagnostics: `node scripts/check-business-bridge.mjs` checks health and an authenticated Docker heartbeat HEAD probe. Add `--model` to attempt a real local-model response without cloud egress. `node scripts/business-model.mjs activepieces plan INPUT.txt` is a runnable connector example; `twenty draft REQUEST.json` creates a cloud draft without submitting it.

This is the model and planning bridge, not a full business automation deployment. CRM CRUD, campaign launches, outreach, billing, product deployments, autonomous revenue experiments and cloud-result callbacks need separate action contracts and approval policies. Chatwoot, ERPNext and GrowthBook remain deferred.

References: https://docs.paperclip.ing/reference/adapters/http/ ; installed adapter source `C:\Paperclip\server\src\adapters\http\execute.ts` ; `docs/hybrid-cloud-operations.md`.
