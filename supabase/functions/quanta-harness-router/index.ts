import { withSupabase } from 'npm:@supabase/server@^1';
import { Ratelimit } from 'npm:@upstash/ratelimit@^2';
import { Redis } from 'npm:@upstash/redis@^1';

const DEFAULT_ORIGIN = 'https://quanta-core.vercel.app';
const MAX_BODY_CHARS = 8_000;
const MAX_PROMPT_CHARS = 3_000;
const MAX_OUTPUT_CHARS = 16_000;
const ROUTER_TIMEOUT_MS = 55_000;

type LimiterSet = {
  minute: Ratelimit;
  day: Ratelimit;
  ipMinute: Ratelimit;
  runMinute: Ratelimit;
  runDay: Ratelimit;
};

let limiterSet: LimiterSet | undefined;

function errorResponse(status: number, message: string, headers: HeadersInit = {}) {
  return Response.json({ error: { message } }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
  });
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
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
    minute: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m'), prefix: 'quanta:harness:minute', analytics: false }),
    day: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1 d'), prefix: 'quanta:harness:day', analytics: false }),
    ipMinute: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m'), prefix: 'quanta:harness:ip', analytics: false }),
    runMinute: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 m'), prefix: 'quanta:harness:run-minute', analytics: false }),
    runDay: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 d'), prefix: 'quanta:harness:run-day', analytics: false })
  };
  return limiterSet;
}

async function checkLimits(userId: string, request: Request, isRun: boolean) {
  let limiters: LimiterSet;
  try { limiters = getLimiters(); }
  catch { return errorResponse(503, 'Hosted request limits are not configured.'); }
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  try {
    const checks = await Promise.all([
      limiters.minute.limit(`user:${userId}`),
      limiters.day.limit(`user:${userId}`),
      ...(forwarded ? [limiters.ipMinute.limit(`ip:${forwarded}`)] : []),
      ...(isRun ? [limiters.runMinute.limit(`user:${userId}`), limiters.runDay.limit(`user:${userId}`)] : [])
    ]);
    if (checks.some(check => !check.success)) {
      const reset = Math.max(...checks.map(check => check.reset));
      return errorResponse(429, 'Hosted HarnessRouter test limit reached. Try again later.', {
        'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000)))
      });
    }
    return null;
  } catch {
    return errorResponse(503, 'Hosted request limits are temporarily unavailable.');
  }
}

function routerConfig() {
  const rawBase = Deno.env.get('HARNESS_ROUTER_BASE_URL')?.trim();
  const apiKey = Deno.env.get('HARNESS_ROUTER_API_KEY')?.trim();
  if (!rawBase || !apiKey) return null;
  try {
    const parsed = new URL(rawBase);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return { baseUrl: `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`, apiKey };
  } catch { return null; }
}

function allowedIds(name: string) {
  return new Set((Deno.env.get(name) || '').split(',').map(value => value.trim()).filter(Boolean));
}

async function routerFetch(config: { baseUrl: string; apiKey: string }, path: string, init: RequestInit = {}, timeoutMs = 15_000) {
  return fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${config.apiKey}`, ...(init.headers || {}) },
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs)
  });
}

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text.slice(0, MAX_OUTPUT_CHARS);
  const chunks = Array.isArray(payload?.output) ? payload.output.flatMap((item: any) =>
    Array.isArray(item?.content) ? item.content.filter((part: any) => typeof part?.text === 'string').map((part: any) => part.text) : []
  ) : [];
  return chunks.join('\n').slice(0, MAX_OUTPUT_CHARS);
}

async function readPayload(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) throw new Error('Request body is too large.');
  try { return JSON.parse(raw); }
  catch { throw new Error('Request body must be valid JSON.'); }
}

Deno.serve(withSupabase({ auth: 'user' }, async (request, context) => {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins().has(origin)) return errorResponse(403, 'This origin is not allowed.');
  const userId = context.userClaims?.id;
  if (!userId) return errorResponse(401, 'Sign in to use hosted HarnessRouter.');

  let payload: unknown;
  try { payload = await readPayload(request); }
  catch (cause) { return errorResponse(400, cause instanceof Error ? cause.message : 'Invalid request.'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return errorResponse(400, 'Invalid HarnessRouter request.');
  const input = payload as Record<string, unknown>;
  const action = input.action;
  if (!['status', 'catalog', 'run'].includes(String(action))) return errorResponse(400, 'Choose status, catalog, or run.');
  const isRun = action === 'run';
  const limited = await checkLimits(userId, request, isRun);
  if (limited) return limited;

  const config = routerConfig();
  if (!config) {
    if (action === 'status') return jsonResponse({ reachable: false, version: null, apiKeyConfigured: false, executionEnabled: false });
    return errorResponse(503, 'Hosted HarnessRouter is not configured. Set its HTTPS endpoint and server-side API key first.');
  }
  const allowedHarnesses = allowedIds('HARNESS_ROUTER_ALLOWED_HARNESSES');
  const allowedModels = allowedIds('HARNESS_ROUTER_ALLOWED_MODELS');
  const executionEnabled = allowedHarnesses.size > 0 && allowedModels.size > 0;

  if (action === 'status') {
    try {
      const response = await routerFetch(config, '/v1/uhp');
      if (!response.ok) {
        await response.body?.cancel();
        return jsonResponse({ reachable: false, version: null, apiKeyConfigured: true, executionEnabled });
      }
      const discovery = await response.json() as any;
      const version = discovery?.implementation?.version || discovery?.version || null;
      return jsonResponse({ reachable: true, version: typeof version === 'string' ? version.slice(0, 80) : null, apiKeyConfigured: true, executionEnabled });
    } catch {
      return jsonResponse({ reachable: false, version: null, apiKeyConfigured: true, executionEnabled });
    }
  }

  if (action === 'catalog') {
    try {
      const [modelsResponse, basesResponse] = await Promise.all([
        routerFetch(config, '/v1/models'),
        routerFetch(config, '/v1/bases')
      ]);
      if (!modelsResponse.ok || !basesResponse.ok) {
        await Promise.all([modelsResponse.body?.cancel(), basesResponse.body?.cancel()]);
        return errorResponse(502, 'Hosted HarnessRouter catalog is unavailable.');
      }
      const [modelPayload, basesPayload]: [any, any] = await Promise.all([modelsResponse.json(), basesResponse.json()]);
      const models = Object.entries(modelPayload?.backends || {}).flatMap(([backend, value]: [string, any]) =>
        (Array.isArray(value?.models) ? value.models : []).filter((model: any) => model?.id).map((model: any) => ({
          backend: String(backend).slice(0, 80),
          id: String(model.id).slice(0, 200),
          available: model.available !== false,
          testAllowed: allowedModels.has(String(model.id))
        }))
      ).slice(0, 500);
      const bases = (Array.isArray(basesPayload?.bases) ? basesPayload.bases : []).slice(0, 100).map((base: any) => ({
        id: String(base?.id || '').slice(0, 120),
        label: String(base?.label || base?.id || 'Unknown harness').slice(0, 120),
        backend: String(base?.backend || '').slice(0, 80),
        status: String(base?.status || 'unknown').slice(0, 40),
        tools: (Array.isArray(base?.tools) ? base.tools : []).map((tool: any) => String(tool?.name || '')).filter(Boolean).slice(0, 40),
        testAllowed: allowedHarnesses.has(String(base?.id))
      })).filter((base: any) => base.id);
      return jsonResponse({ models, bases, executionEnabled });
    } catch {
      return errorResponse(502, 'Hosted HarnessRouter catalog could not be reached.');
    }
  }

  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  const harnessId = typeof input.harnessId === 'string' ? input.harnessId.trim() : '';
  const modelId = typeof input.modelId === 'string' ? input.modelId.trim() : '';
  const requestId = typeof input.requestId === 'string' ? input.requestId : '';
  if (!executionEnabled) return errorResponse(503, 'Hosted test runs are disabled until an operator configures allowed read-only harness and model IDs.');
  if (!prompt || prompt.length > MAX_PROMPT_CHARS || !allowedHarnesses.has(harnessId) || !allowedModels.has(modelId) || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return errorResponse(400, 'Choose an allowlisted harness and model, provide a prompt up to 3,000 characters, and use a valid request ID.');
  }

  try {
    const response = await routerFetch(config, '/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId },
      body: JSON.stringify({
        input: prompt,
        model: modelId,
        metadata: { harness_id: harnessId, quanta_test_run: true },
        instructions: 'This is a bounded test run. Use only the configured tools and read-only data for this harness. Do not place trades, move money, purchase, send messages, deploy, or modify external systems. If a requested action would do so, stop and describe what approval would be needed.',
        max_output_tokens: 512,
        max_step: 2,
        timeout_seconds: 45,
        store: false
      })
    }, ROUTER_TIMEOUT_MS);
    if (!response.ok) {
      await response.body?.cancel();
      return errorResponse(response.status === 401 || response.status === 403 ? 401 : response.status === 429 ? 429 : 502,
        response.status === 401 || response.status === 403 ? 'Hosted HarnessRouter rejected its server API key.' : response.status === 429 ? 'Hosted HarnessRouter is rate limiting test runs.' : 'Hosted HarnessRouter could not complete this test run.');
    }
    const result = await response.json() as any;
    return jsonResponse({
      responseId: typeof result?.id === 'string' ? result.id.slice(0, 160) : null,
      status: typeof result?.status === 'string' ? result.status.slice(0, 40) : 'unknown',
      harnessId: String(result?.metadata?.harness_id || harnessId).slice(0, 160),
      requestedModel: modelId,
      servedModel: String(result?.model || '').slice(0, 200) || null,
      modelFallback: result?.metadata?.model_fallback === true,
      outputText: extractOutputText(result)
    });
  } catch (cause) {
    const timeout = cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError');
    return errorResponse(timeout ? 504 : 502, timeout ? 'Hosted HarnessRouter test run timed out.' : 'Hosted HarnessRouter test run could not be reached.');
  }
}));
