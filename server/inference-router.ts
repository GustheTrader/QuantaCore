import express, { type Request, type Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getProviderDefinition, isCompatibleProvider, type CompatibleProvider } from '../lib/inference-providers';
import { ProviderStore } from './provider-store';

const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });

function endpoint(id: CompatibleProvider, value: string) {
  const definition = getProviderDefinition(id)!;
  let url: URL;
  try { url = new URL(value || definition.baseUrl); } catch { throw fail('Enter a valid API base URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw fail('Use an HTTP API base URL without credentials, queries, or fragments.');
  if (id === 'local' && !localHosts.has(url.hostname)) throw fail('Ollama Local must use a loopback address. Use OpenAI compatible for a remote server.');
  if (url.protocol === 'http:' && !localHosts.has(url.hostname)) throw fail('Remote inference endpoints must use HTTPS. Loopback servers may use HTTP.');
  if (!definition.editableEndpoint && url.toString().replace(/\/$/, '') !== definition.baseUrl) throw fail('This hosted provider uses its published API endpoint.');
  return url.toString().replace(/\/$/, '');
}

const redactError = (message: string, secret: string) => (secret ? message.split(secret).join('[REDACTED]') : message).slice(0, 500);
const errorResponse = (res: Response, error: any) => res.status(error.status || (error.name === 'AbortError' || error.name === 'TimeoutError' ? 504 : 502)).json({ error: { message: error.message || 'Inference request failed.', type: 'provider_error' } });

export interface InferenceHooks {
  researchAuthorized(req: Request): boolean;
  admit(req: Request, provider: string, model: string, baseUrl: string, body: Record<string, unknown>, controller: AbortController): unknown;
  complete(admission: any, result: any): void;
}
export function createInferenceRouters(store: ProviderStore, hooks?: InferenceHooks) {
  const api = express.Router();
  const openai = express.Router();

  api.use((req, res, next) => {
    const host = req.hostname;
    const origin = req.get('origin');
    if (!localHosts.has(host) || req.get('X-Quanta-Client') !== 'local-ui') return res.status(403).json({ error: { message: 'Local application access required.' } });
    if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: { message: 'Cross-origin settings access denied.' } });
    next();
  });

  api.get('/providers', async (_req, res) => {
    try { res.json(await store.publicConfig()); } catch (error) { errorResponse(res, error); }
  });

  api.get('/runtime', async (_req, res) => {
    const services = [
      { id: 'hindsight', label: 'Gnoesis Neural Core · Hindsight', url: `${process.env.HINDSIGHT_BASE_URL || 'http://127.0.0.1:8888'}/health` },
      { id: 'honcho', label: 'Honcho · Session memory', url: `${process.env.HONCHO_BASE_URL || process.env.HONCHO_API_URL || 'http://127.0.0.1:8000'}/health` },
      { id: 'ollama', label: 'Ollama Local', url: 'http://127.0.0.1:11434/v1/models' },
      { id: 'omniroute', label: 'OmniRoute', url: 'http://127.0.0.1:20128/v1/models' }
    ];
    const checks = await Promise.all(services.map(async service => {
      const start = Date.now();
      try {
        const response = await fetch(service.url, { redirect: 'error', signal: AbortSignal.timeout(2500) });
        await response.body?.cancel();
        return { id: service.id, label: service.label, status: response.ok ? 'responding' : response.status === 401 || response.status === 403 ? 'authentication-required' : 'error', httpStatus: response.status, latencyMs: Date.now() - start };
      } catch { return { id: service.id, label: service.label, status: 'unavailable', latencyMs: Date.now() - start }; }
    }));
    res.json({ checkedAt: new Date().toISOString(), services: checks, server: 'responding' });
  });

  api.put('/providers/:id', async (req, res) => {
    try {
      const id = String(req.params.id);
      if (!isCompatibleProvider(id)) throw fail('Unknown provider.');
      const model = String(req.body.model || '').trim();
      if (model.length > 256) throw fail('Model ID is too long.');
      await store.update(data => {
        const old = data.connections[id] || { baseUrl: getProviderDefinition(id)!.baseUrl, apiKey: '' };
        const baseUrl = endpoint(id, String(req.body.baseUrl || old.baseUrl));
        const apiKey = req.body.clearKey === true ? '' : (typeof req.body.apiKey === 'string' && req.body.apiKey.trim() ? req.body.apiKey.trim() : old.apiKey);
        if (apiKey.length > 4096 || /[\r\n]/.test(apiKey)) throw fail('Invalid API key format.');
        data.connections[id] = { baseUrl, model, apiKey };
      });
      res.json(await store.publicConfig());
    } catch (error) { errorResponse(res, error); }
  });

  api.put('/preferred', async (req, res) => {
    try {
      const provider = String(req.body.provider || '');
      if (provider !== 'gemini' && !isCompatibleProvider(provider)) throw fail('Unknown provider.');
      if (isCompatibleProvider(provider)) {
        const config = await store.connection(provider);
        if (!config.model) throw fail('Save a model ID before choosing this provider for agents.');
        if (getProviderDefinition(provider)!.requiresKey && !config.apiKey) throw fail('Configure this provider\'s API key first.');
      }
      await store.update(data => { data.preferredProvider = provider; });
      res.json({ provider });
    } catch (error) { errorResponse(res, error); }
  });

  api.post('/gateway-key', async (_req, res) => {
    try {
      let key = '';
      await store.update(data => { key = data.gatewayKey ||= `quanta_${randomBytes(32).toString('hex')}`; });
      res.json({ key });
    } catch (error) { errorResponse(res, error); }
  });

  api.get('/providers/:id/models', async (req, res) => {
    try {
      const id = String(req.params.id);
      if (!isCompatibleProvider(id)) throw fail('Unknown provider.');
      const config = await store.connection(id);
      const response = await fetch(`${endpoint(id, config.baseUrl)}/models`, { headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}, redirect: 'error', signal: AbortSignal.timeout(20000) });
      const data = await response.json();
      if (!response.ok) throw fail(redactError(data.error?.message || `Model catalog returned HTTP ${response.status}. Enter a model ID manually if discovery is unsupported.`, config.apiKey), response.status);
      if (!Array.isArray(data.data)) throw fail('This server did not return an OpenAI-compatible model list. Enter the model ID manually.', 502);
      res.json({ data: data.data.filter((model: any) => typeof model.id === 'string').map((model: any) => ({ id: model.id, name: model.name || model.id })) });
    } catch (error) { errorResponse(res, error); }
  });

  async function completion(req: Request, res: Response, gateway: boolean) {
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let admission: unknown;
    let accounted = false;
    try {
      const stored = await store.read();
      let provider = gateway ? stored.preferredProvider : String(req.body.provider || stored.preferredProvider);
      let model = typeof req.body.model === 'string' ? req.body.model : '';
      if (gateway && model.includes('/')) {
        const prefix = model.slice(0, model.indexOf('/'));
        if (isCompatibleProvider(prefix)) { provider = prefix; model = model.slice(prefix.length + 1); }
      }
      if (!isCompatibleProvider(provider)) throw fail('Select a configured OpenAI-compatible provider for this API.');
      const config = await store.connection(provider);
      model ||= config.model;
      if (!model || model.length > 256) throw fail('Configure a model ID for this provider.');
      if (getProviderDefinition(provider)!.requiresKey && !config.apiKey) throw fail('Configure this provider\'s API key in Settings.');
      if (!Array.isArray(req.body.messages) || req.body.messages.length === 0) throw fail('messages must be a non-empty array.');
      const allowed = ['messages', 'stream', 'stream_options', 'parallel_tool_calls', 'temperature', 'top_p', 'max_tokens', 'max_completion_tokens', 'stop', 'tools', 'tool_choice', 'response_format', 'seed', 'reasoning_effort', 'plugins'];
      const body: Record<string, unknown> = { model };
      for (const field of allowed) if (req.body[field] !== undefined) body[field] = req.body[field];
      controller = new AbortController();
      if (req.get('X-Gnoesis-Run')) {
        if (!gateway || !hooks) throw fail('Research gateway accounting is unavailable.', 403);
        admission = hooks.admit(req, provider, model, endpoint(provider, config.baseUrl), body, controller);
      }
      timer = setTimeout(() => controller?.abort(), 180000);
      res.on('close', () => controller?.abort());
      const upstream = await fetch(`${endpoint(provider, config.baseUrl)}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}) }, body: JSON.stringify(body), redirect: 'error', signal: controller.signal });
      if (!upstream.ok) {
        const text = await upstream.text();
        let message = `Provider returned HTTP ${upstream.status}.`;
        try { message = JSON.parse(text).error?.message || message; } catch {}
        throw fail(redactError(message, config.apiKey), upstream.status);
      }
      if (body.stream === true) {
        if (!upstream.body) throw fail('Provider returned an empty stream.', 502);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        await pipeline(Readable.fromWeb(upstream.body as any), res);
      } else {
        const result = await upstream.json();
        hooks?.complete(admission, result); accounted = true;
        res.json(result);
      }
    } catch (error) {
      if (!res.headersSent) errorResponse(res, error);
      else res.end();
    } finally { if (timer) clearTimeout(timer); if (admission && !accounted) hooks?.complete(admission, null); }
  }

  api.post('/chat/completions', (req, res) => completion(req, res, false));

  openai.use(async (req, res, next) => {
    try {
      const key = (await store.read()).gatewayKey;
      const provided = req.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
      const expected = Buffer.from(key);
      const received = Buffer.from(provided);
      const general = !!key && expected.length === received.length && timingSafeEqual(expected, received);
      if (!general && !hooks?.researchAuthorized(req)) return res.status(401).json({ error: { message: 'A scoped local API credential is required.', type: 'authentication_error' } });
      next();
    } catch (error) { errorResponse(res, error); }
  });
  openai.get('/models', async (_req, res) => {
    try {
      const data = await store.publicConfig();
      res.json({ object: 'list', data: data.connections.filter(connection => connection.model && (!getProviderDefinition(connection.id)?.requiresKey || connection.hasKey)).map(connection => ({ id: `${connection.id}/${connection.model}`, object: 'model', created: 0, owned_by: connection.id })) });
    } catch (error) { errorResponse(res, error); }
  });
  openai.post('/chat/completions', (req, res) => completion(req, res, true));
  return { api, openai };
}
