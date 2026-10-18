# Approved integration remediation — 2026-10-04

Both approved gaps are closed in the local deployment. This supplements the historical integration audit; it does not certify the entire stack for unattended production.

## Protected bootstrap credentials

Paperclip operator login, connector keys and server signing secret now use ProviderStore's encrypted bootstrap namespace. On this Windows deployment, the stored credential begins with `dpapi:` and is bound to the current Windows user. Migration verified an encrypted round-trip before removing the three exact legacy plaintext source files. Existing credentials and connector bindings were preserved; no credential rotation was performed.

Business bridge, WorkZone, provisioning, model CLI and Docker startup consumers now read protected storage. Launch Paperclip with `node scripts/paperclip-compose.mjs up -d`. The wrapper supplies the signing secret through the subprocess environment, not a plaintext env file. Privileged Windows/Docker users can still inspect runtime secrets; the private Paperclip database also needs protection and backup. Encrypted files alone are not a portable backup to a different Windows identity.

## Scoped general inference

Hybrid's Gateway access policies panel manages local text-agent permissions and separate external client credentials. Every scope pins one saved provider/model, normalized endpoint and provider credential identity. Changing any of these requires a reviewed policy update. Broad legacy keys and their issuance endpoint are retired.

Scopes enforce input bytes, output tokens, requests per minute, monthly calls, one active call per client and monthly spending reservations. Admission is persisted before upstream submission. Failed or interrupted calls retain their reservations; pending calls become uncertain after restart and are not replayed. Revocation stops new admission, but does not cancel requests already submitted. Scoped routes accept text only and reject tools, plugins and streaming. Responses require nonempty completed text. New policies require explicit enabling; cloud enabling also requires route-specific export/spending approval.

Reservations are operator-defined estimates, not measured invoice totals. Set conservative per-call reserves for the configured bounds and use provider-side spending controls. The dedicated research route retains its independent frozen-route admission and budget checks. This remains a single-server, trusted local deployment; distributed policy coordination is not implemented.

## Verification

- Actual Windows migration: protected record verified; operator credentials, three connector keys and server secret retained; no legacy plaintext sources remain.
- Paperclip remains healthy on loopback port 3210; authenticated guarded connector heartbeat returned 200.
- Hybrid console restored on port 3000, preserving the selected ChatGPT plan model and Business setting; new policy controls rendered with access disabled until configured.
- TypeScript checks and production build passed. Migration/bridge/gateway/inference tests passed (12); final gateway/inference rerun passed (7); research and Hybrid regression tests passed (16).
- No cloud inference, trading execution or worker activation was performed by remediation.

Local inference egress isolation, unconfigured providers and live provider conformance remain separate activation work. Paperclip workers remain paused; prepared Activepieces/Twenty bindings do not mean those applications are installed.
