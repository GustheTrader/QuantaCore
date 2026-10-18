# Releasing QuantaCore

A release is one reviewed git commit with recorded validation, passing CI and its commit SHA visible in the app. The operator approved publishing the GitHub Actions workflow on October 17, 2026; confirm its result against the published commit before calling a hosted release validated.

## What runs where

| Capability | Local app (`npm run dev` / `npm start`) | Hosted site (Vercel + Supabase) |
| --- | --- | --- |
| Frontend, chat, notebook, projects | Yes | Yes |
| Model inference | Local server `/api/inference` | `quanta-inference` Edge Function |
| Agent memory | Local Hindsight + Honcho | `quanta-memory` Edge Function |
| Gemini | Local server proxy (key on this computer) | Optional browser key |
| HarnessRouter test runs | Local Docker | `quanta-harness-router` (needs its secrets) |
| Work Zone / Paperclip, QuantaTrade, research worker, RSI Lab, Hermes, OpenMuse, OpenDots, Alexandria, MCP, coding harnesses | Yes | **Hidden** with an "Available in the local app" screen (`lib/hosted-capabilities.ts`) |

Vercel serves only the built frontend (`dist`). The Express server in `eve.ts` never runs there. If you add a screen that calls a local `/api/*` route, add its path to `LOCAL_ONLY_PATHS`.

## Checks before release

1. `npm install` (only after dependencies change) and commit `package-lock.json`.
2. `npm run validate` runs the secret scan, type check, all Node tests and the production build.
3. `npm run test:python` runs the RSI and trading Python tests on Windows.
4. `npm start`, then open http://127.0.0.1:3000 and click through Chat, Settings, Research, Work Zone and RSI Lab. Watch the browser console (F12) for Content Security Policy errors.
5. Record the results against the exact commit and require its GitHub Actions checks to pass.

## Release identity

- `package.json` `version` is the release number (now `0.9.0`, internal beta).
- Every build writes `dist/version.json` (`version`, `commit`, `dirty`, `builtAt`, `target`) and shows `Quanta v… · <sha>` at the bottom of Settings.
- `dirty: true` means the build had uncommitted changes, so it isn't a release.
- To confirm what's live, open https://quanta-core.vercel.app/version.json and compare `commit` with `git rev-parse HEAD`.

## Committing the current worktree

The worktree had 150+ changed files from several workstreams, some still in progress. Commit them in separate groups, in this order, after reviewing each group's diff. Don't use `git add -A`.

| # | Group | Main paths |
| --- | --- | --- |
| 1 | Security (F07, leaked key removal) | `services/novitaService.ts`, `index.html`, `index.tsx`, `styles/`, `tailwind.config.js`, `postcss.config.js`, `package.json`, `package-lock.json`, `vercel.json`, `lib/csp*`, `server/gemini-proxy*`, `services/geminiClient.ts`, `services/geminiService.ts`, `services/edgeService.ts`, `components/VoiceAgent.tsx`, `components/VideoGenerator.tsx`, `components/NeuralVoiceArchitect.tsx` |
| 2 | Audit fixes F02–F05, F09, F10 | `server/research-manager.ts`, `server/research-preflight.test.ts`, `server/inference-router.ts`, `components/GnoesisResearch.tsx`, `services/researchService.ts`, `components/ChatInterface.tsx`, `components/Notebook.tsx`, `types.ts`, `lib/memory-target*`, `services/agentMemoryService.ts`, `components/AgentControlPlane.tsx`, `lib/capability-profiles*`, `server/harness-router.ts`, `services/harnessRouterService.ts`, `components/GnoesisSiHarnessRouter.tsx`, `components/PrototypeBanner.tsx`, prototype screens, `components/ContextOptimizerModal.tsx`, `server/hermes-manager.test.ts`, `trading/tests/test_http_smoke.py` |
| 3 | Release tooling (F06) | `lib/release.ts`, `scripts/release-info.mjs`, `scripts/check-secrets.mjs`, `vite.config.ts`, `.github/workflows/ci.yml`, `lib/hosted-capabilities*`, `components/LocalOnly.tsx`, `components/Sidebar.tsx`, `App.tsx`, `components/Settings.tsx`, `eve.ts`, `.env.example`, `docs/RELEASE.md`, `docs/Audit_Fixes_2026-10-13.md` |
| 4 | Work Zone / Paperclip (F01, other agent) | `server/workzone-router.ts`, `services/workzoneService.ts`, `lib/workzone-contract.ts`, `components/OperatorWorkZone.tsx`, `docs/Paperclip_First_Workflow_2026-10-13.md` |
| 5 | Obsidian + memory governance (other agent) | `docker/obsidian-sync/`, `scripts/obsidian-pilot.mjs`, `server/memory-router.ts`, `server/memory-store.ts`, `supabase/functions/_shared/`, `supabase/functions/quanta-memory/`, `supabase/migrations/20261013000100_memory_governance_v2.sql`, `docs/Obsidian_Sync_2026-10-13.md` |
| 6 | Hermes / Herald | `server/hermes-*`, `components/HermesWorkspace.tsx`, `components/herald/`, `desktop/`, `scripts/*hermes*`, `scripts/*clipping*`, `server/clipping-router.ts`, `docs/HERMES_WORKSPACES.md` |
| 7 | RSI Lab | `rsi/`, `server/rsi-*`, `lib/rsi-*`, `components/Rsi*`, `components/QsSystemsLab.tsx`, `design/qs-systems-theme/`, `scripts/install-rsi.ps1`, `docs/RSI_LAB.md` |
| 8 | Other features | Firecrawl Alexandria, SMB Launchpad, model sign-in hub (`native-sign-in`, `openrouter-oauth`, `gemini-sign-in`), coding agents, startup modules, system guide, remaining components |
| 9 | Docs and whitepapers | whitepapers v1.4/v1.5, integration audits |

If one file has changes from two groups (for example `App.tsx`, `Settings.tsx` or `eve.ts`), commit it in the earlier group and say so in the message.

**Before pushing, decide about `docs/QuantaCore_Audit_2026-10-12.*`.** They describe unfixed security gaps. If the GitHub repo is public, keep them out of git (add them to `.gitignore`) or push only after the P1 items are fixed.

Run `npm run check:secrets` before every push.

## Deploy

1. Push `main` after local validation. Wait for the Node validation and pinned RSI Python jobs to pass.
2. Tag it: `git tag v0.9.0 && git push origin v0.9.0`.
3. Vercel deploys `main` automatically. Confirm `/version.json` shows the tagged commit.
4. Edge Functions only when they changed: `supabase functions deploy quanta-memory` (and `quanta-inference`, `quanta-harness-router`).
5. Database migrations only after review: `supabase db push`. Migrations only move forward, so write the undo SQL in the commit message before applying one.

## Roll back

| What | How |
| --- | --- |
| Hosted frontend | Vercel dashboard → Deployments → choose the previous good deployment → **Instant Rollback** (or `vercel rollback <deployment-url>`). Confirm `/version.json`. |
| Edge Function | `git checkout <previous-tag> -- supabase/functions/<name>` then `supabase functions deploy <name>`, then restore your working copy with `git checkout HEAD -- supabase/functions/<name>`. |
| Database | Apply the reviewed undo SQL from the migration's commit. Never delete user data to roll back. |
| Local app | `git checkout <previous-tag>`, `npm ci`, restart Quanta. Local data in `.quanta/` and `data/` is untouched by checkout. |
| Bad commit on main | `git revert <sha>` and push. Don't rewrite shared history. |
