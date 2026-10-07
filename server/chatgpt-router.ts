import express from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ChatGptPlan } from './chatgpt-plan';

const hash = (value: string) => createHash('sha256').update(value).digest();
export function createChatGptRouter(plan: ChatGptPlan) {
  const api = express.Router();
  const callback = express.Router();
  const transactions = new Map<string, { binding: Buffer; expiresAt: number }>();
  api.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.hostname !== '127.0.0.1' || !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') || req.get('X-Quanta-Client') !== 'local-ui' || (req.get('origin') && req.get('origin') !== `http://${req.get('host')}`)) {
      res.status(403).json({ error: { message: 'Open ChatGPT settings at http://127.0.0.1:3000/hybrid.html' } }); return;
    }
    next();
  });
  const handle = (fn: (req: express.Request, res: express.Response) => Promise<unknown>) => async (req: express.Request, res: express.Response) => {
    try { res.json(await fn(req, res)); } catch (error: any) { res.status(error.status || 502).json({ error: { message: error.status ? error.message : 'ChatGPT connection operation failed; check the local setup' } }); }
  };
  api.get('/status', handle(() => plan.status()));
  api.post('/authorize', handle(async (req, res) => {
    for (const [state, transaction] of transactions) if (transaction.expiresAt < Date.now()) transactions.delete(state);
    if (transactions.size > 10) throw Object.assign(new Error('Too many pending sign-ins'), { status: 429 });
    const attempt = await plan.oauth.begin(req.body?.accountId || undefined);
    const state = new URL(attempt.authorizeUrl).searchParams.get('state')!;
    const binding = randomBytes(32).toString('base64url');
    transactions.set(state, { binding: hash(binding), expiresAt: Date.now() + 600000 });
    res.cookie('quanta_chatgpt_oauth', binding, { httpOnly: true, sameSite: 'lax', path: '/auth/openai', maxAge: 600000 });
    return attempt;
  }));
  api.post('/select', handle(req => plan.oauth.select(req.body?.accountId)));
  api.post('/disconnect', handle(req => plan.oauth.disconnect(req.body?.accountId)));
  api.get('/models', handle(async () => ({ models: await plan.models() })));
  api.put('/route', handle(req => {
    if (typeof req.body?.model !== 'string' || typeof req.body?.businessEnabled !== 'boolean') throw Object.assign(new Error('Select a model and Business permission'), { status: 400 });
    return plan.configure(req.body.model, req.body.businessEnabled);
  }));
  api.post('/test', handle(() => plan.complete([{ role: 'user', content: 'Connection check: reply READY.' }])));
  callback.get('/callback', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const transaction = transactions.get(state);
    const binding = req.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('quanta_chatgpt_oauth='))?.slice('quanta_chatgpt_oauth='.length) || '';
    if (req.hostname !== '127.0.0.1' || !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') || !transaction || transaction.expiresAt < Date.now() || !timingSafeEqual(transaction.binding, hash(binding))) { res.status(400).send('Invalid or expired browser-bound sign-in. Return to the local panel and start again.'); return; }
    transactions.delete(state); res.clearCookie('quanta_chatgpt_oauth', { path: '/auth/openai' });
    try { await plan.oauth.callback(req.query); res.redirect(303, '/hybrid.html?chatgpt=connected'); }
    catch { res.redirect(303, '/hybrid.html?chatgpt=failed'); }
  });
  return { api, callback };
}
