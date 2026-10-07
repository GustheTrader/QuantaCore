import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedJson } from './bounded-json';
test('JSON parsing bounds streamed bytes without trusting content length', async () => {
  assert.deepEqual(await boundedJson(Response.json({ ok: true })), { ok: true });
  await assert.rejects(boundedJson(new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('x'.repeat(20))); c.close(); } }), { headers: { 'content-length': '1' } }), 10), /size limit/);
  await assert.rejects(boundedJson(new Response('broken-json')), SyntaxError);
});
