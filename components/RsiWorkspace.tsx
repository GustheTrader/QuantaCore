import React from 'react';
import { NavLink, Navigate, useLocation } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Compass, FlaskConical, Layers3, LockKeyhole } from 'lucide-react';
import RsiLab from './RsiLab';
import RsiIntentLab from './RsiIntentLab';
import QsSystemsLab from './QsSystemsLab';
import SkillGrowthLab from './SkillGrowthLab';
import OperatingEvidenceView from './OperatingEvidenceView';
import ProductionReview from './ProductionReview';

const pages = [
  { path:'/rsi-lab', label:'Harness evolution', icon:FlaskConical },
  { path:'/rsi-lab/intent', label:'Reference · Intent · Taste', icon:Compass },
  { path:'/rsi-lab/systems', label:'QS Systems Lab', icon:Layers3 },
  { path:'/rsi-lab/skills', label:'Skills & growth', icon:BookOpen },
  { path:'/rsi-lab/evidence', label:'Readiness & evidence', icon:BookOpen },
  { path:'/rsi-lab/adoption', label:'Production review', icon:LockKeyhole }
];

export function RsiSubpageCards() {
  return <section aria-label="RSI research workspaces" className="grid gap-4 md:grid-cols-2">
    {[{ path:pages[1].path, title:'Reference · Intent · Taste', text:'Define the goal, ground it in sources and record judgment at decision forks. Prepare a bounded research mandate.', icon:Compass, accent:'text-cyan-300', gradient:'from-cyan-500/10 to-blue-500/5' },
      { path:pages[2].path, title:'QS Systems Lab', text:'Combine systems and signals. Compare documented metrics, shortlist hypotheses and link the evidence to harness R&D.', icon:Layers3, accent:'text-orange-300', gradient:'from-orange-500/10 to-violet-500/5' },
      { path:pages[3].path, title:'Skills & growth', text:'Read SkillForge, explore the pinned Active Skillference graph and manage evidence-linked skill revisions.', icon:BookOpen, accent:'text-violet-300', gradient:'from-violet-500/10 to-cyan-500/5' }].map(page => <NavLink key={page.path} to={page.path} className={`group rounded-3xl border border-slate-700/70 bg-gradient-to-br ${page.gradient} p-6 transition-colors hover:border-cyan-400/50 focus-visible:outline focus-visible:outline-cyan-300`}>
      <div className="flex items-center justify-between"><page.icon size={23} className={page.accent} /><ArrowUpRight size={18} className="text-slate-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" /></div>
      <h2 className="mt-5 text-xl font-semibold text-white">{page.title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{page.text}</p>
    </NavLink>)}
  </section>;
}

export default function RsiWorkspace({ owner = 'local-operator' }: { owner?: string }) {
  const path = useLocation().pathname.replace(/\/+$/, '');
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="RSI Lab subpages" className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-[#071124] p-2">
        {pages.map(page => <NavLink key={page.path} to={page.path} end className={({isActive}) => `flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-cyan-300 ${isActive?'border border-orange-400/30 bg-gradient-to-r from-blue-500/15 to-orange-500/10 text-white':'border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}><page.icon size={16} />{page.label}</NavLink>)}
      </nav>
      <span className="flex items-center gap-2 text-xs text-slate-500"><LockKeyhole size={13} />Sovereign R&D workspace</span>
    </div>
    {path === '/rsi-lab/evidence' ? <OperatingEvidenceView owner={owner} /> : path === '/rsi-lab/adoption' ? <ProductionReview /> : path === '/rsi-lab/skills' ? <SkillGrowthLab owner={owner} /> : path === '/rsi-lab/intent' ? <RsiIntentLab /> : path === '/rsi-lab/systems' ? <QsSystemsLab /> : path === '/rsi-lab' ? <RsiLab workspaces={<RsiSubpageCards />} /> : path.startsWith('/rsi-lab/') ? <Navigate to="/rsi-lab" replace /> : null}
  </div>;
}
