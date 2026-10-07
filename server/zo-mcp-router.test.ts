import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createZoMcpRouter, ZO_MCP_ENDPOINT } from './zo-mcp-router';
import type { ProviderStore } from './provider-store';

test('Zo MCP requires local access, separates domains, discovers without execution and masks tokens', async () => {
  const keys = new Map<string, string>();
  const store = { cloudConfigured: async (domain: string, provider: string) => Boolean(keys.get(`${domain}:${provider}`)), cloudKey: async (domain: string, provider: string) => keys.get(`${domain}:${provider}`) || '', setCloudKey: async (domain: string, provider: string, key: string) => { keys.set(`${domain}:${provider}`, key); } } as unknown as ProviderStore;
  let calls = 0;
  const app = express(); app.use(express.json());
  app.use('/api/mcp/zo', createZoMcpRouter(store, async key => {
    calls++; if (key === 'reject-secret') throw new Error(`Denied ${key}`);
    assert.equal(key, 'business-secret');
    return [{ name: 'read_file', inputSchema: { type: 'object' } }];
  }));
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}/api/mcp/zo`;
  const call = (route: string, method = 'GET', body?: any, headers = {}) => fetch(`${url}${route}`, { method, headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await fetch(`${url}/status`)).status, 403);
    assert.equal((await call('/status', 'GET', undefined, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await call('/business/tools', 'POST', {})).status, 409);
    assert.equal((await call('/invalid', 'PUT', { apiKey: 'secret' })).status, 400);
    assert.equal((await call('/business', 'PUT', { apiKey: 'bad\nkey' })).status, 400);
    const saved = await call('/business', 'PUT', { apiKey: 'business-secret' });
    assert.equal(saved.status, 200); assert.equal((await saved.text()).includes('business-secret'), false);
    assert.equal(calls, 0);
    keys.set('business:zo', 'business-secret');
    assert.equal((await call('/business', 'PUT', { useExistingZoToken: true })).status, 200);
    assert.equal((await call('/trading', 'PUT', { useExistingZoToken: true })).status, 400);
    const status = await (await call('/status')).json();
    assert.equal(status.endpoint, ZO_MCP_ENDPOINT); assert.equal(status.agentExecutionEnabled, false);
    assert.equal(status.connections.find((c: any) => c.domain === 'trading').hasKey, false);
    const catalog = await (await call('/business/tools', 'POST', {})).json();
    assert.equal(catalog.tools[0].name, 'read_file'); assert.equal(catalog.toolCount, 1); assert.equal(calls, 1);
    await call('/trading', 'PUT', { apiKey: 'reject-secret' });
    const failure = await call('/trading/tools', 'POST', {}); assert.equal(failure.status, 502);
    assert.equal((await failure.text()).includes('reject-secret'), false);
    await call('/business', 'PUT', { clearKey: true });
    assert.equal((await call('/business/tools', 'POST', {})).status, 409);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
