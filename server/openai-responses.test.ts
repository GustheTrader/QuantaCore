import test from 'node:test';
import assert from 'node:assert/strict';
import { responsesRequest, responsesCompletion, usesGpt6Responses } from './openai-responses';
import express from 'express';
import { createServer } from 'node:http';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProviderStore } from './provider-store';
import { createInferenceRouters } from './inference-router';

test('only official OpenAI GPT-6 requests change transport', () => {
  assert.equal(usesGpt6Responses('openai-compatible', 'https://api.openai.com/v1/', 'gpt-6.1-sol'), true);
  assert.equal(usesGpt6Responses('openai-compatible', 'https://other.example/v1', 'gpt-6-astra'), false);
  assert.equal(usesGpt6Responses('ollama-cloud', 'https://ollama.com/v1', 'deepseek-v4.1-flash:cloud'), false);
});
test('reasoning requests omit sampling and preserve capped output and schema', () => {
  const body = responsesRequest({ model: 'gpt-6.1-sol', messages: [{ role: 'system', content: 'Use evidence' }, { role: 'user', content: 'Extract' }], reasoning_effort: 'none', temperature: 0.7, top_p: 0.9, max_tokens: 512, response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema: { type: 'object' } } } });
  assert.deepEqual(body.reasoning, { effort: 'low' });
  assert.equal(body.temperature, undefined); assert.equal(body.top_p, undefined);
  assert.equal(body.max_output_tokens, 512); assert.equal(body.store, false);
  assert.equal(body.text.format.name, 'result'); assert.equal(body.input[0].role, 'system');
  assert.throws(() => responsesRequest({ model: 'gpt-6-astra', messages: [{ role: 'user', content: [] }] }), /text/);
});
test('function call identity survives output and tool-result continuation', () => {
  const result = responsesCompletion({ id: 'r1', model: 'gpt-6.1-sol', status: 'completed', output: [{ type: 'function_call', call_id: 'call-1', name: 'lookup', arguments: '{"id":1}' }], usage: { input_tokens: 10, output_tokens: 20 } });
  assert.equal(result.choices[0].finish_reason, 'tool_calls');
  const body = responsesRequest({ model: 'gpt-6.1-sol', messages: [result.choices[0].message, { role: 'tool', tool_call_id: 'call-1', content: 'found' }], tools: [{ type: 'function', function: { name: 'lookup', parameters: { type: 'object' }, strict: false } }], tool_choice: { type: 'function', function: { name: 'lookup' } } });
  assert.equal(body.input[0].call_id, 'call-1'); assert.equal(body.input[1].type, 'function_call_output');
  assert.equal(body.tools[0].name, 'lookup'); assert.equal(body.tool_choice.name, 'lookup');
  assert.equal(result.usage.prompt_tokens, 10); assert.equal(result.usage.completion_tokens, 20);
});
test('incomplete, empty and unsupported output fail; refusals remain explicit', () => {
  for (const status of ['failed', 'incomplete', 'in_progress']) assert.throws(() => responsesCompletion({ status, output: [] }), /complete/);
  assert.throws(() => responsesCompletion({ status: 'completed', output: [] }), /usable/);
  assert.throws(() => responsesCompletion({ status: 'completed', output: [{ type: 'computer_call' }] }), /Unsupported/);
  const result = responsesCompletion({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Declined' }] }] });
  assert.equal(result.choices[0].message.refusal, 'Declined'); assert.equal(result.choices[0].finish_reason, 'content_filter');
});

test('HTTP gateway translates official GPT-6, accounts usage and validates buffered SSE', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'quanta-gpt6-'));
  const store = new ProviderStore(directory);
  const data = await store.read();
  data.connections['openai-compatible'] = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-6.1-sol', apiKey: 'fixture' };
  const seen: any[] = [], completed: any[] = [];
  const request: typeof fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body)); seen.push({ url, body, signal: init?.signal });
    const incomplete = body.input[0].content === 'incomplete';
    return Response.json({ id: 'r1', model: body.model, status: incomplete ? 'incomplete' : 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'verified fixture' }] }], usage: { input_tokens: 2, output_tokens: 3 } });
  };
  const routers = createInferenceRouters(store, { researchAuthorized: req => req.get('authorization') === 'Bearer fixture-research', admit: () => 'admission', complete: (admission, result) => { if (admission) completed.push(result); } }, request);
  const app = express(); app.use(express.json()); app.use('/v1', routers.openai);
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}/v1/chat/completions`;
  const call = (content: string, stream = false) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fixture-research', 'X-Gnoesis-Run': 'fixture' }, body: JSON.stringify({ model: 'openai-compatible/gpt-6.1-sol', messages: [{ role: 'user', content }], temperature: 0.7, max_tokens: 200, stream }) });
  try {
    const result = await (await call('hello')).json();
    assert.equal(result.choices[0].message.content, 'verified fixture');
    assert.equal(seen[0].url, 'https://api.openai.com/v1/responses');
    assert.equal(seen[0].body.temperature, undefined); assert.equal(seen[0].body.max_output_tokens, 200);
    assert.equal(completed[0].usage.completion_tokens, 3); assert.ok(seen[0].signal);
    const stream = await call('hello', true); assert.match(stream.headers.get('content-type')!, /event-stream/);
    assert.match(await stream.text(), /verified fixture.*\n\n.*stop.*\n\ndata: \[DONE\]/s);
    assert.equal((await call('incomplete')).status, 502); assert.equal(completed.at(-1), null);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    for (const name of ['gateway-policy.json', 'providers.json']) await rm(path.join(directory, name), { force: true });
    await rmdir(directory);
  }
});
