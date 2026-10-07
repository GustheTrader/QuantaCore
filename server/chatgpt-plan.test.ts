import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { completedResponse, responsesInput, ChatGptPlan } from './chatgpt-plan';

const stream = (events: any[]) => new Response(events.map(event => 'data: ' + JSON.stringify(event) + '\n\n').join(''), { headers: { 'content-type': 'text/event-stream' } });
test('Responses requires a completed terminal event and rejects quota failure after text', async () => {
  await assert.rejects(completedResponse(stream([{ type: 'response.output_text.delta', delta: 'partial' }])), /before response.completed/);
  await assert.rejects(completedResponse(stream([{ type: 'response.output_text.delta', delta: 'partial' }, { type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } }])), /subscription_sharing_usage_limit_exceeded/);
  const result = await completedResponse(stream([{ type: 'response.output_text.delta', delta: 'READY' }, { type: 'response.completed', response: { id: 'r1', status: 'completed', model: 'fixture' } }]));
  assert.equal(result.choices[0].message.content, 'READY'); assert.equal(result.billing, 'chatgpt-plan');
});
test('Responses translates system messages into instructions and refuses invalid context', () => {
  const body = responsesInput([{ role: 'system', content: 'Be concise' }, { role: 'user', content: 'Plan' }]);
  assert.match(body.instructions, /Be concise/); assert.deepEqual(body.input, [{ role: 'user', content: 'Plan' }]);
  assert.throws(() => responsesInput([{ role: 'tool', content: 'No' }]));
});
test('Business plan route requires explicit permission, account match, and preview-safe request fields', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'chatgpt-plan-'));
  let active = 'a1', calls = 0;
  const oauth: any = { status: async () => ({ activeAccountId: active, accounts: [], pending: false }), getAccessToken: async (expected: string) => { assert.equal(expected, active); return 'fixture-token'; } };
  const request: typeof fetch = (async (url, init) => {
    if (String(url).endsWith('/models')) return new Response(JSON.stringify({ models: [{ slug: 'fixture-model', display_name: 'Fixture', visibility: 'list' }, { slug: 'hidden', visibility: 'hidden' }] }));
    assert.equal(String(url), 'https://api.openai.com/v1/responses'); calls++;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false); assert.equal(body.stream, true); assert.equal(body.model, 'fixture-model');
    assert.equal(Object.hasOwn(body, 'max_output_tokens'), false); assert.equal(Object.hasOwn(body, 'temperature'), false);
    return stream([{ type: 'response.output_text.delta', delta: 'READY' }, { type: 'response.completed', response: { id: 'r1', status: 'completed' } }]);
  }) as typeof fetch;
  const plan = new ChatGptPlan(root, oauth, request);
  try {
    await assert.rejects(plan.complete([{ role: 'user', content: 'Plan' }], true), /explicitly enable/);
    await plan.configure('fixture-model', false);
    await assert.rejects(plan.complete([{ role: 'user', content: 'Plan' }], true), /explicitly enable/);
    await plan.configure('fixture-model', true);
    await plan.complete([{ role: 'user', content: 'Plan' }], true); assert.equal(calls, 1);
    active = 'a2'; await assert.rejects(plan.complete([{ role: 'user', content: 'Plan' }], true), /explicitly enable/); assert.equal(calls, 1);
  } finally { rmSync(root, { recursive: true }); }
});
test('model route is not saved if the account changes while its catalog is loading', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'chatgpt-route-race-')); let active = 'a1';
  const oauth: any = { status: async () => ({ activeAccountId: active, accounts: [] }), getAccessToken: async (expected: string) => { assert.equal(expected, 'a1'); return 'fixture'; } };
  const request: typeof fetch = (async () => { active = 'a2'; return Response.json({ models: [{ slug: 'fixture', visibility: 'list' }] }); }) as typeof fetch;
  try { const plan = new ChatGptPlan(root, oauth, request); await assert.rejects(plan.configure('fixture', true), /account changed/); assert.equal(plan.route().model, ''); }
  finally { rmSync(root, { recursive: true }); }
});

test('completed SSE without a content-type header is accepted, but incomplete or non-SSE bodies fail', async () => {
  const body = 'event: response.completed\ndata: ' + JSON.stringify({type:'response.completed',response:{id:'r2',status:'completed',output:[{content:[{type:'output_text',text:'READY'}]}]}}) + '\n\n';
  const reply = new Response(new TextEncoder().encode(body));
  assert.equal(reply.headers.get('content-type'), null);
  assert.equal((await completedResponse(reply)).choices[0].message.content,'READY');
  await assert.rejects(completedResponse(new Response(new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":"partial"}\n\n'))), /before response.completed/);
  await assert.rejects(completedResponse(new Response(new TextEncoder().encode('<html>unavailable</html>'))), /before response.completed/);
  await assert.rejects(completedResponse(new Response(body,{headers:{'content-type':'text/html'}})), /not an event stream/);
});
