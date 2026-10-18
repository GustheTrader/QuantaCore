import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCloudroomRouter, validCoreUrl, validGuiUrl, summarizeCore } from './cloudroom-router';
import type { ProviderStore } from './provider-store';

const TOKEN = 'a'.repeat(64);

test('address rules keep the GUI local and the core on HTTPS', () => {
  assert.equal(validGuiUrl('http://127.0.0.1:39886'), 'http://127.0.0.1:39886');
  assert.throws(() => validGuiUrl('https://example.com'));
  assert.throws(() => validGuiUrl('http://127.0.0.1:39886/path'));
  assert.equal(validCoreUrl('https://cloudroom-core-jeff.zo.computer/'), 'https://cloudroom-core-jeff.zo.computer');
  assert.equal(validCoreUrl('http://127.0.0.1:9840'), 'http://127.0.0.1:9840');
  assert.throws(() => validCoreUrl('http://cloudroom.example.com'));
  assert.throws(() => validCoreUrl('https://user:pw@host.example'));
  assert.equal(validCoreUrl(''), '');
});

test('core summary reads harness list and ignores everything else', () => {
  const summary = summarizeCore({ status: 'ready', storage: { state: 'ok' }, secret: 'x' }, { harnesses: [{ id: 'codex', model: 'gpt-5', models: [{ id: 'gpt-5' }] }] }, { sessions: [{}, {}] });
  assert.deepEqual(summary, { status: 'ready', storage: 'ok', harnesses: [{ id: 'codex', model: 'gpt-5', models: ['gpt-5'] }], sessions: 2 });
  assert.deepEqual(summarizeCore(null, null, null).harnesses, []);
});

test('Cloudroom router is local-only, never returns the token and checks the core', async () => {
  const keys = new Map<string, string>();
  const store = {
    cloudConfigured: async (d: string, p: string) => Boolean(keys.get(`${d}:${p}`)),
    cloudKey: async (d: string, p: string) => keys.get(`${d}:${p}`) || '',
    setCloudKey: async (d: string, p: string, k: string) => { keys.set(`${d}:${p}`, k); }
  } as unknown as ProviderStore;
  const seen: { url: string; auth?: string }[] = [];
  const fakeFetch = (async (url: string, init?: any) => {
    seen.push({ url, auth: init?.headers?.Authorization });
    if (url.endsWith('/health') && url.startsWith('http://127.0.0.1:39886')) return new Response('ok', { status: 200 });
    if (init?.headers?.Authorization !== `Bearer ${TOKEN}`) return new Response('{"error":"no"}', { status: 401 });
    if (url.endsWith('/v1/health')) return new Response(JSON.stringify({ status: 'ready', storage: { state: 'ok' } }));
    if (url.endsWith('/v1/capabilities')) return new Response(JSON.stringify({ harnesses: [{ id: 'pi', model: 'auto' }] }));
    if (url.endsWith('/v1/dashboard')) return new Response(JSON.stringify({ sessions: [] }));
    return new Response('', { status: 404 });
  }) as typeof fetch;
  const root = mkdtempSync(path.join(tmpdir(), 'cloudroom-'));
  const app = express(); app.use(express.json());
  app.use('/api/cloudroom', createCloudroomRouter(store, root, fakeFetch));
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}/api/cloudroom`;
  const call = (route: string, method = 'GET', body?: any, headers = {}) => fetch(`${url}${route}`, { method, headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await fetch(`${url}/config`)).status, 403);
    assert.equal((await call('/config', 'GET', undefined, { Origin: 'https://evil.example' })).status, 403);
    const initial = await (await call('/config')).json();
    assert.equal(initial.guiUrl, 'http://127.0.0.1:39886'); assert.equal(initial.hasToken, false);
    assert.equal((await (await call('/gui')).json()).running, true);
    assert.equal((await call('/core/test', 'POST', {})).status, 409);
    assert.equal((await call('/config', 'PUT', { coreUrl: 'http://remote.example' })).status, 400);
    assert.equal((await call('/config', 'PUT', { token: 'short' })).status, 400);
    const saved = await call('/config', 'PUT', { coreUrl: 'https://core.zo.computer', token: TOKEN });
    const savedText = await saved.text();
    assert.equal(saved.status, 200); assert.equal(savedText.includes(TOKEN), false);
    assert.equal(JSON.parse(savedText).hasToken, true);
    const result = await (await call('/core/test', 'POST', {})).json();
    assert.equal(result.status, 'ready'); assert.equal(result.harnesses[0].id, 'pi'); assert.equal(result.sessions, 0);
    assert.ok(seen.some(s => s.url === 'https://core.zo.computer/v1/health' && s.auth === `Bearer ${TOKEN}`));
    keys.set('cloud:cloudroom-core', 'b'.repeat(40));
    assert.equal((await call('/core/test', 'POST', {})).status, 401);
    await call('/config', 'PUT', { clearToken: true });
    assert.equal((await (await call('/config')).json()).hasToken, false);
  } finally { server.close(); }
});
