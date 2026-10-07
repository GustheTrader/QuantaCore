# Data Intake v1

Open `/#/data-intake`, also available under Governess in the left navigation.
Trading, business, personal and chat data use one preview and import process.
Supported inputs: CSV, JSON, JSONL, TXT and Markdown. Maximum 5 MB and 10,000
records per file. ChatGPT mapping exports and conversation messages arrays
are flattened into records; unsupported attachment bodies remain only in the
original source. No PDF, XLSX, archive or connector ingestion is implemented.

Imports use IndexedDB in the current browser origin (`quanta_data_intake_v1`).
The original text, SHA-256 fingerprint, parsed records, mapping, validation
issues, timestamp and agent assignments are retained. This is browser-local
storage, not encrypted custody, a backup or an account-isolated multi-user store.
Do not use a shared browser profile for private material. Clearing browser site
data removes imports. Source filenames and records are not written to the
connection log; only purpose, counts and assignment events are recorded.

CSV validates structure and retains duplicates with warnings. Trading mappings
check timestamp, instrument, finite price and time order. These checks are not
a backtest, gap audit, quote-execution check or authoritative settlement audit.
Business and personal data have structural validation only. User review is
required before import; warnings are retained rather than silently corrected.

Imports start with no agent assignments. Assignment makes sources selectable
in Agent Control Plane for that track. Selection is explicit; at submission,
assignments are rechecked against the local database. Up to three source
excerpts are inserted into source-material context (8,000 characters each,
24,000 combined with other files). The UI warns that selected excerpts go to
the selected provider. Large structured datasets require a future query adapter;
this version does not send or analyze every record. Source material is labeled
as data rather than agent instructions. Other agent runtimes do not consume
these assignments automatically. Removing all assignments keeps the original.

Next adapters: saved column templates, timezone normalization, dataset queries,
source search/indexing, file exports/backups, per-user storage isolation and
read-only connectors. External connectors and cloud synchronization need their
own explicit scopes and approvals.
