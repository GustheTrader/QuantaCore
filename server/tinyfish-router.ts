import express, { type Response } from 'express';
import { isIP } from 'node:net';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const SEARCH_API = 'https://api.search.tinyfish.ai/';
const FETCH_API = 'https://api.fetch.tinyfish.ai/';

const record = (value: unknown): Record<string, any> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
const error = (res: Response, status: number, message: string) => res.status(status).json({ error: { message } });

function isPublicWebUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
    // Only fetch named public sites. This prevents literal localhost/private IP URLs
    // from being forwarded to the external rendering service.
    if (isIP(host)) return false;
    return true;
  } catch { return false; }
}

async function upstream(url: URL, apiKey: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set('X-API-Key', apiKey);
  return fetch(url, {
    ...init,
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(45_000),
    headers
  });
}

function upstreamError(res: Response, providerResponse: globalThis.Response, service: string) {
  if (providerResponse.status === 401 || providerResponse.status === 403) return error(res, 401, `TinyFish rejected the saved API key. Check TINYFISH_API_KEY in the local .env file.`);
  if (providerResponse.status === 429) return error(res, 429, `TinyFish ${service} is rate limited. Wait briefly before trying again.`);
  return error(res, 502, `TinyFish ${service} failed (HTTP ${providerResponse.status}).`);
}

export function createTinyFishRouter() {
  const router = express.Router();
  router.use((req, res, next) => {
    const origin = req.get('origin');
    if (!LOCAL_HOSTS.has(req.hostname) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') ||
      req.get('X-Quanta-Client') !== 'local-ui' || (origin && origin !== `${req.protocol}://${req.get('host')}`)) {
      error(res, 403, 'Local QuantaCore access required.'); return;
    }
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    next();
  });

  router.get('/status', (_req, res) => res.json({ configured: Boolean(process.env.TINYFISH_API_KEY?.trim()), mode: 'local-server' }));

  router.post('/search', async (req, res) => {
    const apiKey = process.env.TINYFISH_API_KEY?.trim();
    if (!apiKey) return error(res, 409, 'Add TINYFISH_API_KEY to C:\\QuantaCore\\.env, then restart the local server.');
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    const location = typeof req.body?.location === 'string' ? req.body.location.trim().toUpperCase() : 'US';
    const language = typeof req.body?.language === 'string' ? req.body.language.trim().toLowerCase() : 'en';
    if (!query || query.length > 500) return error(res, 400, 'Enter a search query of 1 to 500 characters.');
    if (!/^[A-Z]{2}$/.test(location) || !/^[a-z]{2,5}$/.test(language)) return error(res, 400, 'Use a two-letter country code and a valid language code.');
    const url = new URL(SEARCH_API);
    url.searchParams.set('query', query);
    url.searchParams.set('location', location);
    url.searchParams.set('language', language);
    try {
      const response = await upstream(url, apiKey);
      if (!response.ok) return upstreamError(res, response, 'search');
      const payload = await response.json();
      const root = record(payload);
      const results = Array.isArray(root?.results) ? root.results.slice(0, 20) : [];
      return res.json({ query, totalResults: Number.isFinite(root?.total_results) ? root.total_results : results.length, results });
    } catch (cause: any) {
      return error(res, 502, cause?.name === 'TimeoutError' ? 'TinyFish search timed out.' : 'Could not reach TinyFish Search.');
    }
  });

  router.post('/fetch', async (req, res) => {
    const apiKey = process.env.TINYFISH_API_KEY?.trim();
    if (!apiKey) return error(res, 409, 'Add TINYFISH_API_KEY to C:\\QuantaCore\\.env, then restart the local server.');
    const rawUrls = Array.isArray(req.body?.urls) ? req.body.urls : [req.body?.url];
    const urls = rawUrls.filter((value: unknown) => value !== undefined && value !== null && value !== '');
    if (urls.length < 1 || urls.length > 10 || urls.some((value: unknown) => !isPublicWebUrl(value))) {
      return error(res, 400, 'Provide 1 to 10 public http(s) URLs. Local, private-network, and credential-bearing URLs are not allowed.');
    }
    const format = req.body?.format === 'html' || req.body?.format === 'json' ? req.body.format : 'markdown';
    try {
      const response = await upstream(new URL(FETCH_API), apiKey, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, format, links: true })
      });
      if (!response.ok) return upstreamError(res, response, 'fetch');
      const payload = await response.json();
      const root = record(payload);
      const results = Array.isArray(root?.results) ? root.results.slice(0, urls.length) : [];
      return res.json({ results, errors: Array.isArray(root?.errors) ? root.errors.slice(0, urls.length) : [] });
    } catch (cause: any) {
      return error(res, 502, cause?.name === 'TimeoutError' ? 'TinyFish fetch timed out.' : 'Could not reach TinyFish Fetch.');
    }
  });

  return router;
}
