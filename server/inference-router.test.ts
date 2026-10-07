import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProviderStore } from './provider-store';
import { createInferenceRouters } from './inference-router';

const listen = async (server: Server) => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as any).port}`;
};
const close = (server: Server) => new Promise<void>(resolve => server.close(() => resolve()));

test('local inference gateway routes, protects credentials and never falls back', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'quanta-provider-check-'));
  const fixtureKey = 'fixture-key-for-local-check-only';
  const upstreamApp = express();
  upstreamApp.use(express.json());
  const received: any[] = [];
  upstreamApp.get('/v1/models', (_req, res) => res.json({ data: [{ id: 'fixture-model', name: 'Fixture Model' }, { id: 'fixture-alternative' }, { missing: true }] }));
  upstreamApp.post('/v1/chat/completions', (req, res) => {
    received.push({ body: req.body, authorization: req.get('authorization') });
    if (req.body.messages[0]?.content === 'fixture-fail') return res.status(503).json({ error: { message: `Rejected ${fixtureKey}` } });
    if (req.body.stream) { res.setHeader('Content-Type', 'text/event-stream'); return res.end('data: {"choices":[{"delta":{"content":"fixture"}}]}\n\ndata: [DONE]\n\n'); }
    res.json({ id: 'fixture', model: req.body.model, choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'fixture response' } }] });
  });
  const upstream = createServer(upstreamApp);
  const upstreamUrl = await listen(upstream);
  const store = new ProviderStore(directory);
  const routers = createInferenceRouters(store);
  const app = express(); app.use(express.json()); app.use('/api/inference', routers.api); app.use('/v1', routers.openai);
  const server = createServer(app);
  const url = await listen(server);
  const call = (route: string, body?: any, headers: Record<string, string> = {}) => fetch(`${url}${route}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const save = (id: string, body: any) => fetch(`${url}/api/inference/providers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui' }, body: JSON.stringify(body) });
  let gatewayKey = '';
  const scope = { name: 'Fixture client', provider: 'local', model: 'fixture-model', enabled: true, maxInputBytes: 16000, maxOutputTokens: 512, requestsPerMinute: 30, monthlyCalls: 100, monthlyCapUsd: 0, reservePerCallUsd: 0 };
  const operator = () => fetch(`${url}/api/inference/gateway-policy/operator`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui' }, body: JSON.stringify(scope) });
  try {
    await t.test('admin access is restricted and endpoints are validated', async () => {
      assert.equal((await fetch(`${url}/api/inference/providers`)).status, 403);
      assert.equal((await call('/api/inference/providers', undefined, { Origin: 'https://untrusted.example' })).status, 403);
      assert.equal((await save('local', { baseUrl: 'https://remote.example/v1', model: 'fixture' })).status, 400);
      assert.equal((await save('openai-compatible', { baseUrl: 'http://remote.example/v1', model: 'fixture' })).status, 400);
      assert.equal((await save('openai-compatible', { baseUrl: 'not-a-url', model: 'fixture' })).status, 400);
    });
    await t.test('credentials are encrypted and masked; catalogs are live upstream lists', async () => {
      assert.equal((await save('local', { baseUrl: `${upstreamUrl}/v1`, model: 'fixture-model', apiKey: fixtureKey })).status, 200);
      const publicData = await (await call('/api/inference/providers')).json();
      assert.equal(publicData.connections.find((item: any) => item.id === 'local').hasKey, true);
      assert.equal(JSON.stringify(publicData).includes(fixtureKey), false);
      assert.equal((await readFile(path.join(directory, 'providers.json'), 'utf8')).includes(fixtureKey), false);
      assert.equal((await new ProviderStore(directory).connection('local')).apiKey, fixtureKey);
      const models = await (await call('/api/inference/providers/local/models')).json();
      assert.deepEqual(models.data.map((item: any) => item.id), ['fixture-model', 'fixture-alternative']);
    });
    await t.test('completion uses the exact selected route and model', async () => {
      assert.equal((await call('/api/inference/chat/completions', { provider: 'local', model: 'fixture-model', messages: [{ role: 'user', content: 'fixture request' }] })).status, 403);
      assert.equal((await operator()).status, 200);
      const response = await call('/api/inference/chat/completions', { provider: 'local', model: 'fixture-model', messages: [{ role: 'user', content: 'fixture request' }] });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).model, 'fixture-model');
      assert.equal(received.at(-1).authorization, `Bearer ${fixtureKey}`);
      assert.equal(received.at(-1).body.messages[0].content, 'fixture request');
      const failed = await call('/api/inference/chat/completions', { provider: 'local', model: 'fixture-model', messages: [{ role: 'user', content: 'fixture-fail' }] });
      assert.equal(failed.status, 503); assert.equal((await failed.text()).includes(fixtureKey), false);
      assert.equal((await call('/api/inference/chat/completions', { provider: 'fireworks', messages: [{ role: 'user', content: 'fixture request' }] })).status, 400);
    });
    await t.test('concurrent updates preserve each connection and one gateway key', async () => {
      const results = await Promise.all([
        save('openai-compatible', { baseUrl: `${upstreamUrl}/v1`, model: 'fixture-model' }),
        save('fireworks', { baseUrl: 'https://api.fireworks.ai/inference/v1', model: 'fixture-unconfigured' }),
        call('/api/inference/gateway-key', {}), call('/api/inference/gateway-key', {})
      ]);
      assert.equal(results[0].status, 200);
      assert.equal(results[1].status, 200);
      assert.equal(results[2].status, 410); assert.equal(results[3].status, 410);
      const scoped = await call('/api/inference/gateway-policy/clients', scope);
      assert.equal(scoped.status, 200); gatewayKey = (await scoped.json()).key;
      const data = await store.publicConfig();
      assert.equal(data.connections.find(item => item.id === 'local')?.model, 'fixture-model');
      assert.equal(data.connections.find(item => item.id === 'openai-compatible')?.model, 'fixture-model');
      const disk = await readFile(path.join(directory, 'providers.json'), 'utf8');
      assert.equal(disk.includes(gatewayKey), false);
    });
    await t.test('scoped API rejects streams and routes outside the client permission', async () => {
      assert.equal((await call('/v1/models')).status, 401);
      assert.equal((await call('/v1/models', undefined, { Authorization: `Bearer ${'é'.repeat(gatewayKey.length)}` })).status, 401);
      const auth = { Authorization: `Bearer ${gatewayKey}` };
      const models = await (await call('/v1/models', undefined, auth)).json();
      assert.ok(models.data.some((item: any) => item.id === 'local/fixture-model'));
      assert.equal(models.data.some((item: any) => item.id === 'fireworks/fixture-unconfigured'), false);
      const streamed = await call('/v1/chat/completions', { model: 'local/fixture-alternative', stream: true, messages: [{ role: 'user', content: 'fixture request' }] }, auth);
      assert.equal(streamed.status, 403);
      assert.equal((await call('/v1/chat/completions', { model: 'local/fixture-model', stream: true, messages: [{ role: 'user', content: 'fixture request' }] }, auth)).status, 403);
      assert.equal((await call('/v1/chat/completions', { model: 'local/fixture-model', messages: [{ role: 'user', content: 'fixture request' }] }, auth)).status, 200);
      assert.equal(received.at(-1).body.model, 'fixture-model');
    });
  } finally {
    await close(server); await close(upstream);
    // Only remove this fixture's known files; never recursively remove a computed path.
    for (const file of ['providers.json', 'providers.tmp', 'credential.key', 'gateway-policy.json', 'gateway-credentials.json']) {
      try { await unlink(path.join(directory, file)); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    }
    await rmdir(directory);
  }
});
