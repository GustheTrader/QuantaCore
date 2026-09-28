# Quanta OS

**Sovereign SI — Brain · Hands · Nervous System · Governess**<br>
Four coordinating systems. Eight focused agents. One operator-controlled workspace.

Quanta OS is a local-first AI workspace for personal planning, consumer decisions, business operations, learning, investing, and trading research. It combines a React web app with a loopback-only Express service, configurable model routes, a local CLI, and optional memory services.

The interface keeps the original Mission Control and offers a separate blue Agent Control Plane for agent work. Personal and Consumer launch into a local OpenMuse workspace when it is running; Quanta displays OpenMuse health without sending its own session or provider credentials there.

## System map

| System | Responsibility |
| --- | --- |
| **Brain** | Selects model providers and applies the chosen agent instructions. |
| **Hands** | Agent workspaces, coding harness guidance, and user-reviewed actions. |
| **Nervous System** | Local orchestration APIs, provider routing, health, and telemetry surfaces. |
| **Governess** | Human control, privacy and security affordances, approvals, and system policy. |

The map describes the product architecture. Each integration below distinguishes working local connections from optional services and roadmap concepts.

## Agents

Quanta currently defines eight role instructions:

- **Personal** — plans, priorities, schedules, and everyday decisions.
- **Consumer** — compares costs, terms, alternatives, and privacy before a purchase decision.
- **Business** — strategy, operations, and measurable plans.
- **Trading** — market research and risk analysis; defaults to paper or read-only work.
- **Education** — learning plans and practice.
- **Guest** — workspace exploration and onboarding.
- **Investing** — portfolio research and long-term goals.
- **Personal Growth** — habits, reflection, and meaningful goals.

Agent labels guide behavior; they are not an access-control boundary. Financial execution and external commitments remain under human control.

## Included capabilities

- **Mission Control and Agent Control Plane:** original Quanta dashboard plus a dedicated work/chat surface for launched agents.
- **Provider connections:** Gemini, OpenAI-compatible services, Ollama Local and Cloud, OpenRouter, Fireworks AI, OmniRoute, Groq, and Novita. OpenAI-compatible endpoints can use a custom HTTPS base URL, including CheaperInference.
- **Local provider gateway:** model catalog discovery and chat-completion proxy endpoints. Provider keys are encrypted in machine-local `.quanta` state; Windows uses current-user DPAPI.
- **CLI:** `help`, `status`, `agents`, `providers`, `models`, `harnesses`, `harness`, and explicit `ask` commands. `models` fetches the selected provider’s model catalog; `ask` sends its prompt to that provider.
- **Coding harness guide:** setup and restore instructions for supported harnesses. Quanta does not install those tools or provide an unrestricted shell through the CLI.
- **Hindsight–Gnoesis Neural Core:** an animated architecture map and whitepaper for retained memory, evidence, observations, and synthesis.
- **Privacy and Sovereign Trust:** landing-page guidance for opt-in memory protection and data ownership. A diagram or policy description does not mean Memory Defense is enabled in a running Hindsight bank.
- **OpenMuse launch hub:** local Personal and Consumer entry points, starter prompts, and API health status. OpenMuse runs as a separate application and owns its own user/session state.
- **Sovereign Tokens showcase:** introduces FireRouter, Finetune RL, and Nexus. Fireworks model endpoints are connectable; FireRouter routing, Nexus controls, and RL training jobs are not managed by Quanta today.
- **Optional containers:** Docker Compose definitions for Redis, Memgraph, Hindsight, and an opt-in read-only Obsidian sync worker.

## Run Quanta locally

Requirements: Node.js and npm.

```powershell
npm ci
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The Express service binds to loopback. Provider connections are configured from **Settings → Providers**; keys are stored locally by the server and are not embedded into browser code.

To build or type-check:

```powershell
npm run build
npm run lint
```

The CLI can be used in another terminal:

```powershell
node bin/quanta.mjs help
node bin/quanta.mjs status
node bin/quanta.mjs providers
```

`node bin/quanta.mjs ask <provider> <prompt>` makes a model request and may incur provider charges.

## Provider setup

For a compatible gateway such as CheaperInference:

1. Open **Settings → Providers** and choose **OpenAI compatible**.
2. Set the endpoint to `https://api.cheaperinference.com/v1`.
3. Enter an exact model ID from the provider’s model catalog and save its API key.
4. Select that route when you want Quanta to use it.

The compatible-provider settings store protects credentials locally. The legacy direct Gemini client reads the key you enter in Settings from browser local storage and calls Google from the browser; use that path only in a trusted local browser. Quanta no longer injects API keys into the web bundle. Requests sent through a cloud provider leave the local device for that provider to process.

## Optional memory services

The Compose file starts the local memory and graph services, including Hindsight:

```powershell
docker compose up -d
```

Obsidian synchronization is a separate opt-in profile. It needs a machine-specific, read-only vault mount in `docker-compose.obsidian.local.yml`, then:

```powershell
docker compose --profile obsidian -f docker-compose.yml -f docker-compose.obsidian.local.yml up -d --build
```

That mount file is intentionally ignored by Git because it contains a local filesystem path. Review the Compose port bindings and your host firewall before exposing auxiliary services beyond the local machine. The Neural Core diagram is an architectural view; it does not certify that a model, bank policy, vault sync, or conditional FPT-Omega route is active.

## OpenMuse Personal and Consumer workspace

OpenMuse is a separate local repository and service. Quanta’s launch hub expects its API at `127.0.0.1:8787` and web UI at `localhost:8081`. Configure OpenMuse’s own `.env`, CopilotKit Intelligence key, and model provider there. The Quanta launch hub does not share Quanta provider keys or identity with OpenMuse.

The checked local setup uses sample workspace data with a model backend through CheaperInference. Browser and Docker computer workers are optional and need their own setup. See the [OpenMuse repository](https://github.com/GustheTrader/Gnoesisopenmuse) for its architecture and operating instructions.

## Repository map

| Path | Purpose |
| --- | --- |
| `App.tsx`, `components/` | React screens, landing page, Mission Control, control plane, and agent experiences. |
| `services/` | Model adapters, application tools, and whitepaper content. |
| `server/` | Local Express APIs, provider credential storage, model routing, and CLI routes. |
| `lib/` | Agent roles, navigation, provider catalog, control-plane definitions, and motion tokens. |
| `bin/quanta.mjs` | Local CLI entry point. |
| `docker-compose.yml` | Optional memory and graph services. |
| `docker/obsidian-sync/` | Read-only Obsidian reconciliation container. |
| `PROJECT_SUMMARY.md` | Concise product scope, architecture, and current integration status. |

## Status and limits

Quanta is a local application under active development. Interface panels, whitepaper descriptions, and target architecture diagrams can describe a design before the corresponding backend integration exists. Check the status indicator or provider connection before relying on any service. No trading order execution is enabled by these agent roles.
