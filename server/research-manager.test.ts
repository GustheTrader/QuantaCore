import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProviderStore } from './provider-store';
import { ResearchManager } from './research-manager';
import { createInferenceRouters } from './inference-router';
import { createResearchRouter } from './research-router';
import type { RunRequest } from '../lib/research-contract';
const base: RunRequest = { ticker: 'AAPL', trade_date: '2025-01-02', asset_type: 'stock', models: { deep: 'local/unit', quick: 'local/unit' }, selected_analysts: ['market'], debate_rounds: 1, risk_rounds: 1, budget: { max_calls: 1, max_tokens: 10000, max_output_tokens: 128, max_duration_seconds: 30, max_cost_usd: null }, portfolio: null, mode: 'research', confirmed: true };
async function listen(app: any) { const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r)); return { server, url: `http://127.0.0.1:${server.address().port}` }; }
async function close(server: any) { server.closeAllConnections(); await new Promise<void>(r => server.close(r)); }
test('worker credential cannot bypass scope; atomic budget admits only one concurrent request', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'gnoesis-gateway-test-'));
    const upstream = express();
    upstream.use(express.json());
    let calls = 0;
    upstream.post('/v1/chat/completions', async (_req, res) => { calls++; await new Promise(r => setTimeout(r, 40)); res.json({ choices: [{ message: { role: 'assistant', content: 'fixture' } }], usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 } }); });
    const remote = await listen(upstream), providers = new ProviderStore(directory);
    await providers.update(data => { data.connections.local = { baseUrl: `${remote.url}/v1`, model: 'unit', apiKey: '' }; });
    const manager = new ResearchManager(providers, directory, { database: ':memory:' });
    const run = manager.store.create(base, [{ id: 'local/unit', provider: 'local', model: 'unit', baseUrl: `${remote.url}/v1`, input_rate: 0, output_rate: 0 }]);
    manager.store.transition(run.id, 'running', 'run.started', {});
    (manager as any).active = { id: run.id, attempt: 1, started: Date.now(), abort: new AbortController(), calls: new Set() };
    const app = express();
    app.use(express.json());
    app.use('/v1', createInferenceRouters(providers, manager).openai);
    const local = await listen(app);
    const call = (headers: Record<string, string>) => fetch(`${local.url}/v1/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${manager.researchToken}`, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ model: 'local/unit', messages: [{ role: 'user', content: 'test' }] }) });
    try {
        assert.equal((await call({})).status, 401);
        assert.equal((await call({ 'X-Gnoesis-Run': run.id, 'X-Gnoesis-Attempt': '2' })).status, 403);
        const responses = await Promise.all([call({ 'X-Gnoesis-Run': run.id, 'X-Gnoesis-Attempt': '1' }), call({ 'X-Gnoesis-Run': run.id, 'X-Gnoesis-Attempt': '1' })]);
        assert.deepEqual(responses.map(r => r.status).sort(), [200, 429]);
        assert.equal(calls, 1);
        assert.equal(manager.store.get(run.id).usage.total_tokens, 7);
        assert.equal(manager.store.verify(run.id), true);
    }
    finally {
        await close(local.server);
        await close(remote.server);
        manager.store.close();
        await rm(directory, { recursive: true, force: true });
    }
});
test('persisted budget exhaustion is diagnosed without changing the immutable run or allowing resume', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'gnoesis-budget-diagnostic-'));
    const dataDirectory = path.join(directory, 'data', 'trading');
    const manager = new ResearchManager(new ProviderStore(directory), directory, { database: ':memory:' });
    const run = manager.store.create(base, [{ id: 'local/unit', provider: 'local', model: 'unit', baseUrl: 'http://127.0.0.1:1/v1', input_rate: 0, output_rate: 0 }]);
    manager.store.transition(run.id, 'running', 'run.started', {});
    const workerErrorId = '9b8bc52f-63b1-4c27-9d18-c1a631f9f998';
    manager.store.append(run.id, 'worker.error', { code: 'WORKER_FAILED', message: 'Worker failed. Error details are retained by error identifier.', error_id: workerErrorId });
    await mkdir(path.join(dataDirectory, 'runs', run.id, 'attempts', '1'), { recursive: true });
    await writeFile(path.join(dataDirectory, 'runs', run.id, 'attempts', '1', `error-${workerErrorId}.txt`), 'Research budget exhausted before this inference call.');
    manager.store.transition(run.id, 'error', 'run.error', {}, { error: { code: 'WORKER_FAILED', message: 'The research worker stopped.', error_id: 'ab8bc52f-63b1-4c27-9d18-c1a631f9f998' } });
    const before = manager.store.events(run.id), configHash = run.configuration_hash, usage = manager.store.get(run.id).usage;
    try {
        const diagnosed = manager.runView(run.id);
        assert.equal(diagnosed.error?.code, 'RESEARCH_BUDGET_EXHAUSTED');
        assert.equal(diagnosed.error?.error_id, 'ab8bc52f-63b1-4c27-9d18-c1a631f9f998');
        assert.match(diagnosed.error?.message || '', /No inference request was sent/);
        const app = express();
        app.use('/api/trading', createResearchRouter(manager));
        const local = await listen(app);
        try {
            const response = await fetch(`${local.url}/api/trading/runs/${run.id}/artifact.json`, { headers: { 'X-Quanta-Client': 'local-ui' } });
            const artifact = await response.json();
            assert.equal(response.status, 200);
            assert.equal(artifact.run.error.code, 'WORKER_FAILED');
            assert.equal(artifact.diagnosis.code, 'RESEARCH_BUDGET_EXHAUSTED');
            assert.equal(artifact.diagnosis.derived, true);
            assert.equal(artifact.diagnosis.source, 'persisted worker trace');
            assert.equal(artifact.events.length, before.length);
        }
        finally { await close(local.server); }
        await assert.rejects(manager.resume(run.id), (error: any) => error.status === 409 && /frozen inference budget/.test(error.message));
        assert.equal(manager.store.events(run.id).length, before.length);
        assert.equal(manager.store.verify(run.id), true);
        assert.equal(manager.store.get(run.id).configuration_hash, configHash);
        assert.deepEqual(manager.store.get(run.id).usage, usage);
        assert.equal(manager.store.get(run.id).attempt, 1);
    }
    finally {
        manager.store.close();
        await rm(directory, { recursive: true, force: true });
    }
});
test('large SSE replay includes every attempt and post-result event', async () => {
    const manager = new ResearchManager(new ProviderStore(os.tmpdir()), os.tmpdir(), { database: ':memory:' });
    const run = manager.store.create(base, []);
    manager.store.transition(run.id, 'running', 'run.started', {});
    manager.store.transition(run.id, 'error', 'run.error', {});
    manager.store.transition(run.id, 'queued', 'run.resumed', {}, { attempt: 2 });
    manager.store.transition(run.id, 'running', 'run.started', {});
    manager.store.append(run.id, 'report', { text: 'x'.repeat(250000) });
    manager.store.transition(run.id, 'review', 'result', {});
    manager.store.update(run.id, 'settlement.completed', { later: true });
    const app = express();
    app.use('/api/trading', createResearchRouter(manager));
    const local = await listen(app);
    try {
        const denied = await fetch(`${local.url}/api/trading/runs`);
        assert.equal(denied.status, 403);
        const response = await fetch(`${local.url}/api/trading/runs/${run.id}/events`, { headers: { 'X-Quanta-Client': 'local-ui' } });
        const text = await response.text();
        const ids = [...text.matchAll(/^id: (\d+)$/gm)].map(m => Number(m[1]));
        assert.deepEqual(ids, manager.store.events(run.id).map(e => e.seq));
        assert.match(text, /settlement.completed/);
        const replay = await fetch(`${local.url}/api/trading/runs/${run.id}/events`, { headers: { 'X-Quanta-Client': 'local-ui', 'Last-Event-ID': String(ids.at(-2)) } });
        assert.deepEqual([...((await replay.text()).matchAll(/^id: (\d+)$/gm))].map(m => Number(m[1])), [ids.at(-1)]);
    }
    finally {
        await close(local.server);
        manager.store.close();
    }
});
test('a live database owner cannot be replaced or reconciled by a second instance', () => {
    const first = new ResearchManager(new ProviderStore(os.tmpdir()), os.tmpdir(), { database: ':memory:' });
    first.store.claimOwner('first');
    const run = first.store.create(base, []);
    first.store.transition(run.id, 'running', 'run.started', {});
    assert.throws(() => first.store.claimOwner('second'));
    assert.equal(first.store.get(run.id).status, 'running');
    first.store.releaseOwner('first');
    first.store.claimOwner('second');
    first.store.reconcile();
    assert.equal(first.store.get(run.id).status, 'error');
    first.store.close();
});
