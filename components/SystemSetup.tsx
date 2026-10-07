import React, { useState } from 'react';
import ProviderConnections from './ProviderConnections';
import WorkflowSetup from './WorkflowSetup';
import { loadProviderConnections, type ProviderConfigResponse } from '../services/inferenceService';
import { PROVIDER_CHOICES } from '../lib/inference-providers';

const systems = [
  { id: 'quanta', name: 'QuantaCore', detail: 'Choose intelligence for your agents and research workspace.' },
  { id: 'paperclip', name: 'Paperclip', detail: 'Organize agents, projects and reviewed planning work.' },
  { id: 'qs', name: 'QS Terminal', detail: 'Prepare a research bridge; QS owns risk checks and execution.' }
] as const;
const steps = ['Choose system', 'Connect intelligence', 'Check readiness', 'Review setup'];
const button = 'rounded-xl border border-cyan-400/40 px-4 py-3 text-sm font-semibold text-cyan-200 disabled:opacity-40';
const purposes = ['Research', 'Business planning', 'Development', 'Trading research · paper only'];
function savedPlan() {
  try {
    const plan = JSON.parse(localStorage.getItem('quanta_setup_plan_v1') || '{}');
    return { system: systems.find(s => s.id === plan.system)?.id || 'quanta' as const, purpose: purposes.includes(plan.purpose) ? String(plan.purpose) : 'Research' };
  } catch { return { system: 'quanta' as const, purpose: 'Research' }; }
}

export default function SystemSetup({ geminiConnection }: { geminiConnection?: React.ReactNode }) {
  const [step, setStep] = useState(0);
  const [system, setSystem] = useState<typeof systems[number]['id']>(() => savedPlan().system);
  const [purpose, setPurpose] = useState(() => savedPlan().purpose);
  const [config, setConfig] = useState<ProviderConfigResponse>();
  const [checkedAt, setCheckedAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const selected = systems.find(s => s.id === system)!;
  const route = config?.connections.find(c => c.id === config.preferredProvider);
  const configured = Boolean(route?.model);
  const check = async () => {
    setBusy(true); setError(''); setConfig(undefined); setCheckedAt(''); setSaved(false);
    try { setConfig(await loadProviderConnections()); setCheckedAt(new Date().toLocaleString()); }
    catch (e) { setError(e instanceof Error ? e.message : 'The local backend is unavailable.'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Universal system setup" className="space-y-6 rounded-3xl border border-cyan-400/25 bg-[#091529] p-5 sm:p-8">
    <div><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Sovereign Intelligence · Setup</p><h2 className="mt-2 text-2xl font-bold text-white">One setup. Your choice of system.</h2><p className="mt-2 text-sm leading-6 text-slate-300">Choose a system, connect intelligence, check its configuration, then review what remains. Provider authentication stays specific to the provider.</p></div>
    <WorkflowSetup />
    <nav aria-label="Setup steps" className="grid grid-cols-2 gap-2 lg:grid-cols-4">{steps.map((name, index) => <button key={name} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)} className={`${button} text-left ${step === index ? 'bg-cyan-500/20 border-cyan-300' : 'bg-slate-950/40'}`}>{index + 1}. {name}</button>)}</nav>
    {step === 0 && <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3">{systems.map(s => <button key={s.id} aria-pressed={system === s.id} onClick={() => { setSystem(s.id); setSaved(false); }} className={`rounded-2xl border p-5 text-left ${system === s.id ? 'border-cyan-300 bg-cyan-500/10' : 'border-slate-700'}`}><span className="block font-bold text-white">{s.name}</span><span className="mt-2 block text-sm leading-6 text-slate-300">{s.detail}</span></button>)}</div><label className="block text-sm text-slate-300">What will you use it for?<select value={purpose} onChange={e => { setPurpose(e.target.value); setSaved(false); }} className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"><option>Research</option><option>Business planning</option><option>Development</option><option>Trading research · paper only</option></select></label><p className="text-sm text-slate-400">This selection prepares a setup plan. Connecting a model does not automatically connect Paperclip or QS.</p></div>}
    {step === 1 && <ProviderConnections geminiConnection={geminiConnection} />}
    {step === 2 && <div className="space-y-4"><h3 className="font-semibold text-white">Check the local configuration</h3><p className="text-sm leading-6 text-slate-300">Read the backend status and saved model route. This check sends no model prompt and does not start an agent.</p><button className={button} disabled={busy} onClick={check}>{busy ? 'Checking…' : 'Check configuration'}</button><div aria-live="polite">{error && <p role="alert" className="rounded-xl border border-amber-400/30 p-4 text-sm text-amber-200">{error} Start the full Quanta server under the Windows account that owns its protected credentials. Keep those credentials intact.</p>}{config && <div className="space-y-2 text-sm text-slate-300"><p>Backend: responding · checked {checkedAt}</p><p>Text route: {PROVIDER_CHOICES.find(p => p.id === config.preferredProvider)?.label || config.preferredProvider}</p><p>Model: {route?.model || 'Not configured in the shared model gateway'}</p><p>Model response: not tested</p><p>{configured ? 'Configuration found. A bounded model-response test is still required.' : 'Return to Connect intelligence to save a model route.'}</p></div>}</div></div>}
    {step === 3 && <div className="space-y-4"><h3 className="font-semibold text-white">Your setup plan</h3><dl className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2"><div><dt className="text-slate-400">System</dt><dd>{selected.name}</dd></div><div><dt className="text-slate-400">Purpose</dt><dd>{purpose}</dd></div><div><dt className="text-slate-400">Configuration check</dt><dd>{checkedAt ? configured ? 'Model configured; response unverified' : 'Backend available; model setup incomplete' : 'Not verified'}</dd></div><div><dt className="text-slate-400">Operation</dt><dd>Manual setup · {system === 'qs' ? 'research bridge pending' : 'agent activation pending'}</dd></div></dl><p className="text-sm leading-6 text-slate-300">{system === 'paperclip' ? 'Next: finish the Paperclip agent subscription sign-in in its own organization, then verify one manually triggered planning result.' : system === 'qs' ? 'Next: confirm the QS backend address and approve the research bridge contract, then validate a read-only snapshot round trip.' : 'Next: test a bounded response from your chosen route, then assign it to an agent.'}</p><button className={button} onClick={() => { try { localStorage.setItem('quanta_setup_plan_v1', JSON.stringify({ system, purpose, checkedAt, configurationFound: configured, mode: 'manual', savedAt: new Date().toISOString() })); setSaved(true); setError(''); } catch { setError('Could not save the setup plan in this browser.'); } }}>Save setup plan</button>{saved && <p role="status" className="text-sm text-emerald-300">Plan saved in this browser. No agents or integrations were activated.</p>}{error && <p role="alert" className="text-sm text-amber-200">{error}</p>}</div>}
    <div className="flex justify-between border-t border-slate-700 pt-5"><button className={button} disabled={step === 0} onClick={() => setStep(s => s - 1)}>Back</button><button className={button} disabled={step === 3} onClick={() => setStep(s => s + 1)}>Next: {steps[Math.min(step + 1, 3)]}</button></div>
  </section>;
}
