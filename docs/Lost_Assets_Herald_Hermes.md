# Herald OS workspace in Lost Assets

The local LA Plus **HERMES** entry now embeds Quanta's existing Herald OS web workspace. It uses the installed Hermes runtime and native `gnoesis-work` profile, including its existing connections. Coding and Clip Studio open their existing Quanta pages. This is the adapted web workspace; native Linux desktop/compositor functionality is outside this integration.

## Local agent tools

The `lost-assets` MCP connection runs `scripts/lost-assets-tools.ts` as a local stdio process. It provides five bounded tools:

- `lost_assets_status`: source metadata without owner records or credentials.
- `lost_assets_search`: actual property/prepared-case search, numeric dollar values descending before the result limit.
- `lost_assets_case`: one stored prepared case by exact case ID.
- `lost_assets_evidence`: bounded people, relationship links, evidence and human reviews for that case.
- `lost_assets_save_draft`: a local JSON draft under `data/lost-assets/exports/hermes-drafts/`, marked pending human review.

No arbitrary SQL, shell, source-file edits, account access, messaging, signing, claim submission or asset transfers are exposed by this connector. The existing Work profile may have broader native tools: its configuration and other connections are retained, and the profile itself is not a filesystem sandbox.

## Use

1. Open Lost Asset Manager → LA Plus workspace → **HERMES**.
2. Open **Connections** to review Work's `lost-assets`, Zo and Clip Studio configuration/runtime status.
3. Open **Missions** → **Lost Assets · evidence and recovery** → **Work with Hermes**.
4. Review the brief and active provider, then send it. The mission starts with source metadata and a request for the case or name to review. Operator consent for the active model/provider is required before financial/personal records are retrieved for inference.
5. Review any local draft before acting on it. Saving a draft does not submit a claim or contact anyone.

The mission is planned, not scheduled. Setup only discovers tools and reads source metadata; it does not start an inference run or transmit record data to a model. Existing connectors can be configured without being currently connected: the Connections page reports the native runtime status as supplied by Hermes.

Live connection confirmation: the embedded Herald Connections page reported `lost-assets` connected with 5 tools, Zo connected with 79 tools, and Clip Studio connected with 6 tools. A blank Work conversation was prepared without submitting a prompt. The planned recovery mission and connected Hermes runtime were visible inside LA Plus. No source records were retrieved for inference during setup.

## Reinstall/update

```powershell
node --import tsx scripts/connect-hermes-lost-assets.ts
node scripts/build-lost-assets-ui.mjs C:\path\to\LostAssets
```

The setup preserves existing connectors and backs up Work's config in the ignored `.quanta/hermes/lost-assets-backup/` directory. It installs the `quanta-lost-assets` skill only in Work. No credentials are copied into the frontend. Herald's MIT license accompanies the local frontend as `HERALD-LICENSE.txt`.
