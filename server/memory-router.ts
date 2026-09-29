import express, { type Request, type Response } from 'express';
import { createHash } from 'node:crypto';

const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const trim = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });
const errorResponse = (res: Response, error: any) => res.status(error.status || 503).json({ error: { message: error.status ? error.message : 'Memory service unavailable.' } });
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

interface MemoryRequest {
  owner: string;
  threadId: string;
  agent: string;
  query: string;
  userMessage?: string;
  assistantMessage?: string;
}

function validate(body: any): MemoryRequest {
  const owner = trim(body?.owner, 320).toLowerCase();
  const threadId = trim(body?.threadId, 128);
  const agent = trim(body?.agent, 80);
  const query = trim(body?.query, 12000);
  const userMessage = trim(body?.userMessage, 12000);
  const assistantMessage = trim(body?.assistantMessage, 24000);
  if (!owner || !threadId || !agent || !query) throw fail('Owner, thread, agent, and query are required.');
  if (/\r|\n/.test(owner) || /[^a-zA-Z0-9_-]/.test(threadId)) throw fail('Invalid memory identity.');
  return { owner, threadId, agent, query, userMessage, assistantMessage };
}

function identities(owner: string, threadId: string) {
  const user = `user-${digest(owner).slice(0, 32)}`;
  return {
    user,
    bank: `quanta-${digest(owner).slice(0, 32)}`,
    session: `thread-${digest(`${owner}:${threadId}`).slice(0, 40)}`
  };
}

async function serviceStatus(id: 'hindsight' | 'honcho', url: string) {
  const started = Date.now();
  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(1800) });
    await response.body?.cancel();
    return { id, status: response.ok ? 'responding' : response.status === 401 || response.status === 403 ? 'authentication-required' : 'error', latencyMs: Date.now() - started };
  } catch {
    return { id, status: 'unavailable', latencyMs: Date.now() - started };
  }
}

let hindsightClient: any;
async function getHindsightClient() {
  if (!hindsightClient) {
    // Credentials stay in this local server process and are never returned to the browser.
    const options: Record<string, string> = { baseUrl: process.env.HINDSIGHT_BASE_URL || 'http://127.0.0.1:8888' };
    if (process.env.HINDSIGHT_API_KEY) options.apiKey = process.env.HINDSIGHT_API_KEY;
    const { HindsightClient } = await import('@vectorize-io/hindsight-client');
    hindsightClient = new HindsightClient(options as any);
  }
  return hindsightClient;
}

let honchoClient: any;
async function getHonchoClient() {
  if (!honchoClient) {
    const { Honcho } = await import('@honcho-ai/sdk');
    const options: Record<string, string> = {
      baseURL: process.env.HONCHO_BASE_URL || process.env.HONCHO_API_URL || 'http://127.0.0.1:8000',
      workspaceId: process.env.HONCHO_WORKSPACE_ID || 'quanta-core'
    };
    if (process.env.HONCHO_API_KEY) options.apiKey = process.env.HONCHO_API_KEY;
    honchoClient = new Honcho(options);
  }
  return honchoClient;
}

async function recallHindsight(input: MemoryRequest) {
  const { bank } = identities(input.owner, input.threadId);
  const client = await getHindsightClient();
  try { await client.getBankProfile(bank); }
  catch { await client.createBank(bank, { name: 'QuantaCore private memory' }); }
  const result = await client.recall(bank, input.query, { limit: 5 });
  return (result?.results || []).slice(0, 5).map((item: any) => ({ source: 'Hindsight', type: item.type, text: String(item.text || '').slice(0, 1800) }));
}

async function recallHoncho(input: MemoryRequest) {
  const { user, session: sessionId } = identities(input.owner, input.threadId);
  const client = await getHonchoClient();
  const userPeer = await client.peer(user);
  const assistantPeer = await client.peer(`agent-${digest(input.agent.toLowerCase()).slice(0, 24)}`);
  const session = await client.session(sessionId);
  await session.addPeers([userPeer, assistantPeer]);
  const context = await session.context({ summary: true, tokens: 2400 });
  if (typeof context === 'string') return context.slice(0, 12000);
  const promptMessages = typeof context?.toOpenAI === 'function' ? context.toOpenAI({ assistant: assistantPeer }) : context;
  if (Array.isArray(promptMessages)) return promptMessages.map((message: any) => `[${message.role || 'memory'}] ${typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}`).join('\n').slice(0, 12000);
  return JSON.stringify(promptMessages).slice(0, 12000);
}

async function retainTurn(input: MemoryRequest) {
  const { bank, user, session: sessionId } = identities(input.owner, input.threadId);
  const results = await Promise.allSettled([
    (async () => {
      const client = await getHonchoClient();
      const userPeer = await client.peer(user);
      const assistantPeer = await client.peer(`agent-${digest(input.agent.toLowerCase()).slice(0, 24)}`);
      const session = await client.session(sessionId);
      await session.addPeers([userPeer, assistantPeer]);
      const messages: any[] = [];
      if (input.userMessage) messages.push(userPeer.message(input.userMessage));
      if (input.assistantMessage) messages.push(assistantPeer.message(input.assistantMessage));
      if (messages.length) await session.addMessages(messages);
    })(),
    (async () => {
      if (!input.userMessage || !input.assistantMessage) return;
      const hindsight = await getHindsightClient();
      try { await hindsight.getBankProfile(bank); }
      catch { await hindsight.createBank(bank, { name: 'QuantaCore private memory' }); }
      await hindsight.retain(bank, `User request: ${input.userMessage}\nAgent response: ${input.assistantMessage}`, {
        context: `QuantaCore ${input.agent} conversation turn`,
        timestamp: new Date()
      });
    })()
  ]);
  const statuses = { honcho: results[0].status === 'fulfilled' ? 'stored' : 'unavailable', hindsight: results[1].status === 'fulfilled' ? 'stored' : 'unavailable' };
  if (statuses.honcho === 'unavailable' && statuses.hindsight === 'unavailable') throw fail('Neither local memory service could store this turn.', 503);
  return { stored: true, services: statuses };
}

export function createMemoryRouter() {
  const router = express.Router();
  // This service is for the local desktop app only. It cannot be used as a public proxy.
  router.use((req, res, next) => {
    const origin = req.get('origin');
    if (!localHosts.has(req.hostname) || req.get('X-Quanta-Client') !== 'local-ui') return res.status(403).json({ error: { message: 'Local application access required.' } });
    if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: { message: 'Cross-origin memory access denied.' } });
    next();
  });

  router.get('/status', async (_req, res) => {
    const hindsightBase = process.env.HINDSIGHT_BASE_URL || 'http://127.0.0.1:8888';
    const honchoBase = process.env.HONCHO_BASE_URL || process.env.HONCHO_API_URL || 'http://127.0.0.1:8000';
    const [hindsight, honcho] = await Promise.all([
      serviceStatus('hindsight', `${hindsightBase.replace(/\/$/, '')}/health`),
      serviceStatus('honcho', `${honchoBase.replace(/\/$/, '')}/health`)
    ]);
    res.json({ checkedAt: new Date().toISOString(), services: [hindsight, honcho], persistence: 'local' });
  });

  router.post('/context', async (req, res) => {
    try {
      const input = validate(req.body);
      const results = await Promise.allSettled([recallHindsight(input), recallHoncho(input)]);
      const hindsight = results[0].status === 'fulfilled' ? results[0].value : [];
      const honcho = results[1].status === 'fulfilled' ? results[1].value : '';
      res.json({ hindsight, honcho, available: Boolean(hindsight.length || honcho), degraded: results.some(result => result.status === 'rejected') });
    } catch (error) { errorResponse(res, error); }
  });

  router.post('/turn', async (req, res) => {
    try { res.json(await retainTurn(validate(req.body))); }
    catch (error) { errorResponse(res, error); }
  });
  return router;
}
