import { withSupabase } from 'npm:@supabase/server@^1';
import { Ratelimit } from 'npm:@upstash/ratelimit@^2';
import { Redis } from 'npm:@upstash/redis@^1';

const FREE_MODEL = 'openrouter/free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
const MAX_BODY_CHARS = 128_000;
const DEFAULT_ORIGIN = 'https://quanta-core.vercel.app';

type LimiterSet = {
  minute: Ratelimit;
  day: Ratelimit;
  ipMinute: Ratelimit;
};

let limiterSet: LimiterSet | undefined;

function errorResponse(status: number, message: string, headers: HeadersInit = {}) {
  return Response.json({ error: { message } }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
  });
}

function allowedOrigins() {
  const configured = Deno.env.get('QUANTA_ALLOWED_ORIGINS')?.split(',').map(value => value.trim()).filter(Boolean);
  return new Set(configured?.length ? configured : [DEFAULT_ORIGIN]);
}

function getLimiters(): LimiterSet {
  if (limiterSet) return limiterSet;
  const url = Deno.env.get('UPSTASH_REDIS_REST_URL')?.trim();
  const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')?.trim();
  if (!url || !token) throw new Error('Hosted request limits are not configured.');
  const redis = new Redis({ url, token });
  limiterSet = {
    minute: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m'), prefix: 'quanta:inference:minute', analytics: false }),
    day: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1 d'), prefix: 'quanta:inference:day', analytics: false }),
    ipMinute: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m'), prefix: 'quanta:inference:ip', analytics: false })
  };
  return limiterSet;
}

function configuredModel() {
  const model = Deno.env.get('OPENROUTER_MODEL')?.trim() || FREE_MODEL;
  if (model !== FREE_MODEL) throw new Error(`Hosted model must remain ${FREE_MODEL}.`);
  if (!Deno.env.get('OPENROUTER_API_KEY')?.trim()) throw new Error('Hosted inference is not configured.');
  return model;
}

async function readPayload(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) throw new Error('Request body is too large.');
  try { return JSON.parse(raw); }
  catch { throw new Error('Request body must be valid JSON.'); }
}

async function checkLimits(userId: string, request: Request) {
  let limits: LimiterSet;
  try { limits = getLimiters(); }
  catch { return errorResponse(503, 'Hosted request limits are not configured.'); }

  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  try {
    const checks = await Promise.all([
      limits.minute.limit(`user:${userId}`),
      limits.day.limit(`user:${userId}`),
      ...(forwarded ? [limits.ipMinute.limit(`ip:${forwarded}`)] : [])
    ]);
    if (checks.some(check => !check.success)) {
      const reset = Math.max(...checks.map(check => check.reset));
      return errorResponse(429, 'Demo request limit reached. Try again later.', {
        'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000)))
      });
    }
    return null;
  } catch {
    return errorResponse(503, 'Hosted request limits are temporarily unavailable.');
  }
}

async function openRouterModels() {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY')?.trim();
  if (!apiKey) return errorResponse(503, 'OpenRouter is not configured.');
  try {
    const response = await fetch(`${OPENROUTER_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      redirect: 'error',
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) return errorResponse(response.status === 429 ? 429 : 502, 'OpenRouter could not return the model catalog.');
    const catalog = await response.json() as { data?: Array<{ id?: string; name?: string }> };
    const models = (catalog.data || [])
      .filter(model => typeof model.id === 'string' && model.id.endsWith(':free'))
      .map(model => ({ id: model.id!, name: model.name || model.id! }));
    return Response.json({ data: [{ id: FREE_MODEL, name: 'OpenRouter Free Model Router' }, ...models] }, {
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    });
  } catch {
    return errorResponse(503, 'OpenRouter is temporarily unavailable.');
  }
}

async function chatCompletion(body: unknown) {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY')?.trim();
  let model: string;
  try { model = configuredModel(); }
  catch { return errorResponse(503, 'OpenRouter is not configured.'); }
  if (!apiKey || !body || typeof body !== 'object' || !Array.isArray((body as any).messages) || (body as any).messages.length < 1 || (body as any).messages.length > 16) {
    return errorResponse(400, 'Provide between 1 and 16 text messages.');
  }

  const source = body as Record<string, unknown>;
  if (source.stream === true || source.tools !== undefined || source.tool_choice !== undefined || source.plugins !== undefined) {
    return errorResponse(400, 'Streaming, tools, and plugins are disabled on the public free demo route.');
  }
  let characters = 0;
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  for (const item of source.messages as unknown[]) {
    if (!item || typeof item !== 'object') return errorResponse(400, 'Messages must contain plain text and supported roles only.');
    const entry = item as Record<string, unknown>;
    if (!['system', 'user', 'assistant'].includes(String(entry.role)) || typeof entry.content !== 'string' || entry.content.length > 12_000) {
      return errorResponse(400, 'Messages must contain plain text and supported roles only.');
    }
    characters += entry.content.length;
    if (characters > 30_000) return errorResponse(413, 'This demo supports up to 30,000 prompt characters per request.');
    messages.push({ role: entry.role as 'system' | 'user' | 'assistant', content: entry.content });
  }

  try {
    const upstream = await fetch(`${OPENROUTER_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 800,
        temperature: typeof source.temperature === 'number' ? Math.min(1, Math.max(0, source.temperature)) : 0.7
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(30_000)
    });
    if (!upstream.ok) {
      if (upstream.status === 429) return errorResponse(429, 'OpenRouter free-model capacity is busy. Try again shortly.');
      return errorResponse(upstream.status >= 500 ? 502 : upstream.status, 'OpenRouter could not complete this request.');
    }
    const result = await upstream.json();
    return Response.json(result, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return errorResponse(isTimeout ? 504 : 503, 'Hosted inference is temporarily unavailable.');
  }
}

Deno.serve(withSupabase({ auth: 'user' }, async (request, context) => {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins().has(origin)) return errorResponse(403, 'This origin is not allowed.');
  const userId = context.userClaims?.id;
  if (!userId) return errorResponse(401, 'Sign in to use hosted inference.');

  const limited = await checkLimits(userId, request);
  if (limited) return limited;

  let payload: unknown;
  try { payload = await readPayload(request); }
  catch (error) { return errorResponse(400, error instanceof Error ? error.message : 'Invalid request.'); }
  if (!payload || typeof payload !== 'object') return errorResponse(400, 'Invalid inference request.');
  const input = payload as Record<string, unknown>;
  const path = input.path;
  const method = input.method;
  if (typeof path !== 'string' || !path.startsWith('/') || typeof method !== 'string') return errorResponse(400, 'Invalid inference route.');

  if (method === 'GET' && path === '/providers') {
    return Response.json({
      connections: [{ id: 'openrouter', baseUrl: OPENROUTER_URL, model: FREE_MODEL, hasKey: Boolean(Deno.env.get('OPENROUTER_API_KEY')?.trim()) }],
      preferredProvider: 'openrouter',
      gatewayKeyConfigured: false
    }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (method === 'GET' && path === '/runtime') {
    return Response.json({ checkedAt: new Date().toISOString(), server: 'responding', services: [
      { id: 'openrouter', label: 'OpenRouter Free Demo', status: Deno.env.get('OPENROUTER_API_KEY')?.trim() ? 'configured' : 'unavailable', latencyMs: 0 }
    ] }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (method === 'GET' && path === '/providers/openrouter/models') return await openRouterModels();
  if (method === 'POST' && path === '/chat/completions') return await chatCompletion(input.body);
  return errorResponse(404, 'Hosted inference endpoint not found.');
}));
