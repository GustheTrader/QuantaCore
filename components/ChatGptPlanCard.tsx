import { logConnection } from '../services/connectionLog';
import React, { useEffect, useState } from 'react';
type Status = { activeAccountId: string | null; accounts: { id: string; email: string; name: string; connected: boolean; planUsageEnabled: boolean }[]; pending: boolean; route: { accountId: string; model: string; businessEnabled: boolean } };
const button = 'rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-100 disabled:opacity-40';
const field = 'w-full rounded-xl border border-slate-700 bg-[#071124] px-3 py-2 text-sm text-slate-100';
export default function ChatGptPlanCard() {
  const [status, setStatus] = useState<Status>();
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [model, setModel] = useState(''), [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function api(path: string, method = 'GET', body?: unknown) {
    const response = await fetch('/api/chatgpt' + path, { method, headers: { 'X-Quanta-Client': 'local-ui', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Quanta backend unavailable. Start the full local server to connect your account.');
    const data = await response.json();
    if (!response.ok) { if(path === '/test') logConnection('ChatGPT plan','test-failed','Account-bound reply test failed; review setup'); throw new Error(data.error?.message || 'ChatGPT plan connection is unavailable'); }
    if(path === '/test' && typeof data.choices?.[0]?.message?.content === 'string' && data.choices[0].message.content.trim()) logConnection('ChatGPT plan','reply-verified','Account-bound response completed');
    return data;
  }
  async function refresh() {
    const next: Status = await api('/status'); setStatus(next);
    const same = next.activeAccountId && next.route.accountId === next.activeAccountId;
    setModel(same ? next.route.model : ''); setEnabled(Boolean(same && next.route.businessEnabled));
    setModels([]);
    if (next.accounts.some(a => a.id === next.activeAccountId && a.connected && a.planUsageEnabled)) {
      const catalog = await api('/models'); setModels(catalog.models);
    }
  }
  useEffect(() => { void refresh().catch(e => setError(e.message)); }, []);
  const active = status?.accounts.find(a => a.id === status.activeAccountId);
  const act = async (fn: () => Promise<void>) => { setBusy(true); setError(''); setMessage(''); try { await fn(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  const signIn = (accountId?: string) => act(async () => { const attempt = await api('/authorize', 'POST', { accountId }); window.location.assign(attempt.authorizeUrl); });
  if (window.location.hostname !== '127.0.0.1') return <p className="text-sm text-slate-300">Connect your ChatGPT plan from <a href="http://127.0.0.1:3000/hybrid.html">the local operations panel</a>.</p>;
  return <div className="space-y-3 rounded-2xl border border-slate-700 p-5" aria-label="ChatGPT plan connection">
    <h3 className="font-semibold text-white">Use your ChatGPT plan</h3>
    <p className="text-sm text-slate-300">Connect an eligible ChatGPT account for model requests. Choose Google on OpenAI’s sign-in page if you use Google for ChatGPT. This connection does not request Gmail access.</p>
    <p className="text-sm text-slate-300">{active ? `${active.email || active.name || 'ChatGPT account'} · ${active.planUsageEnabled ? 'Plan usage authorized' : 'Plan usage not authorized'}` : 'No ChatGPT account connected to Quanta.'}</p>
    <div className="flex flex-wrap gap-3"><button className={button} disabled={busy} onClick={() => signIn()}>Continue with ChatGPT</button><button className={button} disabled={busy} onClick={() => act(refresh)}>Refresh connection</button><a className={button} href="https://chatgpt.com/#settings" target="_blank" rel="noreferrer">Manage ChatGPT usage</a></div>
    {status && status.accounts.length > 0 && <>
      <label className="block text-sm text-slate-300">Saved ChatGPT account<select className={field} disabled={busy} value={status.activeAccountId || ''} onChange={e => act(async () => { await api('/select', 'POST', { accountId: e.target.value }); setModels([]); await refresh(); })}><option value="" disabled>Select account</option>{status.accounts.map(a => <option key={a.id} value={a.id} disabled={!a.connected}>{a.email || a.name || 'Account'} · {a.id.slice(0, 6)}{a.connected ? '' : ' · signed out'}</option>)}</select></label>
      <div className="flex flex-wrap gap-3"><button className={button} disabled={busy || !active} onClick={() => signIn(active?.id)}>Reauthorize selected account</button><button className={button} disabled={busy || !active} onClick={() => act(async () => { const result = await api('/disconnect', 'POST', { accountId: active?.id }); setModels([]); await refresh(); setMessage(result.remoteRevocationConfirmed ? 'Signed out and renewable session revoked.' : 'Signed out locally. Remote revocation was not confirmed; disconnect QuantaCore in ChatGPT settings.'); })}>Disconnect selected account</button></div>
    </>}
    {active?.planUsageEnabled && <>
      <button className={button} disabled={busy} onClick={() => act(async () => { const data = await api('/models'); setModels(data.models); setMessage('Account-specific model catalog loaded.'); })}>Load available ChatGPT models</button>
      <label className="block text-sm text-slate-300">ChatGPT model<select className={field} disabled={busy} value={model} onChange={e => setModel(e.target.value)}><option value="">Choose from your account’s catalog</option>{model && !models.some(m => m.id === model) && <option value={model}>{model} · saved selection</option>}{models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label className="flex gap-2 text-sm text-slate-300"><input type="checkbox" checked={enabled} disabled={busy} onChange={e => setEnabled(e.target.checked)} /> Allow Business connectors to send explicitly selected model requests using this account’s ChatGPT plan</label>
      <div className="flex flex-wrap gap-3"><button className={button} disabled={busy || !model} onClick={() => act(async () => { await api('/route', 'PUT', { model, businessEnabled: enabled }); await refresh(); setMessage('ChatGPT model route saved. Existing workers remain paused.'); })}>Save ChatGPT model route</button><button className={button} disabled={busy || !status?.route.model || status.route.accountId !== status.activeAccountId} onClick={() => act(async () => { const result = await api('/test', 'POST'); setMessage(`Completed ChatGPT plan response: ${result.choices[0].message.content.slice(0, 200)}`); })}>Send connection test using ChatGPT plan</button></div>
      <p className="text-xs text-slate-400">Eligible requests use your ChatGPT plan and share its limits. A limit or authorization error stops the request; there is no automatic API billing fallback. Business connectors select model “chatgpt-plan” explicitly.</p>
    </>}
    <div aria-live="polite">{busy && <p className="text-sm text-cyan-300">Checking connection…</p>}{error && <p className="text-sm text-rose-300" role="alert">{error}</p>}{message && <p className="text-sm text-emerald-300">{message}</p>}</div>
  </div>;
}
