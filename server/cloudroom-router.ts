import express from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ProviderStore } from './provider-store';

// Cloudroom has two halves:
// - the GUI (cloudroom-gui), a local app QuantaCore shows on its Cloudroom page, and
// - the core (cloudroom-core), the cloud engine that runs agent sessions, hosted on Zo Computer.
// This router keeps the core's URL and token on this computer (the token is encrypted
// with the other saved keys and never sent to the browser) and checks that both halves answer.

export const DEFAULT_GUI_URL = 'http://127.0.0.1:39886';
const TOKEN_DOMAIN = 'cloud', TOKEN_PROVIDER = 'cloudroom-core';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });

export interface CloudroomConfig { guiUrl: string; coreUrl: string }

// The GUI is shown inside QuantaCore, so it must run on this computer.
export function validGuiUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 200) throw fail('Enter the Cloudroom app address, for example http://127.0.0.1:39886.');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw fail('The Cloudroom app address is not a valid URL.'); }
  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw fail('The Cloudroom app must run on this computer (http://127.0.0.1:PORT).');
  }
  return url.origin;
}

// The core holds a token that can run agents, so it is reached over HTTPS only
// (a Zo private *.zo.computer address or your own proxy), or over loopback for a local test.
export function validCoreUrl(value: unknown): string {
  if (value === '' || value === undefined) return '';
  if (typeof value !== 'string' || value.length > 300) throw fail('Enter the Cloudroom core address.');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw fail('The Cloudroom core address is not a valid URL.'); }
  const loopback = url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
  if ((url.protocol !== 'https:' && !loopback) || url.username || url.password || url.search || url.hash) {
    throw fail('Use an https:// address for the Cloudroom core (for example your Zo service URL).');
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

export function validToken(value: unknown): string {
  if (typeof value !== 'string') throw fail('Enter the Cloudroom core token.');
  const token = value.trim();
  if (token.length < 32 || token.length > 512 || /\s/.test(token)) throw fail('The Cloudroom core token is at least 32 characters with no spaces.');
  return token;
}

type Fetch = typeof fetch;

async function getJson(fetcher: Fetch, url: string, headers: Record<string, string> = {}, timeoutMs = 8000) {
  const response = await fetcher(url, { headers, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  const text = (await response.text()).slice(0, 200_000);
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  return { status: response.status, ok: response.ok, body };
}

// Only the parts of the core's answers the page shows. Never pass raw bodies through.
export function summarizeCore(health: any, capabilities: any, dashboard: any) {
  // capabilities.harnesses is a list of {id, model, models?}.
  const harnesses = Array.isArray(capabilities?.harnesses)
    ? capabilities.harnesses.slice(0, 12).map((value: any) => ({
        id: String(value?.id ?? '').slice(0, 40),
        model: typeof value?.model === 'string' ? value.model.slice(0, 80) : undefined,
        models: Array.isArray(value?.models) ? value.models.slice(0, 20).map((m: any) => String(m?.id ?? m).slice(0, 80)) : []
      }))
    : [];
  const sessions = Array.isArray(dashboard?.sessions) ? dashboard.sessions.length : typeof dashboard?.total === 'number' ? dashboard.total : null;
  return {
    status: typeof health?.status === 'string' ? health.status.slice(0, 40) : 'ok',
    storage: typeof health?.storage?.state === 'string' ? health.storage.state.slice(0, 40) : undefined,
    harnesses,
    sessions
  };
}

export function createCloudroomRouter(store: ProviderStore, root = process.cwd(), fetcher: Fetch = fetch) {
  const router = express.Router();
  const file = path.join(root, '.quanta', 'cloudroom.json');
  let testing = false;

  const readConfig = async (): Promise<CloudroomConfig> => {
    try {
      const saved = JSON.parse(await fs.readFile(file, 'utf8'));
      return { guiUrl: validGuiUrl(saved.guiUrl || DEFAULT_GUI_URL), coreUrl: validCoreUrl(saved.coreUrl || '') };
    } catch (error: any) {
      if (error.code === 'ENOENT') return { guiUrl: DEFAULT_GUI_URL, coreUrl: '' };
      throw fail('Cannot read the saved Cloudroom settings. The file was left in place.', 500);
    }
  };
  const writeConfig = async (config: CloudroomConfig) => {
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const temporary = file + '.tmp';
    await fs.writeFile(temporary, JSON.stringify({ version: 1, ...config }, null, 2), { mode: 0o600 });
    await fs.rename(temporary, file);
  };

  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (!LOOPBACK_HOSTS.has(req.hostname) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') || req.get('X-Quanta-Client') !== 'local-ui' || (origin && origin !== `${req.protocol}://${req.get('host')}`)) {
      return res.status(403).json({ error: { message: 'Local application access required.' } });
    }
    next();
  });
  const handle = (fn: (req: express.Request) => Promise<unknown>) => async (req: express.Request, res: express.Response) => {
    try { res.json(await fn(req)); }
    catch (error: any) { res.status(error.status || 502).json({ error: { message: error.status ? error.message : 'Cloudroom check failed.' } }); }
  };

  const publicConfig = async () => {
    const config = await readConfig();
    return { ...config, hasToken: await store.cloudConfigured(TOKEN_DOMAIN, TOKEN_PROVIDER) };
  };

  router.get('/config', handle(publicConfig));

  router.put('/config', handle(async req => {
    if (testing) throw fail('Wait for the current check to finish.', 409);
    const current = await readConfig();
    const next: CloudroomConfig = {
      guiUrl: req.body?.guiUrl === undefined ? current.guiUrl : validGuiUrl(req.body.guiUrl),
      coreUrl: req.body?.coreUrl === undefined ? current.coreUrl : validCoreUrl(req.body.coreUrl)
    };
    if (req.body?.clearToken === true) await store.setCloudKey(TOKEN_DOMAIN, TOKEN_PROVIDER, '');
    else if (req.body?.token !== undefined && req.body.token !== '') await store.setCloudKey(TOKEN_DOMAIN, TOKEN_PROVIDER, validToken(req.body.token));
    await writeConfig(next);
    return { saved: true, ...(await publicConfig()) };
  }));

  // Is the Cloudroom app running on this computer?
  router.get('/gui', handle(async () => {
    const { guiUrl } = await readConfig();
    try {
      const result = await getJson(fetcher, `${guiUrl}/health`, {}, 3000);
      return { guiUrl, running: result.ok };
    } catch { return { guiUrl, running: false }; }
  }));

  // Does the core on Zo answer with this token?
  router.post('/core/test', handle(async () => {
    if (testing) throw fail('A check is already running.', 409);
    testing = true;
    try {
      const { coreUrl } = await readConfig();
      if (!coreUrl) throw fail('Save the Cloudroom core address first.', 409);
      const token = await store.cloudKey(TOKEN_DOMAIN, TOKEN_PROVIDER);
      if (!token) throw fail('Save the Cloudroom core token first.', 409);
      const auth = { Authorization: `Bearer ${token}` };
      let health;
      try { health = await getJson(fetcher, `${coreUrl}/v1/health`, auth); }
      catch { throw fail('The Cloudroom core did not answer. Check that the Zo service is running and the address is right.', 502); }
      if (health.status === 401) throw fail('The Cloudroom core rejected the token.', 401);
      if (!health.ok) throw fail(`The Cloudroom core answered with status ${health.status}.`, 502);
      const [capabilities, dashboard] = await Promise.all([
        getJson(fetcher, `${coreUrl}/v1/capabilities`, auth).catch(() => null),
        getJson(fetcher, `${coreUrl}/v1/dashboard`, auth).catch(() => null)
      ]);
      return { coreUrl, checkedAt: new Date().toISOString(), ...summarizeCore(health.body, capabilities?.ok ? capabilities.body : null, dashboard?.ok ? dashboard.body : null) };
    } finally { testing = false; }
  }));

  return router;
}
