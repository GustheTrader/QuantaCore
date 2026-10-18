import express from 'express';
import type { RsiManager } from './rsi-manager';
import { createInferenceRouters } from './inference-router';

export function createRsiRouter(manager: RsiManager) {
  const router = express.Router();
  const gateway = createInferenceRouters(manager.store, manager).openai;
  router.use('/gateway', (req, res, next) => {
    if (!manager.researchAuthorized(req)) return res.status(403).json({ error: { message: 'Active RSI worker authorization required.' } }); next();
  }, gateway);
  router.use((req, res, next) => {
    const origin = req.get('origin');
    res.setHeader('Cache-Control', 'no-store');
    if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(req.hostname) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') || req.get('X-Quanta-Client') !== 'local-ui' || (origin && origin !== `${req.protocol}://${req.get('host')}`)) return res.status(403).json({ error: { message: 'Local Quanta operator access required.' } });
    next();
  });
  const route = (fn: (req: any, res: any) => any) => async (req: any, res: any) => { try { await fn(req, res); } catch (e: any) { res.status(e.status || 500).json({ error: { message: e.status ? e.message : 'RSI operation failed. Inspect local experiment evidence.' } }); } };
  router.get('/status', route(async (req, res) => res.json(await manager.status(req.query.refresh === '1'))));
  router.post('/estimate', route(async (req, res) => res.json(await manager.estimate(req.body))));
  router.post('/runs', route(async (req, res) => res.status(202).json(await manager.start(req.body.reviewId, req.body.approved))));
  router.get('/runs', route((_req, res) => res.json(manager.list())));
  router.get('/runs/:id', route((req, res) => res.json(manager.get(req.params.id))));
  router.get('/runs/:id/events', route((req, res) => res.json(manager.events(req.params.id, Number(req.query.after) || 0))));
  router.post('/runs/:id/cancel', route((req, res) => res.json(manager.cancel(req.params.id))));
  router.post('/runs/:id/review', route(async (req, res) => res.json(await manager.review(req.params.id, req.body.decision, req.body.note))));
  router.get('/runs/:id/artifact', route((req, res) => { res.setHeader('Content-Disposition', `attachment; filename="quanta-rsi-${req.params.id}.json"`); res.json(manager.artifact(req.params.id)); }));
  router.get('/runs/:id/export', route((req, res) => { res.setHeader('Content-Disposition', `attachment; filename="quanta-rsi-evidence-${req.params.id}.json"`); res.json({ run: manager.get(req.params.id), events: manager.events(req.params.id, 0, 0) }); }));
  router.post('/replay', route(async (_req, res) => res.json(await manager.replay())));
  return router;
}
