import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, realpath, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// This is a one-note, one-time local ingestion pilot. It never enables watch,
// reads provider credentials, or changes another bank's configuration.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = path.join(root, '.quanta', 'obsidian');
const approvalFile = path.join(stateDir, 'pilot-approved.json');
const bank = 'quanta-obsidian-gus';
const api = 'http://127.0.0.1:8888';
const image = 'quanta-obsidian-sync:0.3.0';
const note = 'Welcome.md';
const hash = text => createHash('sha256').update(text).digest('hex');
const bankPath = `/v1/default/banks/${bank}`;
const safeSettings = {
  retain_extraction_mode: 'chunks',
  enable_observations: false,
  enable_auto_consolidation: false,
  enable_temporal_retrieval: false,
  enable_graph_retrieval: false,
  enable_text_search: true,
  enable_reranking: true,
  audit_log_enabled: true,
  memory_defense: {
    enabled: true,
    rules: [{ on: 'sensitive_data', action: 'redact' }]
  }
};
const unknownArgs = process.argv.slice(2).filter(arg => arg !== '--pilot');
if (unknownArgs.length) throw new Error('Supported option: --pilot. Continuous watch is not part of this approval.');

async function request(endpoint, method = 'GET', body) {
  const response = await fetch(`${api}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60000),
    redirect: 'error'
  });
  if (!response.ok) throw new Error(`Local Hindsight ${method} ${endpoint} failed (${response.status}).`);
  return response.json();
}

function docker(args, timeout = 180000) {
  const result = spawnSync('docker', args, { cwd: root, encoding: 'utf8', timeout, windowsHide: true });
  if (result.error || result.status !== 0) {
    // Never print Docker inspect/exec output, which may include runtime secrets.
    throw new Error(`Docker ${args[0]} failed: ${result.error?.message || `exit ${result.status}`}.`);
  }
  return result.stdout.trim();
}

function assertSafeSettings(config) {
  for (const [key, expected] of Object.entries(safeSettings)) {
    if (!isDeepStrictEqual(config[key], expected)) {
      throw new Error(`Obsidian bank ${key} differs from its local-only pilot policy. No retain was submitted.`);
    }
  }
}

const approval = JSON.parse(await readFile(approvalFile, 'utf8'));
if (approval.scope !== 'one-current-note' || approval.note !== note || approval.bank !== bank) {
  throw new Error('This pilot requires an exact one-note approval record.');
}
const vault = await realpath(approval.vault);
const source = await realpath(path.join(vault, note));
if (path.relative(vault, source) !== note) throw new Error('The approved note must be directly inside the vault.');
const original = await readFile(source);
if (original.length > 4096 || hash(original) !== approval.sha256) {
  throw new Error('Welcome.md changed after approval. No content was submitted.');
}

if (!process.argv.includes('--pilot')) {
  console.log(JSON.stringify({ mode: 'plan', bank, note, bytes: original.length, watch: false,
    providerCalls: 0, paidBudgetUsd: 0, extraction: 'local source chunks', approvalRequiredForNewNotes: true }, null, 2));
  process.exit(0);
}
if (approval.completedAt) throw new Error('This one-time pilot is already complete. Inspect its report; do not re-ingest.');

// Check the running image, rather than trusting compose defaults or another checkout.
const verification = JSON.parse(docker(['exec', 'quanta-hindsight', 'python', '-c',
  'import inspect,json; from hindsight_api.config import get_config; from hindsight_api.engine.retain.fact_extraction import extract_facts_from_contents; c=get_config(); s=inspect.getsource(extract_facts_from_contents); print(json.dumps({"embeddings":c.embeddings_provider,"reranker":c.reranker_provider,"bank_config":c.enable_bank_config_api,"chunks_skip_llm":\'if config.retain_extraction_mode == "chunks":\\n        return _extract_facts_chunks(contents, config)\' in s}))'
]));
if (verification.embeddings !== 'local' || verification.reranker !== 'local' ||
    !verification.bank_config || !verification.chunks_skip_llm) {
  throw new Error('Running Hindsight does not meet the local-only contract. No retain was submitted.');
}

await request(bankPath, 'PUT', {
  name: 'Gus Obsidian source notes — local pilot',
  retain_extraction_mode: 'chunks',
  enable_observations: false,
  enable_temporal_retrieval: false,
  enable_graph_retrieval: false,
  enable_text_search: true,
  enable_reranking: true
});
await request(`${bankPath}/config`, 'PATCH', { updates: safeSettings });
assertSafeSettings((await request(`${bankPath}/config`)).config);

// The named volume stays outside the read-only canonical vault. The pinned
// image initializes its permissions for the unprivileged node user.
const cliOutput = docker(['run', '--rm', '--name', 'quanta-obsidian-pilot',
  '--network', 'opennoesis-network', '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=32m',
  '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
  '--mount', `type=bind,source=${vault},target=/vault,readonly`,
  '--mount', 'type=volume,source=quanta_obsidian_pilot_index,target=/home/node/.hindsight/obsidian',
  image, 'reconcile', '--vault', '/vault', '--bank', bank, '--vault-name', 'Gus',
  '--api-url', 'http://hindsight:8888', '--include', note, '--exclude', '.obsidian',
  '--exclude', '.trash', '--prefix-doc-id', '--index', '/home/node/.hindsight/obsidian/pilot.json'
]);

// Upstream CLI marks an item indexed when async retain is accepted. Wait for
// the actual worker result before declaring the ingestion complete.
const deadline = Date.now() + 180000;
let operations;
do {
  const listing = await request(`${bankPath}/operations?type=retain&limit=100`);
  operations = listing.operations || [];
  if (operations.some(item => ['failed', 'cancelled'].includes(item.status))) {
    throw new Error('The Obsidian retain worker failed or was cancelled. The pilot is not verified.');
  }
  if (operations.length && operations.every(item => item.status === 'completed')) break;
  await new Promise(resolve => setTimeout(resolve, 1000));
} while (Date.now() < deadline);
if (!operations?.length || !operations.every(item => item.status === 'completed')) {
  throw new Error('Retain completion was not observed within the pilot timeout.');
}
assertSafeSettings((await request(`${bankPath}/config`)).config);
const documents = await request(`${bankPath}/documents?limit=100`);
const documentRows = documents.items || documents.documents || [];
if (!documentRows.some(item => item.id === `Gus/${note}` || item.document_id === `Gus/${note}`)) {
  throw new Error('The approved source document is missing after retain completion.');
}
const recall = await request(`${bankPath}/memories/recall`, 'POST', {
  query: 'new vault note create link importer', budget: 'low', max_tokens: 512,
  tags: ['vault:Gus'], tags_match: 'all', include: { chunks: { max_tokens: 512 } }
});
if (!recall.results?.length) throw new Error('No source chunk was returned by local recall.');
const llmStats = await request(`${bankPath}/llm-requests/stats?period=1d`);
const recordedModelCalls = (llmStats.buckets || []).reduce((total, bucket) => total + bucket.total, 0);
if (recordedModelCalls !== 0) throw new Error('Unexpected LLM activity was recorded for the local-only source bank.');
if (hash(await readFile(source)) !== approval.sha256) throw new Error('Vault content changed during the pilot.');
const report = {
  checkedAt: new Date().toISOString(), bank, note, bytes: original.length,
  verified: true, watch: false, sourceUnchanged: true,
  paidInferenceUsd: 0, externalModelCalls: 0,
  llmTraceCount: recordedModelCalls,
  settings: safeSettings, runtime: verification,
  retainOperations: operations.map(item => ({ id: item.id || item.operation_id, status: item.status })),
  documentCount: documentRows.length, recallResultCount: recall.results.length,
  limitation: 'Source chunks only; no synthesized facts, observations, graph entities or reflect call.',
  cliSummary: cliOutput.split(/\r?\n/).find(line => line.startsWith('reconcile:')) || 'No summary'
};
await mkdir(stateDir, { recursive: true });
await writeFile(path.join(stateDir, 'pilot-result.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(approvalFile, `${JSON.stringify({ ...approval, completedAt: report.checkedAt }, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
