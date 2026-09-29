import { withSupabase } from 'npm:@supabase/server@^1';
import { Ratelimit } from 'npm:@upstash/ratelimit@^2';
import { Redis } from 'npm:@upstash/redis@^1';
import { HindsightClient } from 'npm:@vectorize-io/hindsight-client@^0.10.1';
import { Honcho } from 'npm:@honcho-ai/sdk@^2.5.1';

const DEFAULT_ORIGIN = 'https://quanta-core.vercel.app';
const MAX_BODY_CHARS = 50_000;
const trim = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
type MemoryInput = { threadId: string; agent: string; query: string; userMessage: string; assistantMessage: string };
type Limiters = { minute: Ratelimit; day: Ratelimit; globalDay: Ratelimit };
let limiters: Limiters | undefined;

function errorResponse(status: number, message: string) {
  return Response.json({ error: { message } }, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

function allowedOrigins() {
  const configured = Deno.env.get('QUANTA_ALLOWED_ORIGINS')?.split(',').map(value => value.trim()).filter(Boolean);
  return new Set(configured?.length ? configured : [DEFAULT_ORIGIN]);
}

function readLimiters(): Limiters {
  if (limiters) return limiters;
  const url = Deno.env.get('UPSTASH_REDIS_REST_URL')?.trim();
  const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')?.trim();
  if (!url || !token) throw new Error('Memory request limits are not configured.');
  const redis = new Redis({ url, token });
  limiters = {
    minute: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m'), prefix: 'quanta:memory:user:minute', analytics: false }),
    day: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1 d'), prefix: 'quanta:memory:user:day', analytics: false }),
    globalDay: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(1000, '1 d'), prefix: 'quanta:memory:global:day', analytics: false })
  };
  return limiters;
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function validate(payload: unknown, userId: string): Promise<MemoryInput> {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid memory request.');
  const body = payload as Record<string, unknown>;
  const threadId = trim(body.threadId, 128);
  const agent = trim(body.agent, 80);
  const query = trim(body.query, 12000);
  const userMessage = trim(body.userMessage, 12000);
  const assistantMessage = trim(body.assistantMessage, 24000);
  if (!threadId || !agent || !query || /[^a-zA-Z0-9_-]/.test(threadId)) throw new Error('Thread, agent, and query are required.');
  if (userMessage.length + assistantMessage.length > 35000) throw new Error('Memory turn is too large.');
  return { threadId: `${(await digest(`${userId}:${threadId}`)).slice(0, 40)}`, agent: agent.slice(0, 80), query, userMessage, assistantMessage };
}

function clients() {
  const hindsightKey = Deno.env.get('HINDSIGHT_API_KEY')?.trim();
  const honchoKey = Deno.env.get('HONCHO_API_KEY')?.trim();
  const hindsight = hindsightKey ? new HindsightClient({ baseUrl: (Deno.env.get('HINDSIGHT_BASE_URL') || 'https://api.hindsight.vectorize.io').replace(/\/$/, ''), apiKey: hindsightKey } as any) : null;
  const honcho = honchoKey ? new Honcho({ baseURL: (Deno.env.get('HONCHO_BASE_URL') || 'https://api.honcho.dev').replace(/\/$/, ''), apiKey: honchoKey, workspaceId: Deno.env.get('HONCHO_WORKSPACE_ID') || 'quanta-core' } as any) : null;
  return { hindsight, honcho };
}

async function identities(userId: string, input: MemoryInput) {
  const userDigest = await digest(userId);
  const agentDigest = await digest(input.agent.toLowerCase());
  return { bank: `quanta-${userDigest.slice(0, 32)}`, user: `user-${userDigest.slice(0, 32)}`, peer: `agent-${agentDigest.slice(0, 24)}`, session: `thread-${input.threadId}` };
}

async function hindsightBank(client: any, bank: string) {
  try { await client.getBankProfile(bank); }
  catch { await client.createBank(bank, { name: 'QuantaCore private memory' }); }
}

async function recallContext(input: MemoryInput, userId: string) {
  const { hindsight, honcho } = clients();
  const ids = await identities(userId, input);
  const results = await Promise.allSettled([
    (async () => {
      if (!hindsight) throw new Error('Hindsight is not configured.');
      await hindsightBank(hindsight, ids.bank);
      const result = await hindsight.recall(ids.bank, input.query, { maxTokens: 2400 });
      return (result?.results || []).slice(0, 5).map((item: any) => ({ source: 'Hindsight', type: item.type, text: String(item.text || '').slice(0, 1800) }));
    })(),
    (async () => {
      if (!honcho) throw new Error('Honcho is not configured.');
      const userPeer = await honcho.peer(ids.user);
      const assistantPeer = await honcho.peer(ids.peer);
      const session = await honcho.session(ids.session);
      await session.addPeers([userPeer, assistantPeer]);
      const value = await session.context({ summary: true, tokens: 2400 });
      if (typeof value === 'string') return value.slice(0, 12000);
      const messages = typeof value?.toOpenAI === 'function' ? value.toOpenAI({ assistant: assistantPeer }) : value;
      if (Array.isArray(messages)) return messages.map((message: any) => `[${message.role || 'memory'}] ${typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}`).join('\n').slice(0, 12000);
      return JSON.stringify(messages).slice(0, 12000);
    })()
  ]);
  const memories = results[0].status === 'fulfilled' ? results[0].value : [];
  const honchoContext = results[1].status === 'fulfilled' ? results[1].value : '';
  return { hindsight: memories, honcho: honchoContext, available: Boolean(memories.length || honchoContext), degraded: results.some(result => result.status === 'rejected') };
}

async function retain(input: MemoryInput, userId: string) {
  const { hindsight, honcho } = clients();
  const ids = await identities(userId, input);
  const results = await Promise.allSettled([
    (async () => {
      if (!honcho) throw new Error('Honcho is not configured.');
      const userPeer = await honcho.peer(ids.user);
      const assistantPeer = await honcho.peer(ids.peer);
      const session = await honcho.session(ids.session);
      await session.addPeers([userPeer, assistantPeer]);
      const messages: any[] = [];
      if (input.userMessage) messages.push(userPeer.message(input.userMessage));
      if (input.assistantMessage) messages.push(assistantPeer.message(input.assistantMessage));
      if (messages.length) await session.addMessages(messages);
    })(),
    (async () => {
      if (!hindsight || !input.userMessage || !input.assistantMessage) throw new Error('Hindsight is not configured or turn is incomplete.');
      await hindsightBank(hindsight, ids.bank);
      await hindsight.retain(ids.bank, `User request: ${input.userMessage}\nAgent response: ${input.assistantMessage}`, { context: `QuantaCore ${input.agent} conversation turn`, timestamp: new Date() });
    })()
  ]);
  const services = { honcho: results[0].status === 'fulfilled' ? 'stored' : 'unavailable', hindsight: results[1].status === 'fulfilled' ? 'stored' : 'unavailable' };
  if (services.honcho === 'unavailable' && services.hindsight === 'unavailable') return errorResponse(503, 'Hosted memory services are not configured or temporarily unavailable.');
  return Response.json({ stored: true, services }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

Deno.serve(withSupabase({ auth: 'user' }, async (request, context) => {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins().has(origin)) return errorResponse(403, 'This origin is not allowed.');
  const userId = context.userClaims?.id;
  if (!userId) return errorResponse(401, 'Sign in to use hosted memory.');
  let checks: Array<{ success: boolean; reset: number }>;
  try {
    const limits = readLimiters();
    checks = await Promise.all([
      limits.minute.limit(`user:${userId}`),
      limits.day.limit(`user:${userId}`),
      limits.globalDay.limit('all-users')
    ]);
  }
  catch { return errorResponse(503, 'Hosted memory request limits are not configured.'); }
  if (checks.some(check => !check.success)) return Response.json({ error: { message: 'Memory request limit reached. Try again later.' } }, { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((Math.max(...checks.map(check => check.reset)) - Date.now()) / 1000))), 'Cache-Control': 'no-store' } });
  let payload: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) return errorResponse(413, 'Memory request is too large.');
    payload = JSON.parse(raw);
  } catch { return errorResponse(400, 'Request body must be valid JSON.'); }
  if (payload.action === 'status') {
    return Response.json({ checkedAt: new Date().toISOString(), persistence: 'hosted', services: [
      { id: 'hindsight', status: Deno.env.get('HINDSIGHT_API_KEY')?.trim() ? 'configured' : 'unavailable', latencyMs: 0 },
      { id: 'honcho', status: Deno.env.get('HONCHO_API_KEY')?.trim() ? 'configured' : 'unavailable', latencyMs: 0 }
    ] }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (!Deno.env.get('HINDSIGHT_API_KEY')?.trim() && !Deno.env.get('HONCHO_API_KEY')?.trim()) return errorResponse(503, 'Hosted memory is not configured. Add Hindsight and/or Honcho API keys in Supabase Edge Function secrets.');
  let input: MemoryInput;
  try { input = await validate(payload, userId); }
  catch (error) { return errorResponse(400, error instanceof Error ? error.message : 'Invalid memory request.'); }
  if (payload.action === 'turn' && (!input.userMessage || !input.assistantMessage)) return errorResponse(400, 'A completed user and agent message are required to retain a turn.');
  if (payload.action === 'context') {
    try { return Response.json(await recallContext(input, userId), { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }); }
    catch { return errorResponse(503, 'Hosted memory could not retrieve context.'); }
  }
  if (payload.action === 'turn') return await retain(input, userId);
  return errorResponse(404, 'Hosted memory endpoint not found.');
}));
