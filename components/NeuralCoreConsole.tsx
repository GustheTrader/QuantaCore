import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Cpu, RefreshCw, ShieldCheck, Workflow } from 'lucide-react';
import HindsightGnoesisNeuralCore from './HindsightGnoesisNeuralCore';
import SovereignTrustSection from './SovereignTrustSection';
import { loadLocalRuntime, loadProviderConnections, type LocalRuntime, type ProviderConfigResponse } from '../services/inferenceService';
import { getProviderDefinition } from '../lib/inference-providers';

export default function NeuralCoreConsole() {
  const [runtime, setRuntime] = useState<LocalRuntime | null>(null);
  const [config, setConfig] = useState<ProviderConfigResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    setBusy(true); setError('');
    const results = await Promise.allSettled([loadLocalRuntime(), loadProviderConnections()]);
    if (results[0].status === 'fulfilled') setRuntime(results[0].value); else setError(results[0].reason.message);
    if (results[1].status === 'fulfilled') setConfig(results[1].value); else setError(results[1].reason.message);
    setBusy(false);
  };
  useEffect(() => { refresh(); }, []);
  return <div className="space-y-8 pb-20">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Nervous Systems</p><h1 className="font-outfit text-3xl font-semibold text-white">Gnoesis Neural Core</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">The connection between your model, agents, memory and review. Inspect the architecture and local runtime from one place.</p></div><button onClick={refresh} disabled={busy} className="flex items-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-xs text-blue-200 disabled:opacity-40"><RefreshCw size={15} />{busy ? 'Checking…' : 'Refresh status'}</button></header>
    <div className="grid gap-4 md:grid-cols-3">{[
      { title: 'Brain', icon: Cpu, body: `Text route: ${getProviderDefinition(config?.preferredProvider || '')?.label || 'Gemini'}.`, link: '/settings', action: 'Model connections' },
      { title: 'Hands', icon: Workflow, body: 'Eight operational agent roles. Chat, plan, draft and review in the control plane.', link: '/agent?mode=work', action: 'Open agent workspace' },
      { title: 'Sovereign Trust', icon: ShieldCheck, body: 'Local history and export controls. Cloud inference receives the context you submit.', link: '/notebook', action: 'Your knowledge library' }
    ].map(item => <div key={item.title} className="rounded-2xl border border-blue-400/15 bg-[#0a1830] p-6"><item.icon size={22} className="mb-4 text-blue-300" /><h2 className="font-semibold text-white">{item.title}</h2><p className="mt-3 text-sm leading-6 text-slate-400">{item.body}</p><Link to={item.link} className="mt-5 inline-block text-xs text-cyan-300">{item.action} →</Link></div>)}</div>
    <section className="rounded-2xl border border-blue-400/15 bg-[#071327] p-6"><h2 className="flex items-center gap-2 font-semibold text-white"><Activity size={19} className="text-cyan-300" /> Local runtime</h2><p className="mt-2 text-xs leading-6 text-slate-500">These checks report HTTP availability on the default local ports. They do not certify model readiness, vault ingestion or a Memory Defense policy.</p><div className="mt-5 grid gap-3 md:grid-cols-3">{runtime?.services.map(service => <div key={service.id} className="rounded-xl border border-slate-700/60 p-4"><p className="text-sm text-slate-300">{service.label}</p><p className={`mt-2 text-xs ${service.status === 'responding' ? 'text-emerald-300' : service.status === 'authentication-required' ? 'text-amber-200' : 'text-slate-500'}`}>{service.status === 'responding' ? 'HTTP responding' : service.status === 'authentication-required' ? 'Reachable · authentication required' : service.status === 'unavailable' ? 'Unavailable on local port' : `HTTP ${service.httpStatus}`}</p></div>)}</div>{runtime && <p className="mt-4 text-[11px] text-slate-600">Checked {new Date(runtime.checkedAt).toLocaleTimeString()}</p>}{error && <p role="alert" className="mt-4 text-xs text-rose-300">{error}</p>}</section>
    <HindsightGnoesisNeuralCore />
    <SovereignTrustSection />
  </div>;
}
