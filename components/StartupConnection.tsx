import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ChatGptPlanCard from './ChatGptPlanCard';
import ConnectionSummary from './ConnectionSummary';
import StartupModules from './StartupModules';
import WorkflowSetup from './WorkflowSetup';
import { loadProviderConnections, loadLocalRuntime, completeWithProvider, setPreferredInferenceProvider, type ProviderConfigResponse, type LocalRuntime } from '../services/inferenceService';
import { getProviderDefinition, COMPATIBLE_PROVIDERS } from '../lib/inference-providers';
import GoogleOAuthCard from './GoogleOAuthCard';
import ModelsPanel from './ModelsPanel';

const button = 'rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-cyan-300';
const steps = ['Sign-in method', 'Choose provider', 'Select model', 'Review connections'];

export default function StartupConnection({ onContinue, prelaunch = false, onSetup }: { onContinue: () => void; prelaunch?: boolean; onSetup?: () => void }) {
  const [config, setConfig] = useState<ProviderConfigResponse>();
  const [runtime, setRuntime] = useState<LocalRuntime>();
  const [provider, setProvider] = useState('');
  const [authMethod, setAuthMethod] = useState<'oauth' | 'api-key' | 'local'>('oauth');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tested, setTested] = useState('');
  const [reply, setReply] = useState('');
  const [checkedAt, setCheckedAt] = useState('');
  const refresh = async () => {
    setBusy(true); setError('');
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
    setBusy(true); setError('');
    try {
      const response = await completeWithProvider(selected.id, { model: selected.model, messages: [{ role: 'user', content: 'Connection check: reply READY.' }], max_tokens: 32 });
      const text = response.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new Error('The model returned no usable text.');
      await setPreferredInferenceProvider(selected.id);
      setTested(identity); setReply(text.slice(0, 200));
    } catch (e) { setError(e instanceof Error ? e.message : 'Model test failed.'); }
    finally { setBusy(false); }
  };
  const verified = Boolean(identity && tested === identity);
  if (prelaunch) return <div className="space-y-5"><ConnectionSummary onSetup={onSetup} /><p className="text-sm text-slate-300">Review the current connections above. Opening the workspace starts no model requests or tool jobs.</p><button className={button} disabled={busy} onClick={onContinue}>Open agent workspace</button></div>;
  return <section aria-label="Startup connection check" className="space-y-6 pb-28">
    <header className="rounded-3xl border border-cyan-300/30 bg-gradient-to-br from-indigo-950 to-slate-950 p-7"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Sovereign Intelligence · guided setup</p><h1 className="mt-3 text-3xl font-bold text-white">Connect your model</h1><p className="mt-3 max-w-3xl text-slate-300">Work through sign-in, provider, and model selection one step at a time. You can review all saved connections at the bottom.</p><button className={button + ' mt-5'} disabled={busy} onClick={refresh}>{busy ? 'Checking…' : 'Refresh status'}</button><p className="mt-2 text-xs text-slate-400">Status checks read saved configuration. Reply tests are optional and use the chosen provider’s quota.</p></header>
    <nav aria-label="Model setup steps" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{steps.map((label, index) => <button key={label} onClick={() => setStep(index)} aria-current={step === index ? 'step' : undefined} className={`rounded-xl border px-3 py-3 text-left text-sm ${step === index ? 'border-cyan-300 bg-cyan-400/10 text-white' : 'border-slate-700 text-slate-400'}`}><span className="mr-2 text-cyan-300">0{index + 1}</span>{label}</button>)}</nav>

    {step === 0 && <div className="space-y-6"><ModelsPanel onChange={()=>void refresh()} /><details className="rounded-xl border border-slate-700 p-4"><summary className="cursor-pointer text-sm text-slate-300">Local inference and other providers</summary><div className="mt-4 flex flex-wrap gap-3"><button className={button} onClick={()=>{setAuthMethod('local');setStep(1);}}>Use Ollama on this computer</button><Link className={button} to="/settings">Additional provider settings</Link></div></details></div>}

    {step === 1 && <section className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Step 2 · provider</p><h2 className="mt-2 text-xl font-bold text-white">Choose a model provider</h2><p className="mt-2 text-sm text-slate-300">Choose Google, OpenAI, Anthropic, xAI/Grok, OpenRouter, or another configured provider. Lower listed prices can help narrow candidates; check the provider’s live pricing and model capabilities before choosing.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{COMPATIBLE_PROVIDERS.filter(p=>authMethod==='local'?p.id==='local':authMethod==='api-key'?p.requiresKey:true).map(item=><button key={item.id} onClick={()=>{setProvider(item.id);setTested('');setStep(2);}} className={`rounded-xl border p-4 text-left ${provider===item.id?'border-cyan-300 bg-cyan-400/10':'border-slate-700 hover:border-slate-500'}`}><span className="flex items-center gap-3 font-semibold text-white"><ProviderMark id={item.id}/>{item.label}</span><span className="mt-2 block text-sm text-slate-400">{item.description}</span><span className="mt-3 block text-xs text-cyan-200">{item.id==='openrouter'?'Catalog includes low-cost and free model options':item.requiresKey?'API key required':'No provider key required'}</span></button>)}</div><div className="mt-5 rounded-2xl border border-slate-700 p-4"><p className="mb-3 text-sm font-semibold text-white">Account sign-in shortcuts</p><div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-800 p-4"><span className="flex items-center gap-3 font-semibold text-white"><ProviderMark id="claude"/>Anthropic · Claude</span><p className="mt-2 text-sm text-slate-400">Claude API uses an Anthropic key. Claude Code subscription sign-in is a separate coding-agent session.</p><Link to="/terminal" className="mt-3 inline-flex text-sm text-cyan-300">Open native sign-in terminal →</Link></div><div className="rounded-xl border border-slate-800 p-4"><span className="flex items-center gap-3 font-semibold text-white"><ProviderMark id="grok"/>xAI · Grok</span><p className="mt-2 text-sm text-slate-400">Grok API uses an xAI key. App subscriptions do not configure API access; Grok coding agent access is through supported native tools.</p><Link to="/terminal" className="mt-3 inline-flex text-sm text-cyan-300">Open coding agent terminal →</Link></div></div></div><div className="mt-5"><Link className={button} to="/settings">Configure provider credentials and load catalog</Link></div></section>}


    {step === 2 && <><section className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Step 3 · model route</p><h2 className="mt-2 text-xl font-bold text-white">Choose a configured model</h2><p className="mt-2 text-sm text-slate-300">The current provider catalog is available in Settings. Select a saved route below, or open settings to connect a provider and load its live catalog.</p><label className="mt-5 block text-sm text-slate-300">Saved provider and model<select aria-label="Startup model route" disabled={busy} value={selected?provider:''} onChange={e=>{setProvider(e.target.value);setTested('');setReply('');setError('');}} className="mt-2 w-full rounded-xl bg-slate-950 p-3 text-white"><option value="">Choose a configured model</option>{routes.map(c=><option key={c.id} value={c.id}>{getProviderDefinition(c.id)?.label} · {c.model}</option>)}</select></label><div className="mt-4 flex flex-wrap gap-3"><Link to="/settings" className={button}>Browse model catalog and configure</Link><button className={button} disabled={busy||!selected} onClick={verify}>{busy?'Testing…':'Send optional test reply'}</button></div><p role="status" className="mt-3 text-sm text-emerald-300">{verified?'Reply verified for '+identity+' · '+reply:'No reply test run for this route'}</p><p className="mt-3 text-xs text-slate-400">Saving a route does not send a model request. Testing does.</p></section>{provider==='google-api'&&<GoogleOAuthCard/>}{provider==='openai-compatible'&&<ChatGptPlanCard/>}</>}

    {step === 3 && <div className="space-y-5"><section className="rounded-2xl border border-slate-700 p-6"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Step 4 · optional modules</p><h2 className="mt-2 text-xl font-bold text-white">Agents and tools</h2><p className="mt-2 text-sm text-slate-300">Review available modules and prepare a workflow. This does not start an agent run.</p><StartupModules runtime={runtime}/><WorkflowSetup/></section><ConnectionSummary/><div className="rounded-2xl border border-slate-700 p-6"><h2 className="font-bold text-white">Selected text route</h2><p className="mt-2 text-sm text-slate-300">{selected?getProviderDefinition(selected.id)?.label+' · '+selected.model:'No configured model selected'}</p><p className="mt-1 text-xs text-slate-400">{verified?'Reply verified this session':'Configured state is not proof of a successful reply'}</p></div><button className={button} disabled={busy} onClick={onContinue}>Continue to Mission Control</button></div>}
    {error&&<p role="alert" className="rounded-xl border border-amber-400/30 p-4 text-sm text-amber-200">{error}</p>}
    {step<3&&<div className="flex justify-between"><button className={button} disabled={step===0} onClick={()=>setStep(s=>Math.max(0,s-1))}>Back</button><button className={button} onClick={()=>setStep(s=>Math.min(3,s+1))}>Continue</button></div>}
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cyan-300/20 bg-slate-950/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-white">Connections review <span className="ml-2 text-xs font-normal text-slate-400">{busy?'Refreshing…':checkedAt?'Updated '+checkedAt:'Not checked'}</span></p><p className="truncate text-xs text-slate-400">{selected?getProviderDefinition(selected.id)?.label+' · '+selected.model:'No model route selected'} · {runtime?.services.length??0} local services discovered</p></div><button className={button+' shrink-0'} onClick={()=>setStep(3)}>Review</button></div></div>
  </section>;
}

function ProviderMark({id}:{id:string}) {
  const common='grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-[10px] font-black tracking-tight';
  const marks:Record<string,{text:string;style:string}>={claude:{text:'A',style:'border-orange-300/30 bg-orange-400/10 text-orange-200'},grok:{text:'x',style:'border-slate-400/30 bg-slate-100/10 text-white'},'google-api':{text:'G',style:'border-blue-300/30 bg-blue-400/10 text-blue-200'},gemini:{text:'✦',style:'border-blue-300/30 bg-blue-400/10 text-blue-200'},'openai-compatible':{text:'◎',style:'border-emerald-300/30 bg-emerald-400/10 text-emerald-200'},openrouter:{text:'OR',style:'border-violet-300/30 bg-violet-400/10 text-violet-200'}};
  const mark=marks[id]||{text:id.slice(0,2).toUpperCase(),style:'border-cyan-300/30 bg-cyan-400/10 text-cyan-200'};
  return <span aria-hidden="true" className={`${common} ${mark.style}`}>{mark.text}</span>;
}
