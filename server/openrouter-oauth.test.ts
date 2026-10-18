import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import express from 'express';
import { OpenRouterOAuth, createOpenRouterOAuthRouter } from './openrouter-oauth';

function fixture() {
  const data: any = { connections: { openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'openrouter/free', apiKey: 'old-key' } }, preferredProvider: 'local' };
  let meta: any = {};
  const calls: { url: string; init?: RequestInit }[] = [];
  let valid = true;
  const store: any = {
    connection: async () => structuredClone(data.connections.openrouter),
    update: async (change: any) => { const next = structuredClone(data); await change(next); Object.assign(data, next); },
    getOAuthCredentials: async (namespace: string) => { assert.equal(namespace, 'openrouter'); return structuredClone(meta); },
    setOAuthCredentials: async (value: any, namespace: string) => { assert.equal(namespace, 'openrouter'); meta = structuredClone(value); },
  };
  const request: typeof fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/auth/keys')) return Response.json({ key: 'new-fixture-key' });
    return valid ? Response.json({ data: { label: 'Fixture key', usage: 0 } }) : Response.json({ error: { message: 'User not found' } }, { status: 401 });
  }) as typeof fetch;
  return { oauth: new OpenRouterOAuth(store, request), data, calls, invalidate: () => { valid = false; } };
}
const callback = 'http://127.0.0.1:3000/auth/openrouter/callback';

test('OpenRouter uses S256 and browser-bound single-use state; verifies key before saving without changing preferred route', async () => {
  const f = fixture();
  const auth = new URL((await f.oauth.begin('browser', callback)).authorizeUrl);
  assert.equal(auth.origin, 'https://openrouter.ai'); assert.equal(auth.searchParams.get('callback_url'), callback);
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
  const query = { state: auth.searchParams.get('state'), code: 'fixture-code' };
  await assert.rejects(f.oauth.callback(query, 'other-browser'), /browser-bound/);
  assert.equal(f.calls.length, 0);
  const status = await f.oauth.callback(query, 'browser');
  const exchange = JSON.parse(String(f.calls[0].init?.body));
  assert.equal(createHash('sha256').update(exchange.code_verifier).digest('base64url'), auth.searchParams.get('code_challenge'));
  assert.equal(exchange.code_challenge_method, 'S256');
  assert.equal(f.calls[1].url, 'https://openrouter.ai/api/v1/key');
  assert.equal(f.data.connections.openrouter.apiKey, 'new-fixture-key');
  assert.equal(f.data.connections.openrouter.model, 'openrouter/free');
  assert.equal(f.data.preferredProvider, 'local'); assert.equal(status.authenticated, true);
  assert.equal(JSON.stringify(status).includes('fixture-key'), false);
  await assert.rejects(f.oauth.callback(query, 'browser'), /expired/);
});
test('cancelled flow and failed upstream validation preserve existing credential', async () => {
  const f = fixture();
  const auth = new URL((await f.oauth.begin('browser', callback)).authorizeUrl);
  await assert.rejects(f.oauth.callback({ state: auth.searchParams.get('state'), error: 'access_denied' }, 'browser'), /cancelled/);
  assert.equal(f.calls.length, 0);
  const retry = new URL((await f.oauth.begin('browser', callback)).authorizeUrl);
  f.invalidate();
  await assert.rejects(f.oauth.callback({ state: retry.searchParams.get('state'), code: 'fixture-code' }, 'browser'), /authenticate/);
  assert.equal(f.data.connections.openrouter.apiKey, 'old-key');
});
test('changed credentials invalidate validation status and stale authorization cannot overwrite a replacement key', async () => {
  const f = fixture();
  await f.oauth.validate(); assert.equal((await f.oauth.status()).authenticated, true);
  const auth = new URL((await f.oauth.begin('browser', callback)).authorizeUrl);
  f.data.connections.openrouter.apiKey = 'replacement-key';
  assert.equal((await f.oauth.status()).authenticated, false);
  await assert.rejects(f.oauth.callback({ state: auth.searchParams.get('state'), code: 'fixture-code' }, 'browser'), /changed/);
  assert.equal(f.data.connections.openrouter.apiKey, 'replacement-key');
});
test('key validation checks the authenticated key endpoint, records failure, and never calls inference', async () => {
  const f = fixture(); await f.oauth.validate(); f.invalidate();
  await assert.rejects(f.oauth.validate(), /authenticate/);
  assert.equal((await f.oauth.status()).authenticated, false);
  assert.ok(f.calls.every(c => c.url === 'https://openrouter.ai/api/v1/key'));
  await assert.rejects(f.oauth.begin('browser', 'https://foreign.example/auth/openrouter/callback'), /local/);
});
test('HTTP routes reject foreign origins and callback binding without leaking credentials', async () => {
  const f = fixture(), routes = createOpenRouterOAuthRouter(f.oauth), app = express();
  app.use(express.json()); app.use('/api/openrouter-oauth', routes.api); app.use('/auth/openrouter', routes.callback);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number }, origin = `http://127.0.0.1:${address.port}`;
  try {
    const blocked = await fetch(`${origin}/api/openrouter-oauth/authorize`, { method: 'POST', headers: { 'X-Quanta-Client': 'local-ui', Origin: 'https://foreign.example' } });
    assert.equal(blocked.status, 403);
    const authorize = await fetch(`${origin}/api/openrouter-oauth/authorize`, { method: 'POST', headers: { 'X-Quanta-Client': 'local-ui', Origin: origin } });
    assert.equal(authorize.status, 200); assert.match(authorize.headers.get('set-cookie')!, /HttpOnly/);
    const url = new URL((await authorize.json()).authorizeUrl);
    assert.equal(url.searchParams.get('callback_url'), `${origin}/auth/openrouter/callback`);
    const noCookie = await fetch(`${origin}/auth/openrouter/callback?state=${url.searchParams.get('state')}&code=fixture`, { redirect: 'manual' });
    assert.equal(noCookie.status, 303); assert.match(noCookie.headers.get('location')!, /auth_result=failed/);
    assert.equal(f.calls.length, 0);
    const status = await fetch(`${origin}/api/openrouter-oauth/status`, { headers: { 'X-Quanta-Client': 'local-ui' } });
    assert.equal((await status.text()).includes('old-key'), false);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
