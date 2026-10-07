import React, { useEffect, useState } from 'react';

async function request(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`/api/mcp/zo${path}`, { method, headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Zo MCP request failed.');
  return result;
}
export default function ZoMcpConnection() {
  const [domain, setDomain] = useState<'business' | 'trading'>('business');
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<any>();
  const [tools, setTools] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname);
  const refresh = async () => setStatus(await request('/status'));
  useEffect(() => { if (local) refresh().catch(e => setError(e.message)); }, []);
  const run = async (action: 'save' | 'tools' | 'clear' | 'existing') => {
    setBusy(true); setError(''); setMessage('');
    try {
      if (action !== 'tools') {
        await request(`/${domain}`, 'PUT', action === 'clear' ? { clearKey: true } : action === 'existing' ? { useExistingZoToken: true } : { apiKey: key });
        setKey(''); setTools([]); setMessage(action === 'clear' ? 'Local credential removed. Revoke the token in Zo to revoke upstream access.' : 'Encrypted token saved. Select Discover tools to test the connection.');
      } else {
        const result = await request(`/${domain}/tools`, 'POST', {});
        setTools(result.tools); setMessage(`Connected to Zo MCP. Discovered ${result.toolCount} tools; no tools executed.`);
      }
      await refresh();
    } catch (e: any) { setError(e.message === 'Failed to fetch' ? 'The local server is unavailable. Start QuantaCore and try again.' : e.message); }
    finally { setBusy(false); }
  };
  const connection = status?.connections?.find((c: any) => c.domain === domain);
  return <section aria-label="Zo Computer MCP connection" className="mb-12 rounded-3xl border border-cyan-500/30 bg-slate-950/70 p-6 space-y-4">
    <h2 className="text-xl font-semibold text-white">Zo Computer · Remote MCP</h2>
    <p className="text-sm text-slate-300">Connect Zo’s tools and context through its HTTP MCP server. <a href="https://www.zo.computer/guide/mcp-server" target="_blank" rel="noreferrer" className="text-cyan-300">Official setup guide</a></p>
    <code className="block break-all text-sm text-cyan-300">https://api.zo.computer/mcp</code>
    {!local ? <p className="text-amber-300">Configure this connection in your local QuantaCore application.</p> : <>
      <label className="block text-sm text-slate-300">Workspace<select aria-label="Zo MCP workspace" disabled={busy} value={domain} onChange={e => { setDomain(e.target.value as typeof domain); setKey(''); setTools([]); setMessage(''); setError(''); }} className="ml-3 rounded-lg bg-slate-800 p-2"><option value="business">Business</option><option value="trading">Trading research</option></select></label>
      <label className="block text-sm text-slate-300">Zo access token<input type="password" autoComplete="new-password" value={key} onChange={e => setKey(e.target.value)} disabled={busy} placeholder={connection?.hasKey ? 'Token saved; enter a replacement only if needed' : 'Create a token in Zo Settings → Advanced'} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3" /></label>
      <p className="text-xs text-slate-400">Zo tokens grant full workspace access. Credentials stay encrypted on the local server and separate for Business and Trading. Discovery lists tool metadata; agent execution is disabled.</p>
      <div className="flex flex-wrap gap-3"><button disabled={busy || !key.trim()} onClick={() => run('save')} className="rounded-xl bg-cyan-700 px-4 py-2 text-white disabled:opacity-50">Save token</button><button disabled={busy || !connection?.hasKey} onClick={() => run('tools')} className="rounded-xl border border-cyan-700 px-4 py-2 text-cyan-300 disabled:opacity-50">Discover tools</button><button disabled={busy || !connection?.hasKey} onClick={() => run('clear')} className="rounded-xl border border-slate-700 px-4 py-2 text-slate-300 disabled:opacity-50">Remove token</button></div>
      {connection?.hasZoApiKey && <button disabled={busy} onClick={() => run('existing')} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-cyan-300 disabled:opacity-50">Use saved Zo {domain === 'business' ? 'Business' : 'Trading'} token</button>}
      <div aria-live="polite">{busy && <p className="text-cyan-300">Connecting…</p>}{message && <p className="text-emerald-300">{message}</p>}{error && <p role="alert" className="text-rose-300">{error}</p>}</div>
      {connection?.checkedAt && <p className="text-xs text-slate-400">Last successful discovery: {connection.checkedAt} · {connection.toolCount} tools</p>}
      {tools.length > 0 && <div className="max-h-80 overflow-auto space-y-2">{tools.map((tool, index) => <details key={`${tool.name}-${index}`} className="rounded-lg border border-slate-800 p-3 text-slate-300"><summary className="cursor-pointer font-mono text-sm text-cyan-300">{tool.name}</summary><p className="mt-2 whitespace-pre-wrap text-sm">{tool.description}</p><pre className="mt-2 overflow-auto text-xs">{JSON.stringify(tool.inputSchema, null, 2)}</pre></details>)}</div>}
    </>}
  </section>;
}
