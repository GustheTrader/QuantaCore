import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ChatGptOAuth } from './chatgpt-oauth';
import type { ProviderStore } from './provider-store';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'quanta-oauth-'));
  let records: Record<string, any> = {};
  let time = Date.now();
  let calls = 0;
  let direct = true;
  let invalid = false;
  let subject = 'account-one';
  let missingAccess = false;
  const requests: URLSearchParams[] = [];
  const store = { getOAuthCredentials: async () => structuredClone(records), setOAuthCredentials: async (value: any) => { records = structuredClone(value); } } as unknown as ProviderStore;
  const manager = new ChatGptOAuth(root, store, {
    now: () => time,
    verify: async (_token, _client, nonce) => { if (invalid) throw new Error('Untrusted signature'); return { sub: subject, email: 'user@example.com', nonce }; },
    fetch: (async (url: any, options: any) => {
      if (String(url).includes('openid-configuration')) return Response.json({ issuer: 'https://auth.openai.com', revocation_endpoint: 'https://auth.openai.com/revoke' });
      if (String(url).endsWith('/revoke')) return new Response(null, { status: 200 });
      calls++;
      requests.push(new URLSearchParams(options.body));
      return Response.json({ access_token: missingAccess ? undefined : `access-${calls}`, refresh_token: `refresh-${calls}`, id_token: 'signed-id', token_type: 'Bearer', expires_in: 3600, scope: `openid email offline_access resource.invoke${direct ? ' chatgpt.tokens.use.direct' : ''}` });
    }) as typeof fetch
  });
  return { root, manager, requests, calls: () => calls, records: () => records, advance: () => { time += 3_600_000; }, deny: () => { direct = false; }, omitAccess: () => { missingAccess = true; }, invalidate: () => { invalid = true; }, switchSubject: () => { subject = 'account-two'; } };
}
async function connect(f: Awaited<ReturnType<typeof fixture>>, accountId?: string) {
  const start = await f.manager.begin(accountId);
  const url = new URL(start.authorizeUrl);
  return f.manager.callback({ state: url.searchParams.get('state'), code: 'auth-code', client_id: accountId ? undefined : 'oaiapp_test_client' });
}
test('dynamic registration binds PKCE, nonce, scope, issued client and stable loopback host', async () => {
  const f = await fixture();
  try {
    const start = await f.manager.begin();
    const url = new URL(start.authorizeUrl);
    assert.equal(url.searchParams.get('client_id'), 'dynamic_agent_client');
    assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1:3000/auth/openai/callback');
    assert.equal(url.searchParams.get('agent_name_hint'), 'QuantaCore');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    await assert.rejects(f.manager.callback({ state: 'bad', code: 'auth-code' }), /state/);
    assert.equal(f.calls(), 0);
    await f.manager.callback({ state: url.searchParams.get('state'), code: 'auth-code', client_id: 'oaiapp_test_client' });
    assert.equal(f.requests[0].get('client_id'), 'oaiapp_test_client');
    assert.ok(f.requests[0].get('code_verifier'));
    assert.equal(await f.manager.getAccessToken(), 'access-1');
    const status = await f.manager.status();
    assert.equal(status.accounts[0].planUsageEnabled, true);
    assert.ok(!JSON.stringify(status).includes('access-1'));
    assert.ok(!(await fs.readFile(path.join(f.root, 'chatgpt-oauth.json'), 'utf8')).includes('refresh-1'));
    await assert.rejects(f.manager.callback({ state: url.searchParams.get('state'), code: 'replay' }), /state/);
    const again = new URL((await f.manager.begin(status.activeAccountId!)).authorizeUrl);
    assert.equal(again.searchParams.get('client_id'), 'oaiapp_test_client');
    assert.equal(again.searchParams.get('ext_agent_host_id'), url.searchParams.get('ext_agent_host_id'));
    assert.equal(again.searchParams.has('agent_name_hint'), false);
  } finally { await fs.rm(f.root, { recursive: true }); }
});

test('token acquisition cannot silently switch away from the request account', async () => {
  const f = await fixture();
  try { const status = await connect(f); assert.ok(await f.manager.getAccessToken(status.activeAccountId!)); await assert.rejects(f.manager.getAccessToken('different-account'), /account changed/); }
  finally { await fs.rm(f.root, { recursive: true, force: true }); }
});
test('identity-only permissions and invalid identity never permit inference', async () => {
  const f = await fixture();
  try {
    f.deny();
    await connect(f);
    await assert.rejects(f.manager.getAccessToken(), /grant/);
    const status = await f.manager.status();
    const consent = new URL((await f.manager.begin(status.activeAccountId!)).authorizeUrl);
    assert.equal(consent.searchParams.get('prompt'), 'consent');
    const before = JSON.stringify(f.records());
    f.invalidate();
    await assert.rejects(connect(f), /verified/);
    assert.equal(JSON.stringify(f.records()), before);
  } finally { await fs.rm(f.root, { recursive: true }); }
});
test('parallel initial reads share one stable host and direct permission without token is rejected', async () => {
  const f = await fixture();
  try {
    const [, start] = await Promise.all([f.manager.status(), f.manager.begin(), f.manager.status()]);
    const url = new URL(start.authorizeUrl);
    const saved = JSON.parse(await fs.readFile(path.join(f.root, 'chatgpt-oauth.json'), 'utf8'));
    assert.equal(url.searchParams.get('ext_agent_host_id'), saved.hostId);
    f.omitAccess();
    await assert.rejects(f.manager.callback({ state: url.searchParams.get('state'), code: 'code', client_id: 'oaiapp_test' }), /incomplete/);
    assert.deepEqual(f.records(), {});
    await assert.rejects(f.manager.getAccessToken(), /Connect/);
  } finally { await fs.rm(f.root, { recursive: true }); }
});
test('refresh is serialized and atomically rotates credentials; sign out revokes and keeps mapping', async () => {
  const f = await fixture();
  try {
    await connect(f);
    f.advance();
    assert.deepEqual(await Promise.all([f.manager.getAccessToken(), f.manager.getAccessToken(), f.manager.getAccessToken()]), ['access-2', 'access-2', 'access-2']);
    assert.equal(f.calls(), 2);
    assert.equal(f.requests[1].get('grant_type'), 'refresh_token');
    assert.equal(f.requests[1].has('scope'), false);
    const result = await f.manager.disconnect();
    assert.equal(result.remoteRevocationConfirmed, true);
    assert.equal(result.status.activeAccountId, null);
    assert.equal(result.status.accounts[0].clientId, 'oaiapp_test_client');
    assert.equal(result.status.accounts[0].connected, false);
    assert.deepEqual(f.records(), {});
    await assert.rejects(f.manager.getAccessToken(), /Connect/);
  } finally { await fs.rm(f.root, { recursive: true }); }
});
test('returning account rejects mismatched client or identity without replacing saved tokens', async () => {
  const f = await fixture();
  try {
    const status = await connect(f);
    const before = JSON.stringify(f.records());
    let url = new URL((await f.manager.begin(status.activeAccountId!)).authorizeUrl);
    await assert.rejects(f.manager.callback({ state: url.searchParams.get('state'), code: 'code', client_id: 'oaiapp_other' }), /expected/);
    assert.equal(f.calls(), 1);
    f.switchSubject();
    url = new URL((await f.manager.begin(status.activeAccountId!)).authorizeUrl);
    await assert.rejects(f.manager.callback({ state: url.searchParams.get('state'), code: 'code' }), /differs/);
    assert.equal(JSON.stringify(f.records()), before);
  } finally { await fs.rm(f.root, { recursive: true }); }
});
