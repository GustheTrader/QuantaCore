import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NAVIGATION_GROUPS, AGENT_CATEGORIES } from '../lib/navigation';
import { AGENT_TRACKS } from '../lib/agent-tracks';
import type { AgentTrackDefinition } from '../lib/agent-tracks';
import type { UserTrack } from '../types';
import SovereignSiHeader from './SovereignSiHeader';

type DirectoryItem = {
  id: string;
  name: string;
  path: string;
  description?: string;
  role: string;
  category: string;
  track?: AgentTrackDefinition;
};

const CATEGORY_ORDER = [
  'Your named agents',
  'Everyday & personal',
  'Business & finance',
  'Markets & investing',
  'Research & forecasting',
  'Digital assets & DeFi',
  'Operations & investigations'
];

export default function AgentDirectory({ onActivateAgent }: { onActivateAgent: (track: UserTrack) => void }) {
  const location = useLocation();
  const selected = location.state?.companion;
  const [pending, setPending] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'docker' | 'cloud'>('docker');
  const [consoleUrl, setConsoleUrl] = useState('');

  const items: DirectoryItem[] = [
    ...(selected && typeof selected.id === 'string' && typeof selected.name === 'string' && typeof selected.role === 'string'
      ? [{ id: `house-${selected.id}`, name: selected.name.slice(0, 40), path: '/agent-house', description: 'Named Open House agent · explicit role handoff', role: selected.role, category: 'Your named agents' }]
      : []),
    ...AGENT_TRACKS.map(track => ({
      id: `role-${track.id}`,
      name: track.label,
      path: track.id === 'personal' || track.id === 'consumer' ? '/openmuse' : '/agent',
      description: track.description,
      role: track.instruction,
      category: track.directoryGroup,
      track
    })),
    ...NAVIGATION_GROUPS.flatMap(group => group.items)
      .filter(item => Boolean(AGENT_CATEGORIES[item.path]) && item.path !== '/agents')
      .map(item => ({ ...item, id: item.path.slice(1), role: item.description || `Assist with ${item.name}. Ask before external actions.`, category: AGENT_CATEGORIES[item.path] }))
  ];

  async function companion(item: DirectoryItem) {
    setPending(item.id);
    setMessage('Creating or reconnecting the companion…');
    setConsoleUrl('');
    try {
      const response = await fetch('/api/opendots/companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui' },
        body: JSON.stringify({ mode, agentId: item.id, name: item.name, role: item.role })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Companion unavailable.');
      if (typeof data.consoleUrl === 'string' && (data.consoleUrl === 'http://127.0.0.1:4310' || data.consoleUrl.startsWith('https://'))) setConsoleUrl(data.consoleUrl);
      setMessage(`${item.name}: companion connected. Computer ${data.computer.state}. Open OpenDots to explicitly enable browser, files or shell permissions and start the computer.`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setPending('');
    }
  }

  const categories = [...new Set(items.map(item => item.category))].sort((a, b) => {
    const aIndex = CATEGORY_ORDER.indexOf(a);
    const bIndex = CATEGORY_ORDER.indexOf(b);
    return (aIndex === -1 ? CATEGORY_ORDER.length : aIndex) - (bIndex === -1 ? CATEGORY_ORDER.length : bIndex);
  });

  return <div className="space-y-8 p-6 sm:p-10">
    <SovereignSiHeader compact />
    <section aria-labelledby="directory-title" className="rounded-2xl border border-cyan-400/20 bg-slate-950/50 p-6">
      <h2 id="directory-title" className="text-xl font-bold text-white">Find the right hands for each task</h2>
      <p className="mt-3 max-w-3xl text-sm text-slate-400">Choose a specialist by familiar use case. Each agent card includes typical work, a research-backed harness fit and the guardrails to keep the task in scope.</p>
      <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">Harness fits reflect documented capabilities. Compare quality, tool success, cost, latency and failures on your own tasks. Confirm catalog availability and assign the harness in Open House Channel, where task routing stays under your control.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link to="/agent-house" className="rounded-xl border border-cyan-400/30 px-4 py-2 text-cyan-200">Named Open House agents</Link>
        <Link to="/opendots" className="rounded-xl border border-orange-400/30 px-4 py-2 text-orange-200">OpenDots & computer setup</Link>
      </div>
    </section>

    <div className="rounded-2xl border border-slate-700 p-5">
      <label className="text-sm text-slate-200">Optional computer destination <select value={mode} onChange={event => setMode(event.target.value as 'docker' | 'cloud')} className="ml-3 rounded-lg bg-slate-900 p-2"><option value="docker">Local Docker</option><option value="cloud">Configured cloud OpenDots</option></select></label>
      <p className="mt-3 text-sm text-slate-400">Off by default. Companion creation grants no browser, file or shell access. Docker requires the OpenDots computer supervisor; cloud requires your own hosted OpenDots service. This does not attach computer tools to Quanta’s existing chat harness.</p>
      <p role="status" className="mt-3 text-cyan-200">{message}</p>
    </div>
    {consoleUrl && <a href={consoleUrl} target="_blank" rel="noreferrer" className="inline-block rounded-xl bg-cyan-700 px-4 py-3 text-white">Open companion console →</a>}

    {categories.map(category => (
      <section key={category} aria-labelledby={`group-${category.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}>
        <h2 id={`group-${category.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`} className="mb-4 text-xl font-bold text-cyan-200">{category}</h2>
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.filter(item => item.category === category).map(item => {
            const harnessFit = item.track?.harnessFit;
            const useCases = item.track?.caseStudies ?? [];
            return <article key={item.id} className="rounded-2xl border border-blue-400/20 bg-gradient-to-br from-blue-950/55 to-slate-950 p-5 shadow-lg shadow-blue-950/20">
              <h3 className="font-bold text-white">{item.name}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">{item.description || item.role}</p>

              {item.track && <div className="mt-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Common use cases</p>
                <ul className="flex flex-wrap gap-2" aria-label={`${item.name} use cases`}>
                  {useCases.slice(0, 2).map(useCase => <li key={useCase.title} className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">{useCase.title}</li>)}
                </ul>
                <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-cyan-200">View use case details</summary>
                  <ul className="mt-3 space-y-3">
                    {useCases.map(useCase => <li key={useCase.title}>
                      <p className="text-xs font-semibold text-slate-200">{useCase.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{useCase.outcome}</p>
                    </li>)}
                  </ul>
                </details>
              </div>}

              {harnessFit && <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-950/25 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-cyan-300">Best-fit harness · candidate</p>
                  <a href={harnessFit.source.url} target="_blank" rel="noreferrer" className="text-[10px] text-cyan-200 underline decoration-cyan-500/50 underline-offset-2">Research source ↗</a>
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{harnessFit.primary}</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">{harnessFit.rationale}</p>
                {harnessFit.support && <p className="mt-2 border-t border-slate-700/70 pt-2 text-xs leading-5 text-slate-400"><span className="font-semibold text-violet-200">Optional specialist step:</span> {harnessFit.support} {harnessFit.supportSource && <a href={harnessFit.supportSource.url} target="_blank" rel="noreferrer" className="text-violet-200 underline decoration-violet-500/50 underline-offset-2">{harnessFit.supportSource.label} ↗</a>}</p>}
                <p className="mt-2 text-[11px] leading-5 text-slate-500"><span className="font-semibold text-orange-200">Boundary:</span> {harnessFit.guardrail}</p>
              </div>}

              <div className="mt-5 flex flex-wrap gap-2">
                <Link to={item.path} onClick={event => {
                  if (item.track) { event.preventDefault(); onActivateAgent(item.track.id); }
                }} className="rounded-lg bg-gradient-to-r from-cyan-700 to-blue-700 px-3 py-2 text-sm text-white">Open workspace</Link>
                <Link to="/work-zone" state={{ onboard: { name: item.name, role: item.role } }} className="rounded-lg border border-cyan-500/35 px-3 py-2 text-sm text-cyan-200">Onboard worker</Link>
                <button disabled={Boolean(pending)} onClick={() => void companion(item)} className="rounded-lg border border-orange-400/35 px-3 py-2 text-sm text-orange-200 disabled:opacity-50">{pending === item.id ? 'Connecting…' : 'Optional computer'}</button>
              </div>
            </article>;
          })}
        </div>
      </section>
    ))}
  </div>;
}
