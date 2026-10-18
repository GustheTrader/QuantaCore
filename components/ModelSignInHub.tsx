import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown, ExternalLink, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import ChatGptPlanCard from './ChatGptPlanCard';
import GoogleOAuthCard from './GoogleOAuthCard';
import ProviderConnections from './ProviderConnections';
import { AgentTerminal } from './herald/CodingAgentsPage';
import { loadProviderConnections, loadProviderModels } from '../services/inferenceService';
import { logConnection } from '../services/connectionLog';
import type { CompatibleProvider, ProviderConnection } from '../lib/inference-providers';

const providers = [
  { id: 'openai-compatible', name: 'OpenAI', mark: '◎', tone: 'text-emerald-200 bg-emerald-500/10', flow: 'ChatGPT account', account: 'https://chatgpt.com', keys: 'https://platform.openai.com/api-keys' },
  { id: 'claude', name: 'Anthropic', mark: 'A', tone: 'text-orange-200 bg-orange-500/10', flow: 'Claude Code sign-in', account: 'https://claude.ai/login', keys: 'https://console.anthropic.com/settings/keys' },
  { id: 'grok', name: 'Grok', mark: '𝕏', tone: 'text-white bg-slate-500/10', flow: 'Native Grok sign-in', account: 'https://grok.com', keys: 'https://console.x.ai' },
  { id: 'google-api', name: 'Google', mark: 'G', tone: 'text-blue-200 bg-blue-500/10', flow: 'Google browser sign-in', account: 'https://aistudio.google.com', keys: 'https://aistudio.google.com/apikey' },
  { id: 'openrouter', name: 'OpenRouter', mark: '⇄', tone: 'text-violet-200 bg-violet-500/10', flow: 'Browser OAuth · PKCE', account: 'https://openrouter.ai', keys: 'https://openrouter.ai/keys' },
] as const;
type Id = typeof providers[number]['id'];
type Summary = { label: string; ready: boolean };
type NativeStatus = { id: string; connected: boolean; state: string; label: string; checkedAt: string };
const button = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-cyan-300';

function ProviderLogo({ provider }: { provider: typeof providers[number] }) {
  const [failed, setFailed] = useState(false);
  const sources: Record<Id, string> = {
    'openai-compatible': 'https://openai.com/favicon.ico', claude: 'https://claude.ai/favicon.ico',
    grok: 'https://x.ai/favicon.ico', 'google-api': 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png',
    openrouter: 'https://openrouter.ai/favicon.ico',
  };
  return <span className={`mb-3 grid h-9 w-9 place-items-center rounded-lg text-xl font-bold ${provider.tone}`} aria-hidden="true">{failed ? provider.mark : <img src={sources[provider.id]} alt="" className="h-7 w-7 object-contain" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>}</span>;
}

async function api(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(path, { method, ...(method === 'GET' ? { signal: AbortSignal.timeout(12000) } : {}), headers: { 'X-Quanta-Client': 'local-ui', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Start the full local Quanta server to use browser sign-in.');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Provider connection unavailable.');
  return result;
}

export default function ModelSignInHub({ onChange }: { onChange?: () => void } = {}) {
  const query = new URLSearchParams(window.location.search);
  const callbackProvider = query.get('auth_provider');
  const [selected, setSelected] = useState<Id>(providers.some(p => p.id === callbackProvider) ? callbackProvider as Id : 'openrouter');
  const [mode, setMode] = useState<'account' | 'api'>('account');
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [openrouter, setOpenrouter] = useState<any>();
  const [native, setNative] = useState<{ id: string; installed: boolean }[]>([]);
  const [nativeStatus, setNativeStatus] = useState<NativeStatus[]>([]);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const nativeInFlight = useRef<Promise<any> | null>(null);
  const [summary, setSummary] = useState<Partial<Record<Id, Summary>>>({});
  const [session, setSession] = useState<any>();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [message, setMessage] = useState(query.get('auth_result') === 'failed' ? 'Browser sign-in was cancelled or failed. Choose the provider below to retry.' : query.get('auth_result') === 'connected' ? 'Browser sign-in returned successfully. Review the saved connection below.' : '');
  const current = providers.find(p => p.id === selected)!;
  const draft = connections.find(c => c.id === selected);
  const nativeId = selected === 'claude' ? 'claude' : selected === 'google-api' ? 'gemini' : 'grok-native';
  const installed = native.some(a => a.id === nativeId && a.installed);
  const nativeConnection = nativeStatus.find(a => a.id === nativeId);
  useEffect(() => {
    if (!session?.running) return;
    let cancelled = false;
    let polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const catalog = await api('/api/hermes/work/coding');
        const next = catalog.sessions.find((s: any) => s.id === session.id);
        if (!next) { if (!cancelled) setSession(undefined); return; }
        if (!cancelled) {
          setSession(previous => previous?.id === next.id ? { ...previous, running: next.running, authorizeUrl: next.authorizeUrl } : previous);
          if (!next.running) void refreshNative().catch(e => setError(e.message));
        }
      } catch {} finally { polling = false; }
    };
    const timer = window.setInterval(() => { void poll(); }, 1500);
    void poll();
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [session?.id, session?.running]);

  function refreshNative() {
    if (nativeInFlight.current) return nativeInFlight.current;
    const pending = api('/api/hermes/work/coding/auth-status').then(result => {
      setNativeStatus(result.agents);
      setSummary(previous => {
        const next = { ...previous };
        const mapping: Record<string, Id> = { claude: 'claude', 'grok-native': 'grok', gemini: 'google-api' };
        for (const status of result.agents as NativeStatus[]) {
          const id = mapping[status.id];
          if (id && (status.connected || !next[id]?.ready || next[id]?.label.startsWith('Connected ·'))) next[id] = { label: status.label, ready: status.connected };
        }
        return next;
      });
      return result;
    }).finally(() => { nativeInFlight.current = null; });
    nativeInFlight.current = pending;
    return pending;
  }

  function refresh() {
    if (refreshInFlight.current) return refreshInFlight.current;
    const pending = refreshAll().finally(() => { refreshInFlight.current = null; });
    refreshInFlight.current = pending;
    return pending;
  }

  async function refreshAll() {
    const results = await Promise.allSettled([loadProviderConnections(AbortSignal.timeout(12000)), api('/api/chatgpt/status'), api('/api/google-oauth/status'), api('/api/openrouter-oauth/status'), api('/api/hermes/work/coding'), refreshNative()]);
    if (results[0].status === 'fulfilled') setConnections(results[0].value.connections);
    if (results[3].status === 'fulfilled') setOpenrouter(results[3].value);
    if (results[4].status === 'fulfilled') setNative(results[4].value.agents);
    if (results[5].status === 'fulfilled') setNativeStatus(results[5].value.agents);
    const next: Partial<Record<Id, Summary>> = {};
    const config = results[0].status === 'fulfilled' ? results[0].value.connections : [];
    for (const p of providers) next[p.id] = { label: config.find(c => c.id === p.id)?.hasKey ? 'API key saved · check access' : 'Not connected', ready: false };
    if (results[1].status === 'fulfilled') {
      const s = results[1].value, active = s.accounts.find((a: any) => a.id === s.activeAccountId);
      if (active?.connected && active.planUsageEnabled) next['openai-compatible'] = { label: 'ChatGPT account authorized', ready: true };
    }
    if (results[2].status === 'fulfilled') {
      const s = results[2].value;
      if (s.connected) next['google-api'] = { label: 'Google API grant saved', ready: true };
      else if (s.configured) next['google-api'] = { label: 'OAuth client ready · sign in', ready: false };
    }
    if (results[3].status === 'fulfilled' && results[3].value.authenticated) next.openrouter = { label: 'OpenRouter key validated', ready: true };
    if (results[5].status === 'fulfilled') {
      const mapping: Record<string, Id> = { claude: 'claude', 'grok-native': 'grok', gemini: 'google-api' };
      for (const status of results[5].value.agents as NativeStatus[]) {
        const id = mapping[status.id];
        if (id && (status.connected || (!next[id]?.ready && !config.find(c => c.id === id)?.hasKey))) next[id] = { label: status.label, ready: status.connected };
      }
    }
    setSummary(previous => {
      if (results[5].status === 'rejected') {
        for (const id of ['claude', 'grok', 'google-api'] as const) {
          if (previous[id]?.label.startsWith('Connected ·') && !next[id]?.ready) next[id] = previous[id];
        }
      }
      return next;
    });
    if (results[0].status === 'rejected') throw results[0].reason;
    if (results[3].status === 'rejected') throw results[3].reason;
  }
  useEffect(() => {
    void refresh().catch(e => setError(e.message));
    const changed = () => { void refresh().catch(e => setError(e.message)); };
    window.addEventListener('focus', changed);
    window.addEventListener('quanta_provider_changed', changed);
    window.addEventListener('quanta_account_changed', changed);
    // Browser authorization can finish while this tab remains visible. Keep the badges current.
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshNative().catch(e => setError(e.message)); }, 6000);
    if (callbackProvider) {
      const clean = new URL(window.location.href); clean.searchParams.delete('auth_provider'); clean.searchParams.delete('auth_result');
      window.history.replaceState(window.history.state, '', clean.pathname + clean.search + clean.hash);
    }
    return () => { window.clearInterval(timer); window.removeEventListener('focus', changed); window.removeEventListener('quanta_provider_changed', changed); window.removeEventListener('quanta_account_changed', changed); };
  }, []);
  async function act(fn: () => Promise<void>) {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }
  const signInOpenrouter = () => act(async () => {
    const result = await api('/api/openrouter-oauth/authorize', 'POST', {});
    window.location.assign(result.authorizeUrl);
  });
  const launchNative = () => act(async () => {
    const next = await api('/api/hermes/work/coding', 'POST', { agent: nativeId, purpose: 'auth', scope: 'space', intelligence: false });
    setSession(next); setMessage(selected === 'google-api' ? 'Google browser sign-in is starting. This sign-in session does not load workspace tools. Follow any Google consent prompt in the terminal below.' : 'Complete the provider’s browser sign-in from the terminal below.');
  });
  const validate = () => act(async () => {
    if (selected === 'openrouter') {
      await api('/api/openrouter-oauth/validate', 'POST', {}); setMessage('OpenRouter authenticated this key. No model prompt was sent.');
    } else {
      const models = await loadProviderModels(selected as CompatibleProvider);
      setMessage(`${current.name} accepted the catalog request · ${models.length} models available. No model prompt was sent.`);
    }
    logConnection(current.name, 'authentication-checked', 'Provider accepted a credential validation or catalog request.');
    await refresh(); onChange?.();
    if (selected !== 'openrouter') setSummary(previous => ({ ...previous, [selected]: { label: 'API catalog access verified', ready: true } }));
  });

  return <section aria-label="Five provider sign-in" className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Connect intelligence</p><h2 className="mt-2 text-2xl font-semibold text-white">Your accounts. Your models.</h2><p className="mt-2 text-sm text-slate-400">Choose a provider, finish browser sign-in, then review its models. Add an API key whenever you need the API route.</p></div><button className={button} disabled={busy} onClick={() => act(refresh)}><RefreshCw size={15} />Refresh connections</button></header>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" role="tablist" aria-label="Sign-in providers">{providers.map((p,index) => <button key={p.id} role="tab" tabIndex={selected===p.id?0:-1} id={`signin-tab-${p.id}`} aria-controls="provider-signin-panel" aria-selected={selected===p.id} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?providers.length-1:(index+(e.key==='ArrowRight'?1:-1)+providers.length)%providers.length;setSelected(providers[next].id);setMode('account');setError('');setMessage('');(e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next])?.focus();}} onClick={() => { setSelected(p.id); setMode('account'); setError(''); setMessage(''); }} className={`min-w-0 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-cyan-300 ${selected===p.id?'border-cyan-300 bg-cyan-300/5':'border-slate-700 bg-slate-900/40 hover:border-slate-500'}`}><ProviderLogo provider={p}/><span className="block text-sm font-semibold text-white">{p.name}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{p.flow}</span><span className={`mt-3 flex items-start gap-1.5 text-xs leading-4 ${summary[p.id]?.ready?'text-emerald-300':'text-slate-500'}`}>{summary[p.id]?.ready && <CheckCircle2 size={12} className="mt-0.5 shrink-0"/>}{summary[p.id]?.label || 'Checking…'}</span></button>)}</div>
    <div id="provider-signin-panel" role="tabpanel" aria-labelledby={`signin-tab-${selected}`} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-3"><div className="flex flex-wrap gap-2"><button aria-pressed={mode==='account'} onClick={()=>setMode('account')} className={`${button} ${mode==='account'?'bg-slate-700 text-white':''}`}><ShieldCheck size={15}/>Account sign-in</button><button aria-pressed={mode==='api'} onClick={()=>setMode('api')} className={`${button} ${mode==='api'?'bg-slate-700 text-white':''}`}><KeyRound size={15}/>API fallback</button></div><a className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white" href={current.account} target="_blank" rel="noreferrer">Open provider account<ExternalLink size={13}/></a></div>
      {mode==='account' && selected==='openrouter' && <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/40 p-5"><h3 className="font-semibold text-white">Sign in to OpenRouter</h3><p className="text-sm leading-6 text-slate-300">OpenRouter handles your browser login and consent. Choose Google on its sign-in page if that’s how you access your account. After approval, Quanta stores the new key encrypted on this computer and checks that OpenRouter accepts it.</p><div className="flex flex-wrap gap-3"><button className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40" disabled={busy} onClick={signInOpenrouter}>Continue with OpenRouter<ArrowRight size={15}/></button><button className={button} disabled={busy || !draft?.hasKey} onClick={validate}>Validate saved key</button></div><p className="text-xs text-slate-400">{openrouter?.authenticated ? `Authentication checked ${new Date(openrouter.checkedAt).toLocaleString()}` : 'A saved key or public model list does not confirm authentication.'} Model requests still use your approved route limits. A replacement key requires route reauthorization.</p><button className="text-sm text-cyan-300" onClick={()=>setMode('api')}>Need a manual API key instead? →</button></div>}
      {mode==='account' && selected==='openai-compatible' && <ChatGptPlanCard />}
      {mode==='account' && selected==='google-api' && <div className="space-y-4"><div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/40 p-5"><h3 className="font-semibold text-white">Sign in with your Google account</h3><p className="text-sm leading-6 text-slate-300">Gemini CLI handles Google’s browser sign-in and keeps its session in the native tool. The sign-in session selects Google automatically. For direct Gemini API access, use your own Google OAuth client below or add an API key.</p><div className="flex flex-wrap gap-3"><button className={button} disabled={busy || !installed} onClick={launchNative}>Start Google browser sign-in<ArrowRight size={15}/></button><button className={button} onClick={()=>setMode('api')}>Connect Gemini API<KeyRound size={14}/></button></div><p className="text-xs text-slate-400">{nativeConnection?.connected ? nativeConnection.label : installed?'Gemini CLI is installed. Native sign-in does not configure the general API gateway.':'Install Gemini CLI or choose the API fallback.'}</p></div><details className="rounded-xl border border-slate-700 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-300">Direct Google API OAuth · Cloud client setup</summary><div className="mt-4"><GoogleOAuthCard /></div></details></div>}
      {mode==='account' && (selected==='claude' || selected==='grok') && <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/40 p-5"><h3 className="font-semibold text-white">{selected==='claude'?'Claude Code':'Grok CLI'} browser sign-in</h3><p className="text-sm leading-6 text-slate-300">{selected==='claude'?'Claude Code opens Anthropic’s browser authorization and keeps its account session in the native tool. Quanta’s general Claude model route uses an Anthropic API key.':'Grok’s native CLI supports browser OAuth. Its account session belongs to the native tool; Quanta’s general Grok model route uses an xAI API key.'} Choose Google on the provider page when offered.</p><div className="flex flex-wrap gap-3"><button className={button} disabled={busy || !installed} onClick={launchNative}>Start native browser sign-in<ArrowRight size={15}/></button><a className={button} href={selected==='claude'?'https://code.claude.com/docs/en/setup':'https://docs.x.ai/build/cli/reference'} target="_blank" rel="noreferrer">Native tool setup<ExternalLink size={14}/></a><button className={button} onClick={()=>setMode('api')}>Connect API instead<KeyRound size={14}/></button></div><p className="text-xs text-slate-400">{nativeConnection?.connected ? nativeConnection.label : installed?'Native sign-in tool is installed. Follow its browser and terminal instructions.':'Native sign-in tool was not found at its supported local installation path.'}</p><code className="block text-xs text-cyan-200">{selected==='claude'?'claude auth login':'grok login'}</code></div>}
      {mode==='api' && <><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-400">Use {current.name} API credentials for the model gateway.</p><a className={button} href={current.keys} target="_blank" rel="noreferrer">Get API key<ExternalLink size={14}/></a></div><ProviderConnections key={selected} provider={selected} apiOnly onSaved={()=>{void refresh().catch(e=>setError(e.message));onChange?.();}}/><button className={button} disabled={busy || !draft?.hasKey} onClick={validate}>Check API access</button></>}
    </div>
    {session && <div className="overflow-hidden rounded-xl border border-slate-700"><div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-4 py-3"><span className="text-sm text-slate-200">{session.agent} · native sign-in {session.running ? 'in progress' : 'finished'}</span>{session.authorizeUrl && <a className={button} href={session.authorizeUrl} target="_blank" rel="noreferrer">Open Google authorization<ExternalLink size={14}/></a>}<button className={button} onClick={()=>act(async()=>{await api(`/api/hermes/work/coding/${session.id}/stop`,'POST',{});setSession(undefined);})}>Close session</button></div><AgentTerminal workspace="work" session={session} onError={setError}/></div>}
    <div aria-live="polite">{busy&&<p className="text-sm text-cyan-300">Connecting…</p>}{message&&<p role="status" className="text-sm text-emerald-300">{message}</p>}{error&&<p role="alert" className="rounded-xl border border-amber-400/30 p-3 text-sm text-amber-200">{error}</p>}</div>
    <details className="rounded-xl border border-slate-700 bg-slate-950/40 p-4"><summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-white">Connections review<span className="flex items-center gap-2 text-xs font-normal text-slate-400">{providers.filter(p=>summary[p.id]?.ready).length}/5 authorized<ChevronDown size={14}/></span></summary><div className="mt-4 divide-y divide-slate-800">{providers.map(p=><div key={p.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[120px_1fr]"><span className="text-white">{p.name}</span><span className={summary[p.id]?.ready?'text-emerald-300':'text-slate-400'}>{summary[p.id]?.label || 'Checking…'}<span className="ml-2 text-xs text-slate-500">{connections.find(c=>c.id===p.id)?.model || 'API model not selected'}</span></span></div>)}</div><p className="mt-3 text-xs text-slate-500">Account authorization, API access, and a successful model reply are separate checks. Native account status is read from the CLI or its saved credentials; it does not authorize the general API gateway.</p></details>
  </section>;
}
