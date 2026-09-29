# Sovereign AIOS in QuantaCore

The public `GustheTrader/sovereign-aios` repository currently contains a product brief, requirements document, and a proposed Compose stack. It does not contain an installable agent runtime or UI. QuantaCore uses the AIOS architecture in its existing control plane instead of launching that full proposal, which includes overlapping services, port conflicts, and insecure `changeme` defaults.

## Runtime mapping

| AIOS layer | QuantaCore component |
| --- | --- |
| Brain | The selected model/provider connection in Settings |
| Hands | The active Personal, Consumer, Investing, or Personal Growth agent |
| Nervous system | Quanta OS control plane, task stages, Neural Core, and local API |
| Governess | Review stage, opt-in boundaries, connector permissions, and human approval |
| Hot/session memory | Honcho, scoped to a private user identity and conversation thread |
| Long-term memory | Hindsight, scoped to a private user bank with retrieval before a run |

Hindsight provides long-term retain/recall. Honcho provides session history and session context. The memory checkbox is off by default and applies to each conversation thread. When enabled, a successful run retrieves memory before inference and records the user prompt and final response after completion. Work-plan and critique passes are not separately retained. No old browser notebook data is migrated automatically. Memory text is sent only when the operator enables memory; the configured model provider may also receive that context for reasoning.

## Local setup

1. Configure the existing ignored `C:\QuantaCore\.env` using the variable names in `.env.example`. Keep service credentials server-side. Hindsight needs a compatible model key/base URL to extract memories; Honcho's local stack needs a model provider key. Free model routes can be rate-limited or may not support every memory operation.
2. Start Hindsight with `docker compose up -d hindsight`.
3. Start a local Honcho stack with the official CLI (`uv tool install honcho-cli`, then `honcho start --setup basic`). Configure its required local derivation provider using the CLI setup. The current QuantaCore adapter expects its API at `http://127.0.0.1:8000` by default.
4. Start QuantaCore with `npm run dev`, open its local control plane, select **Hindsight + Honcho memory** for a thread, and send a message.

The local control plane shows each memory service's connection status. A missing or unavailable memory service degrades to the service that responds; the agent can still run with notebook context. The UI does not expose memory API keys.

## Privacy and deployment boundary

Production uses the authenticated `quanta-memory` Supabase Edge Function. It derives the memory owner from the validated Supabase user JWT and hashes the user and thread IDs before creating Hindsight banks or Honcho sessions. Client-supplied owner IDs are ignored. The function requires JWT verification, allows configured browser origins only, validates and bounds payloads, and applies Upstash limits of 20 requests per minute and 100 per day for each user, plus 1,000 per day across the demo.

For hosted memory, add `HINDSIGHT_API_KEY` and `HONCHO_API_KEY` to **Supabase Dashboard → Edge Functions → Secrets**. Optional endpoint overrides are `HINDSIGHT_BASE_URL`, `HONCHO_BASE_URL`, and `HONCHO_WORKSPACE_ID`; defaults target the managed Hindsight and Honcho services. Reuse the existing `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `QUANTA_ALLOWED_ORIGINS` Edge Function secrets. Do not put these credentials in Vercel variables, `VITE_*` variables, browser storage, or the Docker MCP gateway URL. Hosted service accounts/API keys must be provisioned separately; the Docker MCP gateway only exposes MCP tools and does not provide Hindsight or Honcho memory storage.

The hosted status endpoint reports whether each API key is present; it does not verify the provider account or perform a memory write. Complete a retain and recall after adding the keys before treating hosted memory as operational. This adapter currently sends the completed prompt and answer to each enabled memory provider without a shared redaction pass, so do not enable it for secrets or regulated data until a retention and redaction policy is in place. Anonymous test users retain access to their memory only while their Supabase guest session remains available.

Local development continues to use the Node memory router and Docker/local services. The selected model provider may be cloud-hosted independently of memory storage. Existing local memories are not automatically copied to the hosted services.
