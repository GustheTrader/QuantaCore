import { test } from 'node:test';
import assert from 'node:assert/strict';
import { venueRead } from './venue-router';

test('prediction book uses exact token and fixed GET endpoint', async () => {
  const result = await venueRead('polymarket', { token_id: '123' }, (async (url, init) => {
    assert.equal(String(url), 'https://clob.polymarket.com/book?token_id=123');
    assert.equal(init?.method, 'GET');
    assert.equal(init?.redirect, 'error');
    return new Response(JSON.stringify({ bids: [], asks: [] }));
  }) as typeof fetch);
  assert.equal(result.mode, 'read-only');
});
test('rejects URL injection before network access', async () => {
  await assert.rejects(venueRead('polymarket', { token_id: 'https://evil.example' }, (async () => { throw new Error('must not fetch'); }) as typeof fetch), /Invalid token_id/);
});
test('caps streamed response size', async () => {
  await assert.rejects(venueRead('polymarket', { token_id: '1' }, (async () => new Response('x'.repeat(1_000_001))) as typeof fetch), /too large/);
});
