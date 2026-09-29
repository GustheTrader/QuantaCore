import test from 'node:test';
import assert from 'node:assert/strict';
import { ResearchSseDecoder, isLocalResearchHost, parsePortfolio, researchService, safeResearchUrl, watchResearchEvents } from './researchService';

test('research is allowed only on explicit loopback hosts', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]', '::1']) assert.equal(isLocalResearchHost(host), true);
  for (const host of ['example.com', 'localhost.example.com', '127.0.0.1.example.com', '192.168.1.2', '']) assert.equal(isLocalResearchHost(host), false);
});

test('SSE parser preserves chunk boundaries, CRLF, comments and multiline records', () => {
  const records: { id: string; data: string }[] = [];
  const decoder = new ResearchSseDecoder(record => records.push(record));
  decoder.push(': heartbeat\r\nid: 12\r');
  decoder.push('\ndata: {"seq":12,\r\ndata: "type":"node_done"}\r\n\r');
  decoder.push('\nid: 13\ndata: {"seq":13}\n\n');
  assert.deepEqual(records, [{ id: '12', data: '{"seq":12,\n"type":"node_done"}' }, { id: '13', data: '{"seq":13}' }]);
});

test('operator portfolio rejects nonfinite and malformed position values', () => {
  assert.equal(parsePortfolio(''), null);
  assert.deepEqual(parsePortfolio('{"cash":100,"currency":"USD","positions":[{"ticker":"MSFT","quantity":2,"average_price":300}]}')?.positions[0].ticker, 'MSFT');
  assert.throws(() => parsePortfolio('{"cash":1e999,"currency":"USD","positions":[]}'), /finite/);
  assert.throws(() => parsePortfolio('{"cash":0,"currency":"USD","positions":[{"ticker":"MSFT","quantity":"2","average_price":null}]}'), /quantity/);
  assert.throws(() => parsePortfolio('{"cash":0,"currency":"USD","positions":[],"account_token":"secret"}'), /cash, currency and positions/);
});

test('source links allow HTTPS and reject executable or relative URL schemes', () => {
  assert.equal(safeResearchUrl('https://example.com/report'), 'https://example.com/report');
  for (const url of ['javascript:alert(1)', 'data:text/html,x', '/api/trading/runs/1', 'file:///C:/secret']) assert.equal(safeResearchUrl(url), null);
});

test('hosted research blocks requests before calling fetch', async () => {
  const previousWindow = (globalThis as any).window;
  const previousFetch = globalThis.fetch;
  let calls = 0;
  (globalThis as any).window = { location: { hostname: 'hosted.example' } };
  globalThis.fetch = (async () => { calls++; return new Response('{}'); }) as typeof fetch;
  try {
    await assert.rejects(researchService.health(), /local computer/);
    assert.equal(calls, 0);
  } finally { (globalThis as any).window = previousWindow; globalThis.fetch = previousFetch; }
});

test('event reconnect keeps local headers and replay cursor and deduplicates replay', async () => {
  const previousWindow = (globalThis as any).window;
  const previousFetch = globalThis.fetch;
  const controller = new AbortController();
  const received: number[] = [];
  const calls: RequestInit[] = [];
  (globalThis as any).window = { location: { hostname: 'localhost' } };
  const event = (seq: number) => `id: ${seq}\ndata: ${JSON.stringify({ seq, run_id: 'run-one', type: 'node_completed', at: '2026-01-01T00:00:00Z', node_id: 'market_analyst', payload: {}, hash: 'hash', previous_hash: 'hash' })}\n\n`;
  globalThis.fetch = (async (_url: string | URL | Request, init: RequestInit) => {
    calls.push(init);
    return new Response(calls.length === 1 ? event(1) + event(2) : event(2) + event(3), { headers: { 'Content-Type': 'text/event-stream' } });
  }) as typeof fetch;
  try {
    await watchResearchEvents('run-one', { signal: controller.signal, shouldReconnect: () => true, onState: () => {}, onEvent: record => { received.push(record.seq); if (record.seq === 3) controller.abort(); } });
    assert.deepEqual(received, [1, 2, 3]);
    assert.equal(calls.length, 2);
    assert.equal(new Headers(calls[0].headers).get('X-Quanta-Client'), 'local-ui');
    assert.equal(new Headers(calls[1].headers).get('Last-Event-ID'), '2');
    assert.equal(calls[1].signal, controller.signal);
  } finally { controller.abort(); (globalThis as any).window = previousWindow; globalThis.fetch = previousFetch; }
});
