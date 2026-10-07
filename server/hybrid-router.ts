import express from 'express';
import type { HybridManager } from './hybrid-manager';

export function createHybridRouter(manager: HybridManager) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(req.hostname) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') || req.get('X-Quanta-Client') !== 'local-ui' || (origin && origin !== `http://${req.get('host')}`)) {
      res.status(403).json({ error: { message: 'Use the local Quanta Hybrid Cloud panel.' } }); return;
    }
    next();
  });
  const handle = (fn: (req: express.Request) => Promise<unknown>) => async (req: express.Request, res: express.Response) => {
    try { res.json(await fn(req)); } catch (error: any) { res.status(error.status || 500).json({ error: { message: error.status ? error.message : 'Local hybrid operation failed. Check the local server.' } }); }
  };
  router.get('/status', handle(() => manager.view()));
  router.put('/connections/:domain/:provider', handle(req => manager.configure(req.params.domain, req.params.provider, req.body)));
  router.post('/connections/:domain/:provider/check', handle(req => manager.authenticate(req.params.domain, req.params.provider)));
  router.get('/connections/:domain/:provider/models', handle(req => manager.catalog(req.params.domain, req.params.provider)));
  router.post('/jobs', handle(req => manager.draft(req.body, req.get('Idempotency-Key'))));
  router.post('/jobs/:id/approve', handle(req => manager.approve(String(req.params.id), req.body)));
  router.post('/jobs/:id/run', handle(req => manager.run(String(req.params.id))));
  router.post('/jobs/:id/poll', handle(req => manager.poll(String(req.params.id))));
  router.post('/jobs/:id/cancel', handle(req => manager.cancel(String(req.params.id))));
  router.post('/jobs/:id/evaluate', handle(req => manager.evaluate(String(req.params.id), req.body)));
  router.post('/jobs/:id/promote', handle(req => manager.promote(String(req.params.id), req.body.approvePromotion)));
  router.post('/registry/:domain/rollback', handle(req => manager.rollback(req.params.domain)));
  return router;
}
