# HarnessRouter Community Edition in QuantaCore

QuantaCore runs at `http://127.0.0.1:3000/`. The existing Community Edition container runs at `http://127.0.0.1:3100/` to avoid a port conflict. No HarnessRouter Cloud account is needed.

- Container: `gnoesis-si-harness-router`
- Persistent Docker volume: `gnoesis-si-harness-router`, mounted at `/data`
- Console: `http://127.0.0.1:3100/`
- CE API: `http://127.0.0.1:3100/api/harness`
- Provider integration: `Quanta OpenRouter Free`, an OpenAI-compatible connection to OpenRouter with model `openrouter/free`
- Configured harness: `Quanta Open House · Hermes`

The CE-issued key for `QuantaCore Local Backend` is saved in Quanta's protected local provider store. It is separate from the console password and OpenRouter provider key. These secrets are not put in browser environment variables.

In **Hands → Open House Channel**, add an agent, give it a name, role and task, choose **Quanta Open House · Hermes**, and select **openrouter/free**. Add private and master KB notes as needed. Run the agent, review the draft, and publish or hand it off explicitly.

Quanta lists both configured harness IDs and base engines, and validates a model against the chosen harness backend. The local run budget is two steps, 512 requested output tokens, and 90 seconds, with a 105-second transport ceiling. Free-model availability and latency remain provider-dependent.

This Hermes harness has no configured MCP servers, plugins or skills. Its built-in tools are marked disabled, but this CE version implements Hermes tool disabling as model instructions, not a hard sandbox. Do not treat that setting as an execution security boundary. Quanta Dialogue remains the text-only option without external tools.

Inspect startup with `docker logs --tail 50 gnoesis-si-harness-router`. Preserve the existing volume when upgrading or restarting. The upstream quickstart's host port 3000 conflicts with Quanta; use `127.0.0.1:3100:3000` for this installation.

Upstream guide: https://github.com/HarnessRouter/harnessrouter/blob/main/docs/self-hosting-guide.md

## Current validation

The local Docker runtime, console authentication, CE-issued backend key, configured-harness catalog and model mapping have been verified. A bounded Hermes task was launched but returned incomplete. A direct OpenRouter check returned HTTP 401 `User not found` for the authorized saved credentials, so model execution is not verified as operational. Replace `OPENROUTER_API_KEY` in `C:\QuantaCore\.env` with a valid key and reconnect the CE provider before retrying. Incomplete upstream responses now become errors rather than publishable agent drafts.
