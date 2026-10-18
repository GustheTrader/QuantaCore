import express, { type Response } from 'express';
import { LocalMemoryStore } from './memory-store';
import { handleMemoryAction } from '../supabase/functions/_shared/memory-governance';
import { createMemoryIndexes } from '../supabase/functions/_shared/memory-indexes';
import { memoryPatternCount } from '../supabase/functions/_shared/memory-defense';

const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const errorResponse = (res: Response, error: any) => res.status(error.status || 503).json({ error: { message: error.status ? error.message : 'Memory service unavailable.' } });
let hindsightClient: any, honchoClient: any;
async function getHindsightClient() {
  if (!hindsightClient) {
    const { HindsightClient } = await import('@vectorize-io/hindsight-client');
    hindsightClient = new HindsightClient({ baseUrl: process.env.HINDSIGHT_BASE_URL || 'http://127.0.0.1:8888', ...(process.env.HINDSIGHT_API_KEY ? { apiKey: process.env.HINDSIGHT_API_KEY } : {}) });
  }
  return hindsightClient;
}
async function getHonchoClient() {
  if (!honchoClient) {
    const { Honcho } = await import('@honcho-ai/sdk');
    honchoClient = new Honcho({ baseURL: process.env.HONCHO_BASE_URL || process.env.HONCHO_API_URL || 'http://127.0.0.1:8000', workspaceId: process.env.HONCHO_WORKSPACE_ID || 'quanta-core', ...(process.env.HONCHO_API_KEY ? { apiKey: process.env.HONCHO_API_KEY } : {}) });
  }
  return honchoClient;
}
async function serviceStatus(id: 'hindsight' | 'honcho', url: string) {
  const started = Date.now();
  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(1800) }); await response.body?.cancel();
    return { id, status: response.ok ? 'responding' : response.status === 401 || response.status === 403 ? 'authentication-required' : 'error', latencyMs: Date.now() - started };
  } catch { return { id, status: 'unavailable', latencyMs: Date.now() - started }; }
}
export function createMemoryRouter(root = process.cwd()) {
  const router = express.Router();
  let store: LocalMemoryStore | null = null;
  try { store = new LocalMemoryStore(root); } catch { /* Keep the app available while private memory fails closed. */ }
  const indexes = createMemoryIndexes({ hindsight: getHindsightClient, honcho: getHonchoClient, hindsightHttp: async (method, route, signal) => {
    const base = (process.env.HINDSIGHT_BASE_URL || 'http://127.0.0.1:8888').replace(/\/$/, '');
    const response = await fetch(new URL(route, base), { method, headers: process.env.HINDSIGHT_API_KEY ? { Authorization: `Bearer ${process.env.HINDSIGHT_API_KEY}` } : {}, redirect: 'error', signal });
    let data: any; if (method === 'GET') { try { data = await response.json(); } catch {} } else await response.body?.cancel();
    return { status: response.status, data };
  } });
  const queues = new Map<string, Promise<unknown>>();
  router.use(async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (!localHosts.has(req.hostname) || req.get('X-Quanta-Client') !== 'local-ui' || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') || (origin && origin !== `${req.protocol}://${req.get('host')}`)) return res.status(403).json({ error: { message: 'Local application access required.' } });
    try {
      // Never accept a caller's owner/email string or an unsigned local source
      // request. Loopback is a network boundary, not a user identity.
      let owner: string | null = null;
      const authorization = req.get('authorization');
      if (authorization) {
        const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!url || !key || !authorization.startsWith('Bearer ')) throw new Error('Invalid identity');
        const endpoint = new URL(url); if (endpoint.protocol !== 'https:') throw new Error('Invalid identity endpoint');
        const response = await fetch(endpoint.origin + '/auth/v1/user', { headers: { Authorization: authorization, apikey: key }, redirect: 'error', signal: AbortSignal.timeout(8000) });
        const user = await response.json(); if (!response.ok || typeof user.id !== 'string') throw new Error('Invalid session');
        owner = user.id;
      }
      if (!owner && req.path !== '/status') return res.status(401).json({ error: { message: 'Sign in to use your private memory bank.' } });
      res.locals.owner = owner; next();
    } catch { res.status(401).json({ error: { message: 'Your memory identity could not be verified. Sign in again.' } }); }
  });
  router.get('/status', async (_req, res) => {
    const [hindsight, honcho] = await Promise.all([
      serviceStatus('hindsight', `${(process.env.HINDSIGHT_BASE_URL || 'http://127.0.0.1:8888').replace(/\/$/, '')}/health`),
      serviceStatus('honcho', `${(process.env.HONCHO_BASE_URL || process.env.HONCHO_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')}/health`),
    ]);
    res.json({ checkedAt: new Date().toISOString(), services: [{ id: 'ledger', status: !store ? 'unavailable' : res.locals.owner ? 'responding' : 'authentication-required', latencyMs: 0 }, hindsight, honcho], persistence: 'local', admissionSchema: 'quanta-memory-v2', patternCount: memoryPatternCount, legacyMigrationRequired: true });
  });
  router.post('/:action', async (req, res) => {
    if (!store) return res.status(503).json({ error: { message: 'Private memory storage is unavailable.' } });
    const owner = res.locals.owner as string;
    const operation = (queues.get(owner) || Promise.resolve()).then(() => handleMemoryAction(store, indexes, owner, req.params.action as string, req.body || {}));
    const tail = operation.then(() => undefined, () => undefined); queues.set(owner, tail);
    try { res.json(await operation); } catch (error) { errorResponse(res, error); }
    finally { if (queues.get(owner) === tail) queues.delete(owner); }
  });
  return router;
}
