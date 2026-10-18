// Connect the shared Hermes Work profile to the existing local Zo credential.
// Credentials pass directly to Hermes's native secret saver and are never logged.
import { readFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ProviderStore } from '../server/provider-store';

const root = path.resolve(import.meta.dirname, '..');
const profile = 'gnoesis-work';
const endpoint = 'https://api.zo.computer/mcp';
const token = readFileSync(path.join(root, '.quanta/hermes/gateway-token'), 'utf8').trim();
const port = Number(process.env.GNOESIS_HERMES_PORT || 9120);
const socket = new WebSocket(`ws://127.0.0.1:${port}/api/ws?token=${encodeURIComponent(token)}`);
const pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let readyResolve: () => void;
const ready = new Promise<void>(resolve => { readyResolve = resolve; });
socket.addEventListener('message', event => {
  for (const line of String(event.data).split('\n').filter(Boolean)) {
  let frame: any; try { frame = JSON.parse(line); } catch { continue; }
  if (frame.method === 'event' && frame.params?.type === 'gateway.ready') readyResolve();
  const request = pending.get(String(frame.id));
  if (!request || frame.method) continue;
  pending.delete(String(frame.id)); clearTimeout(request.timer);
  frame.error ? request.reject(new Error(`Hermes ${frame.error.code}: ${frame.error.message}`)) : request.resolve(frame.result);
  }
});
socket.addEventListener('close', () => {
  for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Hermes disconnected.')); }
  pending.clear();
});
async function rpc(method: string, params: Record<string, unknown> = {}) {
  const id = randomUUID();
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out.`)); }, 120_000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params: method.startsWith('mcp.servers.') ? { profile, ...params } : params }));
  });
}
let readyTimer: ReturnType<typeof setTimeout>;
try {
  await Promise.race([ready, new Promise<void>((_, reject) => { readyTimer = setTimeout(() => reject(new Error('Start Hermes before connecting Zo.')), 30_000); })]);
  clearTimeout(readyTimer!);
  const servers = await rpc('mcp.servers.list');
  const existing = servers.servers?.find((server: any) => server.name === 'zo');
  if (existing) {
    // Never replace an operator's existing connector silently.
    if (existing.url !== endpoint) throw new Error('An existing Zo server points elsewhere. Review it before changing it.');
    console.log(JSON.stringify({ profile, alreadyConfigured: true }));
  } else {
    const store = new ProviderStore(path.join(root, '.quanta'));
    const key = await store.cloudKey('business', 'zo-mcp');
    if (!key) throw new Error('Save a Business Zo MCP credential in QuantaCore first.');
    const backup = path.join(root, '.quanta/hermes/zo-backup'); mkdirSync(backup, { recursive: true });
    const config = path.join(process.env.LOCALAPPDATA || '', 'hermes/profiles', profile, 'config.yaml');
    if (existsSync(config)) copyFileSync(config, path.join(backup, `config-${Date.now()}.yaml`));
    await rpc('mcp.servers.add', { name: 'zo', config: { url: endpoint, trust: 'untrusted', timeout: 90 }, bearer_token: key });
    console.log(JSON.stringify({ profile, configured: true, endpoint, approval: 'per-call', credential: 'Hermes native profile secret; not browser storage' }));
  }
  const statusOnly = process.argv.includes('--status-only');
  const probe = statusOnly ? { ok: true, tools: [] } : await rpc('mcp.servers.test', { name: 'zo' });
  if (!probe.ok) {
    const reason = String(probe.error || 'No reason returned').replace(/[A-Za-z0-9_=-]{28,}/g, '[redacted]').slice(0, 400);
    throw new Error(`Zo probe failed: ${reason}. Configuration was preserved.`);
  }
  if (!statusOnly) console.log(JSON.stringify({ profile, authenticated: true, toolCount: probe.tools.length }));
  if (!process.argv.includes('--no-reload')) {
    if (!statusOnly) {
      const result = await rpc('reload.mcp', { confirm: true });
      console.log(JSON.stringify({ reload: result.status }));
    }
    const status = await rpc('mcp.servers.status');
    console.log(JSON.stringify({ profile, servers: status.servers.filter((server: any) => server.name === 'zo') }));
  }
} catch (error) {
  // Do not log provider HTTP bodies or secret-bearing frames.
  console.error((error as Error).message); process.exitCode = 1;
} finally { clearTimeout(readyTimer!); socket.close(); }
