# Starter and Custom system setup

Implemented October 17, 2026. Product contract and local implementation map.

New users choose up to three jobs for one agent, connect one model, then review and open the workspace. The same setup can grow into a Custom configuration with optional module shortcuts and workflow planning. A user doing two things should not need to understand every integration first.

The [Composability Copilot](COMPOSABILITY_COPILOT.md) now offers four short questions from startup or `/#/compose`. It prepares a reviewable composition and hands the client to the existing model-connection step. Runtime evidence dashboards and the QS read-only research bridge are optional Custom modules; selection does not activate them.

## User flow

1. **Choose your jobs.** Starter is the default. Everyday help, research, business, development and trading research provide editable job suggestions. Select one to three jobs and name the setup.
2. **Connect one model.** Reuse an existing saved model connection or open the existing provider controls. Native coding sign-in and model API connections retain their existing separate flows. Configuration is labeled as unverified until a reply has actually been checked. Detailed connections remain at `/#/connections`.
3. **Review and open.** Review the selected jobs and model. Conversation is the default and makes one model call per request. Work uses the existing three stages: plan, draft and review, all on the selected model. Opening the workspace sends no prompt. Without a model the user can save and explore, then connect later.

Custom reveals optional modules grouped into Knowledge, Tools & workflows and Specialist workspaces. Selecting a module adds a checklist and workspace shortcut. Each target workspace owns its setup, readiness and permission checks. Source assignment, memory consent, connector permissions, remote costs and actual runtime activation remain explicit in those workspaces.

Starter and Custom share one saved configuration. Changing back to Starter hides optional modules while retaining their selections for a later return to Custom.

## Composition contract

`lib/system-setup.ts` is the catalog for job IDs, presets and optional modules. A module declares a stable ID, name, group, description, setup route, optional existing service status ID, and next setup requirement. A responding service is reported only as responding, never as proof of an agent task.

The version 1 setup contains a display name, complexity level, focus preset, one to three job IDs, module IDs, chat/work mode and an optional provider/model identity. It is normalized on load and saved per signed-in email in browser storage. Unknown IDs and unsupported formats fall back safely. Credentials are managed by the existing provider stores and are never copied into this configuration.

`SystemLaunchpad` owns draft choices. Save stores the normalized configuration. Save and open rechecks the chosen route against the backend, explicitly sets it as the current default, then opens `/#/agent?mode=chat&setup=1` (or work mode). An unavailable or changed route reports an error. Explore can open without a selected model.

`AgentControlPlane` snapshots the saved setup into each new launched thread. Jobs become actual prompt shortcuts and focus preferences in its inference instructions. New threads inherit that snapshot, while historical threads retain their original setup. Editing the central setup does not rewrite running or saved conversations. Display names are never inserted as model instructions. Job selections organize the workspace; they are not a tool authorization policy.

Trading research presets add paper analysis and evidence requirements. The Work review stage is an additional model pass, not an independently verified finding. Independent empirical validation requires the appropriate research workflow and data.

## Existing surfaces

| Surface | Responsibility |
| --- | --- |
| `/#/startup` | Starter / Custom launch and saved composition |
| `/#/connections` | Existing detailed model and native connection flow |
| `/#/settings` | Provider administration and existing system integration plans |
| `/#/agent` | Conversation or plan/draft/review work, chosen jobs, explicit sources and memory |
| `/#/work-zone` | Existing orchestration workspace; workflow role configuration remains a draft |
| Module routes | Configure and operate the chosen capability through its existing adapter |

## Delivery scope and next increments

This increment implements local browser configuration, the launch flow, model selection, prompt shortcuts and optional module navigation in the existing app. It does not provide automatic multi-agent execution from the workflow draft. Source and memory controls keep their existing enforcement. Hosted and local module access retain their existing route checks.

Connection status reads have a ten-second timeout and leave job selection usable while they run. The launched workspace shows basic controls and the selected module shortcuts. Existing full navigation remains available for threads opened outside a saved setup.

Validation covers seven focused configuration/snapshot tests, TypeScript, the production build, and a browser component review of Starter/Custom switching, retained module choices, two-job selection, saving/restoring, opening the actual agent component, and inserting a selected job prompt. The browser review used a dedicated test owner and the existing local backend for status reads. No model prompt was submitted. A narrow browser layout was also inspected for horizontal overflow.

Future increments should add module-specific readiness contracts and an export/import format for configurations, followed by evaluated workflow templates. Confirm account scope, cost budgets, and team permissions before adding shared profiles or automatic orchestration. No new external package or paid evaluation is required for this increment.
