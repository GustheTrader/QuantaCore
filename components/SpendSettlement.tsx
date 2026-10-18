import React, { useEffect, useMemo, useState } from 'react';
import GatewayPolicies from './GatewayPolicies';

type Policy = { monthlyCapUsd: number; connections: Record<string, { enabled: boolean }> };
type Job = { id: string; domain: 'business' | 'trading'; provider: string; status: string; estimatedUpperBoundUsd: number; label: string; createdAt: string };
const box = 'rounded-2xl border border-slate-700 bg-slate-950/60 p-5';
const field = 'mt-2 w-full rounded-xl border border-slate-700 bg-[#071124] px-3 py-2 text-sm text-slate-100';

export default function SpendSettlement() {
  const [budget, setBudget] = useState('0');
  const [markup, setMarkup] = useState('30');
  const [status, setStatus] = useState<any>();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [section, setSection] = useState('overview');

  useEffect(() => {
    try {
      const savedConfig = JSON.parse(localStorage.getItem('quanta_settlement_controls_v1') || '{}');
      if (typeof savedConfig.monthlyBudgetUsd === 'number') setBudget(String(savedConfig.monthlyBudgetUsd));
      if (typeof savedConfig.markupPercent === 'number') setMarkup(String(savedConfig.markupPercent));
    } catch { /* retain safe defaults */ }
    void refresh();
  }, []);

  async function refresh() {
    setError('');
    try {
      const r = await fetch('/api/hybrid/status', { headers: { 'X-Quanta-Client': 'local-ui' } });
      if (!r.ok) throw new Error('Local provider reservations are unavailable.');
      setStatus(await r.json());
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read local spend status.'); }
  }
  const save = () => {
    const monthlyBudgetUsd = Number(budget), markupPercent = Number(markup);
    if (!Number.isFinite(monthlyBudgetUsd) || monthlyBudgetUsd < 0 || monthlyBudgetUsd > 100000 || !Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 500) {
      setError('Enter a monthly amount from $0 to $100,000 and a markup from 0% to 500%.'); return;
    }
    localStorage.setItem('quanta_settlement_controls_v1', JSON.stringify({ monthlyBudgetUsd, markupPercent, updatedAt: new Date().toISOString() }));
    setSaved(true); setError('');
  };
  const markupExample = (1 + Number(markup || 0) / 100).toFixed(2);
  const reserved = status?.reservedUsd || { business: 0, trading: 0 };
  const jobs: Job[] = status?.jobs || [];
  const nav = [['overview','Overview'],['budget','Monthly budget'],['markup','Markup'],['connections','Provider controls'],['ledger','Usage ledger']] as const;
  const estimateTotal = useMemo(() => jobs.reduce((sum, j) => sum + (j.estimatedUpperBoundUsd || 0), 0), [jobs]);

  return <section className="space-y-6" aria-label="Spend and settlement controls">
    <header><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Operator controls · local</p><h2 className="mt-2 text-2xl font-semibold text-white">Spend & settlement</h2><p className="mt-2 max-w-3xl text-sm text-slate-400">Set a monthly working budget, credit markup, and route limits. These controls are stored in this browser; they do not charge customers or create provider credits.</p></header>
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Spend settings" className="flex gap-2 overflow-x-auto lg:block lg:space-y-1">{nav.map(([id,label])=><button key={id} onClick={()=>setSection(id)} aria-current={section===id?'page':undefined} className={`w-full whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm ${section===id?'bg-slate-700 text-white':'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{label}</button>)}</nav>
      <div className="min-w-0 space-y-5">
        {section==='overview' && <><div className="grid gap-3 sm:grid-cols-3"><div className={box}><p className="text-xs text-slate-400">Monthly budget</p><p className="mt-2 text-2xl font-semibold text-white">${Number(budget||0).toFixed(2)}</p><p className="mt-1 text-xs text-slate-500">Local planning budget</p></div><div className={box}><p className="text-xs text-slate-400">Markup</p><p className="mt-2 text-2xl font-semibold text-white">{Number(markup||0)}%</p><p className="mt-1 text-xs text-slate-500">$1.00 cost → ${markupExample} target credits</p></div><div className={box}><p className="text-xs text-slate-400">Approved reservations</p><p className="mt-2 text-2xl font-semibold text-white">${(reserved.business+reserved.trading).toFixed(2)}</p><p className="mt-1 text-xs text-slate-500">Upper-bound estimates, not final charges</p></div></div><div className={box}><h3 className="font-semibold text-white">Settlement status</h3><p className="mt-2 text-sm leading-6 text-slate-300">No automatic customer charging is connected. Quanta records local call reservations and cloud-job estimates; Zo Computer does not return per-run cost in the documented response. Actual provider billing must be reconciled from provider usage statements before settlement.</p><p className="mt-3 text-xs text-amber-200">Review live account and API authentication in Compute. A saved key is separate from a verified model response.</p></div></>}
        {section==='budget' && <div className={box}><h3 className="font-semibold text-white">Monthly working budget</h3><p className="mt-1 text-sm text-slate-400">Owner-side local planning amount. It is not a customer balance or a provider hard cap.</p><label className="mt-5 block text-sm text-slate-300">Monthly budget (USD)<input className={field} type="number" min="0" max="100000" step="0.01" value={budget} onChange={e=>{setBudget(e.target.value);setSaved(false);}} /></label><p className="mt-3 text-xs text-slate-500">This planning amount does not enforce execution limits. Cloud jobs and model requests use their own server-side reservation caps.</p></div>}
        {section==='markup' && <div className={box}><h3 className="font-semibold text-white">Credit markup</h3><p className="mt-1 text-sm text-slate-400">Applied as a display/planning rate over a verified provider cost.</p><label className="mt-5 block text-sm text-slate-300">Markup (%)<input className={field} type="number" min="0" max="500" step="1" value={markup} onChange={e=>{setMarkup(e.target.value);setSaved(false);}} /></label><p className="mt-3 rounded-xl border border-slate-700 p-3 text-sm text-slate-200">Example: $1.00 verified provider cost × (1 + {Number(markup||0)}%) = ${markupExample} target credit value.</p><p className="mt-3 text-xs text-slate-500">This setting does not currently deduct credits or bill anyone.</p></div>}
        {section==='connections' && <><div className={box}><h3 className="font-semibold text-white">Zo Computer and Deep Agent</h3><p className="mt-2 text-sm leading-6 text-slate-300">Zo Computer jobs use an operator-entered upper-bound estimate before approval. Deep Agent model usage is not yet connected to this settlement ledger. Provider statements are the source of actual cost.</p><p className="mt-3 text-xs text-slate-500">Business reservation: ${(reserved.business||0).toFixed(2)} · Trading reservation: ${(reserved.trading||0).toFixed(2)}</p><button onClick={()=>void refresh()} className="mt-4 rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200">Refresh local status</button></div><div className={box}><h3 className="mb-4 font-semibold text-white">Local model route policy</h3><GatewayPolicies /></div></>}
        {section==='ledger' && <div className={box}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-white">Local cloud-job ledger</h3><p className="mt-1 text-xs text-slate-400">Drafted and reserved upper bounds; not provider-reported actuals. Total listed estimate: ${estimateTotal.toFixed(2)}.</p></div><button onClick={()=>void refresh()} className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200">Refresh</button></div><div className="mt-4 divide-y divide-slate-800">{jobs.length===0?<p className="py-5 text-sm text-slate-400">No cloud-job estimates recorded yet.</p>:jobs.slice().reverse().slice(0,50).map(j=><div key={j.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto]"><span className="text-white">{j.label || j.provider} <span className="text-slate-500">· {j.domain} · {j.status}</span></span><span className="text-slate-300">${(j.estimatedUpperBoundUsd||0).toFixed(2)} estimate</span><span className="text-xs text-slate-500">{j.createdAt ? new Date(j.createdAt).toLocaleString() : j.provider}</span></div>)}</div></div>}
        <div className="flex flex-wrap items-center gap-3"><button onClick={save} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600">Save controls</button>{saved&&<span role="status" className="text-sm text-emerald-300">Saved in this browser.</span>}{error&&<span role="alert" className="text-sm text-rose-300">{error}</span>}</div>
      </div>
    </div>
  </section>;
}
