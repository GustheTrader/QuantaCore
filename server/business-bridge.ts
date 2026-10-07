import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import type { ProviderStore } from './provider-store';
import type { HybridManager } from './hybrid-manager';
import type { ChatGptPlan } from './chatgpt-plan';

type Client = { tokenHash: string; kind: 'paperclip' | 'activepieces' | 'twenty'; companyId?: string; agentId?: string };
type Config = { clients: Record<string, Client> };
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export function authenticateBusinessClient(config: Config, authorization: string | undefined) {
  const token = authorization?.match(/^Bearer ([A-Za-z0-9_-]{40,120})$/)?.[1];
  if (!token) throw fail('Business bridge authentication required', 401);
  const digest = Buffer.from(hash(token), 'hex');
  const entry = Object.entries(config.clients).find(([, client]) => /^[a-f0-9]{64}$/.test(client.tokenHash) && timingSafeEqual(digest, Buffer.from(client.tokenHash, 'hex')));
  if (!entry) throw fail('Business bridge authentication required', 401);
  return { id: entry[0], ...entry[1] };
}
export function validateBusinessMessages(body: any) {
  if (body.model && body.model !== 'local') throw fail('Use model local. Cloud work requires a Business job draft and operator approval.');
  if (body.stream || body.tools || body.tool_choice) throw fail('This planning bridge supports non-streaming text only.');
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 40 || body.messages.some((m: any) => !m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) throw fail('Provide text messages with valid roles.');
  if (JSON.stringify(body.messages).length > 50000) throw fail('Message content exceeds 50 KB.');
  return body.messages;
}
export function assertBusinessLocalModel(model: string) {
  if (/(?:^|[:_-])cloud(?:$|[:_-])/i.test(model)) throw fail('Ollama cloud model tags cannot use the local-only Business route. Use an explicitly authorized cloud route.', 403);
}
export function createBusinessBridge(root: string, store: ProviderStore, hybrid: HybridManager, request: typeof fetch = fetch, chatgpt?: ChatGptPlan) {
  const router = express.Router();
  const directory = path.join(root, '.quanta', 'business-results');
  const configPath = path.join(root, '.quanta', 'business-bridge.json');
  const running = new Set<string>();
  const rates = new Map<string, { start: number; count: number }>();
  router.get('/status', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(req.hostname) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') || req.get('X-Quanta-Client') !== 'local-ui' || (req.get('origin') && req.get('origin') !== `http://${req.get('host')}`)) { res.sendStatus(403); return; }
    try {
      const config: Config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : { clients: {} };
      const probe = async (url: string) => { try { const response = await request(url, { redirect: 'error', signal: AbortSignal.timeout(2500) }); await response.body?.cancel(); return response.ok; } catch { return false; } };
      const [paperclipReachable, localModelReachable] = await Promise.all([probe('http://127.0.0.1:3210/api/health'), probe('http://127.0.0.1:11434/v1/models')]);
      res.json({ mode: 'planning', paperclipReachable, localModelReachable, modelResponseVerified: false, clients: Object.entries(config.clients).map(([id, client]) => ({ id, kind: client.kind, bound: client.kind !== 'paperclip' || Boolean(client.agentId && client.companyId) })), cloudMode: 'operator-approved-business-jobs', externalActionsEnabled: false });
    } catch { res.status(503).json({ error: 'Business bridge configuration unavailable' }); }
  });
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    // Container clients authenticate with separate scoped keys. This router never
    // grants access to settings, the shared inference key, approvals, or execution.
    if (req.get('origin')) { res.status(403).json({ error: { message: 'Use a server-side business connector' } }); return; }
    try {
      const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : { clients: {} };
      const client = authenticateBusinessClient(config, req.get('authorization'));
      let rate = rates.get(client.id);
      if (!rate || Date.now() - rate.start > 60000) { rate = { start: Date.now(), count: 0 }; rates.set(client.id, rate); }
      if (++rate.count > 10) throw fail('Business connector rate limit exceeded', 429);
      res.locals.client = client; next();
    } catch (error: any) { res.status(error.status || 503).json({ error: { message: error.status ? error.message : 'Business bridge configuration unavailable' } }); }
  });
  const handle = (fn: (req: express.Request, res: express.Response) => Promise<void>) => async (req: express.Request, res: express.Response) => {
    try { await fn(req, res); } catch (error: any) { res.status(error.status || 502).json({ error: { message: error.status ? error.message : 'Business bridge request failed; inspect local connector setup' } }); }
  };
  async function localCompletion(body: any) {
    if (body.model === 'chatgpt-plan') {
      if (!chatgpt) throw fail('ChatGPT plan connection is unavailable', 503);
      const messages = validateBusinessMessages({ ...body, model: 'local' });
      return chatgpt.complete(messages, true);
    }
    const messages = validateBusinessMessages(body);
    const connection = await store.connection('local');
    if (!connection.model) throw fail('Configure an Ollama Local model in Quanta Settings first', 503);
    assertBusinessLocalModel(connection.model);
    const url = new URL(connection.baseUrl);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw fail('Local model endpoint must stay on loopback', 503);
    const response = await request(url.toString().replace(/\/$/, '') + '/chat/completions', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { 'Content-Type': 'application/json', ...(connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {}) },
      body: JSON.stringify({ model: connection.model, stream: false, max_tokens: 1024, temperature: 0.2, messages: [{ role: 'system', content: 'You are a business planning analyst. Produce source-aware recommendations with assumptions and acceptance criteria. You have no tools and cannot publish, contact people, change accounts, spend money, or execute trades. Never claim that suggested actions were performed.' }, ...messages] })
    });
    if (!response.ok) throw fail(`Local model returned HTTP ${response.status}`, 502);
    const reader = response.body?.getReader();
    if (!reader) throw fail('Local model returned an empty response', 502);
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1_000_000) { await reader.cancel(); throw fail('Local model response too large', 502); }
      chunks.push(value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim() || content.length > 100000) throw fail('Local model returned no usable text', 502);
    return { id: data.id || 'business-' + Date.now(), object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: 'local', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], ...(data.usage ? { usage: data.usage } : {}) };
  }
  router.get('/v1/models', handle(async (_req, res) => {
    const connection = await store.connection('local');
    const data = connection.model ? [{ id: 'local', object: 'model', owned_by: 'quanta-business' }] : [];
    if (chatgpt) {
      const status = await chatgpt.status();
      if (status.route.businessEnabled && status.route.accountId === status.activeAccountId && status.accounts.some(a => a.id === status.activeAccountId && a.planUsageEnabled)) data.push({ id: 'chatgpt-plan', object: 'model', owned_by: 'chatgpt-subscription' });
    }
    res.json({ object: 'list', data });
  }));
  router.post('/v1/chat/completions', handle(async (req, res) => {
    if (res.locals.client.kind === 'paperclip') throw fail('Paperclip workers must use the bound heartbeat endpoint', 403);
    const key = res.locals.client.id;
    if (running.has(key)) throw fail('Connector already has a model request running', 429);
    running.add(key);
    try { res.json(await localCompletion(req.body)); } finally { running.delete(key); }
  }));
  router.post('/jobs', handle(async (req, res) => {
    if (!['zo_report', 'abacus_forecast', 'fireworks_infer'].includes(req.body?.operation)) throw fail('Only Business report, forecast and inference drafts are allowed');
    const key = req.get('Idempotency-Key');
    if (!key || !/^[a-zA-Z0-9_-]{1,80}$/.test(key)) throw fail('Provide a stable Idempotency-Key');
    const job = await hybrid.draft({ ...req.body, domain: 'business' }, hash(res.locals.client.id + ':' + key));
    res.status(202).json({ id: job.id, status: job.status, approvalRequired: true, executionStarted: false, reviewUrl: 'http://127.0.0.1:3000/hybrid.html' });
  }));
  router.get('/jobs/:id', handle(async (_req, _res) => {
    // Shared cloud results stay in the operator panel until a scoped result
    // delivery contract is implemented; no cross-client result access.
    throw fail('Review cloud jobs in the local Hybrid Cloud panel', 403);
  }));
  async function board(endpoint: string, method = 'GET', body?: unknown) {
    const base = 'http://127.0.0.1:3210';
    const credentials = (await store.getOAuthCredentials('bootstrap')).paperclipAuth;
    if (!credentials) throw fail('Protected Paperclip operator credentials are unavailable', 503);
    const login = await request(base + '/api/auth/sign-in/email', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
    if (!login.ok) throw fail('Paperclip local operator authentication failed', 503);
    const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    if (!cookie) throw fail('Paperclip operator session unavailable', 503);
    const response = await request(base + '/api' + endpoint, { method, redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Origin: base, Cookie: cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw fail(`Paperclip returned HTTP ${response.status}`, 502);
    return response.json();
  }
  router.head('/paperclip/heartbeat', (_req, res) => res.sendStatus(200));
  router.post('/paperclip/heartbeat', handle(async (req, res) => {
    const client = res.locals.client as Client;
    const { agentId, runId, context } = req.body || {};
    const issueId = context?.issueId || context?.taskId;
    if (client.kind !== 'paperclip' || !client.companyId || client.agentId !== agentId) throw fail('Worker is not bound to this connector', 403);
    if (![runId, issueId].every(value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value))) throw fail('Heartbeat requires runId and taskId or issueId');
    const file = path.join(directory, hash(res.locals.client.id + ':' + runId) + '.json');
    const digest = hash(JSON.stringify({ agentId, runId, issueId }));
    if (existsSync(file)) {
      const old = JSON.parse(readFileSync(file, 'utf8'));
      if (old.digest !== digest) throw fail('Run identity was reused with another task', 409);
      if (old.status !== 'succeeded') throw fail('Earlier run is running or uncertain; inspect its local artifact before retrying', 409);
      res.json(old); return;
    }
    const issue = await board('/issues/' + encodeURIComponent(issueId));
    if (issue.companyId !== client.companyId || issue.assigneeAgentId !== agentId || ['done', 'cancelled'].includes(issue.status)) throw fail('Task must be open and assigned to this worker in its bound company', 403);
    if (running.has(res.locals.client.id)) throw fail('Worker already has a model request running', 429);
    const record: any = { digest, runId, agentId, issueId, status: 'running', createdAt: new Date().toISOString() };
    const save = () => { mkdirSync(directory, { recursive: true }); writeFileSync(file + '.tmp', JSON.stringify(record, null, 2)); renameSync(file + '.tmp', file); };
    save(); running.add(res.locals.client.id);
    try {
      record.result = await localCompletion({ model: req.body.model === 'chatgpt-plan' ? 'chatgpt-plan' : 'local', messages: [{ role: 'user', content: JSON.stringify({ title: issue.title, brief: issue.description || '' }) }] });
      record.status = 'model-completed'; save();
      const comment = await board('/issues/' + encodeURIComponent(issueId) + '/comments', 'POST', { body: 'Quanta Business planning output (human review required). No external action was performed.\n\n' + record.result.choices[0].message.content });
      record.commentId = comment.id; record.status = 'succeeded'; record.completedAt = new Date().toISOString(); save();
      res.json(record);
    } catch (error) { record.status = 'uncertain'; save(); throw error; }
    finally { running.delete(res.locals.client.id); }
  }));
  router.use((_req, res) => res.status(405).json({ error: { message: 'This bridge cannot approve jobs or execute business actions' } }));
  return router;
}
