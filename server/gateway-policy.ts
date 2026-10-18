import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import type { ProviderStore } from './provider-store';
import { bindCurrentEntity } from './operating-evidence';
const fail = (message: string, status = 403) => Object.assign(new Error(message), { status });
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
// profile 'agent' (opt-in, external clients only) lets a coding agent such as Gnoesis Bot use
// streaming and tool calls; every other limit, the route pin and the spend reservation still apply.
type Scope = { id: string; name: string; profile?: 'text' | 'agent'; tokenHash?: string; enabled: boolean; route: string; baseUrl: string; credentialHash: string; maxInputBytes: number; maxOutputTokens: number; requestsPerMinute: number; monthlyCalls: number; monthlyCapUsd: number; reservePerCallUsd: number; month: string; calls: number; reservedUsd: number; revision: string };
type Record = { id: string; clientId: string; route: string; revision: string; reservedUsd: number; at: string; status: 'pending' | 'succeeded' | 'failed' | 'uncertain'; usage?: { prompt_tokens: number; completion_tokens: number } };
export class GatewayPolicy {
  private file: string; private scopes: Scope[] = []; private records: Record[] = [];
  private active = new Map<string, number>();
  constructor(private store: ProviderStore) {
    this.file = path.join(store.directory, 'gateway-policy.json');
    if (existsSync(this.file)) { const saved = JSON.parse(readFileSync(this.file, 'utf8')); if (saved.version !== 1 || !Array.isArray(saved.scopes) || !Array.isArray(saved.records)) throw new Error('Gateway policy is invalid; saved data preserved.'); this.scopes = saved.scopes; this.records = saved.records; for (const r of this.records) if (r.status === 'pending') r.status = 'uncertain'; this.save(); }
  }
  private save() { mkdirSync(path.dirname(this.file), { recursive: true }); writeFileSync(this.file + '.tmp', JSON.stringify({ version: 1, scopes: this.scopes, records: this.records }), { mode: 0o600 }); renameSync(this.file + '.tmp', this.file); }
  profile(clientId: string) { return this.scopes.find(s => s.id === clientId)?.profile === 'agent' ? 'agent' as const : 'text' as const; }
  status() { return { legacyGatewayKeysAccepted: false, textOnly: !this.scopes.some(s => s.enabled && s.profile === 'agent'), limitsAreReservations: true, clients: this.scopes.map(({ tokenHash, credentialHash, ...s }) => s), records: this.records.slice(-100) }; }
  private integer(v: unknown, min: number, max: number) { if (!Number.isSafeInteger(v) || Number(v) < min || Number(v) > max) throw fail('Invalid integer gateway limit.', 400); return Number(v); }
  private money(v: unknown, allowZero = false) { if (typeof v !== 'number' || !Number.isFinite(v) || v < (allowZero ? 0 : 0.000001) || v > 10000) throw fail('Invalid gateway reservation limit.', 400); return v; }
  async configure(body: any, operator = false) {
    if (!body || typeof body.provider !== 'string' || typeof body.model !== 'string' || typeof body.enabled !== 'boolean' || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80) throw fail('Specify client name, provider, model and enabled state.', 400);
    const { getProviderDefinition } = await import('../lib/inference-providers'); const definition = getProviderDefinition(body.provider);
    if (!definition) throw fail('Unknown provider.', 400);
    const connection = await this.store.connection(definition.id);
    if (!connection.model || connection.model !== body.model || (definition.requiresKey && !connection.apiKey)) throw fail('Select a saved, configured provider/model route.', 400);
    const paid = definition.id !== 'local' || /(?:^|[:_-])cloud(?:$|[:_-])/i.test(body.model);
    if (paid && body.enabled && body.approveCloud !== true) throw fail('Explicit cloud data export and reservation approval required.', 400);
    const agent = body.profile === 'agent';
    if (agent && operator) throw fail('Agent profiles are for external clients such as Gnoesis Bot.', 400);
    if (agent && body.approveAgentTools !== true) throw fail('Approve streaming and tool calls for this agent client.', 400);
    const id = operator ? 'local-ui' : randomUUID(), existing = this.scopes.find(s => s.id === id);
    const month = new Date().toISOString().slice(0, 7), sameMonth = existing?.month === month;
    const scope: Scope = { id, name: body.name.trim(), profile: agent ? 'agent' : 'text', enabled: body.enabled, route: `${definition.id}/${body.model}`, baseUrl: connection.baseUrl.replace(/\/$/, ''), credentialHash: digest(connection.apiKey), maxInputBytes: this.integer(body.maxInputBytes, 256, agent ? 4000000 : 50000), maxOutputTokens: this.integer(body.maxOutputTokens, 1, agent ? 32768 : 4096), requestsPerMinute: this.integer(body.requestsPerMinute, 1, agent ? 120 : 30), monthlyCalls: this.integer(body.monthlyCalls, 1, 10000), monthlyCapUsd: this.money(body.monthlyCapUsd, true), reservePerCallUsd: paid ? this.money(body.reservePerCallUsd) : 0, month, calls: sameMonth ? existing!.calls : 0, reservedUsd: sameMonth ? existing!.reservedUsd : 0, revision: randomUUID() };
    if (scope.monthlyCapUsd < scope.reservedUsd || scope.monthlyCalls < scope.calls) throw fail('Limits cannot be lowered below existing usage.', 409);
    let key: string | undefined;
    if (!operator) { key = 'qscope_' + randomBytes(32).toString('base64url'); scope.tokenHash = digest(key); const secrets = await this.store.getOAuthCredentials('gateway'); secrets[id] = key; await this.store.setOAuthCredentials(secrets, 'gateway'); }
    this.scopes = this.scopes.filter(s => s.id !== id).concat(scope); this.save(); return { client: this.status().clients.find(s => s.id === id), ...(key ? { key } : {}) };
  }
  authenticate(authorization?: string) {
    const token = authorization?.match(/^Bearer (qscope_[A-Za-z0-9_-]{43})$/)?.[1]; if (!token) throw fail('A scoped gateway credential is required. Legacy broad keys are retired.', 401);
    const hash = Buffer.from(digest(token), 'hex'); const scope = this.scopes.find(s => s.tokenHash && timingSafeEqual(Buffer.from(s.tokenHash, 'hex'), hash));
    if (!scope?.enabled) throw fail('Gateway client is disabled or unknown.', 401); return scope.id;
  }
  routes(clientId: string) { const scope = this.scopes.find(s => s.id === clientId); return scope?.enabled ? [scope.route] : []; }
  admit(clientId: string, route: string, body: any, baseUrl: string, apiKey: string) {
    const scope = this.scopes.find(s => s.id === clientId); if (!scope?.enabled || scope.route !== route) throw fail('This client is not authorized for the selected model route.');
    if (scope.baseUrl !== baseUrl.replace(/\/$/, '') || scope.credentialHash !== digest(apiKey)) throw fail('Provider endpoint or credential changed. Reauthorize the scoped policy.', 409);
    const agent = scope.profile === 'agent';
    if (body.plugins) throw fail('Gateway plugins are disabled.');
    if (!agent && (body.stream || body.tools || body.tool_choice)) throw fail('Scoped gateway permits non-streaming text only; tools and plugins are disabled.');
    const roles = agent ? ['system', 'developer', 'user', 'assistant', 'tool'] : ['system', 'developer', 'user', 'assistant'];
    const contentOk = (m: any) => typeof m.content === 'string' || (agent && (m.content == null || Array.isArray(m.content)));
    if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > (agent ? 2000 : 40) || body.messages.some((m: any) => !m || !roles.includes(m.role) || !contentOk(m)) || Buffer.byteLength(JSON.stringify({ messages: body.messages, tools: body.tools }), 'utf8') > scope.maxInputBytes) throw fail('Message content exceeds this client’s text/input scope.', 400);
    if ((this.active.get(clientId) || 0) >= (agent ? 4 : 1)) throw fail('This client already has the maximum number of active requests.', 429);
    const recent = this.records.filter(r => r.clientId === clientId && Date.now() - Date.parse(r.at) < 60000).length;
    if (recent >= scope.requestsPerMinute) throw fail('Client request rate exceeded.', 429);
    const month = new Date().toISOString().slice(0, 7); if (scope.month !== month) { scope.month = month; scope.calls = 0; scope.reservedUsd = 0; }
    if (scope.calls >= scope.monthlyCalls || scope.reservedUsd + scope.reservePerCallUsd > scope.monthlyCapUsd + 1e-9) throw fail('Client monthly call or spending reservation limit reached.', 429);
    const requested = body.max_completion_tokens ?? body.max_tokens ?? scope.maxOutputTokens;
    if (!Number.isSafeInteger(requested) || requested < 1 || requested > scope.maxOutputTokens) throw fail('Output token request exceeds this client’s scope.', 400);
    if (body.max_completion_tokens !== undefined) { body.max_completion_tokens = requested; delete body.max_tokens; } else body.max_tokens = requested;
    const record: Record = { id: randomUUID(), clientId, route, revision: scope.revision, reservedUsd: scope.reservePerCallUsd, at: new Date().toISOString(), status: 'pending' };
    scope.calls++; scope.reservedUsd += scope.reservePerCallUsd; this.records.push(record); this.save(); bindCurrentEntity('inference',record.id); this.active.set(clientId, (this.active.get(clientId) || 0) + 1); return record.id;
  }
  complete(id: string, result?: any) { const record = this.records.find(r => r.id === id); if (!record || record.status !== 'pending') return; const open = (this.active.get(record.clientId) || 1) - 1; if (open > 0) this.active.set(record.clientId, open); else this.active.delete(record.clientId); record.status = result ? 'succeeded' : 'failed'; const u = result?.usage; if (Number.isSafeInteger(u?.prompt_tokens) && u.prompt_tokens >= 0 && Number.isSafeInteger(u?.completion_tokens) && u.completion_tokens >= 0) record.usage = { prompt_tokens: u.prompt_tokens, completion_tokens: u.completion_tokens }; this.save(); }
  revoke(id: string) { const scope = this.scopes.find(s => s.id === id); if (!scope) throw fail('Unknown client.', 404); scope.enabled = false; this.save(); return this.status(); }
}
