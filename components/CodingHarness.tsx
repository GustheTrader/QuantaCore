import React from 'react';
import { Code2, ExternalLink, SquareTerminal, ShieldCheck, Workflow } from 'lucide-react';

interface Props { onOpenTerminal: () => void }

const harnesses = [
  { label: 'Codex', id: 'codex', note: 'Connect an existing Codex CLI installation.' },
  { label: 'Claude Code', id: 'claude', note: 'Add Fireworks models to an existing Claude Code harness.' },
  { label: 'OpenCode', id: 'opencode', note: 'Route an existing OpenCode installation.' },
  { label: 'VS Code', id: 'vscode', note: 'Use the FireConnect VS Code Chat integration.' }
];

export default function CodingHarness({ onOpenTerminal }: Props) {
  return <div className="mx-auto max-w-6xl pb-24 text-slate-100">
    <div className="rounded-[2rem] border border-blue-400/25 bg-gradient-to-br from-[#0b2340] via-[#07172d] to-[#050d1d] p-7 sm:p-10">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-orange-300"><Code2 size={16} /> Hands · Coding harnesses</p>
      <h1 className="mt-3 font-outfit text-3xl font-black text-white sm:text-5xl">Bring Fireworks into your coding tools</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">FireConnect can point an existing coding harness at Fireworks models or FireRouter. Quanta CLI shows connection state and the exact setup commands; you choose when to change a harness.</p>
      <div className="mt-7 flex flex-wrap gap-3"><button type="button" onClick={onOpenTerminal} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"><SquareTerminal size={17} /> Open Quanta CLI</button><a href="https://github.com/fw-ai/fireconnect" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-blue-400/25 px-5 py-3 text-sm text-blue-200 hover:border-blue-400/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"><ExternalLink size={16} /> FireConnect guide</a></div>
    </div>
    <div className="mt-9 grid gap-4 md:grid-cols-2">
      {harnesses.map(harness => <article key={harness.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-6"><h2 className="flex items-center gap-2 font-outfit text-xl font-bold text-white"><Workflow size={18} className="text-cyan-300" />{harness.label}</h2><p className="mt-2 text-sm text-slate-400">{harness.note}</p><code className="mt-5 block rounded-lg border border-slate-800 bg-[#030b19] px-4 py-3 text-xs text-orange-300">quanta harness {harness.id}</code></article>)}
    </div>
    <div className="mt-8 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-6 text-sm leading-7 text-slate-300"><p className="flex items-center gap-2 font-bold text-emerald-200"><ShieldCheck size={17} /> Operator control</p><p className="mt-2">FireConnect is a separate CLI. These controls do not edit Codex, Claude Code, or another harness configuration. Use <code className="text-orange-300">quanta harnesses</code> for the local install state; run the displayed FireConnect commands when you decide to connect or restore a harness.</p></div>
  </div>;
}
