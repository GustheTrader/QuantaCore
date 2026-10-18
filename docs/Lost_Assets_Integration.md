# Lost Asset Manager · local LA Plus

Quanta's `/#/lost-assets` page contains the LA Plus recovery workspace, a bounded DuckDB search across claims and workbook evidence, and a source register.

## Deployment and source

- Hosted app: https://lost-assets.vercel.app/
- Requested deployment: https://vercel.com/jeffgus-gmailcoms-projects/lost-assets/FvJSjoU7gb4L8geez31V3KYdWwrM
- Deployment source commit: `b6648d85ed653365902914b16c0f05b28f2c22e9` in `GustheTrader/LostAssets`.
- The local frontend is built from an existing LostAssets checkout. Its exact source commit is recorded in `.quanta/lost-assets-app/integration.json`; it may differ from the hosted deployment.

## Local setup

Install DuckDB CLI with `winget install DuckDB.cli`. Build the local frontend using an existing LostAssets checkout with its dependencies installed:

```powershell
node scripts/build-lost-assets-ui.mjs C:\path\to\LostAssets
```

Use the Data sources tab to save full source paths and connect each file, or run:

```powershell
node --import tsx scripts/connect-lost-assets.ts --root C:\QuantaCore --csv C:\data\All_Records.csv --archive C:\data\04_From_500_To_Beyond.zip --workbook051 C:\data\Heir_Recovery_Ranks_051_250.xlsx --workbook251 C:\data\Heir_Recovery_Ranks_251_500.xlsx
```

Restart Quanta after changing server code. The local frontend is served at `/api/lost-assets/app/`.

## Data model

| Source | DuckDB object | Storage |
| --- | --- | --- |
| Master 25-column property CSV | `claims` | Read-only view of original CSV; no duplicate full import |
| CSV ZIP | `priority_claims` | Bounded extraction under local data directory; read-only view across parts |
| Workbook ranks 051–250 | `heir_051_250_*` | Imported canonical sheets with source provenance |
| Workbook ranks 251–500 | `heir_251_500_*` | Imported canonical sheets with source provenance |

Workbook imports include Asset_Cases, Person_Records, Asset_Person_Links, Evidence_Log, Review_Log and the Top ranked view. README and validation lists are not mistaken for cases. `_quanta_source_file` and `_quanta_source_sheet` identify each imported row's origin. Reimport replaces only that workbook's derivative tables.

The CSV's `OWNER_STATE` is an owner-address field, not proof of the reporting jurisdiction. Local record state filters use this address field. Source filenames establish provenance, not eligibility or a verified claimant relationship.

Config, source register, job journal, DuckDB database, extracted CSVs and temporary query files live under `data/lost-assets/`. That directory and `.quanta/` are ignored by Git. Original source files are preserved. Full CSV totals are not scanned during connection. Large substring searches can take time and have a two-minute query timeout, bounded output and a 768 MB memory limit.

## Supported workflow and boundaries

- The Quanta page searches priority claims, master records, prepared cases, and people/link/evidence/review sheets.
- Local LA Plus search and its Database Explorer use actual DuckDB records. Case drafts use the app's browser storage, separate from imported workbook evidence.
- Intake starts blank and saves an explicitly unverified browser-local draft. Original sample telemetry, prefilled claimant details, simulated claim amounts and contract-signing behavior are excluded. Tools beyond intake, record search, saved cases and Database Explorer show an explicit local setup notice.
- Simulated relatives and OSINT matches are disabled. A linked person or contact must be verified from evidence. Missing relationships return no matches.
- Cloud reasoning, external scraping, agent execution and messaging are not activated by this integration. Unsupported API routes return a configuration error. Draft claims are not official submissions.
- The hosted app has a separate data environment. It cannot read C: drive paths through this integration. Recovery files are not uploaded to Vercel or inference providers.
- The local API checks loopback host and socket, same-origin requests, and its UI header. Its frontend CSP restricts connections to the local origin. It is intended for a trusted local machine, not a public network service.

## Connection results · 2026-10-13

Connected the user-selected master CSV and four-part priority ZIP. Imported both canonical workbooks: 200 + 250 Asset_Cases rows, with corresponding people, links, evidence, reviews and ranked views. Source metadata and actual user paths remain in the ignored local config/register.

Validation: bounded record reads and property-ID searches passed against both real CSV views; all 450 prepared case rows retained workbook provenance. Synthetic quoted-name and SQL-injection-literal searches passed, and the master object was confirmed as a view. CSV readers use sequential streaming to avoid the observed parallel-read timeout. Quanta TypeScript checking and both frontend production builds passed.
