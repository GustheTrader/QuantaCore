import { getLocalSecrets, saveLocalSecrets } from './protected-secrets.mjs';
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '.quanta');
mkdirSync(dir, { recursive: true });
const configFile = path.join(dir, 'business-bridge.json');
const keyFile = path.join(dir, 'bootstrap-credentials.json');
const secrets = await getLocalSecrets();
const config = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : { clients: {} };
const keys = secrets.connectorKeys || {};
for (const kind of ['paperclip', 'activepieces', 'twenty']) {
  keys[kind] ||= randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(keys[kind]).digest('hex');
  if (config.clients[kind]?.tokenHash && config.clients[kind].tokenHash !== tokenHash) throw new Error('Connector key mismatch; preserve existing files and reconcile manually');
  config.clients[kind] = { ...config.clients[kind], tokenHash, kind };
}
// Persist before upstream mutations; rerunning reuses existing credentials.
async function save() {
  secrets.connectorKeys = keys; await saveLocalSecrets(secrets);
  for (const [file, data] of [[configFile, config]]) {
    writeFileSync(file + '.tmp', JSON.stringify(data, null, 2), { mode: 0o600 }); renameSync(file + '.tmp', file);
  }
}
await save();
const response = await fetch('http://127.0.0.1:3000/api/work-zone/build/state', { headers: { 'X-Quanta-Client': 'local-ui' }, signal: AbortSignal.timeout(15000) });
const state = await response.json();
if (!response.ok || !state.company?.id) throw new Error('Existing Quanta build organization is required; no duplicate company was created');
const base = 'http://127.0.0.1:3210';
const credentials = secrets.paperclipAuth;
if (!credentials) throw new Error('Protected Paperclip credentials required');
const login = await fetch(base + '/api/auth/sign-in/email', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(credentials), signal: AbortSignal.timeout(15000) });
if (!login.ok) throw new Error('Paperclip local operator login failed');
const cookie = login.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
if (!cookie) throw new Error('No Paperclip session');
async function board(endpoint, method = 'GET', body) {
  const r = await fetch(base + '/api' + endpoint, { method, redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Origin: base, Cookie: cookie, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!r.ok) throw new Error('Paperclip setup returned HTTP ' + r.status);
  return r.json();
}
const companyId = state.company.id;
const agents = await board(`/companies/${companyId}/agents`);
let agent = agents.find(a => a.metadata?.quantaBusinessBridge === true);
const adapterConfig = { url: 'http://host.docker.internal:3000/api/business-bridge/paperclip/heartbeat', method: 'POST', headers: { Authorization: 'Bearer ' + keys.paperclip }, payloadTemplate: { model: process.argv.includes('--chatgpt') ? 'chatgpt-plan' : 'local' }, timeoutMs: 120000 };
if (!agent) {
  agent = await board(`/companies/${companyId}/agents`, 'POST', {
    name: 'Business Model Analyst', role: 'general', title: 'Business planning and analysis; human review required', adapterType: 'http', adapterConfig,
    runtimeConfig: { heartbeat: { enabled: false, wakeOnAssignment: false } }, budgetMonthlyCents: 0,
    metadata: { quantaBusinessBridge: true, externalActions: false, domain: 'business' },
  });
  await board(`/agents/${agent.id}`, 'PATCH', { status: 'paused' });
} else if (agent.status !== 'paused') {
  throw new Error('Existing Business analyst is active; review its configuration before modifying it');
} else {
  await board(`/agents/${agent.id}`, 'PATCH', { adapterConfig, runtimeConfig: { heartbeat: { enabled: false, wakeOnAssignment: false } } });
}
config.clients.paperclip.companyId = companyId;
config.clients.paperclip.agentId = agent.id;
await save();
console.log(JSON.stringify({ companyId, agentId: agent.id, status: 'paused', modelBaseUrl: 'http://127.0.0.1:3000/api/business-bridge/v1', connectorKeysFile: keyFile, credentialsPrinted: false }));
