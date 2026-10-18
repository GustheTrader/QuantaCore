import express, { type Request, type Response } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ProviderStore } from './provider-store';

// Local Gemini REST proxy. The browser sends Gemini SDK requests here and this server
// adds the protected Google API key, so the key never sits in browser storage where any
// script running on the page could read it.
const UPSTREAM = 'https://generativelanguage.googleapis.com';
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const ALLOWED_PATH = /^\/(v1|v1beta|v1alpha)\/(models|operations|files)\/[A-Za-z0-9._\-\/:]+$/;
const DOWNLOAD_PATH = /^\/(v1|v1beta)\/files\/[A-Za-z0-9._-]+:download$/;

export function geminiLocalAccess(req: Pick<Request, 'hostname' | 'get' | 'method' | 'path'> & { socket: { remoteAddress?: string } }) {
  if (!HOSTS.has(req.hostname) || !LOOPBACK.has(req.socket.remoteAddress || '')) return 'Local QuantaCore access required.';
  const origin = req.get('origin');
  if (origin && origin !== `http://${req.get('host')}`) return 'Cross-origin Gemini access denied.';
  // <video src> cannot send custom headers. Downloads are allowed only for same-origin
  // page loads, which a foreign website cannot fake.
  if (req.method === 'GET' && DOWNLOAD_PATH.test(req.path)) return ['same-origin', 'none'].includes(req.get('sec-fetch-site') || '') ? null : 'Cross-site download denied.';
  return req.get('X-Quanta-Client') === 'local-ui' ? null : 'Local QuantaCore access required.';
}

type TokenFactory = (apiKey: string) => Promise<string>;
// Gemini Live opens a browser WebSocket. Instead of the real key, the browser gets a
// single-use ephemeral token that expires quickly.
const liveToken: TokenFactory = async apiKey => {
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
  const now = Date.now();
  const token = await client.authTokens.create({ config: { uses: 1, expireTime: new Date(now + 30 * 60_000).toISOString(), newSessionExpireTime: new Date(now + 60_000).toISOString(), httpOptions: { apiVersion: 'v1alpha' } } });
  if (!token.name) throw new Error('Gemini returned no token.');
  return token.name;
};

export function createGeminiProxy(store: ProviderStore, request: typeof fetch = fetch, createToken: TokenFactory = liveToken) {
  const router = express.Router();
  router.post('/live-token', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const denied = geminiLocalAccess(req);
    if (denied) return res.status(403).json({ error: { message: denied } });
    let apiKey = '';
    try { apiKey = (await store.connection('google-api')).apiKey; } catch {}
    if (!apiKey) return res.status(409).json({ error: { message: 'Add a Google Gemini API key under Settings → Model connections.' } });
    try { res.json({ token: await createToken(apiKey) }); }
    catch { res.status(502).json({ error: { message: 'Gemini did not issue a Live session token.' } }); }
  });
  router.use(async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const denied = geminiLocalAccess(req);
    if (denied) return res.status(403).json({ error: { message: denied } });
    if (!['GET', 'POST'].includes(req.method) || !ALLOWED_PATH.test(req.path)) return res.status(404).json({ error: { message: 'Unsupported Gemini endpoint.' } });
    let apiKey = '';
    try { apiKey = (await store.connection('google-api')).apiKey; } catch {}
    if (!apiKey) return res.status(409).json({ error: { message: 'Add a Google Gemini API key under Settings → Model connections (Google · Gemini API). It is stored protected on this computer.' } });
    const query = new URLSearchParams(req.query as Record<string, string>);
    query.delete('key');
    const target = `${UPSTREAM}${req.path}${query.size ? `?${query}` : ''}`;
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    try {
      const upstream = await request(target, {
        method: req.method,
        headers: { 'x-goog-api-key': apiKey, ...(req.method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
        ...(req.method === 'POST' ? { body: JSON.stringify(req.body ?? {}) } : {}),
        redirect: 'follow',
        signal: controller.signal
      });
      res.status(upstream.status);
      for (const name of ['content-type', 'content-length', 'content-disposition']) {
        const value = upstream.headers.get(name);
        if (value) res.setHeader(name, value);
      }
      if (!upstream.body) return res.end();
      await pipeline(Readable.fromWeb(upstream.body as any), res);
    } catch (error: any) {
      if (!res.headersSent) res.status(error?.name === 'AbortError' ? 499 : 502).json({ error: { message: 'Gemini could not be reached from this computer.' } });
      else res.end();
    }
  });
  return router;
}
