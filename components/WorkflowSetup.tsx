import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { logConnection } from '../services/connectionLog';

const cases = {
  research: { label: 'Research', roles: ['Researcher', 'Evidence reviewer', 'Synthesizer'], tools: 'Selected sources and optional memory', method: 'sequential' },
  development: { label: 'Development', roles: ['Planner', 'Builder', 'Reviewer'], tools: 'Selected project files and coding harness', method: 'sequential' },
  business: { label: 'Business planning', roles: ['Analyst', 'Planner', 'Reviewer'], tools: 'Selected business documents and project board', method: 'coordinator' },
  trading: { label: 'Trading research · paper only', roles: ['Data researcher', 'Quant analyst', 'Independent reviewer'], tools: 'Read-only market data and research workspace', method: 'parallel' }
} as const;
type UseCase = keyof typeof cases;
type Mode = 'single' | 'orchestrated';
type Method = 'sequential' | 'parallel' | 'coordinator';
function readPlan(): { useCase: UseCase; mode: Mode; method: Method } {
  try {
    const p = JSON.parse(localStorage.getItem('quanta_workflow_setup_v1') || '{}');
    return { useCase: Object.hasOwn(cases, p.useCase) ? p.useCase : 'research', mode: p.mode === 'orchestrated' ? 'orchestrated' : 'single', method: ['sequential', 'parallel', 'coordinator'].includes(p.method) ? p.method : 'sequential' };
  } catch { return { useCase: 'research', mode: 'single', method: 'sequential' }; }
}
export default function WorkflowSetup() {
  const [plan, setPlan] = useState(readPlan);
  const [notice, setNotice] = useState('');
  const preset = cases[plan.useCase];
  const change = (next: typeof plan) => { setPlan(next); setNotice(''); };
  const control = 'rounded-xl border border-cyan-400/40 px-4 py-3 text-sm text-cyan-100';
  return <section aria-label="Agent workflow setup" className="space-y-4 rounded-2xl border border-violet-400/40 bg-slate-950/60 p-5">
    <h2 className="text-xl font-bold text-white">How do you want to work?</h2>
    <div className="grid gap-3 sm:grid-cols-2">{(['single', 'orchestrated'] as const).map(mode => <button key={mode} aria-pressed={plan.mode === mode} onClick={() => change({ ...plan, mode })} className={`${control} text-left ${plan.mode === mode ? 'bg-violet-500/25 border-violet-300' : ''}`}><strong className="block">{mode === 'single' ? 'Single agent' : 'Orchestrated workflow'}</strong><span className="mt-1 block text-slate-300">{mode === 'single' ? 'One agent owns one focused task.' : 'Several agents contribute to one shared objective.'}</span></button>)}</div>
    <label className="block text-sm text-slate-300">Use case<select aria-label="Workflow use case" value={plan.useCase} onChange={e => { const useCase = e.target.value as UseCase; change({ ...plan, useCase, method: cases[useCase].method }); }} className="mt-2 w-full rounded-xl bg-slate-900 p-3">{Object.entries(cases).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
    {plan.mode === 'orchestrated' && <label className="block text-sm text-slate-300">Orchestration method<select aria-label="Orchestration method" value={plan.method} onChange={e => change({ ...plan, method: e.target.value as Method })} className="mt-2 w-full rounded-xl bg-slate-900 p-3"><option value="sequential">Sequential · ordered handoffs</option><option value="parallel">Parallel · independent analysis, then synthesis</option><option value="coordinator">Coordinator · delegate and combine results</option></select></label>}
    <div className="space-y-2 text-sm text-slate-300" aria-live="polite"><p><strong>Suggested roles:</strong> {plan.mode === 'single' ? preset.roles[0] : preset.roles.join(' → ')}</p><p><strong>Connections to review:</strong> {preset.tools}; a verified model route for every participating agent.</p>{plan.mode === 'orchestrated' && <p><strong>Handoffs:</strong> {plan.method === 'parallel' ? 'Agents analyze independently; a synthesizer combines outputs and disagreements.' : plan.method === 'coordinator' ? 'A coordinator assigns scoped tasks, reviews results and requests operator review.' : 'Each agent passes its output and sources to the next; a reviewer checks the final result.'}</p>}<p><strong>Before a run:</strong> confirm the objective, agent assignments, model routes, tool access and stopping conditions.</p></div>
    <div className="flex flex-wrap gap-3"><button className={control} onClick={() => { try { localStorage.setItem('quanta_workflow_setup_v1', JSON.stringify({ ...plan, roles: plan.mode === 'single' ? [preset.roles[0]] : preset.roles, savedAt: new Date().toISOString(), status: 'draft' })); logConnection('Workflow setup', 'draft-saved', `${plan.mode} · ${plan.useCase}${plan.mode === 'orchestrated' ? ' · ' + plan.method : ''}`); setNotice('Setup draft saved in this browser. Assign agents and connections before running; orchestration execution is not activated by this plan.'); } catch { setNotice('Could not save this setup. Browser storage is unavailable.'); } }}>Save workflow setup</button><Link className={control} to={plan.mode === 'single' ? '/agent?mode=work' : '/work-zone'}>{plan.mode === 'single' ? 'Open task workspace' : 'Open orchestration workspace'}</Link></div>
    <p className="text-xs text-slate-400">This is a setup draft. Workspace links do not apply these roles or start a run. External actions retain their approval steps.</p>
    {notice && <p role="status" className="text-sm text-cyan-200">{notice}</p>}
  </section>;
}
