import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { authenticateBusinessClient, validateBusinessMessages, createBusinessBridge, assertBusinessLocalModel } from './business-bridge';

test('connector authentication is scoped and rejects incorrect tokens', () => {
  const token = 'a'.repeat(43);
  const config = { clients: { twenty: { kind: 'twenty' as const, tokenHash: createHash('sha256').update(token).digest('hex') } } };
  assert.equal(authenticateBusinessClient(config, 'Bearer ' + token).kind, 'twenty');
  assert.throws(() => authenticateBusinessClient(config, 'Bearer ' + 'b'.repeat(43)), /authentication/);
  assert.throws(() => authenticateBusinessClient(config, undefined), /authentication/);
});
test('planning model rejects cloud routing, tools, streams and nontext', () => {
  for (const model of ['gpt-oss:120b-cloud', 'qwen:cloud', 'cloud-model']) assert.throws(() => assertBusinessLocalModel(model), /local-only/);
  assert.doesNotThrow(() => assertBusinessLocalModel('qwen:7b'));
  for (const body of [{ model: 'fireworks/model', messages: [] }, { tools: [], messages: [] }, { stream: true }, { messages: [{ role: 'user', content: [] }] }]) assert.throws(() => validateBusinessMessages(body));
  assert.deepEqual(validateBusinessMessages({ model: 'local', messages: [{ role: 'user', content: 'Plan a launch' }] }), [{ role: 'user', content: 'Plan a launch' }]);
});
test('HTTP bridge routes local inference and forces cloud drafts into Business without approving', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'business-bridge-'));
  const token = 'a'.repeat(43);
  mkdirSync(path.join(root, '.quanta'));
  writeFileSync(path.join(root, '.quanta', 'business-bridge.json'), JSON.stringify({ clients: { activepieces: { kind: 'activepieces', tokenHash: createHash('sha256').update(token).digest('hex') } } }));
  let drafts = 0;
  const store: any = { connection: async () => ({ baseUrl: 'http://127.0.0.1:11434/v1', model: 'fixture-local' }) };
  const hybrid: any = { draft: async (body: any) => { assert.equal(body.domain, 'business'); drafts++; return { id: 'draft1', status: 'draft' }; } };
  const request: typeof fetch = (async (url, init) => {
    assert.equal(String(url), 'http://127.0.0.1:11434/v1/chat/completions');
    assert.equal(JSON.parse(String(init?.body)).model, 'fixture-local');
    return new Response(JSON.stringify({ choices: [{ message: { content: 'A reviewable plan' } }] }));
  }) as typeof fetch;
  const app = express(); app.use(express.json()); app.use(createBusinessBridge(root, store, hybrid, request));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  try {
    assert.equal((await fetch(base + '/v1/models')).status, 401);
    assert.equal((await fetch(base + '/v1/models', { headers: { ...headers, Origin: 'http://evil.test' } })).status, 403);
    const result = await fetch(base + '/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify({ model: 'local', messages: [{ role: 'user', content: 'Plan' }] }) });
    assert.equal(result.status, 200); assert.equal((await result.json()).choices[0].message.content, 'A reviewable plan');
    const draft = await fetch(base + '/jobs', { method: 'POST', headers: { ...headers, 'Idempotency-Key': 'job1' }, body: JSON.stringify({ operation: 'fireworks_infer', domain: 'trading' }) });
    assert.equal(draft.status, 202); assert.equal((await draft.json()).executionStarted, false); assert.equal(drafts, 1);
    assert.equal((await fetch(base + '/jobs/draft1/approve', { method: 'POST', headers })).status, 405);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); rmSync(root, { recursive: true }); }
});

test('Paperclip checks ownership, posts evidence once, and refuses uncertain retries', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'business-worker-'));
  const token = 'p'.repeat(43);
  mkdirSync(path.join(root, '.quanta'));
  writeFileSync(path.join(root, '.quanta', 'business-bridge.json'), JSON.stringify({ clients: { paperclip: { kind: 'paperclip', companyId: 'company1', agentId: 'agent1', tokenHash: createHash('sha256').update(token).digest('hex') } } }));
  let comments = 0, modelCalls = 0, wrongCompany = true, failModel = false;
  const request: typeof fetch = (async (url, init) => {
    const address = String(url);
    if (address.endsWith('/api/auth/sign-in/email')) return new Response('{}', { headers: { 'set-cookie': 'session=fixture; HttpOnly' } });
    if (address.endsWith('/comments')) { comments++; assert.match(JSON.parse(String(init?.body)).body, /human review required/); return new Response('{"id":"comment1"}'); }
    if (address.includes('/api/issues/')) return new Response(JSON.stringify({ companyId: wrongCompany ? 'other' : 'company1', assigneeAgentId: 'agent1', status: 'todo', title: 'Plan', description: 'Evidence' }));
    modelCalls++; return new Response(JSON.stringify({ choices: [{ message: { content: 'Measured launch proposal' } }] }), { status: failModel ? 503 : 200 });
  }) as typeof fetch;
  const store: any = { getOAuthCredentials: async () => ({ paperclipAuth: { email: 'fixture', password: 'fixture' } }), connection: async () => ({ baseUrl: 'http://127.0.0.1:11434/v1', model: 'fixture' }) };
  const app = express(); app.use(express.json()); app.use(createBusinessBridge(root, store, {} as any, request));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const send = (runId: string, agentId = 'agent1') => fetch(base + '/paperclip/heartbeat', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId, runId, context: { issueId: 'issue1' } }) });
  try {
    assert.equal((await send('r1', 'other')).status, 403);
    assert.equal((await send('r1')).status, 403); assert.equal(modelCalls, 0);
    wrongCompany = false;
    assert.equal((await send('r1')).status, 200);
    assert.equal((await send('r1')).status, 200); assert.equal(comments, 1); assert.equal(modelCalls, 1);
    failModel = true;
    assert.equal((await send('r2')).status, 502);
    assert.equal((await send('r2')).status, 409); assert.equal(modelCalls, 2); assert.equal(comments, 1);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); rmSync(root, { recursive: true }); }
});
