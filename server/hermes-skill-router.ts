import express from 'express';
import { listSkillProposals } from './hermes-skill-bridge';

// Independently mountable read-only slice; it never starts the Hermes gateway.
export function createHermesSkillRouter() {
  const router = express.Router();
  router.get('/:workspace/skill-proposals', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(req.hostname)
      || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')
      || req.get('X-Quanta-Client') !== 'local-ui'
      || (origin && origin !== `${req.protocol}://${req.get('host')}`)) return res.status(403).json({ error: { message: 'Local operator access required.' } });
    try { res.json(listSkillProposals(String(req.params.workspace))); }
    catch { res.status(400).json({ error: { message: 'Cannot read this Hermes profile. Select Work or Personal and preserve its existing files.' } }); }
  });
  return router;
}
