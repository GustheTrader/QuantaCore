# Cloudroom in QuantaCore

QuantaCore's **Cloudroom** page (`/#/cloudroom`, under Hands) brings together the two halves of your cloud setup:

| Part | Where it runs | What it does |
|---|---|---|
| [cloudroom-gui](https://github.com/GustheTrader/cloudroom-gui) | This computer, `http://127.0.0.1:39886` | The Cloudroom app: local and cloud agent threads, teleport between them. QuantaCore shows it on the **Workspace** tab. |
| [cloudroom-core](https://github.com/GustheTrader/cloudroom-core) | Your Zo Computer | The engine that runs cloud agent sessions (Claude Code, Codex, Pi) on your own subscriptions. |
| QuantaCore | This computer | Keeps the core's address and token (encrypted, never sent to the browser) and checks that both parts answer. |

## 1. Install the core on Zo

1. Copy `scripts/cloudroom-zo/zo-setup.sh` to your Zo machine and open a Zo terminal.
2. Run `sudo bash zo-setup.sh check`. It only looks. If anything says NO or missing, paste the output to Claude.
3. Run `sudo bash zo-setup.sh install`. By default it installs Claude Code for the agent. Use `--harness codex --codex-model MODEL` for Codex, or `--harness none`.
4. In Zo, add a service:
   - Label: `cloudroom-core`
   - Mode: `http`
   - Local port: `9840`
   - Entrypoint: `bash /usr/local/lib/cloudroom/zo-start.sh`

   Make it **private** (the `*.zo.computer` address that needs your Zo sign-in).
5. Run `sudo bash zo-setup.sh status`. It should print `"status":"ready"`.
6. Run `sudo bash zo-setup.sh token` and copy the token.

The script uses the core's **container mode**. Zo has no systemd, so the core runs as its agent account and the agent keeps sudo, and the Zo sandbox is the security boundary. Use it only on a Zo machine that is yours alone. Running it again keeps the same token.

## 2. Run the Cloudroom app on this computer

From a cloudroom-gui checkout (Node 22.19+ and pnpm 9.15):

```sh
cd gui
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Cloudroom officially supports macOS and Linux. On Windows, run these commands in WSL (Ubuntu). WSL forwards `127.0.0.1:39886` to Windows, so QuantaCore can still show the app.

## 3. Connect

1. In QuantaCore, open **Cloudroom → Cloud core on Zo**. Enter the Zo service address and the token, choose **Save**, then **Test core**.
2. In the Cloudroom app, open **Settings → Cloudroom account → Connect your own Core** and enter the same address and token.
3. To sign in Claude for cloud threads, choose Cloud in the Cloudroom app, then **Connect Claude**.

## Safety

- The token can run agents on your Zo machine. QuantaCore stores it with your other keys, encrypted, and never shows it again.
- QuantaCore accepts only `https://` core addresses, or `http://127.0.0.1` for a local test.
- Never use Zo's public `*.zocomputer.io` address for the core.

## Files

- `server/cloudroom-router.ts` (+ test)
- `components/CloudroomWorkspace.tsx`
- `scripts/cloudroom-zo/zo-setup.sh`
- Route and navigation wiring: `App.tsx`, `eve.ts`, `lib/navigation.ts`, `lib/hosted-capabilities.ts`
- `lib/csp.ts`: local mode may frame `http://127.0.0.1:*`.
