import express, { type Request, type Response } from 'express';
import { isLocalHost, isLoopbackSocket, sameOrigin } from './local-access';
import type { ProviderStore } from './provider-store';
import { agentChat, agentDecide } from './composio-agent';

const API = 'https://backend.composio.dev/api/v3';
const SHARED_ID = 'quanta-herb';
const SUPABASE = process.env.QUANTA_SUPABASE_TARGET || 'http://127.0.0.1:8000';
const TOOLKITS: Record<string, string> = { gmail: 'Gmail', googlecalendar: 'Google Calendar', googledrive: 'Google Drive', googlesheets: 'Google Sheets', googledocs: 'Google Docs' };

const sharedAllowed = () => process.env.QUANTA_COMPOSIO_SHARED !== '0';

/** Shared = the owner's single connection. Personal = a Composio user id derived from the signed-in Supabase user, so each person links their own Google account. */
async function resolveUser(req: Request): Promise<{ id: string; scope: 'shared' | 'personal' }> {
  const scope = (req.method === 'GET' ? req.query.scope : req.body?.scope) === 'personal' ? 'personal' : 'shared';
  if (scope === 'shared') {
    if (!sharedAllowed()) throw Object.assign(new Error('The shared account is turned off. Use your personal account.'), { status: 403 });
    return { id: SHARED_ID, scope };
  }
  const token = req.get('x-quanta-user') || '', apikey = req.get('apikey') || '';
  if (!/^Bearer \S+$/.test(token) || !apikey) throw Object.assign(new Error('Sign in to Quanta to use a personal account.'), { status: 401 });
  const response = await fetch(`${SUPABASE}/auth/v1/user`, { headers: { Authorization: token, apikey }, cache: 'no-store', signal: AbortSignal.timeout(10_000) }).catch(() => null);
  const user = response?.ok ? await response.json().catch(() => null) : null;
  if (!user?.id || !/^[0-9a-f-]{36}$/i.test(user.id)) throw Object.assign(new Error('Sign in again to use a personal account.'), { status: 401 });
  return { id: `quanta-u-${user.id}`, scope };
}

const error = (res: Response, status: number, message: string) => res.status(status).json({ error: { message } });

async function composio(path: string, init: RequestInit = {}) {
  const key = process.env.COMPOSIO_API_KEY?.trim();
  if (!key) throw Object.assign(new Error('Composio is not configured.'), { status: 409 });
  const response = await fetch(`${API}${path}`, {
    ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20_000),
    headers: { 'x-api-key': key, 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body?.error?.message || `Composio request failed (HTTP ${response.status}).`), { status: response.status === 401 ? 401 : 502 });
  return body as any;
}

async function authConfigId(toolkit: string) {
  const list = await composio(`/auth_configs?toolkit_slug=${encodeURIComponent(toolkit)}&limit=20`);
  const existing = (list.items || []).find((c: any) => c.toolkit?.slug === toolkit && c.status === 'ENABLED');
  if (existing) return existing.id as string;
  const created = await composio('/auth_configs', { method: 'POST', body: JSON.stringify({ toolkit: { slug: toolkit }, auth_config: { type: 'use_composio_managed_auth' } }) });
  return (created.auth_config?.id || created.id) as string;
}

export function createComposioRouter(store?: ProviderStore) {
  const router = express.Router();
  router.use((req: Request, res, next) => {
    if (!isLocalHost(req.hostname) || !isLoopbackSocket(req) || req.get('X-Quanta-Client') !== 'local-ui' || !sameOrigin(req)) {
      error(res, 403, 'Local QuantaCore access required.'); return;
    }
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    next();
  });

  router.get('/status', async (req, res) => {
    if (!process.env.COMPOSIO_API_KEY) return res.json({ configured: false, apps: [] });
    try {
      const { id, scope } = await resolveUser(req);
      const data = await composio(`/connected_accounts?user_ids=${encodeURIComponent(id)}&limit=100`);
      const apps = Object.entries(TOOLKITS).map(([slug, name]) => {
        const accounts = (data.items || []).filter((a: any) => a.toolkit?.slug === slug);
        const active = accounts.some((a: any) => a.status === 'ACTIVE');
        const pending = !active && accounts.some((a: any) => a.status === 'INITIALIZING' || a.status === 'INITIATED');
        return { slug, name, connected: active, pending };
      });
      res.json({ configured: true, scope, sharedAllowed: sharedAllowed(), apps });
    } catch (cause: any) { error(res, cause.status || 502, cause.message); }
  });

  router.post('/connect', async (req, res) => {
    const toolkit = typeof req.body?.toolkit === 'string' ? req.body.toolkit : '';
    if (!TOOLKITS[toolkit]) return error(res, 400, 'Choose a supported Google app.');
    try {
      const { id } = await resolveUser(req);
      const authConfig = await authConfigId(toolkit);
      const origin = `${req.get('x-forwarded-proto') || 'https'}://${req.get('host')}`;
      const link = await composio('/connected_accounts/link', { method: 'POST', body: JSON.stringify({ auth_config_id: authConfig, user_id: id, callback_url: `${origin}/#/` }) });
      res.json({ url: link.redirect_url });
    } catch (cause: any) { error(res, cause.status || 502, cause.message); }
  });

  router.post('/disconnect', async (req, res) => {
    const toolkit = typeof req.body?.toolkit === 'string' ? req.body.toolkit : '';
    if (!TOOLKITS[toolkit]) return error(res, 400, 'Choose a supported Google app.');
    try {
      const { id } = await resolveUser(req);
      const data = await composio(`/connected_accounts?user_ids=${encodeURIComponent(id)}&toolkit_slugs=${toolkit}&limit=100`);
      for (const account of data.items || []) await composio(`/connected_accounts/${account.id}`, { method: 'DELETE' });
      res.json({ ok: true });
    } catch (cause: any) { error(res, cause.status || 502, cause.message); }
  });

  router.post('/agent', async (req, res) => {
    if (!store) return error(res, 503, 'The agent is not available.');
    try {
      const { id } = await resolveUser(req);
      const body = req.body || {};
      const ctx = { store, composio, userId: id };
      res.json(body.pendingId ? await agentDecide(ctx, body.messages, body.pendingId, body.approve) : await agentChat(ctx, body.messages));
    } catch (cause: any) { error(res, cause.status || 502, cause.message); }
  });

  return router;
}
