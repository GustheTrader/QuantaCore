import express from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ProviderStore } from './provider-store';
import { boundedJson } from './bounded-json';

const redirectUri = 'http://127.0.0.1:3000/auth/google/callback';
const scope = 'https://www.googleapis.com/auth/generative-language.retriever';
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });
const hash = (value: string) => createHash('sha256').update(value).digest();
type Credentials = { clientId?: string; clientSecret?: string; projectId?: string; accessToken?: string; refreshToken?: string; expiresAt?: number; model?: string; grantId?: string };

export class GoogleOAuth {
  private pending?: { state: string; verifier: string; binding: Buffer; expiresAt: number; clientId: string };
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private store: Pick<ProviderStore, 'getOAuthCredentials' | 'setOAuthCredentials'>, private request: typeof fetch = fetch) {}
  private serial<T>(fn: () => Promise<T>): Promise<T> { const next = this.queue.catch(() => {}).then(fn); this.queue = next; return next; }
  private read(): Promise<Credentials> { return this.store.getOAuthCredentials('google'); }
  private write(data: Credentials) { return this.store.setOAuthCredentials(data, 'google'); }
  async status() { const c = await this.read(); return { configured: Boolean(c.clientId && c.clientSecret && c.projectId), connected: Boolean(c.accessToken), clientId: c.clientId || '', projectId: c.projectId || '', model: c.model || '', redirectUri, scope }; }
  configure(body: any) { return this.serial(async () => {
    const c = await this.read();
    const clientId = String(body?.clientId || '').trim(), projectId = String(body?.projectId || '').trim();
    const clientSecret = typeof body?.clientSecret === 'string' && body.clientSecret.trim() ? body.clientSecret.trim() : c.clientSecret;
    if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId) || !/^[a-z][a-z0-9-]{4,62}$/.test(projectId) || !clientSecret || clientSecret.length > 4096 || /[\r\n]/.test(clientSecret)) throw fail('Enter a Google Desktop OAuth client ID, client secret, and project ID.');
    const retain = c.clientId === clientId && c.projectId === projectId && c.clientSecret === clientSecret;
    this.pending = undefined;
    await this.write({ ...(retain ? c : {}), clientId, clientSecret, projectId }); return this.status();
  }); }
  begin(binding: string) { return this.serial(async () => {
    const c = await this.read(); if (!c.clientId || !c.clientSecret || !c.projectId) throw fail('Configure your Google Cloud Desktop OAuth client first.', 409);
    const state = randomBytes(32).toString('base64url'), verifier = randomBytes(32).toString('base64url');
    this.pending = { state, verifier, binding: hash(binding), expiresAt: Date.now() + 600000, clientId: c.clientId };
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    for (const [k, v] of Object.entries({ client_id: c.clientId, redirect_uri: redirectUri, response_type: 'code', scope, state, code_challenge: hash(verifier).toString('base64url'), code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent' })) url.searchParams.set(k, v);
    return { authorizeUrl: url.toString() };
  }); }
  private async tokenExchange(fields: Record<string, string>) {
    const response = await this.request('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields), redirect: 'error', signal: AbortSignal.timeout(20000) });
    const result = await boundedJson(response);
    if (!response.ok || typeof result.access_token !== 'string' || !result.access_token || String(result.token_type).toLowerCase() !== 'bearer' || !Number.isFinite(result.expires_in) || result.expires_in <= 0) throw fail('Google authorization failed. Check your OAuth client and approved scopes.', 401);
    if (result.scope && String(result.scope).trim() !== scope) throw fail('Google did not return the requested Gemini API permission.', 403);
    return result;
  }
  callback(query: any, binding: string) { return this.serial(async () => {
    const p = this.pending; this.pending = undefined;
    if (!p || p.expiresAt < Date.now() || typeof query.state !== 'string' || query.state !== p.state || !timingSafeEqual(p.binding, hash(binding)) || typeof query.code !== 'string' || query.error) throw fail('Invalid or expired Google sign-in.', 400);
    const c = await this.read(); if (c.clientId !== p.clientId) throw fail('Google client changed during sign-in.');
    const result = await this.tokenExchange({ grant_type: 'authorization_code', code: query.code, client_id: c.clientId!, client_secret: c.clientSecret!, redirect_uri: redirectUri, code_verifier: p.verifier });
    if (result.scope !== scope) throw fail('Google did not confirm the requested Gemini API permission.', 403);
    await this.write({ ...c, grantId: randomBytes(32).toString('base64url'), accessToken: result.access_token, refreshToken: result.refresh_token, expiresAt: Date.now() + result.expires_in * 1000 });
    return this.status();
  }); }
  private access() { return this.serial(async () => {
    const c = await this.read(); if (!c.accessToken) throw fail('Connect your Google API account first.', 401);
    if ((c.expiresAt || 0) > Date.now() + 60000) return c;
    if (!c.refreshToken || !c.clientId || !c.clientSecret) throw fail('Reauthorize Google to renew API access.', 401);
    const r = await this.tokenExchange({ grant_type: 'refresh_token', refresh_token: c.refreshToken, client_id: c.clientId, client_secret: c.clientSecret });
    const next = { ...c, accessToken: r.access_token, refreshToken: r.refresh_token || c.refreshToken, expiresAt: Date.now() + r.expires_in * 1000 }; await this.write(next); return next;
  }); }
  async models() {
    const c = await this.access();
    const response = await this.request('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: { Authorization: `Bearer ${c.accessToken}`, 'x-goog-user-project': c.projectId! }, redirect: 'error', signal: AbortSignal.timeout(20000) });
    const data = await boundedJson(response); if (!response.ok || !Array.isArray(data.models)) throw fail(`Google model catalog returned HTTP ${response.status}. Verify the Generative Language API and project permissions.`, response.ok ? 502 : response.status);
    return data.models.filter((m: any) => typeof m.name === 'string' && m.supportedGenerationMethods?.includes('generateContent')).map((m: any) => ({ id: m.name, name: m.displayName || m.name }));
  }
  async select(model: unknown) {
    const selectedGrant = (await this.read()).grantId;
    if (typeof model !== 'string' || !(await this.models()).some((m: any) => m.id === model)) throw fail('Select a model from the Google account catalog.');
    return this.serial(async () => { const c = await this.read(); if (!selectedGrant || c.grantId !== selectedGrant || !c.accessToken) throw fail('Google authorization changed. Reload its catalog before selecting a model.', 409); await this.write({ ...c, model }); return this.status(); });
  }
  async test() {
    const c = await this.access(); if (!c.model || !/^models\/[\w.-]+$/.test(c.model)) throw fail('Save a Google model first.');
    const response = await this.request(`https://generativelanguage.googleapis.com/v1beta/${c.model}:generateContent`, { method: 'POST', headers: { Authorization: `Bearer ${c.accessToken}`, 'x-goog-user-project': c.projectId!, 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Connection check: reply READY.' }] }] }), redirect: 'error', signal: AbortSignal.timeout(60000) });
    const data = await boundedJson(response); if (!response.ok) throw fail(`Google API test returned HTTP ${response.status}.`, response.status);
    if (data.candidates?.[0]?.finishReason !== 'STOP') throw fail('Google API test did not complete successfully.', 502);
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join(''); if (!text) throw fail('Google returned no usable text.', 502); return { text };
  }
  disconnect() { return this.serial(async () => {
    const c = await this.read(); let remoteRevocationConfirmed = false;
    try { if (c.refreshToken || c.accessToken) { const response = await this.request('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: c.refreshToken || c.accessToken! }), redirect: 'error', signal: AbortSignal.timeout(10000) }); remoteRevocationConfirmed = response.ok; await response.body?.cancel(); } } catch {}
    this.pending = undefined; await this.write({ clientId: c.clientId, clientSecret: c.clientSecret, projectId: c.projectId }); return { ...await this.status(), remoteRevocationConfirmed };
  }); }
}
export function createGoogleOAuthRouter(google: GoogleOAuth) {
  const api = express.Router(), callback = express.Router();
  const local = (req: express.Request) => req.hostname === '127.0.0.1' && ['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '');
  api.use((req, res, next) => { if (!local(req) || req.get('X-Quanta-Client') !== 'local-ui' || (req.get('origin') && req.get('origin') !== `http://${req.get('host')}`)) { res.status(403).json({ error: { message: 'Local application access required.' } }); return; } res.setHeader('Cache-Control', 'no-store'); next(); });
  const handle = (fn: (req: express.Request, res: express.Response) => Promise<unknown>) => async (req: express.Request, res: express.Response) => { try { res.json(await fn(req, res)); } catch (e: any) { res.status(e.status || 502).json({ error: { message: e.status ? e.message : 'Google connection operation failed.' } }); } };
  api.get('/status', handle(() => google.status())); api.put('/client', handle(req => google.configure(req.body)));
  api.post('/authorize', handle(async (_req, res) => { const binding = randomBytes(32).toString('base64url'); const result = await google.begin(binding); res.cookie('quanta_google_oauth', binding, { httpOnly: true, sameSite: 'lax', path: '/auth/google', maxAge: 600000 }); return result; }));
  api.get('/models', handle(async () => ({ models: await google.models() }))); api.put('/model', handle(req => google.select(req.body?.model))); api.post('/test', handle(() => google.test())); api.post('/disconnect', handle(() => google.disconnect()));
  callback.get('/callback', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
    if (!local(req)) { res.status(403).send('Local callback required.'); return; }
    const binding = req.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('quanta_google_oauth='))?.slice('quanta_google_oauth='.length) || '';
    res.clearCookie('quanta_google_oauth', { path: '/auth/google' });
    try { await google.callback(req.query, binding); res.redirect(303, '/hybrid.html?google=connected'); } catch { res.redirect(303, '/hybrid.html?google=failed'); }
  });
  return { api, callback };
}
