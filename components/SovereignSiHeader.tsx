import React, { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BrainCircuit, Hand, Network, ShieldCheck, Blocks, Database, Cpu, Workflow, Sparkles } from 'lucide-react';

interface Props { compact?: boolean; onNavigate?: (path: string) => void }

const buildingBlocks = [
  { name: 'Data', caption: 'Your foundation', icon: Database, color: '#22d3ee', number: '01' },
  { name: 'Models', caption: 'Your intelligence', icon: BrainCircuit, color: '#7dd3fc', number: '02' },
  { name: 'Memory', caption: 'Your context', icon: Network, color: '#a5b4fc', number: '03' },
  { name: 'Inference', caption: 'Your compute', icon: Cpu, color: '#34d399', number: '04' },
  { name: 'Agents', caption: 'Your systems', icon: Workflow, color: '#fb923c', number: '05' },
] as const;

const layers = [
  { name: 'Brain', caption: 'Choose intelligence', icon: BrainCircuit, color: '#22d3ee' },
  { name: 'Hands', caption: 'Direct your agents', icon: Hand, color: '#fb923c' },
  { name: 'Nervous System', caption: 'Connect the flow', icon: Network, color: '#a5b4fc' },
  { name: 'Governess', caption: 'Set the boundaries', icon: ShieldCheck, color: '#34d399' },
] as const;

export default function SovereignSiHeader({ compact = false, onNavigate }: Props) {
  const reducedMotion = useReducedMotion();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} style={{ containerType: 'inline-size' }} className={`relative isolate overflow-hidden rounded-[2rem] border border-orange-400/50 bg-[#061329] text-left shadow-[0_28px_100px_rgba(0,0,0,.35)] ${compact ? 'mb-8 p-5 sm:p-8' : 'mb-12 p-6 sm:p-10 lg:p-12'}`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 100% 0%,rgba(34,211,238,.13),transparent 48%),radial-gradient(ellipse at 0% 100%,rgba(249,115,22,.12),transparent 48%),linear-gradient(125deg,#0b2040,#061329 45%,#030b1c)' }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[.14]" style={{ backgroundImage: 'radial-gradient(#93c5fd .8px,transparent .8px)', backgroundSize: '22px 22px', maskImage: 'linear-gradient(90deg,transparent,black)' }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-orange-300/80 to-transparent" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex flex-wrap items-center gap-2.5 rounded-2xl border border-cyan-300/50 bg-gradient-to-r from-cyan-400/15 via-violet-500/20 to-fuchsia-500/20 px-4 py-3 text-sm font-black uppercase tracking-[.08em] shadow-[0_0_28px_rgba(34,211,238,.18)] sm:text-base"><Blocks size={20} className="text-cyan-300" aria-hidden="true" /><span className="text-cyan-300">Sovereign Intelligence <span className="text-amber-300">SI</span></span><span className="text-white">-</span><span className="text-fuchsia-300">Lego Builder/Modular</span></span>
          <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400"><span aria-hidden="true" className="h-1 w-6 bg-gradient-to-r from-cyan-400 to-emerald-400" /> Compose. Connect. Own.</span>
        </div>

        <div className={`grid items-center gap-8 ${compact ? 'mt-7 lg:grid-cols-[1.1fr_1fr]' : 'mt-9 lg:grid-cols-[1.1fr_1fr] lg:gap-12'}`}>
          <div className="min-w-0">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[.22em] text-cyan-200/80 sm:text-xs">Composable Sovereign AI</p>
            <h1 id={titleId} style={{ fontSize: compact ? 'clamp(2rem, 5cqw, 3.5rem)' : 'clamp(2.2rem, 5.3cqw, 4rem)' }} className="font-outfit font-black leading-[1.02] tracking-[-.045em] text-white">
              Your intelligence.<br /><span className="bg-gradient-to-r from-orange-200 via-orange-400 to-amber-300 bg-clip-text text-transparent">Your rules.</span>
            </h1>
            <p className={`mt-5 max-w-xl leading-relaxed text-blue-100/90 ${compact ? 'text-sm sm:text-base' : 'text-base sm:text-lg'}`}>
              Build an agentic system around you. Choose your <strong className="font-semibold text-white">data, models, memory and inference</strong> — then connect the agents that put them to work.
            </p>
            <p className="mt-3 max-w-lg text-xs leading-6 text-slate-400 sm:text-sm">Define your agent’s identity, role and skills with Lego Builder. Choose model, memory and inference connections from your workspace.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#/sme-builder" onClick={event => { if (onNavigate) { event.preventDefault(); onNavigate('/sme-builder'); } }} className="inline-flex items-center gap-2 rounded-xl border border-orange-300/40 bg-gradient-to-r from-orange-500 to-amber-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_8px_30px_rgba(249,115,22,.16)] transition-transform hover:-translate-y-0.5 motion-reduce:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-200"><Blocks size={17} aria-hidden="true" /> Open Lego Builder <span aria-hidden="true">→</span></a>
              <a href="#/agents" onClick={event => { if (onNavigate) { event.preventDefault(); onNavigate('/agents'); } }} className="inline-flex items-center rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-5 py-3 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">Explore your agents</a>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-xs font-medium text-slate-300">
              <span className="flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-300" aria-hidden="true" /> Your boundaries</span>
              <span className="flex items-center gap-2"><Blocks size={15} className="text-cyan-300" aria-hidden="true" /> Your building blocks</span>
              <span className="flex items-center gap-2"><Sparkles size={15} className="text-orange-300" aria-hidden="true" /> Your agentic systems</span>
            </div>
          </div>

          <div className="relative min-w-0 rounded-3xl border border-cyan-200/10 bg-[#030d20]/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_20px_50px_rgba(0,0,0,.16)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3 px-1">
              <span className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Your sovereign stack</span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[.06] px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-200">Built around you</span>
            </div>
            <div className="relative space-y-2">
              <div aria-hidden="true" className="absolute bottom-6 left-[1.65rem] top-5 w-px bg-gradient-to-b from-cyan-400/60 via-indigo-300/50 to-orange-400/60" />
              {buildingBlocks.map((block, index) => {
                const Icon = block.icon;
                return (
                  <motion.div key={block.name} initial={reducedMotion ? false : { opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .45, delay: .08 + index * .07 }} whileHover={reducedMotion ? undefined : { x: 3 }} className="relative flex items-center gap-3 rounded-2xl border border-white/[.08] bg-gradient-to-r from-[#102440] to-[#0a172b] p-2.5 sm:gap-4">
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 sm:h-9 sm:w-9" style={{ color: block.color, background: `${block.color}12` }}><Icon size={17} strokeWidth={1.7} aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1"><span className="block font-outfit text-sm font-bold text-white sm:text-base">{block.name}</span><span className="block text-[10px] text-slate-400 sm:text-[11px]">{block.caption}</span></span>
                    <div aria-hidden="true" className="flex items-center gap-1.5">
                      {[0, 1, 2].map(segment => <motion.span key={segment} className="h-1.5 w-3 rounded-sm sm:w-5" style={{ backgroundColor: block.color }} animate={reducedMotion ? { opacity: .55 } : { opacity: [.2, .7, .2] }} transition={{ duration: 3.8, repeat: Infinity, delay: index * .25 + segment * .3, ease: 'easeInOut' }} />)}
                    </div>
                    <span aria-hidden="true" className="ml-1 font-mono text-[9px] text-slate-500">{block.number}</span>
                  </motion.div>
                );
              })}
            </div>
            <a href="#/harness-router" onClick={event => { if (onNavigate) { event.preventDefault(); onNavigate('/harness-router'); } }} className="group mt-3 flex items-center gap-3 rounded-2xl border border-orange-300/30 bg-gradient-to-r from-orange-400/10 via-indigo-400/10 to-cyan-400/10 p-3 transition-colors hover:border-orange-300/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-200">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-orange-300/20 bg-orange-400/10 text-orange-200"><Workflow size={18} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="mb-1 block text-[9px] font-bold uppercase tracking-[.18em] text-orange-300">Optional add-on</span><span className="block font-outfit text-sm font-bold text-white sm:text-base">Inference Harness</span><span className="mt-1 block text-[11px] leading-relaxed text-slate-300">Connect a task harness to your chosen model and inference provider.</span></span>
              <span aria-hidden="true" className="text-lg text-orange-200 transition-transform group-hover:translate-x-1 motion-reduce:transform-none">→</span>
            </a>
            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-400"><span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-transparent to-cyan-300/20" /><Blocks size={12} className="text-orange-300" aria-hidden="true" /><span>Independent pieces. Connected intelligence.</span><span aria-hidden="true" className="h-px flex-1 bg-gradient-to-l from-transparent to-orange-300/20" /></div>
          </div>
        </div>

        <div className="mt-8 border-t border-white/[.08] pt-5 sm:mt-9">
          <p className="mb-4 text-[9px] font-semibold uppercase tracking-[.2em] text-slate-500">The architecture behind your agentic systems</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
            {layers.map(layer => {
              const Icon = layer.icon;
              return <div key={layer.name} className="flex items-center gap-2.5 sm:gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[.08]" style={{ color: layer.color, background: `${layer.color}0c` }}><Icon size={18} strokeWidth={1.7} aria-hidden="true" /></span><span><span className="block font-outfit text-xs font-bold text-slate-100 sm:text-sm">{layer.name}</span><span className="mt-0.5 block text-[9px] text-slate-400 sm:text-[10px]">{layer.caption}</span></span></div>;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
