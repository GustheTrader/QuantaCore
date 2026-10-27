import { isLocalHost, isLoopbackSocket, sameOrigin, publicOrigin } from './local-access';
import express from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ProviderStore } from './provider-store';
import { boundedJson } from './bounded-json';

const hash = (value: string) => createHash('sha256').update(value).digest();
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });
type Store = Pick<ProviderStore, 'connection' | 'update' | 'getOAuthCredentials' | 'setOAuthCredentials'>;

export class OpenRouterOAuth {
  private pending = new Map<string, { verifier: string; binding: Buffer; expiresAt: number; callbackUrl: string; credentialHash: string }>();
  constructor(private store: Store, private request: typeof fetch = fetch) {}
  async status() {
    const c = await this.store.connection('openrouter');
    const saved = await this.store.getOAuthCredentials('openrouter');
    const same = Boolean(c.apiKey) && saved.credentialHash === hash(c.apiKey).toString('hex');
    return { hasKey: Boolean(c.apiKey), model: c.model, authenticated: same && saved.authenticated === true,
      method: same ? saved.method : c.apiKey ? 'api-key' : null, checkedAt: same ? saved.checkedAt : null };
  }
  async begin(binding: string, callbackUrl: string) {
    const url = new URL(callbackUrl);
    if (!((url.protocol === 'http:' && url.hostname === '127.0.0.1') || (url.protocol === 'https:' && url.hostname !== '127.0.0.1' && isLocalHost(url.hostname))) || url.pathname !== '/auth/openrouter/callback' || url.username || url.password || url.search || url.hash) throw fail('Use the local OpenRouter callback.');
    for (const [state, p] of this.pending) if (p.expiresAt < Date.now()) this.pending.delete(state);
    if (this.pending.size >= 10) throw fail('Too many pending sign-ins. Wait before trying again.', 429);
    const state = randomBytes(32).toString('base64url'), verifier = randomBytes(32).toString('base64url');
    const c = await this.store.connection('openrouter');
    this.pending.set(state, { verifier, binding: hash(binding), expiresAt: Date.now() + 600000, callbackUrl, credentialHash: hash(c.apiKey).toString('hex') });
    const authorize = new URL('https://openrouter.ai/auth');
    for (const [key, value] of Object.entries({ callback_url: callbackUrl, state, code_challenge: hash(verifier).toString('base64url'), code_challenge_method: 'S256', key_label: 'QuantaCore local' })) authorize.searchParams.set(key, value);
    return { authorizeUrl: authorize.toString() };
  }
  private async checkKey(key: string) {
    const response = await this.request('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${key}` }, redirect: 'error', signal: AbortSignal.timeout(20000) });
    const data = await boundedJson(response);
    if (!response.ok || !data.data || typeof data.data !== 'object') throw fail('OpenRouter could not authenticate this key. Sign in again or replace the API key.', response.ok ? 502 : response.status);
  }
  async validate() {
    const c = await this.store.connection('openrouter');
    if (!c.apiKey) throw fail('Sign in or save an OpenRouter API key first.', 409);
    const previous = await this.store.getOAuthCredentials('openrouter');
    const credentialHash = hash(c.apiKey).toString('hex');
    try { await this.checkKey(c.apiKey); }
    catch (error) { await this.store.setOAuthCredentials({ credentialHash, authenticated: false, checkedAt: new Date().toISOString(), method: previous.credentialHash === credentialHash ? previous.method : 'api-key' }, 'openrouter'); throw error; }
    if (hash((await this.store.connection('openrouter')).apiKey).toString('hex') !== credentialHash) throw fail('Credential changed during validation. Check the saved key again.', 409);
    await this.store.setOAuthCredentials({ credentialHash, authenticated: true, method: previous.credentialHash === credentialHash ? previous.method : 'api-key', checkedAt: new Date().toISOString() }, 'openrouter');
    return this.status();
  }
  async callback(query: any, binding: string) {
    const state = typeof query.state === 'string' ? query.state : '';
    const p = this.pending.get(state);
    if (!p || p.expiresAt < Date.now() || !timingSafeEqual(p.binding, hash(binding))) throw fail('Invalid or expired browser-bound OpenRouter sign-in.');
    this.pending.delete(state);
    if (query.error || typeof query.code !== 'string' || !query.code || query.code.length > 4096) throw fail('OpenRouter sign-in was cancelled or returned no code.');
    const response = await this.request('https://openrouter.ai/api/v1/auth/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: query.code, code_verifier: p.verifier, code_challenge_method: 'S256' }), redirect: 'error', signal: AbortSignal.timeout(20000) });
    const data = await boundedJson(response);
    if (!response.ok || typeof data.key !== 'string' || !data.key.trim() || data.key.length > 4096 || /[\r\n]/.test(data.key)) throw fail('OpenRouter authorization code exchange failed. Restart sign-in.', 401);
    await this.checkKey(data.key);
    await this.store.update(saved => {
      const old = saved.connections.openrouter;
      if (hash(old?.apiKey || '').toString('hex') !== p.credentialHash) throw fail('OpenRouter credential changed during sign-in. Start a new sign-in.', 409);
      saved.connections.openrouter = { baseUrl: 'https://openrouter.ai/api/v1', model: old?.model || 'openrouter/free', apiKey: data.key };
    });
    await this.store.setOAuthCredentials({ credentialHash: hash(data.key).toString('hex'), method: 'oauth', authenticated: true, checkedAt: new Date().toISOString() }, 'openrouter');
    return this.status();
  }
}

export function createOpenRouterOAuthRouter(oauth: OpenRouterOAuth) {
  const api = express.Router(), callback = express.Router();
  const local = (req: express.Request) => (req.hostname === '127.0.0.1' || isLocalHost(req.hostname)) && isLoopbackSocket(req);
  api.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!local(req) || req.get('X-Quanta-Client') !== 'local-ui' || !sameOrigin(req)) { res.status(403).json({ error: { message: 'Local application access required.' } }); return; }
    next();
  });
  const handle = (fn: (req: express.Request, res: express.Response) => Promise<unknown>) => async (req: express.Request, res: express.Response) => {
    try { res.json(await fn(req, res)); } catch (e: any) { res.status(e.status || 502).json({ error: { message: e.status ? e.message : 'OpenRouter sign-in unavailable. Retry from the local app.' } }); }
  };
  api.get('/status', handle(() => oauth.status()));
  api.post('/validate', handle(() => oauth.validate()));
  api.post('/authorize', handle(async (req, res) => {
    const binding = randomBytes(32).toString('base64url');
    const result = await oauth.begin(binding, `${publicOrigin(req)}/auth/openrouter/callback`);
    res.cookie('quanta_openrouter_oauth', binding, { httpOnly: true, sameSite: 'lax', path: '/auth/openrouter', maxAge: 600000 });
    return result;
  }));
  callback.get('/callback', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
    if (!local(req)) { res.status(403).send('Local callback required.'); return; }
    const binding = req.get('cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith('quanta_openrouter_oauth='))?.slice('quanta_openrouter_oauth='.length) || '';
    res.clearCookie('quanta_openrouter_oauth', { path: '/auth/openrouter' });
    try { await oauth.callback(req.query, binding); res.redirect(303, '/?auth_provider=openrouter&auth_result=connected#/startup'); }
    catch { res.redirect(303, '/?auth_provider=openrouter&auth_result=failed#/startup'); }
  });
  return { api, callback };
}
