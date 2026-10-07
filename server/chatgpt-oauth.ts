import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { ProviderStore } from './provider-store';
import { boundedJson } from './bounded-json';

const ISSUER = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const CALLBACK = 'http://127.0.0.1:3000/auth/openai/callback';
const TOKEN = `${ISSUER}/api/accounts/oauth/token`;
const DIRECT = 'chatgpt.tokens.use.direct';
type Account = { id: string; clientId: string; subject: string; email: string; name: string; scopes: string[]; expiresAt: number; connected: boolean };
type Metadata = { hostId: string; activeAccountId: string | null; accounts: Account[] };
type Credentials = { access_token?: string; refresh_token?: string; id_token?: string };
type Pending = { state: string; nonce: string; verifier: string; expiresAt: number; accountId?: string; clientId: string };
type Dependencies = { fetch?: typeof fetch; verify?: (token: string, clientId: string, nonce?: string) => Promise<JWTPayload>; now?: () => number };

/** Local OSS Sign in with ChatGPT. Never reads or reuses Codex credentials. */
export class ChatGptOAuth {
  private metadata?: Metadata;
  private loading?: Promise<Metadata>;
  private pending?: Pending;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private readonly verify: NonNullable<Dependencies['verify']>;
  constructor(private readonly root: string, private readonly store: ProviderStore, dependencies: Dependencies = {}) {
    this.fetcher = dependencies.fetch || fetch;
    this.now = dependencies.now || Date.now;
    const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));
    this.verify = dependencies.verify || (async (token, clientId, nonce) => {
      const { payload } = await jwtVerify(token, jwks, { issuer: ISSUER, audience: clientId, requiredClaims: ['sub', 'exp', 'iat'], algorithms: ['RS256'], clockTolerance: 5 });
      if (!payload.sub || (nonce !== undefined && payload.nonce !== nonce)) throw new Error('ChatGPT identity could not be verified.');
      return payload;
    });
  }
  private serial<T>(action: () => Promise<T>): Promise<T> {
    const run = this.queue.then(action, action);
    this.queue = run.catch(() => undefined);
    return run;
  }
  private async read() {
    if (this.loading) return this.loading;
    if (this.metadata) return this.metadata;
    this.loading = (async () => {
      await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
      try { this.metadata = JSON.parse(await fs.readFile(path.join(this.root, 'chatgpt-oauth.json'), 'utf8')); }
      catch (error: any) {
        if (error.code !== 'ENOENT') throw new Error('ChatGPT account metadata cannot be read. Saved files were preserved.');
        this.metadata = { hostId: `urn:uuid:${randomUUID()}`, activeAccountId: null, accounts: [] };
        await this.save();
      }
      return this.metadata!;
    })();
    try { return await this.loading; } finally { this.loading = undefined; }
  }
  private async save() {
    const target = path.join(this.root, 'chatgpt-oauth.json');
    const temporary = `${target}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(this.metadata), { mode: 0o600 });
    await fs.rename(temporary, target);
  }
  async status() {
    const data = await this.read();
    return { activeAccountId: data.activeAccountId, accounts: data.accounts.map(a => ({ id: a.id, email: a.email, name: a.name, clientId: a.clientId, connected: a.connected, planUsageEnabled: a.connected && a.scopes.includes(DIRECT), expiresAt: a.expiresAt ? new Date(a.expiresAt).toISOString() : null })), pending: !!this.pending && this.pending.expiresAt > this.now() };
  }
  async begin(accountId?: string) {
    return this.serial(async () => {
      const data = await this.read();
      const account = accountId ? data.accounts.find(a => a.id === accountId) : undefined;
      if (accountId && !account) throw new Error('Unknown ChatGPT account.');
      const attempt: Pending = { state: randomBytes(32).toString('base64url'), nonce: randomBytes(32).toString('base64url'), verifier: randomBytes(64).toString('base64url'), expiresAt: this.now() + 600_000, accountId, clientId: account?.clientId || 'dynamic_agent_client' };
      const url = new URL(`${ISSUER}/api/accounts/authorize`);
      url.search = new URLSearchParams({ client_id: attempt.clientId, ext_agent_host_id: data.hostId, response_type: 'code', redirect_uri: CALLBACK, scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct', resource: RESOURCE, state: attempt.state, nonce: attempt.nonce, code_challenge_method: 'S256', code_challenge: createHash('sha256').update(attempt.verifier).digest('base64url') }).toString();
      if (!account) url.searchParams.set('agent_name_hint', 'QuantaCore');
      if (account) {
        if (!account.scopes.includes(DIRECT)) url.searchParams.set('prompt', 'consent');
        const records = await this.store.getOAuthCredentials();
        if (account.connected && records[account.id]?.id_token) url.searchParams.set('id_token_hint', records[account.id].id_token);
        if (account.email) url.searchParams.set('login_hint', account.email);
      }
      this.pending = attempt;
      return { authorizeUrl: url.toString(), expiresAt: new Date(attempt.expiresAt).toISOString() };
    });
  }
  private async token(body: Record<string, string>) {
    let response: Response;
    try { response = await this.fetcher(TOKEN, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: new URLSearchParams(body), signal: AbortSignal.timeout(20_000), redirect: 'error' }); }
    catch { throw new Error('ChatGPT token exchange could not reach OpenAI. Start sign-in again.'); }
    if (!response.ok) throw new Error(`ChatGPT token exchange failed (${response.status}). Sign in again.`);
    let value: any;
    try { value = await boundedJson(response); } catch { throw new Error('OpenAI returned an unreadable credential response.'); }
    if (!value || typeof value.token_type !== 'string' || value.token_type.toLowerCase() !== 'bearer' || typeof value.access_token !== 'string' || !value.access_token || !Number.isFinite(value.expires_in) || value.expires_in <= 0 || value.expires_in > 86_400 || typeof value.scope !== 'string') throw new Error('OpenAI returned an incomplete credential response.');
    return value;
  }
  async callback(query: Record<string, unknown>) {
    return this.serial(async () => {
      const attempt = this.pending;
      if (!attempt || attempt.expiresAt <= this.now() || typeof query.state !== 'string' || query.state !== attempt.state) throw new Error('Sign-in state is missing, expired, or invalid.');
      this.pending = undefined;
      if (query.error) throw new Error('ChatGPT sign-in was declined or could not complete.');
      const clientId = attempt.clientId === 'dynamic_agent_client' ? query.client_id : attempt.clientId;
      if (typeof clientId !== 'string' || !/^oaiapp_[A-Za-z0-9_-]+$/.test(clientId) || (attempt.clientId !== 'dynamic_agent_client' && query.client_id !== undefined && query.client_id !== clientId)) throw new Error('ChatGPT registration did not return the expected issued client ID.');
      if (typeof query.code !== 'string' || !query.code || query.code.length > 8192) throw new Error('ChatGPT authorization code is missing.');
      const tokens = await this.token({ grant_type: 'authorization_code', client_id: clientId, code: query.code, code_verifier: attempt.verifier, redirect_uri: CALLBACK, resource: RESOURCE });
      if (typeof tokens.id_token !== 'string') throw new Error('OpenAI returned no identity token.');
      let identity: JWTPayload;
      try { identity = await this.verify(tokens.id_token, clientId, attempt.nonce); }
      catch { throw new Error('ChatGPT identity could not be verified.'); }
      if (typeof identity.sub !== 'string' || !identity.sub) throw new Error('ChatGPT identity has no subject.');
      const data = await this.read();
      const selected = attempt.accountId ? data.accounts.find(a => a.id === attempt.accountId) : data.accounts.find(a => a.clientId === clientId && a.subject === identity.sub);
      if (selected && (selected.subject !== identity.sub || selected.clientId !== clientId)) throw new Error('The signed-in ChatGPT identity differs from the selected account.');
      const scopes = tokens.scope.split(/\s+/).filter(Boolean);
      if (scopes.includes('offline_access') && (typeof tokens.refresh_token !== 'string' || !tokens.refresh_token)) throw new Error('OpenAI returned no renewable session token.');
      const account: Account = { id: selected?.id || randomUUID(), clientId, subject: identity.sub, email: typeof identity.email === 'string' ? identity.email : '', name: typeof identity.name === 'string' ? identity.name : '', scopes, expiresAt: this.now() + tokens.expires_in * 1000, connected: true };
      const records = await this.store.getOAuthCredentials();
      records[account.id] = { access_token: tokens.access_token, refresh_token: tokens.refresh_token || '', id_token: tokens.id_token };
      await this.store.setOAuthCredentials(records);
      data.accounts = data.accounts.filter(a => a.id !== account.id).concat(account);
      data.activeAccountId = account.id;
      await this.save();
      return this.status();
    });
  }
  async select(accountId: string) {
    return this.serial(async () => {
      const data = await this.read();
      if (!data.accounts.some(a => a.id === accountId && a.connected)) throw new Error('Sign in to that ChatGPT account before selecting it.');
      data.activeAccountId = accountId;
      await this.save();
      return this.status();
    });
  }
  async getAccessToken(expectedAccountId?: string) {
    return this.serial(async () => {
      const data = await this.read();
      const account = data.accounts.find(a => a.id === data.activeAccountId);
      if (expectedAccountId && account?.id !== expectedAccountId) throw new Error('Selected ChatGPT account changed. Start the request again.');
      if (!account?.connected || !account.scopes.includes(DIRECT) || !account.scopes.includes('resource.invoke')) throw new Error('Connect ChatGPT and grant ChatGPT plan usage before inference.');
      const records = await this.store.getOAuthCredentials();
      const credentials: Credentials = records[account.id] || {};
      if (account.expiresAt > this.now() + 60_000 && credentials.access_token) return credentials.access_token;
      if (!credentials.refresh_token) throw new Error('ChatGPT session expired. Sign in again.');
      const tokens = await this.token({ grant_type: 'refresh_token', client_id: account.clientId, refresh_token: credentials.refresh_token, resource: RESOURCE });
      if (typeof tokens.refresh_token !== 'string' || !tokens.refresh_token) throw new Error('OpenAI did not return a replacement refresh token. Sign in again.');
      const grantedScopes: string[] = tokens.scope.split(/\s+/).filter(Boolean);
      if (grantedScopes.some(scope => !account.scopes.includes(scope))) throw new Error('Refreshed permissions differ from the authorized grant. Sign in again.');
      if (tokens.id_token) {
        let identity: JWTPayload;
        try { identity = await this.verify(tokens.id_token, account.clientId); }
        catch { throw new Error('Refreshed ChatGPT identity could not be verified.'); }
        if (identity.sub !== account.subject) throw new Error('Refreshed ChatGPT identity differs from the selected account.');
      }
      records[account.id] = { access_token: tokens.access_token, refresh_token: tokens.refresh_token, id_token: tokens.id_token || credentials.id_token };
      await this.store.setOAuthCredentials(records);
      account.scopes = grantedScopes;
      account.expiresAt = this.now() + tokens.expires_in * 1000;
      await this.save();
      if (!account.scopes.includes(DIRECT) || !account.scopes.includes('resource.invoke')) throw new Error('ChatGPT plan usage is no longer authorized.');
      return tokens.access_token as string;
    });
  }
  async disconnect(accountId?: string) {
    return this.serial(async () => {
      const data = await this.read();
      const account = data.accounts.find(a => a.id === (accountId || data.activeAccountId));
      if (!account) throw new Error('Unknown ChatGPT account.');
      this.pending = undefined;
      const records = await this.store.getOAuthCredentials();
      const credentials: Credentials = records[account.id] || {};
      let remoteRevocationConfirmed = false;
      if (credentials.refresh_token) {
        try {
          const discovery = await this.fetcher(`${ISSUER}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(10_000), redirect: 'error' });
          if (!discovery.ok) throw new Error('Discovery failed');
          const config = await discovery.json();
          const endpoint = new URL(config.revocation_endpoint);
          if (config.issuer !== ISSUER || endpoint.origin !== ISSUER) throw new Error('Invalid revocation endpoint');
          const response = await this.fetcher(endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: credentials.refresh_token, token_type_hint: 'refresh_token', client_id: account.clientId }), signal: AbortSignal.timeout(10_000), redirect: 'error' });
          remoteRevocationConfirmed = response.status === 200;
        } catch { /* Local sign-out still clears all tokens; UI reports unconfirmed revocation. */ }
      }
      delete records[account.id];
      await this.store.setOAuthCredentials(records);
      account.connected = false;
      account.scopes = [];
      account.expiresAt = 0;
      if (data.activeAccountId === account.id) data.activeAccountId = null;
      await this.save();
      return { remoteRevocationConfirmed, status: await this.status() };
    });
  }
}
