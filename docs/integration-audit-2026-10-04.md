# Quanta integration audit — 2026-10-04

Verdict: suitable for supervised local integration work, with unresolved blockers for unattended operation. This is a code, fixture-test and read-only runtime audit, not a completed production penetration test or provider performance benchmark.

## Severity-ranked findings

| Severity | Finding | Disposition |
|---|---|---|
| High | OpenAI account could change between route validation and token acquisition. A catalog could also finish loading after account selection changed. | Fixed: token acquisition is bound to the request account inside the serialized OAuth manager; route saves recheck the account after discovery. Regression tests reject mismatches and catalog races. Evidence: server/chatgpt-oauth.ts:136; server/chatgpt-plan.ts:74,84. |
| High | A cloud-backed Ollama tag could enter the local-only Business connector route through its loopback endpoint. Loopback transport is not proof of local computation. | Known cloud tags are now rejected before inference. Evidence: server/business-bridge.ts:28,73. Residual: tag checks cannot prove that a custom model/server is offline. A truly local-only worker needs a separately isolated inference runtime with restricted egress. |
| High | General agent/API-key inference does not inherit the reviewed Hybrid job queue's per-domain reservations and approvals. One general gateway key can address multiple configured providers. | Fixed in approved remediation: broad keys rejected; scopes pin one route/endpoint/credential and enforce persisted call, rate, concurrency, input/output and reservation limits. Provider invoice controls remain external. Evidence: server/inference-router.ts:118,174. |
| High | Paperclip's email/password bootstrap is read from an ordinary local JSON file; connector provisioning also retains recoverable raw client keys in a separate JSON file. | Fixed in approved remediation: verified Windows DPAPI migration removed all three legacy plaintext sources; consumers and Docker launcher use protected storage. Existing credentials were preserved, not rotated. Protect private Paperclip runtime/database access. Evidence: server/business-bridge.ts:128; scripts/setup-business-bridge.mjs; .quanta/business-connector-keys.json. |
| Medium | Provider JSON could be buffered without a byte limit in new OAuth/catalog paths. | Fixed for OpenAI/Google OAuth and the ChatGPT plan catalog/error paths: streamed JSON is capped at 2 MB and readers are canceled. Existing general compatible-provider JSON and streaming paths still need broader body/output limits. Evidence: server/bounded-json.ts:2. |
| Medium | Google model selection could save a catalog result after its authorization grant changed. | Fixed with an internal grant ID and a serialized recheck before saving. Evidence: server/google-oauth.ts:67. |
| Medium | Windows credential protection could hang and stall the write/refresh queue indefinitely. | Fixed with a 45-second subprocess timeout and failure that preserves prior stored files. Evidence: server/provider-store.ts:20. |
| Medium | Google API test could treat a nonempty but incomplete response as success. | Fixed: a successful test requires STOP termination and usable text. Evidence: server/google-oauth.ts:75. |
| Medium | Google OAuth is not yet a full agent/Business inference route, and non-OpenAI providers have not been authorized and exercised live in this audit. | Explicit readiness limitation. Google OAuth currently provides catalog selection and explicit connection tests. API-key Google routing is separate. Complete consent, validate live responses, quotas, scopes and termination semantics before operational claims. |
| Medium | OAuth callback URLs are fixed to port 3000 while QUANTA_PORT is configurable. Multi-process/shared-user deployment is not covered by the file store and in-memory queues. | Supported audited topology is one local process at 127.0.0.1:3000. Central identity/policy persistence, dynamic callback binding and deployment readiness checks need a separate design before changing topology. |
| Low | Settings had inconsistent cache and socket-origin restrictions. | Tightened general inference settings to loopback peers and no-store; OAuth responses include no-referrer. Local administration trusts the signed-in Windows user and same-origin app. It is not isolation from malware or XSS under that user. |

## Architecture assessment

The separation between the local operator UI, encrypted provider/OAuth credentials, scoped Business connector keys, and reviewed Hybrid jobs is useful and implemented in code. Business connectors reject tools, streaming and nontext inputs and cannot approve or execute cloud drafts. ChatGPT plan inference requires a saved account-bound model route and explicit Business permission, with no API-key billing fallback. OpenAI token exchange uses PKCE/state/nonce and verifies JWT issuer, audience, signature and identity. Refresh is serialized; disconnect clears local credentials even when remote revocation cannot be confirmed.

This does not make every route equally governed. ProviderConnections selects the general text-agent gateway; the Hybrid panel selects domain-specific job credentials and model routes; ChatGPT plan usage has its own limits and permission. These are distinct control planes, not one interchangeable connection with one enforced budget. Model prompts are advisory; deterministic routes and allowed API operations supply the actual execution boundaries.

The venue gateway only offers fixed market-read endpoints and rejects execution. Trading cloud jobs have separate credentials, expiry, approval and source/version metadata. Fine-tuned model promotion requires evaluation and supports rollback. These controls do not establish strategy profitability, calibrated settlement probability, or safe live trading.

## Validation

- Integration suite: 38 tests passed across OAuth, bounded JSON, Business bridge, model gateway, Hybrid queue and read-only venues. Added account/catalog-race regression also passed in a separate 4-test plan run.
- TypeScript check passed; follow-up checks cover final hardening changes.
- Production dependency audit reported zero known vulnerabilities. This is registry evidence, not proof that dependencies are vulnerability-free.
- Live OpenAI catalog was verified in the preceding implementation; this audit does not send paid/plan inference probes or activate workers.
- Negative fixtures cover missing credentials, rejected origins, URL injection, account/client mismatches, permission denial, oversized responses, quota failure after partial output, reservation oversubscription, uncertain retries and invalid promotion.
- Google credential persistence was exercised through actual Windows DPAPI with isolated fixture data; tokens remained absent from public status and plaintext files.
- Authentication tests use injected identity verification fixtures; they do not independently exercise every real-provider JWT/key-rotation failure case. Production code uses jose's remote JWKS verification. Callback HTTP/browser-flow replay coverage and a live Google consent run should be expanded before external distribution.

## Ordered next steps requiring architectural approval

1. Migrate the remaining bootstrap and connector secrets into protected storage, verify consumers, then rotate credentials with a recovery plan.
2. Add one policy layer for autonomous agent routing: scoped client/route permissions, quotas, concurrency, usage records and explicit export/spend permissions. Preserve provider-specific authentication adapters.
3. Isolate local-only inference from cloud-enabled Ollama runtimes and validate actual egress boundaries.
4. Complete live conformance checks for each authorized provider, then expand Google OAuth into agent routing if desired. Keep provider capability and billing distinctions visible.
5. Add browser callback replay tests, restart/refresh-failure recovery tests, pagination/capability filtering and typed state schemas. Establish a single-process support contract or migrate durable state before multi-user/cloud hosting.

Official references reviewed: [OpenAI local sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [Google API OAuth](https://ai.google.dev/gemini-api/docs/oauth). Google's own quickstart explicitly describes a simplified testing setup; fixture success is not production readiness.
# Remediation update

The two approved gaps (plaintext bootstrap credentials and the unscoped general gateway) were subsequently fixed and verified. See [implementation and verification](integration-remediation-2026-10-04.md). The findings below preserve the original audit context.
