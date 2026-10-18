import express, { type Request, type Response } from 'express';
import Ajv from 'ajv';
import { randomUUID } from 'node:crypto';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const FIRECRAWL_API = 'https://api.firecrawl.dev/v2';
const DISCOVERY_TTL_MS = 15 * 60 * 1000;
const discoveries = new Map<string, { expiresAt: number; capabilities: Map<string, AlexandriaCapability> }>();

type AlexandriaCapability = {
  id: string;
  provider: string;
  capability: string;
  address: string;
  name: string;
  useWhen: string;
  priceCredits: number | null;
  priceLabel: string;
  perRecord: boolean;
  inspected: boolean;
  optionsSchema: Record<string, unknown> | null;
};

const record = (value: unknown): Record<string, any> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
const cleanText = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const error = (res: Response, status: number, message: string) => res.status(status).json({ error: { message } });

function listedCredits(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string') {
    const match = value.match(/\b(\d+(?:\.\d+)?)\s*(?:credits?)?\b/i);
    if (match) return Number(match[1]);
  }
  const object = record(value);
  if (object) return listedCredits(object.credits ?? object.amount ?? object.value);
  return null;
}

function optionsSchema(tool: Record<string, any>): Record<string, unknown> | null {
  const candidate = record(tool.options) || record(tool.inputSchema) || record(tool.input_schema) || record(tool.parameters) || record(tool.inputs);
  if (!candidate && Array.isArray(tool.options)) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const option of tool.options.slice(0, 80)) {
      const field = record(option);
      const name = cleanText(field?.name, 100);
      if (!name) continue;
      const rawType = cleanText(field?.type, 30).toLowerCase();
      const type = rawType === 'int' ? 'integer' : ['string', 'number', 'integer', 'boolean', 'object', 'array'].includes(rawType) ? rawType : 'string';
      const property: Record<string, unknown> = { type };
      if (typeof field?.description === 'string') property.description = cleanText(field.description, 500);
      else if (typeof field?.about === 'string') property.description = cleanText(field.about, 500);
      const patternFromDescription = typeof field?.about === 'string' ? field.about.match(/Pattern:\s*(\^.*?\$)/)?.[1] : undefined;
      if (typeof field?.pattern === 'string') property.pattern = field.pattern.slice(0, 300);
      else if (patternFromDescription) property.pattern = patternFromDescription.slice(0, 300);
      if (typeof field?.min === 'number' && Number.isFinite(field.min)) property[type === 'string' ? 'minLength' : 'minimum'] = field.min;
      if (typeof field?.max === 'number' && Number.isFinite(field.max)) property[type === 'string' ? 'maxLength' : 'maximum'] = field.max;
      if (Array.isArray(field?.enum)) property.enum = field.enum.slice(0, 100);
      properties[name] = property;
      if (field?.required === true) required.push(name);
    }
    return { type: 'object', properties, required, additionalProperties: false };
  }
  if (!candidate) return null;
  try {
    if (JSON.stringify(candidate).length > 48_000) return null;
  } catch { return null; }
  return candidate;
}

function normalizeCapability(tool: unknown): AlexandriaCapability | null {
  const value = record(tool);
  if (!value) return null;
  const address = cleanText(value.address ?? value.id ?? value.path, 300);
  const provider = cleanText(value.provider ?? address.split('/')[0], 100);
  const directCapability = cleanText(value.capability ?? value.path, 220);
  const capability = directCapability && directCapability !== address
    ? directCapability
    : address.startsWith(`${provider}/`) ? address.slice(provider.length + 1) : address;
  if (!provider || !capability || /[\r\n]/.test(provider + capability)) return null;
  const price = value.creditsCost ?? value.credits_cost ?? value.price ?? value.credits ?? value.cost;
  const rawPriceLabel = typeof price === 'string' ? price : typeof price === 'number' ? `${price} credits` : '';
  return {
    id: randomUUID(), provider, capability, address: address || `${provider}/${capability}`,
    name: cleanText(value.name ?? value.title ?? value.label ?? capability, 160) || capability,
    useWhen: cleanText(value.whenToUse ?? value.when_to_use ?? value.description ?? value.summary ?? value.reason, 600),
    priceCredits: listedCredits(price), priceLabel: cleanText(rawPriceLabel, 100),
    perRecord: value.perRecord === true || value.per_record === true,
    inspected: price !== undefined || Array.isArray(value.options) || !!optionsSchema(value),
    optionsSchema: optionsSchema(value)
  };
}

function discoveredTools(payload: unknown): unknown[] {
  const root = record(payload);
  const data = record(root?.data);
  const tools = data?.tools ?? root?.tools ?? data?.capabilities ?? root?.capabilities ?? data?.alexandria ?? root?.alexandria;
  return Array.isArray(tools) ? tools : [];
}

async function firecrawl(path: string, apiKey: string, body: unknown) {
  return fetch(`${FIRECRAWL_API}${path}`, {
    method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25_000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

function reportedCredits(payload: unknown): number | null {
  const seen = new Set<object>();
  const visit = (value: unknown, depth = 0): number | null => {
    if (depth > 6 || !value || typeof value !== 'object' || seen.has(value as object)) return null;
    seen.add(value as object);
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 30)) { const found = visit(item, depth + 1); if (found !== null) return found; }
      return null;
    }
    const object = value as Record<string, unknown>;
    for (const key of ['creditsCost', 'credits_cost', 'creditsUsed', 'credits_used', 'creditsConsumed', 'credits_consumed', 'actualCredits', 'actual_credits']) {
      if (key in object) { const found = listedCredits(object[key]); if (found !== null) return found; }
    }
    for (const [key, child] of Object.entries(object).slice(0, 40)) {
      if (key === 'cost' || key === 'price' || key === 'usage') {
        const found = listedCredits(child); if (found !== null) return found;
      }
    }
    for (const child of Object.values(object).slice(0, 40)) { const found = visit(child, depth + 1); if (found !== null) return found; }
    return null;
  };
  return visit(payload);
}

export function createFirecrawlAlexandriaRouter() {
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

  router.get('/status', (_req, res) => res.json({ configured: Boolean(process.env.FIRECRAWL_API_KEY), mode: 'local-server' }));

  router.post('/discover', async (req, res) => {
    const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
    if (!apiKey) return error(res, 409, 'Add FIRECRAWL_API_KEY to the local server .env file, then restart QuantaCore.');
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!query || query.length > 500) return error(res, 400, 'Enter a discovery query of 1 to 500 characters.');
    try {
      const response = await firecrawl('/search', apiKey, { query, sources: ['alexandria'] });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401 || response.status === 403) return error(res, 401, 'Firecrawl rejected the saved API key. Check the key in the local .env file.');
        if (response.status === 429) return error(res, 429, 'Firecrawl discovery is rate limited. Wait briefly and retry.');
        return error(res, 502, `Firecrawl discovery failed (HTTP ${response.status}).`);
      }
      const payload = await response.json();
      const candidates = discoveredTools(payload).map(normalizeCapability).filter((tool): tool is AlexandriaCapability => !!tool).slice(0, 20);
      const id = randomUUID();
      for (const [key, cached] of discoveries) if (cached.expiresAt <= Date.now()) discoveries.delete(key);
      if (discoveries.size >= 60) discoveries.delete(discoveries.keys().next().value!);
      const capabilityMap = new Map(candidates.map(tool => [tool.id, tool]));
      discoveries.set(id, { expiresAt: Date.now() + DISCOVERY_TTL_MS, capabilities: capabilityMap });
      res.json({ discoveryId: id, query, discoveryCostCredits: 0, expiresInSeconds: DISCOVERY_TTL_MS / 1000,
        capabilities: candidates.map(({ id: capabilityId, provider, capability, address, name, useWhen, priceCredits, priceLabel, optionsSchema: schema }) => ({
          id: capabilityId, provider, capability, address, name, useWhen, priceCredits, priceLabel, optionsSchema: schema
        })) });
    } catch (cause: any) {
      error(res, 502, cause?.name === 'TimeoutError' ? 'Firecrawl discovery timed out.' : 'Could not reach Firecrawl discovery.');
    }
  });

  router.post('/inspect', async (req, res) => {
    const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
    if (!apiKey) return error(res, 409, 'Add FIRECRAWL_API_KEY to the local server .env file, then restart QuantaCore.');
    const discoveryId = typeof req.body?.discoveryId === 'string' ? req.body.discoveryId : '';
    const discovery = discoveries.get(discoveryId);
    if (!discovery || discovery.expiresAt <= Date.now()) {
      discoveries.delete(discoveryId);
      return error(res, 409, 'This discovery has expired. Discover providers again before inspecting tool contracts.');
    }
    const discovered = [...discovery.capabilities.values()];
    if (!discovered.length) return error(res, 409, 'This discovery returned no capabilities to inspect.');
    try {
      const providers = [...new Set(discovered.map(tool => tool.provider))].slice(0, 20);
      const capabilityNames = [...new Set(discovered.map(tool => tool.capability))].slice(0, 40);
      const response = await firecrawl('/scrape', apiKey, { alexandria: { provider: 'firecrawl', capability: 'find-tools', options: {
        providers, capabilities: capabilityNames, level: 'tools', expand: ['options', 'response'], limit: 100
      } } });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401 || response.status === 403) return error(res, 401, 'Firecrawl rejected the saved API key or blocked catalogue access. Check the local key and Alexandria access.');
        if (response.status === 429) return error(res, 429, 'Firecrawl catalogue inspection is rate limited. Wait briefly and retry.');
        return error(res, 502, `Firecrawl contract inspection failed (HTTP ${response.status}).`);
      }
      const payload = await response.json();
      const root = record(payload);
      const data = record(root?.data);
      const alexandriaResult = Array.isArray(root?.alexandria) ? record(root.alexandria[0]) : null;
      const wrappedResult = Array.isArray(data?.alexandria) ? record(data.alexandria[0]) : null;
      const detail = record(alexandriaResult?.data) || record(wrappedResult?.data) || data || root;
      const items = Array.isArray(detail?.items) ? detail.items : [];
      const byKey = new Map<string, Record<string, any>>();
      for (const item of items) {
        const candidate = record(item);
        if (candidate?.provider && candidate?.capability) byKey.set(`${candidate.provider}/${candidate.capability}`, candidate);
      }
      const updated = discovered.flatMap(original => {
        const detail = byKey.get(`${original.provider}/${original.capability}`);
        if (!detail) return [];
        const full = normalizeCapability({ ...detail, address: `${original.provider}/${original.capability}` });
        if (!full) return [];
        const merged = { ...original, name: full.name, useWhen: full.useWhen || original.useWhen,
          priceCredits: full.priceCredits, priceLabel: full.perRecord ? `${full.priceCredits ?? 'Unknown'} credits per record` : `${full.priceCredits ?? 'Unknown'} credits per call`,
          perRecord: full.perRecord, inspected: full.inspected, optionsSchema: full.optionsSchema };
        discovery.capabilities.set(merged.id, merged);
        return [merged];
      });
      res.json({ discoveryId, inspected: true, inspectionCostCredits: 0, capabilities: updated.map(({ id, provider, capability, address, name, useWhen, priceCredits, priceLabel, perRecord, inspected, optionsSchema: schema }) => ({
        id, provider, capability, address, name, useWhen, priceCredits, priceLabel, perRecord, inspected, optionsSchema: schema
      })) });
    } catch (cause: any) {
      error(res, 502, cause?.name === 'TimeoutError' ? 'Firecrawl contract inspection timed out.' : 'Could not reach Firecrawl contract inspection.');
    }
  });

  router.post('/retrieve', async (req, res) => {
    const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
    if (!apiKey) return error(res, 409, 'Add FIRECRAWL_API_KEY to the local server .env file, then restart QuantaCore.');
    const discoveryId = typeof req.body?.discoveryId === 'string' ? req.body.discoveryId : '';
    const capabilityId = typeof req.body?.capabilityId === 'string' ? req.body.capabilityId : '';
    const discovery = discoveries.get(discoveryId);
    if (!discovery || discovery.expiresAt <= Date.now()) {
      discoveries.delete(discoveryId);
      return error(res, 409, 'This discovery has expired. Discover providers again before retrieving data.');
    }
    const capability = discovery.capabilities.get(capabilityId);
    if (!capability) return error(res, 400, 'Choose a capability returned by this discovery before retrieving data.');
    if (!capability.inspected) return error(res, 409, 'Inspect this discovered tool and its live price before retrieval.');
    if (capability.priceCredits === null) return error(res, 409, 'Firecrawl did not provide a verifiable credit price for this capability, so Quanta blocked execution.');
    if (capability.perRecord) return error(res, 409, 'This capability is billed per record. Quanta has blocked it until a maximum total-credit budget can be confirmed.');
    if (typeof req.body?.expectedCredits !== 'number' || req.body.expectedCredits !== capability.priceCredits) {
      return error(res, 409, `Confirm the listed price of ${capability.priceCredits} credits before retrieval.`);
    }
    const options = record(req.body?.options);
    if (!options) return error(res, 400, 'Capability options must be a JSON object.');
    let serializedOptions = '';
    try { serializedOptions = JSON.stringify(options); } catch { return error(res, 400, 'Capability options must be valid JSON.'); }
    if (serializedOptions.length > 24_000) return error(res, 400, 'Capability options exceed the 24 KB request limit.');
    if (capability.optionsSchema) {
      try {
        const validate = new Ajv({ strict: false, allErrors: true }).compile(capability.optionsSchema as any);
        if (!validate(options)) return error(res, 400, `Options do not match the discovered input schema: ${(validate.errors || []).slice(0, 3).map(issue => issue.message).join('; ')}`);
      } catch { return error(res, 409, 'The discovered input schema could not be validated. Run discovery again or choose another capability.'); }
    }
    const requestId = typeof req.body?.requestId === 'string' && /^[0-9a-f-]{36}$/i.test(req.body.requestId) ? req.body.requestId : '';
    if (!requestId) return error(res, 400, 'A valid retrieval request ID is required for safe retries.');
    try {
      const response = await fetch(`${FIRECRAWL_API}/scrape`, {
        method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25_000),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'x-request-id': requestId },
        body: JSON.stringify({ alexandria: { provider: capability.provider, capability: capability.capability, options } })
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401 || response.status === 403) return error(res, 401, 'Firecrawl rejected the saved API key. Check the key in the local .env file.');
        if (response.status === 402) return error(res, 402, 'Firecrawl could not execute this capability with the current credit balance or plan.');
        if (response.status === 429) return error(res, 429, 'Firecrawl retrieval is rate limited. Wait briefly and retry.');
        return error(res, 502, `Firecrawl retrieval failed (HTTP ${response.status}).`);
      }
      const payload = await response.json();
      res.json({ result: payload, publishedPriceCredits: capability.priceCredits, reportedChargeCredits: reportedCredits(payload),
        address: capability.address, requestId, retrievedAt: new Date().toISOString() });
    } catch (cause: any) {
      error(res, 502, cause?.name === 'TimeoutError' ? 'Firecrawl retrieval timed out.' : 'Could not reach Firecrawl retrieval.');
    }
  });

  return router;
}
