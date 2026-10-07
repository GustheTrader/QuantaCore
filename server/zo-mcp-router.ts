import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ProviderStore } from './provider-store';

export const ZO_MCP_ENDPOINT = 'https://api.zo.computer/mcp';
type Domain = 'business' | 'trading';
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });
export async function discoverZoTools(key: string) {
  const client = new Client({ name: 'quanta-zo-mcp', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(ZO_MCP_ENDPOINT), {
    requestInit: { headers: { Authorization: `Bearer ${key}` }, redirect: 'error' },
    fetch: (url, init) => fetch(url, { ...init, redirect: 'error', signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), AbortSignal.timeout(20000)]) })
  });
  try {
    await client.connect(transport, { timeout: 20000 });
    const tools: any[] = [];
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      const page = await client.listTools(cursor ? { cursor } : undefined, { timeout: 20000 });
      tools.push(...page.tools.map(tool => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema, annotations: tool.annotations })));
      if (tools.length > 500 || seen.size >= 20) throw fail('Zo tool catalog exceeded the local limit.', 502);
      cursor = page.nextCursor;
      if (cursor && seen.has(cursor)) throw fail('Zo repeated a tool catalog cursor.', 502);
      if (cursor) seen.add(cursor);
    } while (cursor);
    return tools;
  } finally { await client.close().catch(() => {}); await transport.close().catch(() => {}); }
}

export function createZoMcpRouter(store: ProviderStore, discover = discoverZoTools) {
  const router = express.Router();
  const checks = new Map<Domain, { checkedAt: string; toolCount: number }>();
  const active = new Set<Domain>();
  const domain = (value: unknown): Domain => { if (value !== 'business' && value !== 'trading') throw fail('Select Business or Trading.'); return value; };
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(req.hostname) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') || req.get('X-Quanta-Client') !== 'local-ui' || (req.get('origin') && req.get('origin') !== `${req.protocol}://${req.get('host')}`)) return res.status(403).json({ error: { message: 'Local application access required.' } });
    next();
  });
  const handle = (fn: (req: express.Request) => Promise<unknown>) => async (req: express.Request, res: express.Response) => {
    try { res.json(await fn(req)); } catch (error: any) { res.status(error.status || 502).json({ error: { message: error.status ? error.message : 'Zo MCP connection failed. Verify the access token and try again.' } }); }
  };
  router.get('/status', handle(async () => ({ endpoint: ZO_MCP_ENDPOINT, transport: 'streamable-http', agentExecutionEnabled: false, connections: await Promise.all((['business', 'trading'] as const).map(async domain => ({ domain, hasKey: await store.cloudConfigured(domain, 'zo-mcp'), hasZoApiKey: await store.cloudConfigured(domain, 'zo'), ...checks.get(domain) }))) })));
  router.put('/:domain', handle(async req => {
    const selected = domain(req.params.domain);
    if (active.has(selected)) throw fail('Wait for tool discovery to finish before changing credentials.', 409);
    const key = req.body?.useExistingZoToken === true ? await store.cloudKey(selected, 'zo') : req.body?.apiKey;
    if (req.body?.clearKey !== true && (typeof key !== 'string' || !key.trim() || key.length > 4096 || /[\r\n]/.test(key))) throw fail('Enter a valid Zo access token.');
    await store.setCloudKey(selected, 'zo-mcp', req.body.clearKey === true ? '' : key.trim());
    checks.delete(selected);
    return { domain: selected, hasKey: await store.cloudConfigured(selected, 'zo-mcp') };
  }));
  router.post('/:domain/tools', handle(async req => {
    const selected = domain(req.params.domain);
    if (active.has(selected)) throw fail('Tool discovery is already running.', 409);
    active.add(selected);
    try {
      const key = await store.cloudKey(selected, 'zo-mcp');
      if (!key) throw fail('Save a Zo MCP access token first.', 409);
      const tools = await discover(key);
      const check = { checkedAt: new Date().toISOString(), toolCount: tools.length };
      checks.set(selected, check);
      return { domain: selected, endpoint: ZO_MCP_ENDPOINT, ...check, tools, agentExecutionEnabled: false };
    } finally { active.delete(selected); }
  }));
  return router;
}
