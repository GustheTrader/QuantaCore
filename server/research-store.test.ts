import test from 'node:test';
import assert from 'node:assert/strict';
import { ResearchStore, validateRequest } from './research-store';
import type { RunRequest } from '../lib/research-contract';
export const request: RunRequest = { ticker: 'AAPL', trade_date: '2025-01-02', asset_type: 'stock', models: { deep: 'local/test', quick: 'local/test' }, selected_analysts: ['market'], debate_rounds: 1, risk_rounds: 1, budget: { max_calls: 4, max_tokens: 10000, max_output_tokens: 128, max_duration_seconds: 30, max_cost_usd: null }, portfolio: null, mode: 'fixture', confirmed: true };
test('invalid calendar, path and nonfinite portfolio inputs fail before persistence', () => {
    for (const patch of [{ trade_date: '2025-02-30' }, { ticker: '../../keys' }, { trade_date: '2999-01-01' }, { portfolio: { cash: NaN, currency: 'USD', positions: [] } }])
        assert.throws(() => validateRequest({ ...request, ...patch }, true));
    assert.throws(() => validateRequest(request, false));
});
test('duplicate submission is idempotent while independent same-day runs remain separate', () => {
    const store = new ResearchStore(':memory:');
    const first = store.create(request, [], null, 'one');
    assert.equal(store.create(request, [], null, 'one').id, first.id);
    assert.throws(() => store.create({ ...request, ticker: 'MSFT' }, [], null, 'one'));
    assert.notEqual(store.create(request, []).id, first.id);
    assert.equal(store.list().length, 2);
    assert.equal(store.verify(first.id), true);
    assert.throws(() => store.db.prepare('DELETE FROM events').run());
    store.close();
});
test('recovery retains journal and budgets; cancellation cannot be overwritten by late result', () => {
    const store = new ResearchStore(':memory:');
    const run = store.create(request, []);
    store.transition(run.id, 'running', 'run.started', {});
    store.transition(run.id, 'cancelling', 'run.cancelling', {});
    assert.throws(() => store.transition(run.id, 'done', 'result', {}));
    store.reconcile();
    assert.equal(store.get(run.id).status, 'cancelled');
    assert.equal(store.events(run.id).filter(e => e.type !== 'run.projection').length, 4);
    assert.equal(store.verify(run.id), true);
    const modified = { ...store.get(run.id), status: 'done' };
    store.db.prepare('UPDATE runs SET value=? WHERE id=?').run(JSON.stringify(modified), run.id);
    assert.equal(store.verify(run.id), false);
    store.close();
});
