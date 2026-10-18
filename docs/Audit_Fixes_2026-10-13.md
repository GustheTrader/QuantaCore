# Audit fixes — 2026-10-13

Follow-up to `QuantaCore_Audit_2026-10-12`. Another agent is handling F01 (Paperclip login) and the Obsidian sync; neither is touched here.

## Changed

| Finding | Change | Files |
| --- | --- | --- |
| F10 | Hermes test now checks rejection semantics (an unoffered scope is rejected, not forwarded, and stays pending). The HTTP smoke test writes sidecar output to `sidecar.log` and prints it on a startup failure; the deadline can be changed with `GNOESIS_HTTP_SMOKE_READY_SECONDS` (default unchanged at 90s). | `server/hermes-manager.test.ts`, `trading/tests/test_http_smoke.py` |
| F02 | Research input reservation counted request bytes as tokens (about 3–4× too high), which is the likely reason late Conservative/Neutral analyst calls hit the budget. It now reserves `bytes/3 + 512`. Submission refuses limits below the graph minimum (`BUDGET_TOO_SMALL`), warns when context growth may exceed the cap, and checks the provider key without inference (`PROVIDER_AUTH_FAILED`, OpenRouter `/key`, others `/models`). A provider 401/403 during a run is now recorded as `PROVIDER_AUTH_FAILED` instead of a generic worker failure. The UI shows budget problems and disables Start. | `server/research-manager.ts`, `server/inference-router.ts`, `components/GnoesisResearch.tsx`, `services/researchService.ts`, new `server/research-preflight.test.ts` |
| F03 | Neural Chat learning is opt-in (two toggles above the input). Distilled notes are private to the agent and marked unreviewed; Notebook has "Approve & share with all agents". Prompt reflection never auto-applies: the suggestion is shown for approval and the previous prompt is kept in `promptHistory`. A malformed reflection is an error, not score 5. | `components/ChatInterface.tsx`, `components/Notebook.tsx`, `services/geminiService.ts`, `types.ts` |
| F04 | Memory target is chosen by `lib/memory-target.ts`: localhost is always local, a hosted site is hosted, `VITE_QUANTA_MEMORY_TARGET` overrides it. The status tooltip shows the target and reason. | `lib/memory-target.ts` (+test), `services/agentMemoryService.ts`, `components/AgentControlPlane.tsx`, `.env.example` |
| F05 | Server-enforced capability profiles. Tools are classified read / network-read / side-effect (unknown = side-effect), each with a replay policy (only side-effect-free tools are safe to retry). HarnessRouter test runs are refused (409) unless every exposed tool fits the `read-only` profile; the catalog reports `readOnly` and the reason, and the UI only offers eligible harnesses. | `lib/capability-profiles.ts` (+test), `server/harness-router.ts`, `services/harnessRouterService.ts`, `components/GnoesisSiHarnessRouter.tsx` |
| F09 | "Prototype · simulated" banner on Agentic OS, AgentZero, Edge Mech Network and IronClaw; Langfuse label says it is simulated. | `components/PrototypeBanner.tsx` and those screens |

## Verified

Typecheck shows no errors in edited code. 21 tests pass: Hermes, inference router, research manager/store/preflight, memory target, capability profiles. Not run here: the Python trading suite and anything against live services.

## Still open

- Run on Windows: `npm run test:research`, `node --import tsx --test server/hermes-manager.test.ts lib/*.test.ts`, and `cd trading; uv run pytest tests/test_http_smoke.py -s`. If it still times out, the failure now includes the sidecar log.
- Restart the local server (`npm run dev`) to load the server changes.
- Replace or reconnect the OpenRouter key ("User not found" = revoked or deleted key), then run one small approved research run.
- HarnessRouter: create a configured harness with write tools disabled so test runs are allowed.
- Not done: F06 release packaging, F07 browser keys and Tailwind CDN, F08 Hindsight bank policies, F11 database ownership and recovery, F12 bundle size, F13 specialist routing, hosted Edge-function harness allowlists, and counting auxiliary calls toward the budget.

## F07 — browser credentials and remote scripts

- **Leaked key removed.** `services/novitaService.ts` had a Novita API key built in. It was also in git history and the public Vercel bundle. It's now removed; Deep Dive asks for your own key. **Revoke the old key at novita.ai.**
- **No remote scripts.** The Tailwind Play CDN and the esm.sh import map are gone from `index.html`. Tailwind 3.4.17 is compiled at build time (`tailwind.config.js`, `postcss.config.js`, `styles/tailwind.css`), and React and the other packages come from `node_modules`. Run `npm install` once before restarting.
- **Gemini key on the server.** On this computer, Gemini text, research and video requests go through `/api/gemini` (`server/gemini-proxy.ts`), which adds the protected `google-api` key. Gemini Live voice gets a single-use token that expires within minutes (`/api/gemini/live-token`). Saving a Gemini key in Settings moves it into the protected store and clears it from the browser. Video links stream through the server instead of carrying `&key=` in the URL. A hosted site still falls back to the optional browser key.
- **Content Security Policy.** `lib/csp.ts` is sent as a header by built local pages (`npm start`) and by Vercel (`vercel.json`): first-party scripts only, plus a short list of allowed connections. Vite dev mode is exempt because it injects inline scripts.
- Tests: `server/gemini-proxy.test.ts` and `lib/csp.test.ts` (5 tests) pass.
- Still open: the hosted site keeps the browser-key fallback until a Supabase Gemini function exists; check the CSP against every screen after `npm run build && npm start`.

## F06 — release

- **Release identity:** version `0.9.0`. Every build writes `dist/version.json` with the commit SHA and whether there were uncommitted changes, and Settings shows `Quanta v0.9.0 · <sha>`. Files: `lib/release.ts`, `scripts/release-info.mjs`, `vite.config.ts`.
- **Hosted site fails closed:** 13 screens that need the local server show "Available in the local app" on Vercel and get a "Local app" tag in the sidebar. Files: `lib/hosted-capabilities.ts`, `components/LocalOnly.tsx`, `App.tsx`, `components/Sidebar.tsx`.
- **One command checks everything:** `npm run validate` runs the secret scan, type check, all Node tests and the build. `npm test` runs every Node test. `npm run test:python` runs the Python tests.
- **CI:** `.github/workflows/ci.yml` runs validate plus the RSI Python tests against the pinned RRSI checkout.
- **Release and rollback guide:** `docs/RELEASE.md` covers the local/hosted capability table, the 9-group commit plan, deploy steps and rollback.
- Checked here: 99 Node tests pass. The only failures are packages missing in the test sandbox (`jose`, `@modelcontextprotocol/sdk`). The secret scan passes on 359 files.
- **Not done:** no commits, tag or deploy yet. `package-lock.json` must be refreshed with `npm install` before CI's `npm ci` can pass.

## Sign-in and model activation (2026-10-14)

- **Google and GitHub sign-in.** The welcome page now has "Continue with Google / GitHub" buttons, using Supabase Auth with the PKCE flow so the `#/` routes keep working. The track you choose is remembered across the redirect. This works on the hosted site and in the local app whenever Supabase is configured. Guest access is unchanged.
  - Setup in Supabase: Authentication → Providers → enable Google (OAuth client from Google Cloud) and GitHub (OAuth App). Both use the callback `https://<project>.supabase.co/auth/v1/callback`. Under Authentication → URL Configuration, add `http://127.0.0.1:3000/**` and `https://quanta-core.vercel.app/**` as redirect URLs.
- **Models page.** `components/ModelsPanel.tsx` replaces the five-tab sign-in hub in Settings, startup and setup. It's one list, and each row has two lanes:
  - **Connect** uses a subscription: ChatGPT plan OAuth, OpenRouter PKCE, or native CLI sign-in for Claude, Gemini and Grok.
  - **Add key** is the API lane: save, check the model list, choose a model, and "Use for chat".
- New API-key providers: DeepSeek, Mistral, Cerebras, Moonshot/Kimi, MiniMax, NVIDIA NIM, Hugging Face, Together AI and Baseten.
- `components/ModelSignInHub.tsx` is no longer used. It can be deleted after review.
