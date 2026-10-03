# OpenDots specialist agents and computers

Source: https://github.com/GustheTrader/QuantaOpenDots

Local checkout: `C:\QuantaOpenDots`, initially pinned to `c2569bb6a13a22e565cf3eb791c62267d06babb1`.

## Entry points

- Quanta: `http://127.0.0.1:3000/#/agents` groups operational roles and workspaces by purpose.
- OpenDots integration: `http://127.0.0.1:3000/#/opendots` shows runtime and setup state.
- Native single-owner console: `http://127.0.0.1:4310`.
- The existing Quanta app keeps port 3000; HarnessRouter CE keeps port 3100.

The optional computer button creates an OpenDots companion with a dedicated Space and stable Dot identity. It grants no research, memory, browser, file or shell permissions. Its role instructions are sent to the selected OpenDots service. Quanta KBs, messages and master KB are not copied automatically. Existing Quanta chat harnesses do not gain computer tools from this operation. Hand tasks to the Dot explicitly in its native console.

## Local application

The ignored `C:\QuantaOpenDots\.env` contains a generated owner token, a stable owner ID, and blank provider and Intelligence keys. Do not commit it. Enter OWNER_TOKEN in the native console. Chat requires a valid Intelligence key and an OpenAI-compatible model provider. Previously rejected Quanta provider credentials have not been copied.

From `C:\QuantaOpenDots`:

```powershell
docker compose -p quanta-opendots up -d --build app
```

For this Windows installation, the local build overlay avoids two concurrent package downloads:

```powershell
docker compose -p quanta-opendots -f compose.yml -f compose.quanta.yml up -d --build app
```

`Dockerfile.quanta` downloads dependencies once with limited connection concurrency and a build cache, builds the app, and prunes development dependencies before copying the runtime into a nonroot image. The upstream Dockerfile remains available.

This starts the app with persistent named SQLite storage. It does not start a computer supervisor.

## Optional Docker computers

Upstream `compose.computers.yml` and `compose.computers-app.yml` provide per-Dot computers pinned to OpenBot. The supervisor mounts the Docker socket and can manage containers. Review that capability before starting it. The app itself does not mount the socket. Generate separate COMPUTER_SUPERVISOR_TOKEN and COMPUTER_TOKEN values and a dedicated namespace in the ignored OpenDots environment. See the upstream `COMPUTERS.md` for commands and requirements.

After the supervisor is configured, use the native Dot computer controls to opt into only the required browser, files and shell permissions. Each Dot has separate derived credentials and persistent volumes. Stop the session when finished. Container boundaries do not make unrestricted shell or browser actions safe; require task approval for external actions and financial execution.

## Cloud

Use your own HTTPS OpenDots service with its computer supervisor configured remotely. In Quanta's server-only environment:

```dotenv
OPENDOTS_CLOUD_URL=https://your-opendots-host.example
OPENDOTS_CLOUD_OWNER_TOKEN=
```

Never use VITE_ for owner, provider or supervisor secrets. Cloud choices use a separate Dot binding from Docker choices. Configure TLS, access controls and backups on the host. This is a single-owner companion service, not tenant-isolated hosted infrastructure. The Quanta bridge is loopback-only and is not implemented by Vercel or Supabase Edge Functions.

## Memory and collaboration boundaries

Open House owns its existing private agent KBs and explicit master KB publishing. OpenDots owns its own Spaces and SQLite records. Automatic synchronization, group Dot conversations and delegation are not implemented here. A future version should use explicit source-linked handoffs and authenticated owner-scoped bridges rather than copying all memories into every agent.
