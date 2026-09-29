import type { Request, Response } from 'express';

const FREE_MODEL = 'openrouter/free';
const BASE_URL = 'https://openrouter.ai/api/v1';
const jsonError = (res: Response, status: number, message: string) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json({ error: { message } });
};

type AuthClient = import('@supabase/supabase-js').SupabaseClient;
type RateLimits = {
  minute: import('@upstash/ratelimit').Ratelimit;
  day: import('@upstash/ratelimit').Ratelimit;
  ipMinute: import('@upstash/ratelimit').Ratelimit;
};
let authClient: AuthClient | undefined;
let limits: RateLimits | undefined;

async function getAuthClient() {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error('Hosted authentication is not configured.');
  const { createClient } = await import('@supabase/supabase-js');
  return authClient ||= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function getRateLimits() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new Error('Hosted request limits are not configured.');
  if (!limits) {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis')
    ]);
    const redis = new Redis({ url, token });
    limits = {
      minute: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m'), prefix: 'quanta:inference:minute', analytics: false }),
      day: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1 d'), prefix: 'quanta:inference:day', analytics: false }),
      ipMinute: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m'), prefix: 'quanta:inference:ip', analytics: false })
    };
  }
  return limits;
}

function header(req: Request, name: string) {
  const value = req.get?.(name) || req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function sameOrigin(req: Request) {
  const origin = header(req, 'origin');
  const host = header(req, 'host');
  if (!origin) return req.method === 'GET';
  if (!host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:' && parsed.host.toLowerCase() === host.toLowerCase();
  } catch { return false; }
}

async function authenticate(req: Request) {
  const bearer = header(req, 'authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer || bearer.length > 4096) return null;
  const client = await getAuthClient();
  const { data, error } = await client.auth.getUser(bearer);
  return error || !data.user ? null : data.user;
}

function configuredModel() {
  const model = process.env.OPENROUTER_MODEL?.trim() || FREE_MODEL;
  if (model !== FREE_MODEL) throw new Error(`Hosted model must remain ${FREE_MODEL}.`);
  if (!process.env.OPENROUTER_API_KEY?.trim()) throw new Error('Hosted inference is not configured.');
  return model;
}

export async function hostedInference(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!sameOrigin(req)) return jsonError(res, 403, 'Same-origin requests are required.');

  let user;
  try { user = await authenticate(req); }
  catch { return jsonError(res, 503, 'Hosted authentication is temporarily unavailable.'); }
  if (!user) return jsonError(res, 401, 'Sign in to use hosted inference.');

  let rateLimits: Awaited<ReturnType<typeof getRateLimits>>;
  try { rateLimits = await getRateLimits(); }
  catch { return jsonError(res, 503, 'Hosted request limits are not configured.'); }

  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(',')[0]?.trim() || 'unknown';
  let minute, day, ipMinute;
  try {
    [minute, day, ipMinute] = await Promise.all([
      rateLimits.minute.limit(`user:${user.id}`),
      rateLimits.day.limit(`user:${user.id}`),
      rateLimits.ipMinute.limit(`ip:${ip}`)
    ]);
  } catch { return jsonError(res, 503, 'Hosted request limits are temporarily unavailable.'); }
  if (!minute.success || !day.success || !ipMinute.success) {
    const reset = Math.max(minute.reset, day.reset, ipMinute.reset);
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))));
    return jsonError(res, 429, 'Demo request limit reached. Try again later.');
  }

  const route = new URL(req.url || '/', 'https://quanta.invalid').pathname.replace(/\/$/, '') || '/';
  if (req.method === 'GET' && route.endsWith('/providers')) {
    return res.json({
      connections: [{ id: 'openrouter', baseUrl: BASE_URL, model: FREE_MODEL, hasKey: Boolean(process.env.OPENROUTER_API_KEY?.trim()) }],
      preferredProvider: 'openrouter',
      gatewayKeyConfigured: false
    });
  }

  if (req.method === 'GET' && route.endsWith('/runtime')) {
    return res.json({ checkedAt: new Date().toISOString(), server: 'responding', services: [
      { id: 'openrouter', label: 'OpenRouter Free Demo', status: process.env.OPENROUTER_API_KEY?.trim() ? 'configured' : 'unavailable', latencyMs: 0 }
    ] });
  }

  if (req.method === 'GET' && route.endsWith('/providers/openrouter/models')) {
    try {
      configuredModel();
      const response = await fetch(`${BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
        redirect: 'error',
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) return jsonError(res, response.status === 429 ? 429 : 502, 'OpenRouter could not return the model catalog.');
      const catalog = await response.json() as { data?: Array<{ id?: string; name?: string }> };
      const models = (catalog.data || []).filter(model => typeof model.id === 'string').map(model => ({ id: model.id, name: model.name || model.id }));
      return res.json({ data: [{ id: FREE_MODEL, name: 'OpenRouter Free Model Router' }, ...models.filter(model => model.id?.endsWith(':free'))] });
    } catch { return jsonError(res, 503, 'OpenRouter is not configured.'); }
  }

  if (req.method !== 'POST' || !route.endsWith('/chat/completions')) return jsonError(res, 404, 'Hosted inference endpoint not found.');

  try {
    const model = configuredModel();
    const body = req.body;
    if (!body || typeof body !== 'object' || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 16) {
      return jsonError(res, 400, 'Provide between 1 and 16 text messages.');
    }
    let characters = 0;
    const messages = [] as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    for (const entry of body.messages) {
      if (!entry || !['system', 'user', 'assistant'].includes(entry.role) || typeof entry.content !== 'string' || entry.content.length > 12000) {
        return jsonError(res, 400, 'Messages must contain plain text and supported roles only.');
      }
      characters += entry.content.length;
      if (characters > 30000) return jsonError(res, 413, 'This demo supports up to 30,000 prompt characters per request.');
      messages.push({ role: entry.role, content: entry.content });
    }
    if (body.stream === true || body.tools !== undefined || body.tool_choice !== undefined || body.plugins !== undefined) {
      return jsonError(res, 400, 'Streaming, tools, and plugins are disabled on the public free demo route.');
    }

    const upstream = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: 800, temperature: typeof body.temperature === 'number' ? Math.min(1, Math.max(0, body.temperature)) : 0.7 }),
      redirect: 'error',
      signal: AbortSignal.timeout(30000)
    });
    if (!upstream.ok) {
      if (upstream.status === 429) return jsonError(res, 429, 'OpenRouter free-model capacity is busy. Try again shortly.');
      return jsonError(res, upstream.status >= 500 ? 502 : upstream.status, 'OpenRouter could not complete this request.');
    }
    const result = await upstream.json();
    return res.status(200).json(result);
  } catch (error: any) {
    return jsonError(res, error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 504 : 503, 'Hosted inference is temporarily unavailable.');
  }
}
