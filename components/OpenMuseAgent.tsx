import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Check, Clipboard, RefreshCw, ShieldCheck } from 'lucide-react';
import type { UserTrack } from '../types';

interface Props {
  track: UserTrack;
  onActivateAgent: (track: UserTrack) => void;
}

interface Status {
  reachable: boolean;
  mode: 'sample' | 'live' | null;
  agentConfigured: boolean;
  browserConfigured: boolean;
}

const prompts = {
  personal: [
    'Organize my priorities for this week and make a plan I can review.',
    'Help me review a document and prepare the next steps.'
  ],
  consumer: [
    'Compare these options by total cost, terms, privacy, and uncertainty. Do not purchase anything.',
    'Review my subscriptions and propose savings for my approval.'
  ]
};

export default function OpenMuseAgent({ track, onActivateAgent }: Props) {
  const [params] = useSearchParams();
  const selected = params.get('agent') === 'consumer' ? 'consumer' : track === 'consumer' ? 'consumer' : 'personal';
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(-1);

  const refresh = async () => {
    setChecking(true);
    try {
      const response = await fetch('/api/openmuse/status', { cache: 'no-store' });
      setStatus(await response.json());
    } catch { setStatus({ reachable: false, mode: null, agentConfigured: false, browserConfigured: false }); }
    finally { setChecking(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const ready = status?.reachable === true;
  const label = selected === 'consumer' ? 'Consumer' : 'Personal';
  return <div className="mx-auto max-w-6xl pb-20 text-slate-100">
    <div className="rounded-[2rem] border border-blue-400/25 bg-gradient-to-br from-[#0b2340] via-[#07172d] to-[#050d1d] p-7 sm:p-10">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-300">Hands · OpenMuse agent</p>
      <h1 className="mt-3 font-outfit text-4xl font-black text-white sm:text-5xl">{label} Agent</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">OpenMuse provides durable tasks, reviewable actions, saved files, and optional browser and computer workers. It runs as a separate local service with its own identity and data store. Quanta chooses the entry point; OpenMuse owns the work and approvals inside its workspace.</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <button type="button" onClick={() => onActivateAgent(selected === 'consumer' ? 'personal' : 'consumer')} className="rounded-xl border border-blue-400/25 px-4 py-3 text-sm font-semibold text-blue-100 hover:bg-blue-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Switch to {selected === 'consumer' ? 'Personal' : 'Consumer'}</button>
        {ready ? <a href="http://localhost:8081" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300">Open OpenMuse <ArrowUpRight size={17} /></a> : <button type="button" disabled className="rounded-xl border border-orange-400/20 bg-orange-400/5 px-5 py-3 text-sm font-bold text-orange-200/60">OpenMuse offline</button>}
        <button type="button" onClick={() => void refresh()} disabled={checking} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"><RefreshCw size={15} /> Refresh status</button>
        <Link to="/agent?mode=work" className="rounded-xl border border-blue-400/20 px-4 py-3 text-sm text-slate-300 hover:bg-blue-400/10">Quanta control plane</Link>
      </div>
    </div>

    <div className="mt-7 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <h2 className="font-outfit text-xl font-bold text-white">Try in {label} mode</h2>
        <p className="mt-2 text-sm text-slate-400">Copy a starter request into OpenMuse. The selected Quanta role is not automatically shared with OpenMuse, so review the request before sending.</p>
        <div className="mt-5 space-y-3">{prompts[selected].map((prompt, index) => <button key={prompt} type="button" onClick={async () => { await navigator.clipboard.writeText(prompt); setCopied(index); }} className="flex w-full items-start justify-between gap-4 rounded-xl border border-blue-400/15 bg-blue-500/5 p-4 text-left text-sm leading-6 text-blue-100 hover:border-blue-400/40"><span>{prompt}</span>{copied === index ? <Check size={17} className="shrink-0 text-emerald-300" /> : <Clipboard size={17} className="shrink-0 text-blue-300" />}</button>)}</div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <h2 className="font-outfit text-xl font-bold text-white">Local service</h2>
        <p className={`mt-3 text-sm font-semibold ${ready ? 'text-emerald-300' : 'text-orange-300'}`}>{checking ? 'Checking…' : ready ? `Online · ${status?.mode} mode` : 'Setup needed · service offline'}</p>
        <div className="mt-4 space-y-2 text-sm text-slate-400"><p>API: <code className="text-slate-200">127.0.0.1:8787</code></p><p>Web: <code className="text-slate-200">localhost:8081</code></p><p>Browser worker: {status?.browserConfigured ? 'configured' : 'optional / not configured'}</p></div>
        {!ready && <div className="mt-5 rounded-xl border border-orange-400/20 bg-orange-400/5 p-4 text-xs leading-6 text-slate-300"><p>In <code className="text-orange-200">C:\GnoesisOpenMuse\.env</code>, set the server-only <code className="text-orange-200">CPK_INTELLIGENCE_API_KEY</code>, then run <code className="text-orange-200">pnpm dev</code> and <code className="text-orange-200">pnpm dev:web</code> in separate terminals. OpenMuse requires this key even in sample mode.</p></div>}
        <p className="mt-5 flex items-start gap-2 text-xs leading-6 text-slate-400"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-300" /> Gmail, Calendar, browser profiles, and the Docker computer use OpenMuse’s own configuration and stored action review. Quanta does not transfer its session or provider keys to OpenMuse.</p>
      </section>
    </div>
  </div>;
}
