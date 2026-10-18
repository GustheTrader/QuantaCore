import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Layers3, Sparkles } from 'lucide-react';
import { SETUP_JOBS, SETUP_MODULES, SETUP_PRESETS, loadSystemSetup, saveSystemSetup, setupJobs, setupModules, type SystemSetupPlan } from '../lib/system-setup';
import { getProviderDefinition } from '../lib/inference-providers';
import { loadLocalRuntime, loadProviderConnections, setPreferredInferenceProvider, type LocalRuntime, type ProviderConfigResponse } from '../services/inferenceService';
import ModelsPanel from './ModelsPanel';
import ConnectionSummary from './ConnectionSummary';
import WorkflowSetup from './WorkflowSetup';
import type { ControlMode } from '../lib/control-plane';
import type { UserTrack } from '../types';
import ReadinessStrip from './ReadinessStrip';
import { loadOperatingSnapshot, type OperatingSnapshot } from '../services/operatingService';
import ComposabilityCopilot from './ComposabilityCopilot';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';
const button = `inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 ${focus}`;
const primary = `${button} border-cyan-300 bg-cyan-300 text-slate-950 hover:bg-cyan-200`;
const steps = ['Choose your jobs', 'Connect one model', 'Review & open'];

export default function SystemLaunchpad({ owner, track, onLaunch, startWithCopilot = false }: { owner: string; track: UserTrack; onLaunch: (mode: ControlMode) => void; startWithCopilot?: boolean }) {
  const [plan, setPlan] = useState(() => loadSystemSetup(owner, track));
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<ProviderConfigResponse>();
  const [runtime, setRuntime] = useState<LocalRuntime>();
  const [provider, setProvider] = useState<string | null>(plan.provider || null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingModel, setEditingModel] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(startWithCopilot);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [evidence, setEvidence] = useState<OperatingSnapshot>();
  const connectionPanel = useRef<HTMLDivElement>(null);
  const routes = config?.connections.filter(connection => connection.model && (!getProviderDefinition(connection.id)?.requiresKey || connection.hasKey)) || [];
  const selected = routes.find(connection => connection.id === provider);
  const modules = setupModules(plan);
  const jobs = setupJobs(plan);
  const refresh = async () => {
    setRefreshing(true); setError('');
    const signal = AbortSignal.timeout(10000);
    const results = await Promise.allSettled([loadProviderConnections(signal), loadLocalRuntime(signal)]);
    if (results[0].status === 'fulfilled') {
      const next = results[0].value;
      setConfig(next);
      setProvider(previous => previous === null ? next.preferredProvider : previous);
    } else { setConfig(undefined); setError(results[0].reason?.message || 'Model connections are unavailable. You can save your setup and connect later.'); }
    setRuntime(results[1].status === 'fulfilled' ? results[1].value : undefined);
    setRefreshing(false);
  };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { const abort=new AbortController();loadOperatingSnapshot(abort.signal).then(setEvidence).catch(()=>setEvidence(undefined));return()=>abort.abort(); }, []);
  useEffect(() => { if (connectionsOpen) connectionPanel.current?.scrollIntoView({ block: 'center' }); }, [connectionsOpen]);
  const change = (patch: Partial<SystemSetupPlan>) => { setPlan(previous => ({ ...previous, ...patch })); setNotice(''); setError(''); };
  const persist = () => {
    try { saveSystemSetup(owner, { ...plan, provider: selected?.id, model: selected?.model }); setNotice('Setup saved in this browser. You can return and customize it.'); return true; }
    catch { setError('The setup could not be saved. Browser storage is unavailable.'); return false; }
  };
  const launch = async () => {
    setBusy(true); setError('');
    try {
      if (selected) {
        const latest = await loadProviderConnections(AbortSignal.timeout(10000));
        const route = latest.connections.find(connection => connection.id === selected.id);
        if (!route || route.model !== selected.model || (getProviderDefinition(route.id)?.requiresKey && !route.hasKey)) {
          throw new Error('This model connection changed. Refresh connections and choose it again.');
        }
        await setPreferredInferenceProvider(selected.id);
      }
      if (persist()) onLaunch(plan.mode);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open the workspace.'); }
    finally { setBusy(false); }
  };
  if (interviewOpen) return <ComposabilityCopilot base={plan} onClose={() => setInterviewOpen(false)} onApply={proposal => { setPlan(proposal); setStep(1); setInterviewOpen(false); setNotice('Copilot proposal applied. Review your model connection, then review and open the setup.'); }} />;
  return <section aria-label="System launch setup" className="space-y-7 pb-28">
    <header className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#102642] to-slate-950 p-6 sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">QuantaGnoesis · system setup</p>
      <h1 className="mt-4 font-outfit text-3xl font-bold tracking-tight text-white sm:text-4xl">Start small. Build your system.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Give one agent two or three useful jobs. Add tools, memory and team workflows as your needs grow.</p>
      <button type="button" className={primary + ' mt-5'} onClick={() => setInterviewOpen(true)}>Let the Composability Copilot guide me</button><p className="mt-2 text-xs text-slate-400">Four short questions. Review a proposed setup, then connect your model.</p>
      <div role="group" aria-label="Setup complexity" className="mt-6 grid gap-3 sm:grid-cols-2">
        {(['starter', 'custom'] as const).map(level => <button key={level} disabled={busy} aria-pressed={plan.level === level} onClick={() => change({ level })} className={`rounded-2xl border p-5 text-left ${focus} ${plan.level === level ? 'border-cyan-300 bg-cyan-300/10' : 'border-slate-700 bg-slate-950/40'}`}>
          <span className="flex items-center gap-3 font-semibold text-white">{level === 'starter' ? <Sparkles size={19} className="text-cyan-300" /> : <Layers3 size={19} className="text-violet-300" />}{level === 'starter' ? 'Starter setup' : 'Custom setup'}{plan.level === level && <Check size={17} className="ml-auto text-cyan-300" />}</span>
          <span className="mt-2 block text-sm leading-6 text-slate-400">{level === 'starter' ? 'One agent, one model, your chosen jobs.' : 'The same foundation, with optional modules and workflow planning.'}</span>
        </button>)}
      </div>
    </header>
    <nav aria-label="System setup steps" className="grid grid-cols-3 gap-2">{steps.map((label, index) => <button key={label} disabled={busy || (index > 0 && !plan.jobIds.length)} onClick={() => setStep(index)} aria-current={step === index ? 'step' : undefined} className={`rounded-xl border p-3 text-left text-xs sm:p-4 sm:text-sm ${focus} ${step === index ? 'border-cyan-300 bg-cyan-400/10 text-white' : 'border-slate-700 text-slate-400'}`}><span className="mb-1 block text-cyan-300">0{index + 1}</span>{label}</button>)}</nav>

    {step === 0 && <div className="space-y-6">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/40 p-5 sm:p-7">
        <h2 className="text-xl font-semibold text-white">What will your agent help with?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">Choose a starting point, then keep the jobs you need.</p>
        <div className="mt-5 flex flex-wrap gap-2">{SETUP_PRESETS.map(preset => <button key={preset.id} aria-pressed={plan.preset === preset.id} onClick={() => change({ preset: preset.id, jobIds: [...preset.jobs], ...(plan.name === `${SETUP_PRESETS.find(item => item.id === plan.preset)?.label} agent` ? { name: `${preset.label} agent` } : {}) })} className={`${button} ${plan.preset === preset.id ? 'border-cyan-300 bg-cyan-400/10 text-cyan-100' : ''}`}>{preset.label}</button>)}</div>
        <p className="mt-4 text-sm text-slate-300">{SETUP_PRESETS.find(preset => preset.id === plan.preset)?.detail}</p>
        <fieldset className="mt-6"><legend className="text-sm font-medium text-white">Your jobs <span className="ml-2 text-slate-400">{plan.jobIds.length} of 3 selected</span></legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{SETUP_JOBS.map(job => {
            const checked = plan.jobIds.includes(job.id);
            const disabled = !checked && plan.jobIds.length >= 3;
            return <label key={job.id} className={`flex gap-3 rounded-xl border p-4 ${checked ? 'border-cyan-300/70 bg-cyan-400/5' : 'border-slate-700'} ${disabled ? 'opacity-50' : 'cursor-pointer'}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={() => change({ jobIds: checked ? plan.jobIds.filter(id => id !== job.id) : [...plan.jobIds, job.id] })} className={`mt-1 h-4 w-4 shrink-0 accent-cyan-300 ${focus}`} /><span><span className="block text-sm font-semibold text-white">{job.label}</span><span className="mt-2 block text-xs leading-6 text-slate-400">{job.detail}</span></span></label>;
          })}</div>
        </fieldset>
        <p className="mt-4 text-xs leading-6 text-slate-400">Choose one to three jobs. Each becomes a task shortcut in your agent workspace.</p>
        <label className="mt-5 block text-sm text-slate-300">Name your setup<input maxLength={64} value={plan.name} onChange={event => change({ name: event.target.value })} className={`mt-2 block w-full max-w-lg rounded-xl border border-slate-700 bg-slate-950 p-3 text-white ${focus}`} /></label>
      </section>
      {plan.level === 'custom' && <section aria-label="Optional modules" className="rounded-2xl border border-violet-300/25 bg-violet-400/5 p-5 sm:p-7">
        <h2 className="text-xl font-semibold text-white">Compose your setup</h2><p className="mt-2 text-sm leading-6 text-slate-400">Add workspace shortcuts for the parts you want to use. Each module has its own connection and permission setup.</p>
        {[...new Set(SETUP_MODULES.map(module => module.group))].map(group => <fieldset key={group} className="mt-6"><legend className="text-xs font-semibold uppercase tracking-widest text-violet-200">{group}</legend><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{SETUP_MODULES.filter(module => module.group === group).map(module => <article key={module.id} className="min-w-0 rounded-xl border border-slate-700 bg-slate-950/40 p-4"><label className="flex cursor-pointer gap-3"><input type="checkbox" checked={plan.moduleIds.includes(module.id)} onChange={event => change({ moduleIds: event.target.checked ? [...plan.moduleIds, module.id] : plan.moduleIds.filter(id => id !== module.id) })} className={`mt-1 h-4 w-4 accent-violet-300 ${focus}`} /><span><span className="block text-sm font-semibold text-white">{module.name}</span><span className="mt-2 block text-xs leading-6 text-slate-400">{module.detail}</span></span></label><ReadinessStrip cells={evidence?.modules.find(item=>item.moduleId===module.id)?.cells} useCase={module.readiness.useCase}/><Link className="mt-3 inline-flex text-xs text-cyan-300" to={module.readiness.evidencePath}>Inspect readiness evidence →</Link></article>)}</div></fieldset>)}
        {plan.moduleIds.includes('orchestration') && <div className="mt-6"><WorkflowSetup /></div>}
      </section>}
    </div>}

    {step === 1 && <section className="space-y-5 rounded-2xl border border-slate-700 bg-slate-900/40 p-5 sm:p-7">
      <div><h2 className="text-xl font-semibold text-white">One model is enough to start</h2><p className="mt-2 text-sm leading-6 text-slate-400">Use an existing connection or connect a provider. Your selected jobs share this model.</p></div>
      <label className="block text-sm text-slate-300">Model connection<select aria-label="Launch model connection" value={selected ? provider : ''} disabled={busy} onChange={event => { setProvider(event.target.value); setNotice(''); }} className={`mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white ${focus}`}><option value="">Connect a model or choose one later</option>{routes.map(route => <option key={route.id} value={route.id}>{getProviderDefinition(route.id)?.label} · {route.model}</option>)}</select></label>
      <p className="text-xs leading-6 text-slate-400">{selected ? 'Saved configuration found. A successful model reply has not been verified here. This becomes your default when you open the workspace.' : 'You can explore the workspace and finish connecting a model later.'}</p>
      <div className="flex flex-wrap gap-3"><button className={button} disabled={busy} aria-expanded={editingModel} onClick={() => { if (editingModel || persist()) setEditingModel(!editingModel); }}>{editingModel ? 'Hide provider setup' : 'Connect or change a model'}</button><button className={button} disabled={busy || refreshing} onClick={() => void refresh()}>{refreshing ? 'Refreshing…' : 'Refresh connections'}</button><Link className={button} onClick={event => { if (!persist()) event.preventDefault(); }} to="/connections">Detailed connection setup</Link></div>
      {editingModel && <div className="border-t border-slate-700 pt-5"><ModelsPanel onChange={() => void refresh()} /></div>}
    </section>}

    {step === 2 && <div className="space-y-5">
      <section className="rounded-2xl border border-cyan-300/25 bg-[#0c1d33] p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Your {plan.level} setup</p><h2 className="mt-3 text-2xl font-semibold text-white">{plan.name.trim() || 'My agent setup'}</h2>
        <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-slate-400">Agent</dt><dd className="mt-1 text-white">One agent · {SETUP_PRESETS.find(preset => preset.id === plan.preset)?.label}</dd></div><div><dt className="text-slate-400">Model</dt><dd className="mt-1 break-words text-white">{selected ? `${getProviderDefinition(selected.id)?.label} · ${selected.model}` : 'Connect later · workspace exploration'}</dd></div><div><dt className="text-slate-400">Your jobs</dt><dd className="mt-1 leading-7 text-white">{jobs.map(job => job.label).join(' · ')}</dd></div><div><dt className="text-slate-400">Optional modules</dt><dd className="mt-1 leading-7 text-white">{modules.length ? modules.map(module => module.name).join(' · ') : 'Add them when you need them'}</dd></div></dl>
        <fieldset className="mt-6"><legend className="text-sm font-semibold text-white">How should tasks run?</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{(['chat', 'work'] as const).map(mode => <label key={mode} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${plan.mode === mode ? 'border-cyan-300/60 bg-cyan-400/5' : 'border-slate-700'}`}><input type="radio" name="launch-mode" checked={plan.mode === mode} onChange={() => change({ mode })} className="mt-1 accent-cyan-300" /><span><strong className="block text-sm text-white">{mode === 'chat' ? 'Conversation' : 'Plan, draft & review'}</strong><span className="mt-2 block text-xs leading-6 text-slate-400">{mode === 'chat' ? 'One model reply per request. A simple starting point.' : 'Three model calls per task using the same model. Review is an additional model pass.'}</span></span></label>)}</div></fieldset>
        <p className="mt-5 text-xs leading-6 text-slate-400">Your setup is saved in this browser. Supplied context goes to your selected model when you submit a task. Source files and memory are chosen in the workspace.</p>
        {plan.preset === 'markets' && <p className="mt-3 text-sm text-amber-200">Trading research stays in paper analysis. Ideas need data and independent validation before use.</p>}
      </section>
      {modules.length > 0 && <section className="rounded-2xl border border-slate-700 p-5 sm:p-7"><h2 className="text-lg font-semibold text-white">Your module setup checklist</h2><div className="mt-4 space-y-4">{modules.map(module => {
        const service = runtime?.services.find(service => service.id === module.service);
        return <div key={module.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4 last:border-0 last:pb-0"><div className="max-w-2xl"><h3 className="text-sm font-semibold text-white">{module.name}</h3><p className="mt-1 text-xs text-violet-200">{service?.status === 'responding' ? 'Latest service probe responded; task evidence is separate below.' : 'Review the evidence for this module.'}</p><p className="mt-2 text-xs leading-6 text-slate-400">{module.requirement}</p><ReadinessStrip cells={evidence?.modules.find(item=>item.moduleId===module.id)?.cells} useCase={module.readiness.useCase}/></div><Link className={button} onClick={event => { if (!persist()) event.preventDefault(); }} to={module.path}>Open setup</Link></div>;
      })}</div></section>}
      <div className="flex flex-wrap gap-3"><button className={primary} disabled={busy || !plan.jobIds.length} onClick={() => void launch()}>{busy ? 'Preparing…' : selected ? 'Save & open agent' : 'Save & explore workspace'}<ArrowRight size={16} /></button><button className={button} disabled={busy || !plan.jobIds.length} onClick={persist}>Save setup</button></div>
    </div>}

    {error && <p role="alert" className="rounded-xl border border-amber-300/30 p-4 text-sm text-amber-200">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-cyan-300/20 p-4 text-sm text-cyan-100">{notice}</p>}
    <div className="flex justify-between gap-3"><button className={button} disabled={busy || step === 0} onClick={() => setStep(previous => previous - 1)}>Back</button>{step < 2 && <button className={primary} disabled={busy || !plan.jobIds.length} onClick={() => setStep(previous => previous + 1)}>Continue<ArrowRight size={16} /></button>}</div>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cyan-300/20 bg-slate-950/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-white">Connections review</p><p className="truncate text-xs text-slate-400">{selected ? `${getProviderDefinition(selected.id)?.label} · ${selected.model}` : 'Model connection pending'} · {jobs.length} selected jobs</p></div><button className={button} aria-expanded={connectionsOpen} onClick={() => setConnectionsOpen(!connectionsOpen)}>{connectionsOpen ? 'Close' : 'Review'}</button></div></div>
    {connectionsOpen && <div ref={connectionPanel} className="rounded-2xl border border-slate-700 p-5"><ConnectionSummary /></div>}
  </section>;
}
