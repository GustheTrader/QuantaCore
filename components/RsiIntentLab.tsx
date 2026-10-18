import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Compass, Download, ExternalLink, GitBranch, ShieldCheck, Upload } from 'lucide-react';
import { defaultIntent, intentPrompt, parseIntent, RSI_INTENT_KEY, RSI_SEED_KEY, saveJson, type ResearchIntent } from '../lib/rsi-workspaces';

const input = 'mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-3 text-sm text-slate-200 focus:border-cyan-400 focus:outline-none';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/20 focus-visible:outline focus-visible:outline-cyan-300 disabled:opacity-40';
const fields: { key: keyof Omit<ResearchIntent,'version'|'title'|'domain'>; title:string; help:string }[] = [
  { key:'objective',title:'Desired outcome',help:'Describe the problem, expected deliverable and measurable improvement.' },
  { key:'references',title:'Reference evidence',help:'List source URLs or local artifact IDs, provenance, dates and what each source supports.' },
  { key:'constraints',title:'Constraints',help:'Specify allowed data, tools, privacy limits, compute budget and actions that require review.' },
  { key:'success',title:'Success criteria',help:'Define acceptance metrics, baseline and independent validation before the experiment starts.' },
  { key:'health',title:'Health metrics',help:'Name what must not degrade: risk, factual accuracy, latency, cost or privacy.' },
  { key:'stop',title:'Stop rules',help:'Set evidence gaps, budget limits, failure thresholds and conditions that require escalation.' },
  { key:'judgment',title:'Taste · judgment at decision forks',help:'Rank trade-offs, describe preferred alternatives and require a rationale when choosing a path.' },
  { key:'approval',title:'Autonomy & approval boundary',help:'State what the agent may do alone and what the operator must approve.' }
];

function loadDraft() {
  try { const value = localStorage.getItem(RSI_INTENT_KEY); return value ? parseIntent(JSON.parse(value)) : { ...defaultIntent }; }
  catch { return { ...defaultIntent }; }
}

export default function RsiIntentLab() {
  const [draft,setDraft] = useState<ResearchIntent>(loadDraft), [notice,setNotice] = useState(''), [error,setError] = useState('');
  const file = useRef<HTMLInputElement>(null); const navigate = useNavigate();
  const update = (change:Partial<ResearchIntent>) => { setDraft(old => ({...old,...change})); setNotice('Unsaved changes'); setError(''); };
  const complete = ['objective','references','constraints','success','health','stop','judgment','approval'].every(key => String(draft[key as keyof ResearchIntent]).trim());
  const save = () => { try { localStorage.setItem(RSI_INTENT_KEY,JSON.stringify(draft));setNotice('Draft saved in this browser.');return true; } catch {setError('Browser storage is unavailable. Export your draft to keep a backup.');return false;} };
  const template = (domain:ResearchIntent['domain']) => {
    update({ domain,
      objective: domain === 'Agent harness' ? 'Improve source attribution and uncertainty handling against a frozen baseline harness.' : domain === 'Trading research' ? 'Compare a system-only baseline with one additional signal using documented costs and independent validation.' : 'Research a DeFi allocation hypothesis under explicit liquidity, protocol and custody constraints.',
      references: 'Record primary sources, dataset versions and evidence artifact paths here. Verify each source before using it.',
      constraints: 'Read-only research. Keep private data local. Freeze model, rules and evaluation data before comparison. No live orders, wallet signing or paid tool calls without separate approval.',
      success: 'Document baseline and candidate measurements; reserve unseen validation data; require independent review before adoption.',
      health: 'No privacy regression, unsupported factual claims or risk-limit violation. Report compute cost and uncertainty.',
      stop: 'Stop on missing provenance, contaminated holdout data, exceeded approved budget or unexplained metric regression.',
      judgment: 'Prefer reproducible evidence and simple explanations over complex hypotheses with weak support. Record the alternative and why it was rejected.'
    });
  };
  return <div className="space-y-6 pb-10">
    <header className="relative overflow-hidden rounded-[2rem] border border-orange-400/35 bg-gradient-to-br from-[#102c43] via-[#09162d] to-[#221735] p-7 md:p-10">
      <div className="pointer-events-none absolute -right-10 -top-20 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <p className="relative text-xs font-semibold uppercase tracking-[.22em] text-orange-300">RSI Lab / Intent engineering</p>
      <h1 className="relative mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-white md:text-5xl">Give intelligence a <span className="bg-gradient-to-r from-cyan-300 to-orange-300 bg-clip-text text-transparent">clear mandate.</span></h1>
      <p className="relative mt-4 max-w-3xl text-lg leading-7 text-slate-300">Reference grounds the work. Intent defines the outcome. Taste guides the next decision.</p>
      <div className="relative mt-7 grid gap-3 sm:grid-cols-4">{[['01','Reference','Sources & provenance'],['02','Intent','Goal & boundaries'],['03','Taste','Trade-offs & judgment'],['04','Review','Evidence & approval']].map(([n,title,caption]) => <div key={n} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"><p className="text-[10px] tracking-widest text-cyan-400">{n}</p><h2 className="mt-2 font-semibold text-white">{title}</h2><p className="mt-1 text-xs text-slate-400">{caption}</p></div>)}</div>
    </header>
    {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <section className="rounded-3xl border border-slate-800 bg-[#081225] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-semibold text-white"><Compass className="text-cyan-300" size={20} />Research mandate builder</h2><span className="text-xs text-slate-500">Browser-local draft · export for backup</span></div>
        <div className="mt-5 flex flex-wrap gap-2">{(['Agent harness','Trading research','DeFi research'] as const).map(domain => <button key={domain} className={button} onClick={() => template(domain)}>{domain} template</button>)}</div>
        <label className="mt-5 block text-sm text-slate-300">Mandate name<input className={input} value={draft.title} maxLength={120} onChange={e => update({title:e.target.value})} /></label>
        <label className="mt-4 block text-sm text-slate-300">Research domain<select className={input} value={draft.domain} onChange={e => update({domain:e.target.value as ResearchIntent['domain']})}>{['Agent harness','Trading research','DeFi research'].map(value => <option key={value}>{value}</option>)}</select></label>
        <div className="mt-5 space-y-5">{fields.map(field => <label key={field.key} className="block text-sm text-slate-300">{field.title}<span className="mt-1 block text-xs leading-5 text-slate-500">{field.help}</span><textarea aria-label={field.title} className={`${input} min-h-24`} value={draft[field.key]} maxLength={16000} onChange={e => update({[field.key]:e.target.value})} /></label>)}</div>
        <div className="mt-6 flex flex-wrap gap-3"><button className={button} onClick={save}>Save local draft</button><button className={button} onClick={() => saveJson('quanta-research-intent.json',draft)}><Download size={15} />Export mandate</button><button className={button} onClick={() => file.current?.click()}><Upload size={15} />Import mandate</button></div>
        <input className="hidden" type="file" accept=".json,application/json" ref={file} aria-label="Import intent JSON" onChange={async e => {const uploaded=e.target.files?.[0];if(!uploaded)return;try {if(uploaded.size>200000)throw Error('Use an intent file smaller than 200 KB.');setDraft(parseIntent(JSON.parse(await uploaded.text())));setNotice('Imported draft. Save to keep it in this browser.');setError('');}catch(err:any){setError(err.message);}finally{e.target.value='';}}} />
        {notice && <p role="status" className="mt-4 text-sm text-cyan-200">{notice}</p>}
      </section>
      <div className="space-y-5">
        <section className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-[#081225] p-6"><h2 className="flex items-center gap-2 text-xl font-semibold text-white"><GitBranch size={20} className="text-violet-300" />Into the RSI loop</h2><ol className="mt-4 space-y-4 text-sm leading-6 text-slate-400"><li><span className="text-cyan-200">01 · Freeze the mandate.</span> Define the target and provenance before tuning.</li><li><span className="text-cyan-200">02 · Prepare the harness.</span> Copy this mandate into starting instructions and review the model and budget.</li><li><span className="text-cyan-200">03 · Measure and replay.</span> Evaluate candidates; use completed evidence for recorded-world replay.</li><li><span className="text-orange-200">04 · Review adoption.</span> Inspect the independent holdout and keep exports inactive until deliberately integrated.</li></ol>
          <button className={`${button} mt-5 w-full`} disabled={!complete || !draft.title.trim()} onClick={() => {const prompt=intentPrompt(draft);if(prompt.length>6000){setError('Shorten the mandate to 6,000 characters before preparing the starting harness.');return;}try {sessionStorage.setItem(RSI_SEED_KEY,JSON.stringify({version:1,title:draft.title,prompt,preparedAt:new Date().toISOString()}));navigate('/rsi-lab?intent=1');}catch{setError('Session storage is unavailable. Export the mandate and paste its instructions into the lab.');}}}>Use as starting harness instructions <ArrowRight size={16} /></button>
          <p className="mt-3 text-xs leading-5 text-slate-500">This prepares a prompt. Financial metrics and trade rules require a separate evaluator; the current RSI runner measures its synthetic agent-workflow suite.</p>
        </section>
        <section className="rounded-3xl border border-slate-800 bg-[#081225] p-6"><h2 className="flex items-center gap-2 text-xl font-semibold text-white"><BookOpen size={20} className="text-cyan-300" />Composable reference stack</h2><div className="mt-4 space-y-4 text-sm"><div><a className="text-cyan-200 hover:underline" href="#/alexandria">Firecrawl Alexandria →</a><p className="mt-1 leading-6 text-slate-400">Discover capabilities, inspect inputs and prices, then approve retrieval. Put the resulting evidence IDs in your mandate.</p></div><div><a className="text-cyan-200 hover:underline" href="https://docs.near-intents.org/" target="_blank" rel="noreferrer">NEAR Intents documentation <ExternalLink size={12} className="inline" /></a><p className="mt-1 leading-6 text-slate-400">Research a desired outcome and its execution constraints. A natural-language mandate is not a signed on-chain intent.</p></div><div><a className="text-cyan-200 hover:underline" href="https://github.com/nearai/ironclaw" target="_blank" rel="noreferrer">IronClaw source <ExternalLink size={12} className="inline" /></a><p className="mt-1 leading-6 text-slate-400">Evaluate a downstream runtime with sandbox and credential boundaries before adapting a reviewed profile.</p></div><div><a className="text-cyan-200 hover:underline" href="https://market.near.ai/" target="_blank" rel="noreferrer">NEAR AI Agent Market <ExternalLink size={12} className="inline" /></a><p className="mt-1 leading-6 text-slate-400">Study specialist discovery and contracted deliverables. Hiring, escrow and wallet actions need a separately configured adapter and approval.</p></div></div></section>
        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[.04] p-6"><h2 className="flex items-center gap-2 font-semibold text-emerald-200"><ShieldCheck size={19} />Own the brief and the evidence</h2><p className="mt-3 text-sm leading-6 text-slate-400">Drafts stay in this browser's local storage and exports stay under your control. Browser storage is not an encrypted vault; keep credentials in Quanta's server-side provider settings.</p><p className="mt-3 text-xs leading-5 text-slate-500">Adapted from your Near.md reference. Provider rankings, marketplace statistics and benchmark claims in the notes are not used as verified performance evidence.</p></section>
      </div>
    </div>
  </div>;
}
