import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BrainCircuit, Hand, Network, ShieldCheck, ArrowUpRight } from 'lucide-react';

interface Props { compact?: boolean }

const layers = [
  { name: 'Brain', caption: 'Choose the model', detail: 'Local and connected LLMs', icon: BrainCircuit, color: '#22d3ee', number: '01' },
  { name: 'Hands', caption: 'Put agents to work', detail: 'Personal, Consumer and specialist agents', icon: Hand, color: '#fb923c', number: '02' },
  { name: 'Nervous System', caption: 'Coordinate the flow', detail: 'Memory, orchestration and telemetry', icon: Network, color: '#818cf8', number: '03' },
  { name: 'Governess', caption: 'Keep human control', detail: 'Privacy, policy and action review', icon: ShieldCheck, color: '#34d399', number: '04' }
] as const;

export default function SovereignSiHeader({ compact = false }: Props) {
  const reducedMotion = useReducedMotion();
  return <section aria-labelledby={compact ? 'mission-sovereign-title' : 'splash-sovereign-title'} className={`relative isolate overflow-hidden rounded-[2rem] border border-orange-400/60 bg-[#061329] text-left shadow-[0_24px_80px_rgba(0,0,0,0.28)] ${compact ? 'mb-8 px-5 py-6 sm:px-8 sm:py-8' : 'mb-12 px-5 py-7 sm:px-10 sm:py-10'}`}>
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-65" style={{ background: 'radial-gradient(circle at 85% 10%, rgba(249,115,22,.18), transparent 34%), radial-gradient(circle at 5% 95%, rgba(34,211,238,.12), transparent 40%), linear-gradient(135deg, #0c2850 0%, #061329 54%, #020617 100%)' }} />
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(125,211,252,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,.14) 1px, transparent 1px)', backgroundSize: '32px 32px', maskImage: 'linear-gradient(to bottom, black, transparent 70%)' }} />
    <motion.div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-40 h-80 w-80 rounded-full border border-orange-300/20" animate={reducedMotion ? undefined : { rotate: 360 }} transition={{ duration: 38, repeat: Infinity, ease: 'linear' }} />
    <div className="relative">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-orange-300/35 bg-orange-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-orange-200"><span className="h-1.5 w-1.5 rounded-full bg-orange-300 shadow-[0_0_10px_#fb923c]" /> Sovereign operating model</span>
        <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-400">4 connected layers · 8 agents</span>
      </div>
      <div className={`mt-6 flex flex-col gap-3 ${compact ? 'lg:flex-row lg:items-end lg:justify-between' : 'lg:flex-row lg:items-end lg:justify-between'}`}>
        <div>
          <h1 id={compact ? 'mission-sovereign-title' : 'splash-sovereign-title'} className={`font-outfit font-black leading-[0.96] tracking-tight text-white ${compact ? 'text-3xl sm:text-5xl' : 'text-4xl sm:text-6xl lg:text-7xl'}`}>Sovereign <span className="bg-gradient-to-r from-orange-300 via-orange-500 to-amber-300 bg-clip-text text-transparent">SI</span><br />Agents<span className="text-orange-400">.</span></h1>
          <p className="mt-4 text-sm font-medium text-blue-100 sm:text-base">Brain <span className="text-orange-400">·</span> Hands <span className="text-orange-400">·</span> Nervous System <span className="text-orange-400">·</span> Governess</p>
        </div>
        <p className="max-w-sm text-xs leading-6 text-slate-400 sm:text-sm">-4 Agents and Agentic Systems. Choose the intelligence, direct the work, observe every step, and retain approval over consequential actions.</p>
      </div>
      <div className={`mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 ${compact ? '' : 'sm:gap-4'}`}>
        {layers.map((layer, index) => {
          const Icon = layer.icon;
          return <motion.div key={layer.name} initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .42, delay: index * .08 }} whileHover={reducedMotion ? undefined : { y: -4 }} className="group relative min-h-36 overflow-hidden rounded-2xl border border-white/10 bg-[#07172c]/85 p-4 backdrop-blur-sm transition-colors hover:border-white/25">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${layer.color}, transparent)` }} />
            <div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10" style={{ color: layer.color, background: `${layer.color}16` }}><Icon size={20} strokeWidth={1.8} /></span><span className="flex items-center gap-1 font-mono text-[10px] text-slate-500">{layer.number}<ArrowUpRight size={12} className="opacity-0 transition-opacity group-hover:opacity-100" /></span></div>
            <h2 className="mt-4 font-outfit text-lg font-bold text-white">{layer.name}</h2>
            <p className="mt-1 text-xs font-semibold" style={{ color: layer.color }}>{layer.caption}</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-400">{layer.detail}</p>
          </motion.div>;
        })}
      </div>
    </div>
  </section>;
}
