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

Hindsight provides long-term retain/recall. Honcho provides session history and session context. The memory checkbox is off by default and applies to each conversation thread. When enabled, a successful run retrieves local memory before inference and records the user prompt and final response after completion. Work-plan and critique passes are not separately retained. No old browser notebook data is migrated automatically. Memory text stays in local storage, but the configured model provider may receive it for extraction/reasoning; configure local Ollama in both memory services if you require local-only processing.

## Local setup

1. Configure the existing ignored `C:\QuantaCore\.env` using the variable names in `.env.example`. Keep service credentials server-side. Hindsight needs a compatible model key/base URL to extract memories; Honcho's local stack needs a model provider key. Free model routes can be rate-limited or may not support every memory operation.
2. Start Hindsight with `docker compose up -d hindsight`.
3. Start a local Honcho stack with the official CLI (`uv tool install honcho-cli`, then `honcho start --setup basic`). Configure its required local derivation provider using the CLI setup. The current QuantaCore adapter expects its API at `http://127.0.0.1:8000` by default.
4. Start QuantaCore with `npm run dev`, open its local control plane, select **Hindsight + Honcho memory** for a thread, and send a message.

The control plane shows each local memory service's connection status. A missing or unavailable memory service degrades to the memory service that responds; the agent can still run with the existing notebook context. The UI does not expose memory API keys.

## Privacy and deployment boundary

This adapter is connected to the local Node runtime only. The Vercel frontend disables this checkbox because its static deployment cannot reach services on the user's computer. Hosted memory requires a separate authenticated backend and configured hosted/self-hosted endpoints; do not publish local service keys or point a public function at loopback addresses. The selected model provider may still be cloud-hosted independently of memory storage.
