import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProviderStore } from './provider-store';
import { createGeminiProxy } from './gemini-proxy';

async function listen(app: any) { const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r)); return { server, url: `http://127.0.0.1:${server.address().port}` }; }

test('Gemini proxy adds the protected key server-side and refuses foreign callers', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'gemini-proxy-'));
  const store = new ProviderStore(directory);
  await store.update(data => { data.connections['google-api'] = { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini', apiKey: 'protected-key' }; });
  const seen: { url: string; key: string | null; body?: string }[] = [];
  const fake = (async (url: string, init: any) => { seen.push({ url, key: init.headers['x-goog-api-key'], body: init.body }); return new Response('{"candidates":[]}', { status: 200, headers: { 'content-type': 'application/json' } }); }) as unknown as typeof fetch;
  const app = express(); app.use(express.json()); app.use('/api/gemini', createGeminiProxy(store, fake));
  const { server, url } = await listen(app);
  try {
    const ok = await fetch(`${url}/api/gemini/v1beta/models/gemini-3-flash-preview:generateContent?key=browser-key`, { method: 'POST', headers: { 'X-Quanta-Client': 'local-ui', 'Content-Type': 'application/json', 'x-goog-api-key': 'browser-key' }, body: JSON.stringify({ contents: [] }) });
    assert.equal(ok.status, 200);
    assert.equal(seen[0].key, 'protected-key');
    assert.equal(seen[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent');
    assert.equal((await fetch(`${url}/api/gemini/v1beta/models/x:generateContent`, { method: 'POST' })).status, 403, 'missing local UI header');
    assert.equal((await fetch(`${url}/api/gemini/v1beta/models/x:generateContent`, { method: 'POST', headers: { 'X-Quanta-Client': 'local-ui', Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await fetch(`${url}/api/gemini/v1beta/cachedContents/x`, { headers: { 'X-Quanta-Client': 'local-ui' } })).status, 404);
    assert.equal((await fetch(`${url}/api/gemini/v1beta/files/abc:download?alt=media`, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
    assert.equal((await fetch(`${url}/api/gemini/v1beta/files/abc:download?alt=media`, { headers: { 'sec-fetch-site': 'same-origin' } })).status, 200);
    assert.equal(seen.length, 2);
    await store.update(data => { data.connections['google-api']!.apiKey = ''; });
    assert.equal((await fetch(`${url}/api/gemini/v1beta/models/x:generateContent`, { method: 'POST', headers: { 'X-Quanta-Client': 'local-ui' } })).status, 409);
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await rm(directory, { recursive: true, force: true }); }
});

test('Live sessions receive a short-lived token, never the stored key', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'gemini-live-'));
  const store = new ProviderStore(directory);
  await store.update(data => { data.connections['google-api'] = { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: '', apiKey: 'protected-key' }; });
  let received = '';
  const app = express(); app.use(express.json()); app.use('/api/gemini', createGeminiProxy(store, fetch, async key => { received = key; return 'auth_tokens/ephemeral'; }));
  const { server, url } = await listen(app);
  try {
    const response = await fetch(`${url}/api/gemini/live-token`, { method: 'POST', headers: { 'X-Quanta-Client': 'local-ui' } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.token, 'auth_tokens/ephemeral');
    assert.equal(received, 'protected-key');
    assert.ok(!JSON.stringify(body).includes('protected-key'));
    assert.equal((await fetch(`${url}/api/gemini/live-token`, { method: 'POST' })).status, 403);
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await rm(directory, { recursive: true, force: true }); }
});
