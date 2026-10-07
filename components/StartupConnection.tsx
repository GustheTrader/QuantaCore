import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ChatGptPlanCard from './ChatGptPlanCard';
import ConnectionSummary from './ConnectionSummary';
import WorkflowSetup from './WorkflowSetup';
import { logConnection } from '../services/connectionLog';
import { loadProviderConnections, loadLocalRuntime, completeWithProvider, setPreferredInferenceProvider, type ProviderConfigResponse, type LocalRuntime } from '../services/inferenceService';
import { getProviderDefinition, type CompatibleProvider } from '../lib/inference-providers';

export default function StartupConnection({ onContinue, prelaunch = false, onSetup }: { onContinue: () => void; prelaunch?: boolean; onSetup?: () => void }) {
  const [config, setConfig] = useState<ProviderConfigResponse>();
  const [runtime, setRuntime] = useState<LocalRuntime>();
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tested, setTested] = useState('');
  const [reply, setReply] = useState('');
  const [checkedAt, setCheckedAt] = useState('');
  const refresh = async () => {
    setBusy(true); setError(''); setTested(''); setReply(''); setConfig(undefined); setRuntime(undefined);
    const results = await Promise.allSettled([loadProviderConnections(), loadLocalRuntime()]);
    if (results[0].status === 'fulfilled') { setConfig(results[0].value); setProvider(results[0].value.preferredProvider); }
    else setError(results[0].reason?.message || 'Backend unavailable. Run C:\\QuantaCore\\Start-Quanta.ps1.');
    if (results[1].status === 'fulfilled') setRuntime(results[1].value);
    setCheckedAt(new Date().toLocaleTimeString()); setBusy(false);
  };
  useEffect(() => { void refresh(); }, []);
  const routes = config?.connections.filter(c => c.model && (!getProviderDefinition(c.id)?.requiresKey || c.hasKey)) || [];
  const selected = routes.find(c => c.id === provider);
  const identity = selected ? selected.id + '/' + selected.model : '';
  const verify = async () => {
    if (!selected) return;
    setBusy(true); setError(''); setTested(''); setReply('');
    try {
      const response = await completeWithProvider(selected.id, { model: selected.model, messages: [{ role: 'user', content: 'Connection check: reply READY.' }], max_tokens: 32 });
      const text = response.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new Error('The model returned no usable text.');
      await setPreferredInferenceProvider(selected.id as CompatibleProvider);
      setTested(identity); setReply(text.slice(0, 200)); logConnection('Text model', 'reply-verified', identity + ' · completed reply');
    } catch (e) { logConnection('Text model', 'test-failed', identity + ' · review model access and connection'); setError(e instanceof Error ? e.message : 'Model test failed.'); }
    finally { setBusy(false); }
  };
  const verified = Boolean(identity && tested === identity);
  const button = 'rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-200 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-cyan-300';
  if (prelaunch) return <div className="space-y-5"><WorkflowSetup /><ConnectionSummary onSetup={onSetup} /><p className="text-sm text-slate-300">Review the current connections above. Opening the workspace starts no model requests or tool jobs.</p><button className={button} disabled={busy} onClick={onContinue}>{busy ? "Checking…" : "Open agent workspace"}</button></div>;
  return <section aria-label="Startup connection check" className="space-y-6 pb-12">
    <header className="rounded-3xl border border-cyan-300/30 bg-gradient-to-br from-indigo-950 to-slate-950 p-7"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Sovereign Intelligence · Start here</p><h1 className="mt-3 text-3xl font-bold text-white">Connect & start</h1><p className="mt-3 text-slate-300">One model connection for text agents. Check it once, then choose your workspace.</p><button className={button + ' mt-5'} disabled={busy} onClick={refresh}>{busy ? 'Checking…' : 'Refresh connections'}</button><p className="mt-3 text-xs text-slate-400">Automatic checks only read status. The reply test uses your selected provider’s quota.</p></header>
    <WorkflowSetup />
    <ConnectionSummary />
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6"><h2 className="text-lg font-bold text-white">1. Local backend</h2><p className="mt-3 text-sm text-slate-300">{config ? 'Responding · saved connections loaded' : busy ? 'Checking the full server…' : 'Unavailable · start the full server'}</p>{!config && !busy && <code className="mt-3 block text-sm text-cyan-200">& C:\QuantaCore\Start-Quanta.ps1</code>}<p className="mt-3 text-xs text-slate-400">Last check: {checkedAt || 'pending'}</p></section>
      <section className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6"><h2 className="text-lg font-bold text-white">2. Choose & verify your text model</h2><label className="mt-3 block text-sm text-slate-300">Saved model route<select aria-label="Startup model route" disabled={busy} value={selected ? provider : ''} onChange={e => { setProvider(e.target.value); setTested(''); setReply(''); setError(''); }} className="mt-2 w-full rounded-xl bg-slate-950 p-3 text-white"><option value="">Choose a configured model</option>{routes.map(c => <option key={c.id} value={c.id}>{getProviderDefinition(c.id)?.label} · {c.model}</option>)}</select></label><div className="mt-4 flex flex-wrap gap-3"><button className={button} disabled={busy || !selected} onClick={verify}>Test reply & use for text agents</button><Link to="/settings" className={button}>Connect another model</Link></div><p role="status" className="mt-3 text-sm text-emerald-300">{verified ? 'Verified this session · ' + reply : 'Reply not verified for this route'}</p><p className="mt-3 text-xs text-slate-400">ChatGPT plan sign-in and its own reply test are in Settings → OpenAI compatible. A plan connection does not configure an API route.</p></section>
    </div>
    <details className="rounded-2xl border border-cyan-400/30 p-6"><summary className="cursor-pointer font-semibold text-cyan-200">Use your ChatGPT plan · account sign-in, no API key</summary><div className="mt-4"><ChatGptPlanCard /></div></details>
    <section className="rounded-2xl border border-slate-700 p-6"><h2 className="text-lg font-bold text-white">3. Agents & optional tools</h2><p className="mt-2 text-sm text-slate-300">{verified ? 'The shared text model returned a reply. Open an agent to start a task.' : 'Agent workspaces are available; verify the selected model before relying on replies.'}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{runtime?.services.map(service => <div key={service.id} className="rounded-xl border border-slate-700 p-4"><p className="text-sm text-white">{service.label}</p><p className="mt-2 text-xs text-slate-300">{service.status === 'responding' ? 'HTTP responding · task not tested' : service.status === 'authentication-required' ? 'Sign-in required' : 'Unavailable · optional'}</p></div>)}</div>{!runtime && <p className="mt-3 text-sm text-amber-200">Optional service checks unavailable.</p>}<div className="mt-5 flex flex-wrap gap-3"><Link className={button} to="/agent?mode=work">Open agent workspace</Link><Link className={button} to="/agents">Browse agents</Link><Link className={button} to="/mcp">Connect tools</Link><Link className={button} to="/work-zone">Paperclip setup</Link></div><p className="mt-4 text-xs text-slate-400">Voice, images, video, external tools and Paperclip use their own adapters. HTTP availability is separate from a completed tool task. Jobs and trading retain their review steps.</p></section>
    {error && <p role="alert" className="rounded-xl border border-amber-400/30 p-4 text-sm text-amber-200">{error}</p>}
    <button className={button} disabled={busy} onClick={onContinue}>{verified ? 'Continue to Mission Control' : 'Continue with setup pending'}</button>
  </section>;
}
