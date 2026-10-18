# Hermes Work and Personal workspaces

The `/hermes` page connects to the installed Hermes Agent through a loopback backend. It uses real Hermes sessions and model/tool configuration, not the old AgentOS placeholder tool handlers.

## Local services

- GnoesisQuanta Intelligence: `http://127.0.0.1:3000/#/hermes`
- Shared API: `/api/hermes` on the GnoesisQuanta server
- Hermes headless gateway: `127.0.0.1:9120`, started by the page's **Start Hermes** button
- QS uses its own `/api/hermes` proxy to the shared API. Its default upstream is `http://127.0.0.1:3000`; set `GNOESIS_HERMES_BRIDGE_URL` on the QS server if the GnoesisQuanta port differs.

Work uses the `gnoesis-work` Hermes profile; Personal uses `gnoesis-personal`. The first startup creates profiles from the existing default provider/configuration without cloning conversation or memory history and without messaging channel tokens. Each profile has its own session state and memory. New chats start in separate directories under `.quanta/hermes/workspaces`. Profiles are context boundaries, not filesystem sandboxes; tools have the installed Hermes runtime's permissions.

## Features

- Shared, restart-persistent conversation lists in both apps, separated by workspace
- Actual streamed assistant responses and visible tool activity
- File attachments up to 1 MB, with image/PDF handling through Hermes
- Explicit Allow once / Deny approval cards and clarification answers
- Stop running turns; no automatic prompt replay after a disconnect or restart

The gateway session token stays in `.quanta/hermes/gateway-token` and the server-side WebSocket connection. Provider credentials remain in Hermes. Session metadata/transcripts are kept in `.quanta/hermes/sessions.json`; these local files are not encrypted by this adapter. Removing a conversation from this workspace closes its live session and removes the workspace entry; Hermes retains its native stored session.

For Windows startup, the adapter discovers `%LOCALAPPDATA%/hermes/bin/hermes.exe`; `GNOESIS_HERMES_EXE` can override it. `GNOESIS_HERMES_PORT` overrides port 9120. The gateway is independent of the frontend and stays running when the Quanta server restarts. A new server connection resumes conversations from their stored Hermes session IDs.

Hosted/cloud use is disabled by the adapter's loopback, Host, Origin and client-header checks. The local `/hermes` route uses the same trusted-local-operator entry pattern as the existing local Research/Work Zone routes.

## Checks

`node --import tsx --test server/hermes-manager.test.ts` covers profile isolation, event routing, approval ownership, streaming and restart behavior. The QS bridge has focused tests for local-only forwarding and secret/header boundaries.

For a QS-only review without starting the trading runtime:

```powershell
.venv\Scripts\python.exe -m uvicorn terminal.backend.hermes_bridge:app --host 127.0.0.1 --port 8011
cd terminal
node node_modules/vite/bin/vite.js --config vite.hermes.config.ts --host 127.0.0.1 --port 5173 --strictPort
```

Open `http://127.0.0.1:5173/?panel=hermes`. Normal QS startup mounts this same bridge router and uses its normal frontend configuration.
