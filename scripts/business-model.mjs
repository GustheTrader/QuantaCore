import { getLocalSecrets } from './protected-secrets.mjs';
import { readFileSync } from 'node:fs';
const [client, action, filename] = process.argv.slice(2);
if (!['activepieces', 'twenty'].includes(client) || !['plan', 'draft'].includes(action) || !filename) {
  console.error('Usage: node scripts/business-model.mjs activepieces|twenty plan|draft INPUT_FILE'); process.exit(1);
}
const keys = (await getLocalSecrets()).connectorKeys || {};
const source = readFileSync(filename, 'utf8');
const draft = action === 'draft';
const body = draft ? JSON.parse(source) : { model: 'local', messages: [{ role: 'user', content: source }] };
const headers = { Authorization: 'Bearer ' + keys[client], 'Content-Type': 'application/json' };
if (draft) {
  const { createHash } = await import('node:crypto');
  headers['Idempotency-Key'] = createHash('sha256').update(source).digest('hex');
}
try {
  const response = await fetch('http://127.0.0.1:3000/api/business-bridge/' + (draft ? 'jobs' : 'v1/chat/completions'), { method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(90000) });
  const result = await response.json();
  if (!response.ok) { console.error(result.error?.message || 'Connector request failed'); process.exitCode = 1; }
  else console.log(JSON.stringify(result, null, 2));
} catch { console.error('Local Business bridge is unavailable'); process.exitCode = 1; }
