import { withSupabase } from 'npm:@supabase/server@1.9.1';
import { Ratelimit } from 'npm:@upstash/ratelimit@^2';
import { Redis } from 'npm:@upstash/redis@^1';
import { HindsightClient } from 'npm:@vectorize-io/hindsight-client@0.10.1';
import { Honcho } from 'npm:@honcho-ai/sdk@2.5.1';
import { handleMemoryAction } from '../_shared/memory-governance.ts';
import { SupabaseMemoryStore } from '../_shared/memory-supabase-store.ts';
import { createMemoryIndexes } from '../_shared/memory-indexes.ts';
import { memoryPatternCount } from '../_shared/memory-defense.ts';

const DEFAULT_ORIGINS = ['https://quanta-core.vercel.app', 'http://127.0.0.1:3000', 'http://localhost:3000'];
type Limiters = { minute: Ratelimit; day: Ratelimit; globalDay: Ratelimit };
let limiters: Limiters | undefined;
function errorResponse(status: number, message: string) {
  return Response.json({ error: { message } }, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
function allowedOrigins() {
  const configured = Deno.env.get('QUANTA_ALLOWED_ORIGINS')?.split(',').map(value => value.trim()).filter(Boolean);
  return new Set(configured?.length ? configured : DEFAULT_ORIGINS);
}
function readLimiters(): Limiters {
  if (limiters) return limiters;
  const url = Deno.env.get('UPSTASH_REDIS_REST_URL')?.trim(), token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')?.trim();
  if (!url || !token) throw new Error('Limits unavailable');
  const redis = new Redis({ url, token });
  return limiters = {
    minute: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m'), prefix: 'quanta:memory:user:minute', analytics: false }),
    day: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1 d'), prefix: 'quanta:memory:user:day', analytics: false }),
    globalDay: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(1000, '1 d'), prefix: 'quanta:memory:global:day', analytics: false }),
  };
}
function indexes() {
  return createMemoryIndexes({
    hindsightHttp: async (method, route, signal) => {
      const key = Deno.env.get('HINDSIGHT_API_KEY')?.trim(); if (!key) throw new Error('Hindsight is not configured');
      const base = (Deno.env.get('HINDSIGHT_BASE_URL') || 'https://api.hindsight.vectorize.io').replace(/\/$/, '');
      const response = await fetch(new URL(route, base), { method, headers: { Authorization: `Bearer ${key}` }, redirect: 'error', signal });
      let data: any; if (method === 'GET') { try { data = await response.json(); } catch {} } else await response.body?.cancel();
      return { status: response.status, data };
    },
    hindsight: async () => {
      const key = Deno.env.get('HINDSIGHT_API_KEY')?.trim();
      return key ? new HindsightClient({ baseUrl: (Deno.env.get('HINDSIGHT_BASE_URL') || 'https://api.hindsight.vectorize.io').replace(/\/$/, ''), apiKey: key }) : null;
    },
    honcho: async () => {
      const key = Deno.env.get('HONCHO_API_KEY')?.trim();
      return key ? new Honcho({ baseURL: (Deno.env.get('HONCHO_BASE_URL') || 'https://api.honcho.dev').replace(/\/$/, ''), apiKey: key, workspaceId: Deno.env.get('HONCHO_WORKSPACE_ID') || 'quanta-core' }) : null;
    },
  });
}
Deno.serve(withSupabase({ auth: 'user' }, async (request, context) => {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins().has(origin)) return errorResponse(403, 'This origin is not allowed.');
  const owner = context.userClaims?.id;
  if (!owner) return errorResponse(401, 'Sign in to use hosted memory.');
  try {
    const limits = readLimiters();
    const checks = await Promise.all([limits.minute.limit(`user:${owner}`), limits.day.limit(`user:${owner}`), limits.globalDay.limit('all-users')]);
    if (checks.some(check => !check.success)) return Response.json({ error: { message: 'Memory request limit reached. Try again later.' } }, { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((Math.max(...checks.map(check => check.reset)) - Date.now()) / 1000))), 'Cache-Control': 'no-store' } });
  } catch { return errorResponse(503, 'Hosted memory request limits are not configured.'); }
  let payload: Record<string, any>;
  try {
    const raw = await request.text(); if (raw.length > 1000000) return errorResponse(413, 'Memory request is too large.');
    payload = JSON.parse(raw); if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new Error('Invalid body');
  } catch { return errorResponse(400, 'Request body must be valid JSON.'); }
  if (payload.action === 'status') {
    const { error } = await context.supabaseAdmin.from('quanta_memory_banks_v2').select('id').eq('owner_id', owner).limit(1);
    return Response.json({ checkedAt: new Date().toISOString(), persistence: 'hosted', admissionSchema: 'quanta-memory-v2', patternCount: memoryPatternCount, legacyMigrationRequired: true, services: [
      { id: 'ledger', status: error ? 'unavailable' : 'responding', latencyMs: 0 },
      { id: 'hindsight', status: Deno.env.get('HINDSIGHT_API_KEY')?.trim() ? 'configured' : 'unavailable', latencyMs: 0 },
      { id: 'honcho', status: Deno.env.get('HONCHO_API_KEY')?.trim() ? 'configured' : 'unavailable', latencyMs: 0 },
    ] }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  try {
    const result = await handleMemoryAction(new SupabaseMemoryStore(context.supabaseAdmin), indexes(), owner, String(payload.action || ''), payload);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error: any) { return errorResponse(error.status || 503, error.status ? error.message : 'Hosted memory service unavailable.'); }
}));
