import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Search } from 'lucide-react';
import { AgentTerminal } from './herald/CodingAgentsPage';
import { COMPATIBLE_PROVIDERS, getProviderDefinition, type CompatibleProvider, type ProviderConnection } from '../lib/inference-providers';
import { loadProviderConnections, loadProviderModels, saveProviderConnection, setPreferredInferenceProvider } from '../services/inferenceService';
import { logConnection } from '../services/connectionLog';

// One list for every model provider. Each row has up to two lanes:
//   Connect  – sign in with the subscription you already pay for (OAuth / native CLI sign-in)
//   Add key  – the API lane, billed per token by the provider
type Native = 'claude' | 'grok-native' | 'gemini';
type Subscription = { kind: 'chatgpt' } | { kind: 'openrouter' } | { kind: 'native'; agent: Native };
type Row = { id: CompatibleProvider; name: string; mark: string; tone: string; subscription?: Subscription; subscriptionNote?: string; keyName: string; keysUrl: string };

const PRIMARY: Row[] = [
  { id: 'openai-compatible', name: 'OpenAI / Codex', mark: '◎', tone: 'bg-emerald-500/15 text-emerald-200', subscription: { kind: 'chatgpt' }, subscriptionNote: 'ChatGPT Plus / Pro plan · used by Quanta chat', keyName: 'OPENAI_API_KEY', keysUrl: 'https://platform.openai.com/api-keys' },
  { id: 'claude', name: 'Claude', mark: 'A', tone: 'bg-orange-500/15 text-orange-200', subscription: { kind: 'native', agent: 'claude' }, subscriptionNote: 'Claude Pro / Max · used by Claude Code', keyName: 'ANTHROPIC_API_KEY', keysUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'google-api', name: 'Google Gemini', mark: 'G', tone: 'bg-blue-500/15 text-blue-200', subscription: { kind: 'native', agent: 'gemini' }, subscriptionNote: 'Google account · used by Gemini CLI', keyName: 'GEMINI_API_KEY', keysUrl: 'https://aistudio.google.com/apikey' },
  { id: 'grok', name: 'Grok · xAI', mark: '𝕏', tone: 'bg-slate-500/20 text-white', subscription: { kind: 'native', agent: 'grok-native' }, subscriptionNote: 'SuperGrok / X account · used by Grok CLI', keyName: 'XAI_API_KEY', keysUrl: 'https://console.x.ai' },
  { id: 'openrouter', name: 'OpenRouter', mark: '⇄', tone: 'bg-violet-500/15 text-violet-200', subscription: { kind: 'openrouter' }, subscriptionNote: 'Browser sign-in creates a key for Quanta', keyName: 'OPENROUTER_API_KEY', keysUrl: 'https://openrouter.ai/keys' },
];
const KEY_NAMES: Partial<Record<CompatibleProvider, string>> = { deepseek: 'DEEPSEEK_API_KEY', mistral: 'MISTRAL_API_KEY', cerebras: 'CEREBRAS_API_KEY', moonshot: 'MOONSHOT_API_KEY', minimax: 'MINIMAX_API_KEY', nvidia: 'NVIDIA_API_KEY', huggingface: 'HF_TOKEN', together: 'TOGETHER_API_KEY', baseten: 'BASETEN_API_KEY', 'cheaper-inference': 'CHEAPER_INFERENCE_API_KEY', groq: 'GROQ_API_KEY', fireworks: 'FIREWORKS_API_KEY', novita: 'NOVITA_API_KEY', 'ollama-cloud': 'OLLAMA_API_KEY', omniroute: 'OMNIROUTE_API_KEY', local: 'No key · local server' };
const OTHER: Row[] = COMPATIBLE_PROVIDERS.filter(p => !PRIMARY.some(r => r.id === p.id)).map(p => ({
  id: p.id, name: p.label, mark: p.label.slice(0, 1), tone: 'bg-slate-700/40 text-slate-200', keyName: KEY_NAMES[p.id] || 'API key', keysUrl: p.docs
}));

const button = 'rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-400 hover:text-white disabled:opacity-40';
const primary = 'rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-100 disabled:opacity-40';
const field = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none';

async function local(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(path, { method, headers: { 'X-Quanta-Client': 'local-ui', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Start the local Quanta server (npm run dev) to connect models.');
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || 'Connection request failed.');
  return result;
}

type Status = { label: string; tone: 'ok' | 'warn' | 'off'; lane?: 'subscription' | 'key' };

export default function ModelsPanel({ onChange }: { onChange?: () => void }) {
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [preferred, setPreferred] = useState<string>('');
  const [chatgpt, setChatgpt] = useState<{ connected: boolean; email?: string } | null>(null);
  const [openrouter, setOpenrouter] = useState(false);
  const [native, setNative] = useState<Record<string, { connected: boolean; state: string; label: string }>>({});
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<CompatibleProvider | null>(null);
  const [showOther, setShowOther] = useState(true);
  const [filter, setFilter] = useState('');
  const [draft, setDraft] = useState({ apiKey: '', model: '', baseUrl: '' });
  const [models, setModels] = useState<string[]>([]);
  const [session, setSession] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const [config, plan, router, auth, catalog] = await Promise.allSettled([
      loadProviderConnections(), local('/api/chatgpt/status'), local('/api/openrouter-oauth/status'), local('/api/hermes/work/coding/auth-status'), local('/api/hermes/work/coding')
    ]);
    if (config.status === 'fulfilled') { setConnections(config.value.connections); setPreferred(config.value.preferredProvider); }
    else setNotice({ kind: 'error', text: config.reason?.message || 'The local Quanta server is not responding.' });
    if (plan.status === 'fulfilled') { const active = plan.value.accounts?.find((a: any) => a.id === plan.value.activeAccountId); setChatgpt(active ? { connected: !!(active.connected && active.planUsageEnabled), email: active.email } : { connected: false }); }
    if (router.status === 'fulfilled') setOpenrouter(!!router.value.authenticated);
    if (auth.status === 'fulfilled') setNative(Object.fromEntries((auth.value.agents || []).map((a: any) => [a.id, a])));
    if (catalog.status === 'fulfilled') setInstalled(Object.fromEntries((catalog.value.agents || []).map((a: any) => [a.id, !!a.installed])));
  }, []);

  useEffect(() => {
    void refresh();
    const changed = () => void refresh();
    window.addEventListener('focus', changed);
    // Returning from a provider's OAuth page lands back here with ?auth_result=…
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth_result')) {
      setNotice(params.get('auth_result') === 'connected' ? { kind: 'ok', text: 'Sign-in finished. The connection is saved on this computer.' } : { kind: 'error', text: 'Sign-in was cancelled or failed. Try Connect again.' });
      const clean = new URL(window.location.href); clean.searchParams.delete('auth_provider'); clean.searchParams.delete('auth_result');
      window.history.replaceState(window.history.state, '', clean.pathname + clean.search + clean.hash);
    }
    return () => window.removeEventListener('focus', changed);
  }, [refresh]);

  // While a native sign-in terminal runs, watch for the sign-in page link and completion.
  useEffect(() => {
    if (!session?.running) return;
    const timer = window.setInterval(async () => {
      try {
        const catalog = await local('/api/hermes/work/coding');
        const next = catalog.sessions?.find((s: any) => s.id === session.id);
        if (!next) { setSession(null); return; }
        setSession((previous: any) => ({ ...previous, running: next.running, authorizeUrl: next.authorizeUrl }));
        if (!next.running) { await refresh(); onChange?.(); }
      } catch {}
    }, 1500);
    return () => window.clearInterval(timer);
  }, [session?.id, session?.running, refresh, onChange]);

  const status = (row: Row): Status => {
    const connection = connections.find(c => c.id === row.id);
    const sub = row.subscription;
    if (sub?.kind === 'chatgpt' && chatgpt?.connected) return { label: 'Subscription', tone: 'ok', lane: 'subscription' };
    if (sub?.kind === 'openrouter' && openrouter) return { label: 'Connected', tone: 'ok', lane: 'subscription' };
    if (sub?.kind === 'native') {
      const state = native[sub.agent];
      if (state?.connected) return { label: 'Subscription', tone: 'ok', lane: 'subscription' };
      if (state?.state === 'expired') return { label: 'Sign-in expired', tone: 'warn' };
    }
    if (connection?.hasKey || (row.id === 'local' && connection?.model)) return { label: connection.model ? 'API key' : 'Key saved · pick a model', tone: connection.model ? 'ok' : 'warn', lane: 'key' };
    return { label: 'Not connected', tone: 'off' };
  };

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key); setNotice(null);
    try { await work(); } catch (error) { setNotice({ kind: 'error', text: (error as Error).message }); } finally { setBusy(null); }
  };

  const connect = (row: Row) => run(`connect:${row.id}`, async () => {
    const sub = row.subscription!;
    if (sub.kind === 'chatgpt') { const attempt = await local('/api/chatgpt/authorize', 'POST', {}); window.location.assign(attempt.authorizeUrl); return; }
    if (sub.kind === 'openrouter') { const attempt = await local('/api/openrouter-oauth/authorize', 'POST', {}); window.location.assign(attempt.authorizeUrl); return; }
    if (!installed[sub.agent]) throw new Error(`${row.name} sign-in uses its command-line tool, which isn't installed. Install it from Coding Harnesses, then try again.`);
    const next = await local('/api/hermes/work/coding', 'POST', { agent: sub.agent, purpose: 'auth', scope: 'space', intelligence: false });
    setSession({ ...next, provider: row.id });
    logConnection(row.name, 'sign-in-started', 'Subscription sign-in opened in the native tool.');
  });

  const openKey = (row: Row) => {
    if (open === row.id) { setOpen(null); return; }
    const connection = connections.find(c => c.id === row.id);
    setDraft({ apiKey: '', model: connection?.model || '', baseUrl: connection?.baseUrl || getProviderDefinition(row.id)?.baseUrl || '' });
    setModels([]); setOpen(row.id);
  };

  const saveKey = (row: Row) => run(`save:${row.id}`, async () => {
    const definition = getProviderDefinition(row.id)!;
    await saveProviderConnection(row.id, { baseUrl: definition.editableEndpoint ? draft.baseUrl : definition.baseUrl, model: draft.model.trim(), ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}) });
    let found: string[] = [];
    try { found = (await loadProviderModels(row.id)).map(m => m.id); } catch (error) { throw new Error(`Saved, but ${row.name} didn't accept it: ${(error as Error).message}`); }
    setModels(found);
    logConnection(row.name, 'api-key-saved', 'API key saved and the model catalog loaded.');
    setNotice({ kind: 'ok', text: `${row.name} accepted the key · ${found.length} models available.${draft.model ? '' : ' Pick a model to finish.'}` });
    setDraft(d => ({ ...d, apiKey: '' }));
    await refresh(); onChange?.();
  });

  const removeKey = (row: Row) => run(`remove:${row.id}`, async () => {
    const connection = connections.find(c => c.id === row.id);
    await saveProviderConnection(row.id, { baseUrl: connection?.baseUrl || getProviderDefinition(row.id)!.baseUrl, model: connection?.model || '', clearKey: true });
    setNotice({ kind: 'ok', text: `${row.name} key removed from this computer.` });
    await refresh(); onChange?.();
  });

  const useForChat = (row: Row) => run(`use:${row.id}`, async () => {
    await setPreferredInferenceProvider(row.id);
    setPreferred(row.id);
    setNotice({ kind: 'ok', text: `${row.name} is now the default for chat and agents.` });
  });

  const rowView = (row: Row) => {
    const state = status(row);
    const connection = connections.find(c => c.id === row.id);
    const definition = getProviderDefinition(row.id);
    const pill = state.tone === 'ok' ? 'bg-emerald-500/15 text-emerald-200' : state.tone === 'warn' ? 'bg-amber-500/15 text-amber-200' : 'bg-slate-800 text-slate-300';
    return (
      <li key={row.id} className="border-b border-slate-800/80 last:border-0">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base font-bold ${row.tone}`} aria-hidden="true">{row.mark}</span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">{row.name}{preferred === row.id && <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">Default</span>}</p>
            <p className="truncate font-mono text-[11px] text-slate-500">{row.subscription ? `${row.subscriptionNote} · or ${row.keyName}` : `${row.keyName}${connection?.model ? ` · ${connection.model}` : ''}`}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${pill}`}>{state.label}</span>
          {row.subscription && <button className={state.lane === 'subscription' ? button : primary} disabled={!!busy} onClick={() => connect(row)}>{busy === `connect:${row.id}` ? 'Opening…' : state.lane === 'subscription' ? 'Reconnect' : 'Connect'}</button>}
          <button className={button} disabled={!!busy} onClick={() => openKey(row)} aria-expanded={open === row.id}>{connection?.hasKey ? 'Edit key' : row.id === 'local' ? 'Set up' : 'Add key'}</button>
          {(state.lane === 'key' && connection?.model && preferred !== row.id) && <button className={button} disabled={!!busy} onClick={() => useForChat(row)}>Use for chat</button>}
        </div>
        {open === row.id && (
          <div className="space-y-3 border-t border-slate-800 bg-slate-950/60 px-4 py-4">
            <p className="text-xs text-slate-400">{definition?.description} The key is encrypted on this computer and never sent to the browser.</p>
            {definition?.editableEndpoint && <label className="block text-xs text-slate-400">Server URL<input className={`${field} mt-1`} value={draft.baseUrl} onChange={e => setDraft({ ...draft, baseUrl: e.target.value })} /></label>}
            {definition?.requiresKey !== false && <label className="block text-xs text-slate-400">{row.keyName}<input type="password" autoComplete="off" className={`${field} mt-1 font-mono`} value={draft.apiKey} placeholder={connection?.hasKey ? 'Saved · paste a new key to replace it' : 'Paste your key'} onChange={e => setDraft({ ...draft, apiKey: e.target.value })} /></label>}
            <label className="block text-xs text-slate-400">Model
              {models.length ? <select className={`${field} mt-1`} value={draft.model} onChange={e => setDraft({ ...draft, model: e.target.value })}><option value="">Choose a model</option>{models.map(m => <option key={m} value={m}>{m}</option>)}</select>
                : <input className={`${field} mt-1 font-mono`} value={draft.model} placeholder="Save the key to load the model list, or type a model ID" onChange={e => setDraft({ ...draft, model: e.target.value })} />}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button className={primary} disabled={!!busy || (definition?.requiresKey !== false && !draft.apiKey.trim() && !connection?.hasKey)} onClick={() => saveKey(row)}>{busy === `save:${row.id}` ? 'Checking…' : 'Save and check'}</button>
              {connection?.hasKey && <button className={button} disabled={!!busy} onClick={() => removeKey(row)}>Remove key</button>}
              <a className={`${button} inline-flex items-center gap-1`} href={row.keysUrl} target="_blank" rel="noreferrer">Get a key <ExternalLink size={12} /></a>
            </div>
            <p className="text-[11px] text-slate-500">Checking only lists models. No prompt is sent and nothing is billed.</p>
          </div>
        )}
        {session?.provider === row.id && (
          <div className="border-t border-slate-800 bg-slate-950/60 px-4 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-300">{session.running ? 'Finish signing in with your subscription account. If a code is shown, paste it in the terminal below.' : 'Sign-in window closed.'}</p>{session.authorizeUrl && <a className={primary} href={session.authorizeUrl} target="_blank" rel="noreferrer">Open sign-in page</a>}</div>
            <div className="overflow-hidden rounded-lg border border-slate-800"><AgentTerminal workspace="work" session={session} onError={text => setNotice({ kind: 'error', text })} /></div>
          </div>
        )}
      </li>
    );
  };

  const others = useMemo(() => OTHER.filter(r => !filter.trim() || r.name.toLowerCase().includes(filter.trim().toLowerCase())), [filter]);
  const connectedCount = [...PRIMARY, ...OTHER].filter(r => status(r).tone === 'ok').length;

  return (
    <section aria-label="Models" className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-white">Models</h2>
        <p className="mt-1 text-sm text-slate-400">Connect uses a subscription you already pay for. Add key uses the provider's API and is billed per token. {connectedCount ? `${connectedCount} connected.` : ''}</p>
      </header>
      {notice && <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${notice.kind === 'ok' ? 'border-emerald-500/30 text-emerald-200' : 'border-amber-500/30 text-amber-200'}`}>{notice.text}</p>}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
        <p className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-white">Providers</p>
        <ul>{PRIMARY.map(rowView)}</ul>
      </div>
      <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-white" onClick={() => setShowOther(v => !v)} aria-expanded={showOther}><ChevronDown size={14} className={showOther ? '' : '-rotate-90'} />Other providers (API key)</button>
      {showOther && <>
        <label className="relative block"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input className={`${field} pl-9`} value={filter} placeholder="Search model providers…" onChange={e => setFilter(e.target.value)} /></label>
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40"><ul>{others.map(rowView)}</ul>{!others.length && <p className="px-4 py-6 text-center text-sm text-slate-500">No provider matches.</p>}</div>
      </>}
      <p className="text-[11px] leading-relaxed text-slate-500">Subscription sign-ins for Claude, Gemini and Grok are kept by their own command-line tools and power the coding harnesses. Providers don't allow those plans to be used as a general API, so Quanta chat uses an API key for them. ChatGPT plan sign-in and OpenRouter work for Quanta chat directly.</p>
    </section>
  );
}
