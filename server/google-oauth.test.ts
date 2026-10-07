import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleOAuth } from './google-oauth';
import { ProviderStore } from './provider-store';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const scope = 'https://www.googleapis.com/auth/generative-language.retriever';
function fixture() {
  let saved: any = {}; const calls: { url: string; init?: RequestInit }[] = [];
  const store = { async getOAuthCredentials(namespace?: string) { assert.equal(namespace, 'google'); return structuredClone(saved); }, async setOAuthCredentials(data: any, namespace?: string) { assert.equal(namespace, 'google'); saved = structuredClone(data); } };
  const request = async (input: any, init?: RequestInit) => { const url = String(input); calls.push({ url, init }); if (url.includes('/token')) return Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', token_type: 'Bearer', expires_in: 3600, scope }); if (url.includes('/revoke')) return new Response('', { status: 200 }); return Response.json({ models: [{ name: 'models/fixture-chat', displayName: 'Fixture Chat', supportedGenerationMethods: ['generateContent'] }, { name: 'models/fixture-embedding', supportedGenerationMethods: ['embedContent'] }] }); };
  return { google: new GoogleOAuth(store, request as typeof fetch), calls, stored: () => saved };
}
test('Google OAuth binds state, browser, PKCE and requested scope; keeps tokens out of status', async () => {
  const f = fixture(); await f.google.configure({ clientId: 'fixture.apps.googleusercontent.com', clientSecret: 'fixture-secret', projectId: 'fixture-project' });
  const attempt = new URL((await f.google.begin('fixture-browser')).authorizeUrl);
  assert.equal(attempt.origin, 'https://accounts.google.com'); assert.equal(attempt.searchParams.get('scope'), scope); assert.equal(attempt.searchParams.get('code_challenge_method'), 'S256');
  await assert.rejects(f.google.callback({ state: attempt.searchParams.get('state'), code: 'fixture-code' }, 'different-browser'), /Invalid/); assert.equal(f.calls.length, 0);
  const next = new URL((await f.google.begin('fixture-browser')).authorizeUrl);
  await f.google.callback({ state: next.searchParams.get('state'), code: 'fixture-code' }, 'fixture-browser');
  const body = new URLSearchParams(String(f.calls[0].init?.body)); assert.equal(body.get('redirect_uri'), 'http://127.0.0.1:3000/auth/google/callback'); assert.ok(body.get('code_verifier'));
  const status = await f.google.status(); assert.equal(status.connected, true); assert.equal(JSON.stringify(status).includes('fixture-secret'), false); assert.equal(JSON.stringify(status).includes('fixture-access'), false);
  await assert.rejects(f.google.callback({ state: next.searchParams.get('state'), code: 'fixture-code' }, 'fixture-browser'), /Invalid/);
  assert.deepEqual(await f.google.models(), [{ id: 'models/fixture-chat', name: 'Fixture Chat' }]);
  assert.equal((f.calls.at(-1)?.init?.headers as any)['x-goog-user-project'], 'fixture-project');
  await f.google.select('models/fixture-chat'); assert.equal(f.stored().model, 'models/fixture-chat');
  const result = await f.google.disconnect(); assert.equal(result.connected, false); assert.equal(result.remoteRevocationConfirmed, true); assert.equal(f.stored().refreshToken, undefined);
});
test('changing Google client or project invalidates the old grant and pending authorization', async () => {
  const f = fixture(); await f.google.configure({ clientId: 'fixture.apps.googleusercontent.com', clientSecret: 'fixture-secret', projectId: 'fixture-project' });
  const attempt = new URL((await f.google.begin('browser')).authorizeUrl);
  await f.google.configure({ clientId: 'different.apps.googleusercontent.com', projectId: 'different-project' });
  await assert.rejects(f.google.callback({ state: attempt.searchParams.get('state'), code: 'fixture-code' }, 'browser'), /Invalid/);
  await assert.rejects(f.google.models(), /Connect/); assert.equal(f.calls.length, 0);
});
test('Google and ChatGPT credentials are encrypted independently and survive reopening', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'quanta-oauth-isolation-'));
  try {
    const store = new ProviderStore(directory);
    await store.setOAuthCredentials({ fixture: 'fixture-chatgpt-token' });
    await store.setOAuthCredentials({ fixture: 'fixture-google-token' }, 'google');
    for (const name of ['chatgpt', 'google'] as const) {
      assert.equal((await readFile(path.join(directory, `${name}-credentials.json`), 'utf8')).includes(`fixture-${name}-token`), false);
      assert.deepEqual(await new ProviderStore(directory).getOAuthCredentials(name), { fixture: `fixture-${name}-token` });
    }
  } finally {
    for (const file of ['chatgpt-credentials.json', 'google-credentials.json', 'credential.key']) await unlink(path.join(directory, file)).catch((e: any) => { if (e.code !== 'ENOENT') throw e; });
    await rmdir(directory);
  }
});
test('Google connection tests reject partial text and accept only completed content', async () => {
  let finishReason = 'MAX_TOKENS';
  const store: any = { getOAuthCredentials: async () => ({ accessToken: 'fixture-access', expiresAt: Date.now() + 3600000, projectId: 'fixture-project', model: 'models/fixture' }), setOAuthCredentials: async () => {} };
  const request: typeof fetch = (async () => Response.json({ candidates: [{ finishReason, content: { parts: [{ text: 'READY' }] } }] })) as typeof fetch;
  const google = new GoogleOAuth(store, request);
  await assert.rejects(google.test(), /did not complete/); finishReason = 'STOP'; assert.deepEqual(await google.test(), { text: 'READY' });
});
