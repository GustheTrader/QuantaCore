import express, { type Request, type Response } from 'express';
import { ProviderStore } from './provider-store';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const HARNESS_ROUTER_ORIGIN = 'http://127.0.0.1:3100';
const HARNESS_ROUTER_API = `${HARNESS_ROUTER_ORIGIN}/api/harness`;

function error(res: Response, status: number, message: string) {
  return res.status(status).json({ error: { message } });
}

async function callRouter(path: string, apiKey?: string, init: RequestInit = {}, timeoutMs = 4000) {
  return fetch(`${HARNESS_ROUTER_API}${path}`, {
    ...init,
    headers: {
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      ...(init.headers || {})
    },
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs)
  });
}

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text.slice(0, 16000);
  const chunks = Array.isArray(payload?.output) ? payload.output.flatMap((item: any) =>
    Array.isArray(item?.content) ? item.content.filter((part: any) => typeof part?.text === 'string').map((part: any) => part.text) : []
  ) : [];
  return chunks.join('\n').slice(0, 16000);
}

function requireLocalUi(req: Request, res: Response, next: (error?: unknown) => void) {
  const origin = req.get('origin');
  if (!LOCAL_HOSTS.has(req.hostname) || req.get('X-Quanta-Client') !== 'local-ui') {
    return error(res, 403, 'Local QuantaCore access required.');
  }
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) {
    return error(res, 403, 'Cross-origin settings access denied.');
  }
  next();
}

export function createHarnessRouterApi(store: ProviderStore) {
  const router = express.Router();
  router.use(requireLocalUi);

  router.get('/status', async (_req, res) => {
    try {
      const response = await callRouter('/v1/uhp');
      if (!response.ok) {
        await response.body?.cancel();
        return res.json({ reachable: false, version: null, apiKeyConfigured: Boolean(await store.harnessRouterKey()) });
      }
      const discovery: any = await response.json();
      const version = discovery?.implementation?.version || discovery?.version || null;
      res.set('Cache-Control', 'no-store').json({
        reachable: true,
        version: typeof version === 'string' ? version.slice(0, 80) : null,
        apiKeyConfigured: Boolean(await store.harnessRouterKey())
      });
    } catch {
      res.set('Cache-Control', 'no-store').json({ reachable: false, version: null, apiKeyConfigured: Boolean(await store.harnessRouterKey()) });
    }
  });

  router.get('/capabilities', async (_req, res) => {
    const apiKey = await store.harnessRouterKey();
    if (!apiKey) return error(res, 409, 'Add a HarnessRouter API key before loading its catalog.');
    try {
      const [modelsResponse, basesResponse] = await Promise.all([
        callRouter('/v1/models', apiKey),
        callRouter('/v1/bases', apiKey)
      ]);
      const failedResponse = !modelsResponse.ok ? modelsResponse : !basesResponse.ok ? basesResponse : null;
      if (failedResponse) {
        await Promise.all([modelsResponse.body?.cancel(), basesResponse.body?.cancel()]);
        return error(res, failedResponse.status === 401 || failedResponse.status === 403 ? 401 : 502,
          failedResponse.status === 401 || failedResponse.status === 403 ? 'HarnessRouter rejected the saved API key.' : 'HarnessRouter capability catalog is unavailable.');
      }
      const [payload, basesPayload]: [any, any] = await Promise.all([modelsResponse.json(), basesResponse.json()]);
      const models = Object.entries(payload?.backends || {}).flatMap(([backend, value]: [string, any]) =>
        (Array.isArray(value?.models) ? value.models : []).filter((model: any) => model?.id).map((model: any) => ({
          backend: backend.slice(0, 80),
          id: String(model.id).slice(0, 200),
          available: model.available !== false
        }))
      ).slice(0, 500);
      const bases = (Array.isArray(basesPayload?.bases) ? basesPayload.bases : []).slice(0, 100).map((base: any) => ({
        id: String(base?.id || '').slice(0, 120),
        label: String(base?.label || base?.id || 'Unknown harness').slice(0, 120),
        backend: String(base?.backend || '').slice(0, 80),
        status: String(base?.status || 'unknown').slice(0, 40),
        tools: (Array.isArray(base?.tools) ? base.tools : []).map((tool: any) => String(tool?.name || '')).filter(Boolean).slice(0, 40)
      })).filter((base: any) => base.id);
      res.set('Cache-Control', 'no-store').json({ models, bases });
    } catch (cause: any) {
      error(res, 502, cause?.name === 'TimeoutError' ? 'HarnessRouter model catalog timed out.' : 'HarnessRouter model catalog could not be reached.');
    }
  });

  router.post('/run', async (req, res) => {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const harnessId = typeof req.body?.harnessId === 'string' ? req.body.harnessId.trim() : '';
    const modelId = typeof req.body?.modelId === 'string' ? req.body.modelId.trim() : '';
    const requestId = typeof req.body?.requestId === 'string' ? req.body.requestId : '';
    if (!prompt || prompt.length > 3000 || !harnessId || harnessId.length > 160 || !modelId || modelId.length > 200 || !/^[0-9a-f-]{36}$/i.test(requestId)) {
      return error(res, 400, 'Provide a prompt up to 3,000 characters, a listed harness and model, and a valid request ID.');
    }

    const apiKey = await store.harnessRouterKey();
    if (!apiKey) return error(res, 409, 'Add a HarnessRouter API key before starting a test run.');
    try {
      const [modelsResponse, basesResponse] = await Promise.all([
        callRouter('/v1/models', apiKey),
        callRouter('/v1/bases', apiKey)
      ]);
      if (!modelsResponse.ok || !basesResponse.ok) {
        await Promise.all([modelsResponse.body?.cancel(), basesResponse.body?.cancel()]);
        return error(res, 502, 'Could not verify the selected harness and model against the live catalog.');
      }
      const [modelsPayload, basesPayload]: [any, any] = await Promise.all([modelsResponse.json(), basesResponse.json()]);
      const model = Object.values(modelsPayload?.backends || {}).flatMap((backend: any) => Array.isArray(backend?.models) ? backend.models : [])
        .find((candidate: any) => candidate?.id === modelId && candidate?.available !== false);
      const base = (Array.isArray(basesPayload?.bases) ? basesPayload.bases : []).find((candidate: any) =>
        candidate?.id === harnessId && !['disabled', 'unavailable', 'error'].includes(String(candidate?.status || '').toLowerCase())
      );
      if (!model || !base) return error(res, 400, 'The selected harness or model is not currently available. Refresh the catalog and try again.');

      const upstream = await callRouter('/v1/responses', apiKey, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': requestId },
        body: JSON.stringify({
          input: prompt,
          model: modelId,
          metadata: { harness_id: harnessId, quanta_test_run: true },
          instructions: 'This is a bounded test run. Use only the configured tools and read-only data for this harness. Do not place trades, move money, purchase, send messages, deploy, or modify external systems. If a requested action would do so, stop and describe what approval would be needed.',
          max_output_tokens: 512,
          max_step: 2,
          timeout_seconds: 45,
          store: false
        })
      }, 55000);
      if (!upstream.ok) {
        await upstream.body?.cancel();
        return error(res, upstream.status === 401 || upstream.status === 403 ? 401 : upstream.status === 429 ? 429 : 502,
          upstream.status === 401 || upstream.status === 403 ? 'HarnessRouter rejected the saved API key.' : upstream.status === 429 ? 'HarnessRouter is rate limiting test runs. Try again shortly.' : 'HarnessRouter could not complete this test run.');
      }
      const result: any = await upstream.json();
      res.set('Cache-Control', 'no-store').json({
        responseId: typeof result?.id === 'string' ? result.id.slice(0, 160) : null,
        status: typeof result?.status === 'string' ? result.status.slice(0, 40) : 'unknown',
        harnessId: String(result?.metadata?.harness_id || harnessId).slice(0, 160),
        requestedModel: modelId,
        servedModel: String(result?.model || '').slice(0, 200) || null,
        modelFallback: result?.metadata?.model_fallback === true,
        outputText: extractOutputText(result)
      });
    } catch (cause: any) {
      error(res, cause?.name === 'TimeoutError' ? 504 : 502, cause?.name === 'TimeoutError' ? 'HarnessRouter test run timed out.' : 'HarnessRouter test run could not be reached.');
    }
  });

  router.put('/credential', async (req, res) => {
    const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
    if (!apiKey || apiKey.length > 4096 || /[\r\n]/.test(apiKey)) return error(res, 400, 'Enter a valid HarnessRouter API key.');
    try {
      const response = await callRouter('/v1/models', apiKey);
      if (!response.ok) {
        await response.body?.cancel();
        return error(res, response.status === 401 || response.status === 403 ? 401 : 502,
          response.status === 401 || response.status === 403 ? 'HarnessRouter rejected that API key; it was not saved.' : 'Could not validate the key against the local HarnessRouter instance.');
      }
      await response.body?.cancel();
      await store.setHarnessRouterKey(apiKey);
      res.set('Cache-Control', 'no-store').json({ configured: true });
    } catch (cause: any) {
      error(res, 502, cause?.name === 'TimeoutError' ? 'HarnessRouter validation timed out; the key was not saved.' : 'Could not validate the key against the local HarnessRouter instance.');
    }
  });

  router.delete('/credential', async (_req, res) => {
    await store.setHarnessRouterKey('');
    res.set('Cache-Control', 'no-store').json({ configured: false });
  });

  return router;
}
