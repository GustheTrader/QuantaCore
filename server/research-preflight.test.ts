import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProviderStore } from './provider-store';
import { ResearchManager, estimateCalls, reserveInputTokens } from './research-manager';
import type { RunRequest } from '../lib/research-contract';

const base: RunRequest = { ticker: 'AAPL', trade_date: '2025-01-02', asset_type: 'stock', models: { deep: 'local/unit', quick: 'local/unit' }, selected_analysts: ['market', 'news'], debate_rounds: 1, risk_rounds: 1, budget: { max_calls: 40, max_tokens: 2_000_000, max_output_tokens: 2000, max_duration_seconds: 600, max_cost_usd: null }, portfolio: null, mode: 'research', confirmed: true };
const route = { id: 'local/unit', provider: 'local', model: 'unit', baseUrl: 'http://127.0.0.1:9/v1', input_rate: 0, output_rate: 0 };

async function withManager(fn: (manager: ResearchManager, providers: ProviderStore) => Promise<void>) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'gnoesis-preflight-'));
  const providers = new ProviderStore(directory);
  const manager = new ResearchManager(providers, directory, { database: ':memory:' });
  try { await fn(manager, providers); } finally { manager.store.close(); await rm(directory, { recursive: true, force: true }); }
}

test('budget fit counts carried-forward context and explains what to change', async () => {
  await withManager(async manager => {
    const { count, growth, output } = estimateCalls(base);
    assert.equal(count, 16);
    assert.ok(growth > count * 6000, 'later calls carry earlier reports');
    assert.equal(manager.budgetFit(base).ok, true);
    const tight = manager.budgetFit({ ...base, budget: { ...base.budget, max_tokens: growth + output - 1 } });
    assert.equal(tight.ok, true, 'context growth is advisory, not a refusal');
    assert.match(tight.risks.join(' '), /may stop before a decision/);
    const small = { ...base, budget: { ...base.budget, max_calls: 10, max_tokens: count * 6000 } };
    const fit = manager.budgetFit(small);
    assert.equal(fit.ok, false);
    assert.equal(fit.problems.length, 2);
    assert.match(fit.problems.join(' '), /16 model calls/);
    assert.match(fit.problems.join(' '), /fewer analysts/);
  });
});

test('input reservation no longer treats every byte as a token', () => {
  assert.equal(reserveInputTokens(30000), 10512);
  assert.ok(reserveInputTokens(30000) < 30000 + 512);
});

test('preflight rejects a revoked key without sending inference', async () => {
  await withManager(async (manager, providers) => {
    await providers.update(data => { data.connections.local = { baseUrl: route.baseUrl, model: 'unit', apiKey: 'revoked-key' }; });
    const seen: string[] = [];
    const denied = (async (url: string, init: any) => { seen.push(url); assert.equal(init.headers.Authorization, 'Bearer revoked-key'); return new Response('{"error":{"message":"User not found."}}', { status: 401 }); }) as unknown as typeof fetch;
    await assert.rejects(manager.preflight([route], denied), (error: any) => error.code === 'PROVIDER_AUTH_FAILED' && error.status === 424 && !/revoked-key/.test(error.message));
    assert.deepEqual(seen, [route.baseUrl + '/models']);
    assert.ok(!seen.some(url => url.includes('chat/completions')));
    const ok = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    await manager.preflight([route], ok);
    const offline = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    await manager.preflight([route], offline); // network problems are reported by the run, not guessed here
  });
});

test('a provider 401 during a run is recorded as an auth failure, not a generic crash', async () => {
  await withManager(async manager => {
    const run = manager.store.create(base, [route]);
    manager.store.transition(run.id, 'running', 'run.started', {});
    const active: any = { id: run.id, attempt: 1, started: Date.now(), abort: new AbortController(), calls: new Set() };
    (manager as any).active = active;
    manager.rejected({ id: 'call', runId: run.id, route, input: 1, output: 1, controller: new AbortController() }, 401);
    assert.deepEqual(active.authFailure, { status: 401, model: 'local/unit' });
    assert.ok(manager.store.events(run.id).some(event => event.type === 'warning' && event.payload.reason === 'provider_auth'));
    assert.throws(() => (manager as any).workerEvent(run.id, active, { type: 'error', node_id: null, payload: { message: 'Error code: 401', error_id: '9b8bc52f-63b1-4c27-9d18-c1a631f9f998' } }),
      (error: any) => error.code === 'PROVIDER_AUTH_FAILED' && /Reconnect or replace the provider key/.test(error.message));
  });
});
