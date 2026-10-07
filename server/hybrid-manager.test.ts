import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { HybridManager } from './hybrid-manager';
import { ProviderStore } from './provider-store';
import { createHybridRouter } from './hybrid-router';
import type { CloudJobRequest } from '../lib/hybrid-contract';

const input = (overrides: Partial<CloudJobRequest> = {}): CloudJobRequest => ({ domain: 'business', operation: 'zo_report', label: 'Fixture report', estimatedUpperBoundUsd: 0.29, datasetHash: 'a'.repeat(64), schemaVersion: 'v1', labelDefinition: 'Source-grounded report', sourceAvailableAt: '2026-01-01T00:00:00Z', codeCommit: 'fixture-v1', payload: { input: 'Public fixture facts only' }, ...overrides });
function fixture(request: typeof fetch = async () => new Response(JSON.stringify({ output: 'Fixture report' }), { status: 200 })) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'quanta-hybrid-'));
  const keys: Record<string, string> = {};
  const store = { cloudKey: async (d: string, p: string) => keys[`${d}:${p}`] || '', cloudConfigured: async (d: string, p: string) => Boolean(keys[`${d}:${p}`]), setCloudKey: async (d: string, p: string, key: string) => { keys[`${d}:${p}`] = key; } } as unknown as ProviderStore;
  const manager = new HybridManager(store, root, request);
  const configure = (domain = 'business', provider = 'zo', cap = 1) => manager.configure(domain, provider, { enabled: true, accountId: 'fixture', deploymentId: 'fixture-deployment', model: 'accounts/fireworks/models/fixture-base', apiKey: `${domain}-${provider}-secret`, monthlyCapUsd: cap });
  return { manager, root, store, configure, close: () => { manager.stop(); rmSync(root, { recursive: true, force: true }); } };
}
const approval = { approveDataExport: true, approveSpend: true };

test('draft and approval are local; submission uses only the selected domain credential', async () => {
  const calls: any[] = [];
  const f = fixture(async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ output: 'Business report' })); });
  try {
    await f.configure(); const j = await f.manager.draft(input(), 'one');
    assert.equal(calls.length, 0); assert.equal(j.status, 'draft');
    await assert.rejects(f.manager.run(j.id), /approved job/);
    await assert.rejects(f.manager.approve(j.id, {}), /exact payload/);
    await f.manager.approve(j.id, approval); assert.equal(calls.length, 0);
    const result = await f.manager.run(j.id); assert.equal(result.status, 'succeeded');
    assert.equal(calls[0].url, 'https://api.zo.computer/zo/ask');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer business-zo-secret');
    assert.equal(JSON.parse(calls[0].options.body).model_name, 'accounts/fireworks/models/fixture-base');
    await assert.rejects(f.manager.run(j.id), /never replayed/);
    const view = await f.manager.view(); assert.equal(view.policies.business.connections.zo.state, 'tested');
    assert.equal(view.policies.trading.connections.zo.state, 'unconfigured');
    assert.equal(JSON.stringify(view).includes('business-zo-secret'), false);
    assert.equal(JSON.stringify(view).includes('trading-zo-secret'), false);
  } finally { f.close(); }
});

test('Zo and Fireworks catalogs use domain credentials and return selectable model IDs without jobs', async () => {
  const calls: any[] = [];
  const f = fixture(async (url, options) => { calls.push({ url: String(url), options }); return Response.json(String(url).includes('zo.computer') ? { models: [{ model_name: 'byok:fixture', label: 'My model' }] } : { data: [{ id: 'accounts/fireworks/models/fixture-base' }] }); });
  try {
    await f.configure('business', 'zo'); await f.configure('trading', 'fireworks');
    assert.deepEqual(await f.manager.catalog('business', 'zo'), { models: [{ id: 'byok:fixture', name: 'My model' }] });
    assert.deepEqual(await f.manager.catalog('trading', 'fireworks'), { models: [{ id: 'accounts/fireworks/models/fixture-base', name: 'accounts/fireworks/models/fixture-base' }] });
    assert.equal(calls[0].options.headers.Authorization, 'Bearer business-zo-secret');
    assert.equal(calls[1].options.headers.Authorization, 'Bearer trading-fireworks-secret');
    assert.ok(calls.every(c => !c.options.body)); assert.equal((await f.manager.view()).jobs.length, 0);
    await assert.rejects(f.manager.catalog('trading', 'zo'), /credential/);
  } finally { f.close(); }
});

test('idempotency returns the same draft and rejects changed input', async () => {
  const f = fixture(); try {
    const j = await f.manager.draft(input(), 'same'); assert.equal((await f.manager.draft(input(), 'same')).id, j.id);
    await assert.rejects(f.manager.draft(input({ label: 'Changed' }), 'same'), /different inputs/);
  } finally { f.close(); }
});

test('concurrent approval cannot oversubscribe the domain budget; cancellation releases unsubmitted reservation', async () => {
  const f = fixture(); try {
    await f.configure('business', 'zo', 0.5);
    const a = await f.manager.draft(input(), 'a'), b = await f.manager.draft(input(), 'b');
    const results = await Promise.allSettled([f.manager.approve(a.id, approval), f.manager.approve(b.id, approval)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await f.manager.view()).reservedUsd.business, 0.29);
    await f.manager.cancel(a.id); await f.manager.approve(b.id, approval);
    assert.equal((await f.manager.view()).reservedUsd.business, 0.29);
  } finally { f.close(); }
});

test('trading needs its own credential and expiry; expired response cannot be evaluated', async () => {
  const f = fixture(); try {
    await f.configure();
    await assert.rejects(f.manager.draft(input({ domain: 'trading' }), 'no-expiry'), /future expiry/);
    const j = await f.manager.draft(input({ domain: 'trading', expiresAt: new Date(Date.now() + 60000).toISOString() }), 'trade');
    await assert.rejects(f.manager.approve(j.id, approval), /domain’s provider/);
    await f.configure('trading'); await f.manager.approve(j.id, approval);
    const file = path.join(f.root, '.quanta', 'hybrid-cloud.json'), data = JSON.parse(readFileSync(file, 'utf8'));
    data.jobs[0].expiresAt = '2020-01-01T00:00:00Z'; writeFileSync(file, JSON.stringify(data));
    const restored = new HybridManager(f.store, f.root); assert.equal((await restored.run(j.id)).status, 'stale');
    await assert.rejects(restored.evaluate(j.id, {} as any), /non-stale/);
  } finally { f.close(); }
});

test('interrupted submission remains uncertain and reserved after restart; no replay', async () => {
  let count = 0; const f = fixture(async () => { count++; throw new Error('network lost after provider accepted'); });
  try {
    await f.configure(); const j = await f.manager.draft(input(), 'lost'); await f.manager.approve(j.id, approval);
    assert.equal((await f.manager.run(j.id)).status, 'uncertain');
    const restored = new HybridManager(f.store, f.root);
    await assert.rejects(restored.run(j.id), /never replayed/); assert.equal(count, 1);
    assert.equal((await restored.view()).reservedUsd.business, 0.29);
    await assert.rejects(restored.cancel(j.id), /unsubmitted/);
  } finally { f.close(); }
});

test('training requires distinct validation; poll survives restart; promotion needs evaluation and supports rollback', async () => {
  let count = 0;
  const name = 'accounts/fixture/supervisedFineTuningJobs/job1';
  const f = fixture(async (_url, options) => {
    count++; return new Response(JSON.stringify(options?.method === 'POST' ? { name, state: 'JOB_STATE_RUNNING' } : { name, state: 'JOB_STATE_COMPLETED', outputModel: 'accounts/fixture/models/tuned' }));
  });
  try {
    await f.configure('business', 'fireworks', 10);
    const p = { dataset: 'accounts/fixture/datasets/train', evaluationDataset: 'accounts/fixture/datasets/validation', baseModel: 'accounts/fireworks/models/base', epochs: 1 };
    await assert.rejects(f.manager.draft(input({ operation: 'fireworks_sft', payload: { ...p, evaluationDataset: p.dataset } }), 'same-data'), /must be distinct/);
    const j = await f.manager.draft(input({ operation: 'fireworks_sft', payload: p }), 'sft'); await f.manager.approve(j.id, approval);
    assert.equal((await f.manager.run(j.id)).status, 'submitted');
    const restored = new HybridManager(f.store, f.root, async () => new Response(JSON.stringify({ name, state: 'JOB_STATE_COMPLETED', outputModel: 'accounts/fixture/models/tuned' })));
    assert.equal((await restored.poll(j.id)).status, 'succeeded');
    await assert.rejects(restored.promote(j.id, true), /passing independent/);
    const e = { metric: 'extraction accuracy', direction: 'higher' as const, baselineScore: 0.7, candidateScore: 0.9, holdoutHash: 'a'.repeat(64), evidence: 'fixture independent test evidence', evaluatorVersion: 'fixture-v1' };
    await assert.rejects(restored.evaluate(j.id, e), /cannot equal/);
    await restored.evaluate(j.id, { ...e, holdoutHash: 'b'.repeat(64) });
    await assert.rejects(restored.promote(j.id, false), /explicit approval/);
    assert.equal((await restored.promote(j.id, true)).registry.business.fireworks?.model, 'accounts/fixture/models/tuned');
    assert.equal((await restored.rollback('business')).registry.business.fireworks, undefined);
    assert.equal(count, 1);
  } finally { f.close(); }
});

test('unknown payload fields and non-finite budgets are rejected before any provider call', async () => {
  const f = fixture(); try {
    await assert.rejects(f.manager.draft(input({ payload: { input: 'x', endpoint: 'http://malicious' } }), 'bad'), /unsupported field/);
    await assert.rejects(f.manager.draft(input({ estimatedUpperBoundUsd: Infinity }), 'infinite'), /USD/);
    await assert.rejects(f.manager.draft(input({ estimatedUpperBoundUsd: 0 }), 'zero'), /USD/);
    await assert.rejects(f.manager.draft(input({ datasetHash: 'not-a-hash' }), 'hash'), /SHA-256/);
    await assert.rejects(f.manager.draft(input({ operation: '__proto__' as any }), 'prototype'), /Unknown cloud operation/);
  } finally { f.close(); }
});

test('configuration changes invalidate unsubmitted approval and provider secrets are redacted from artifacts', async () => {
  const f = fixture(async () => new Response(JSON.stringify({ output: 'Echo business-zo-secret must be redacted' })));
  try {
    await f.configure(); const a = await f.manager.draft(input(), 'first'); await f.manager.approve(a.id, approval);
    await f.configure(); await assert.rejects(f.manager.run(a.id), /changed after approval/); await f.manager.cancel(a.id);
    const b = await f.manager.draft(input(), 'second'); await f.manager.approve(b.id, approval); await f.manager.run(b.id);
    assert.equal(JSON.stringify(await f.manager.view()).includes('business-zo-secret'), false);
  } finally { f.close(); }
});

test('multi-step rollback preserves history and rejects tampered prior artifacts', async () => {
  let sequence = 0;
  const f = fixture(async (_url, options) => { if (options?.method === 'POST') sequence++; return new Response(JSON.stringify({ name: `accounts/fixture/supervisedFineTuningJobs/job${sequence}`, state: options?.method === 'POST' ? 'JOB_STATE_RUNNING' : 'JOB_STATE_COMPLETED', outputModel: `accounts/fixture/models/model${sequence}` })); });
  try {
    await f.configure('business', 'fireworks', 10); const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const j = await f.manager.draft(input({ operation: 'fireworks_sft', payload: { dataset: 'accounts/fixture/datasets/train', evaluationDataset: 'accounts/fixture/datasets/validation', baseModel: 'accounts/fireworks/models/base' } }), `model${i}`);
      ids.push(j.id); await f.manager.approve(j.id, approval); await f.manager.run(j.id); await f.manager.poll(j.id);
      await f.manager.evaluate(j.id, { metric: 'accuracy', direction: 'higher', baselineScore: 0.5, candidateScore: 0.8, holdoutHash: 'b'.repeat(64), evidence: 'fixture independent evaluation', evaluatorVersion: 'v1' }); await f.manager.promote(j.id, true);
    }
    assert.equal((await f.manager.rollback('business')).registry.business.fireworks?.jobId, ids[1]);
    const file = path.join(f.root, '.quanta', 'hybrid-cloud.json'), data = JSON.parse(readFileSync(file, 'utf8'));
    data.jobs[0].result.outputModel = 'accounts/fixture/models/tampered'; writeFileSync(file, JSON.stringify(data));
    const restored = new HybridManager(f.store, f.root);
    await assert.rejects(restored.rollback('business'), /integrity/); assert.equal((await restored.view()).registry.business.fireworks?.jobId, ids[1]);
    assert.equal((await f.manager.rollback('business')).registry.business.fireworks?.jobId, ids[0]);
    assert.equal((await f.manager.rollback('business')).registry.business.fireworks, undefined);
  } finally { f.close(); }
});

test('local router rejects missing client marker and cross-origin requests', async () => {
  const f = fixture(); const app = express(); app.use(express.json()); app.use('/api/hybrid', createHybridRouter(f.manager));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}/api/hybrid/status`;
  try {
    assert.equal((await fetch(url)).status, 403);
    assert.equal((await fetch(url, { headers: { 'X-Quanta-Client': 'local-ui', Origin: 'https://other.example' } })).status, 403);
    const response = await fetch(url, { headers: { 'X-Quanta-Client': 'local-ui' } }); assert.equal(response.status, 200); assert.equal((await response.json()).executionMode, 'paper');
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); f.close(); }
});

test('cloud credentials are encrypted on disk, survive other provider updates and are excluded from public settings', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'quanta-cloud-credentials-'));
  try {
    const store = new ProviderStore(root);
    await store.setCloudKey('business', 'zo', 'fixture-zo-credential');
    await store.setHarnessRouterKey('fixture-harness-credential');
    const raw = readFileSync(path.join(root, 'providers.json'), 'utf8');
    assert.equal(raw.includes('fixture-zo-credential'), false); assert.equal(raw.includes('fixture-harness-credential'), false);
    const restored = new ProviderStore(root); assert.equal(await restored.cloudKey('business', 'zo'), 'fixture-zo-credential');
    const metadataOnly = new ProviderStore(root); (metadataOnly as any).unprotect = async () => { throw new Error('Presence checks must not decrypt.'); };
    assert.equal(await metadataOnly.cloudConfigured('business', 'zo'), true); assert.equal(await metadataOnly.cloudConfigured('trading', 'zo'), false);
    assert.equal(await restored.cloudKey('trading', 'zo'), ''); assert.equal(await restored.harnessRouterKey(), 'fixture-harness-credential');
    assert.equal(JSON.stringify(await restored.publicConfig()).includes('fixture-zo-credential'), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
