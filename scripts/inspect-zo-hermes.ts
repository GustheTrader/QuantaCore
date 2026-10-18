import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ProviderStore } from '../server/provider-store';
import path from 'node:path';
const store = new ProviderStore(path.resolve(import.meta.dirname, '../.quanta'));
const key = await store.cloudKey('business', 'zo-mcp');
const client = new Client({ name: 'quanta-hermes-setup', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(new URL('https://api.zo.computer/mcp'), { requestInit: { headers: { Authorization: `Bearer ${key}` }, redirect: 'error' } });
await client.connect(transport, { timeout: 30_000 });
try {
  for (const tool of ['bash', 'list_app_tools', 'register_user_service']) {
    const r = await client.callTool({ name: 'tool_docs', arguments: { tool_name: tool } }, undefined, { timeout: 30_000 });
    console.log(tool, r.content);
  }
  const r = await client.callTool({ name: 'bash', arguments: { cmd: 'python3 --version; command -v uv; command -v codex; command -v claude; command -v gemini', timeout: 20, description: 'Inspect available runtimes for the requested remote OpenHands worker' } }, undefined, { timeout: 30_000 });
  console.log('RUNTIME', r.content);
} finally { await client.close(); await transport.close(); }
