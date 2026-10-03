import express from 'express';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import path from 'node:path';

// Local, single-owner bridge. No provider or owner credentials enter the UI.
export function createOpenDotsRouter(root: string) {
  const router = express.Router();
  const file = path.join(root, '.quanta', 'opendots-bindings.json');
  let bindings: Record<string, string> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  let mutation = Promise.resolve();
  router.use((req, res, next) => {
    const origin = req.get('origin');
    const expected = `http://${req.get('host')}`;
    const host = req.hostname;
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(host) || req.get('X-Quanta-Client') !== 'local-ui' || (origin && origin !== expected) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')) {
      res.status(403).json({ error: 'OpenDots bridge is available to the local operator only.' }); return;
    }
    next();
  });
  function runtime(mode: string) {
    if (mode !== 'docker' && mode !== 'cloud') throw new Error('Choose Docker or cloud.');
    if (mode === 'docker') {
      const envPath = 'C:\\QuantaOpenDots\\.env';
      const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
      if (!env.OWNER_TOKEN) throw new Error('OpenDots local owner token is not configured.');
      return { url: 'http://127.0.0.1:4310', token: env.OWNER_TOKEN };
    }
    const url = process.env.OPENDOTS_CLOUD_URL || '';
    const token = process.env.OPENDOTS_CLOUD_OWNER_TOKEN || '';
    if (!url || !token) throw new Error('Cloud OpenDots requires OPENDOTS_CLOUD_URL and OPENDOTS_CLOUD_OWNER_TOKEN in the server environment.');
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/') throw new Error('Cloud OpenDots must use an HTTPS origin without embedded credentials.');
    return { url: parsed.origin, token };
  }
  async function upstream(mode: string, endpoint: string, method = 'GET', body?: unknown) {
    const config = runtime(mode);
    const response = await fetch(config.url + '/api' + endpoint, {
      method, redirect: 'error', signal: AbortSignal.timeout(12000),
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (!response.ok) throw new Error(`OpenDots returned ${response.status}. Check its owner token and setup.`);
    return response.json();
  }
  router.get('/status', async (req, res) => {
    const mode = String(req.query.mode || 'docker');
    try {
      const workspace = await upstream(mode, '/workspace');
      res.json({ reachable: true, mode, setup: workspace.setup, count: workspace.dots?.length || 0, bindings });
    } catch (error) { res.json({ reachable: false, mode, error: (error as Error).message, bindings }); }
  });
  router.post('/companion', async (req, res) => {
    const { mode, agentId, name, role } = req.body || {};
    if (!['docker', 'cloud'].includes(mode) || typeof agentId !== 'string' || !/^[a-zA-Z0-9_/-]{1,100}$/.test(agentId) || typeof name !== 'string' || !name.trim() || name.length > 40 || typeof role !== 'string' || role.length > 1800) {
      res.status(400).json({ error: 'Provide a valid agent identity, name and role.' }); return;
    }
    const key = `${mode}:${agentId}`;
    const operation = mutation.then(async () => {
      if (!bindings[key]) {
        const space = await upstream(mode, '/spaces', 'POST', { name: name + ' KB', description: 'Private companion workspace. Quanta KB contents are not copied automatically.' });
        const dot = await upstream(mode, '/dots', 'POST', { spaceId: space.id, name, instructions: role || 'Assist the operator with this specialist role. Request approval for external actions.', researchAllowed: false, memoryAllowed: false });
        bindings[key] = dot.id;
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, JSON.stringify(bindings, null, 2));
      }
      return { dotId: bindings[key], consoleUrl: runtime(mode).url, computer: await upstream(mode, `/dots/${encodeURIComponent(bindings[key])}/computer`) };
    });
    mutation = operation.then(() => undefined, () => undefined);
    try { res.json(await operation); }
    catch (error) { res.status(502).json({ error: (error as Error).message }); }
  });
  return router;
}
