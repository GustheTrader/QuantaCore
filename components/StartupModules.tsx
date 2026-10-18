import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import ProviderConnections from './ProviderConnections';
import { CodingAgentsPage } from './herald/CodingAgentsPage';
import { paletteVars } from './herald/theme';
import { heraldThemes } from './herald/themes';
import type { LocalRuntime } from '../services/inferenceService';
import './herald/hermes.css';

const modules = [
  { name: 'Hermes', path: '/hermes', note: 'Main agent, spaces, memory and native approvals.' },
  { name: 'OpenHands / Zo', path: '/hermes?view=connections', note: 'Remote orchestration and account connectors. Configure and verify the remote worker separately.' },
  { name: 'Goose & coding agents', path: '/hermes?view=coding', note: 'Native sign-in and provider configuration.' },
  { name: 'Clip Studio', path: '/hermes?view=clips', note: 'Local media jobs, model packs and GPU readiness.' },
  { name: 'MCP connectors', path: '/mcp', note: 'Discover tools and review their permissions before use.' },
  { name: 'Paperclip', path: '/work-zone', service: 'paperclip', note: 'Organization and workflow adapter.' },
  { name: 'OpenMuse', path: '/openmuse', service: 'openmuse', note: 'Optional agent runtime.' },
  { name: 'Honcho / memory', path: '/memory', service: 'honcho', note: 'Memory adapter and local knowledge records.' },
];
const action = 'inline-flex rounded-xl border border-cyan-300/30 px-4 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300';

export default function StartupModules({ runtime }: { runtime?: LocalRuntime }) {
  const [space, setSpace] = useState('work');
  const [modelsOpen, setModelsOpen] = useState(false);
  const [codingOpen, setCodingOpen] = useState(false);
  const theme = heraldThemes.find(item => item.name === 'herald-ocean')!;
  return <div className="space-y-6">
    <section className="rounded-3xl border border-emerald-300/30 bg-emerald-400/5 p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Your proprietary value</p>
      <h2 className="mt-2 text-2xl font-bold text-white">Neural Core – SI Intelligence</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">Your intelligence layer coordinates context, memory, routing, workflows and evaluation. Models, subscriptions and open-source Lego modules connect through replaceable adapters under your control.</p>
      <div className="mt-4 flex flex-wrap gap-3"><Link className={action} to="/neural-core">Open Neural Core</Link><Link className={action} to="/harness-router">Intelligence routing</Link></div>
    </section>
    <section className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6">
      <h2 className="text-xl font-bold text-white">Models & subscriptions</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">Connect API models and supported account sign-ins here. Provider website sessions, subscription access and CLI authentication are separate; a web subscription does not automatically grant API access. Credentials follow each adapter’s existing storage and renewal rules.</p>
      <button className={action + ' mt-4'} aria-expanded={modelsOpen} onClick={() => setModelsOpen(!modelsOpen)}>{modelsOpen ? 'Hide model setup' : 'Authenticate / configure models'}</button>
      {modelsOpen && <div className="mt-5"><ProviderConnections /></div>}
    </section>
    <section className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6">
      <h2 className="text-xl font-bold text-white">Coding agents & CLI</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">Check installed agents and complete native sign-in in an embedded terminal. Installation is separate from authentication; a running terminal is not proof of model access. Saved native credentials are reused until renewal is required.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3"><label className="text-sm text-slate-300">Space <select className="ml-2 rounded-lg bg-slate-950 p-2" value={space} onChange={event => setSpace(event.target.value)}><option value="work">Work</option><option value="personal">Personal</option><option value="ideas">Ideas</option></select></label><button className={action} aria-expanded={codingOpen} onClick={() => setCodingOpen(!codingOpen)}>{codingOpen ? 'Hide coding setup' : 'Sign in / configure coding agents'}</button><Link className={action} to="/terminal">Open Quanta CLI</Link></div>
      <p className="mt-4 text-xs text-slate-400">Claude Code / Gemini installer on this computer: <code>C:\QuantaCore\scripts\install-coding-agents.ps1</code>. Run it explicitly when installation is needed. Codex and Goose use their existing native installations.</p>
      {codingOpen && <div className="herald-hermes mt-5" style={{ ...paletteVars(theme.colors, { scheme: theme.shell?.scheme }), minHeight: 0, height: 'auto' } as CSSProperties}><CodingAgentsPage key={space} workspace={space} initialSurface="terminal" /></div>}
    </section>
    <section className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6">
      <h2 className="text-xl font-bold text-white">Open-source Lego modules & connections</h2>
      <p className="mt-2 text-sm text-slate-300">Open each adapter to configure accounts, tools and permissions. Unknown readiness stays unverified; service availability alone does not prove a completed task.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{modules.map(module => {
        const service = 'service' in module ? runtime?.services.find(item => item.id === module.service) : undefined;
        const status = service?.status === 'responding' ? 'Connected · HTTP only' : service?.status === 'authentication-required' ? 'Sign-in needed' : service ? 'Unavailable · check setup' : 'Readiness unverified';
        return <article key={module.name} className="rounded-xl border border-slate-700 p-4"><h3 className="font-bold text-white">{module.name}</h3><p className="mt-2 text-xs text-cyan-200">{status}</p><p className="mt-2 text-sm text-slate-400">{module.note}</p><Link className={action + ' mt-4'} to={module.path}>Open setup</Link></article>;
      })}</div>
    </section>
  </div>;
}
