import React from 'react';
import { ArrowDown, ArrowRight, BookOpen, Coins, Gauge, GitBranch, LockKeyhole, Route, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react';

const flowBox = 'min-w-0 rounded-2xl border border-slate-700/70 bg-[#071429] px-4 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

const FlowArrow = () => <span aria-hidden="true" className="flex shrink-0 items-center justify-center text-orange-400/70">
  <ArrowDown size={18} className="lg:hidden" />
  <ArrowRight size={19} className="hidden lg:block" />
</span>;

const SovereignTokensShowcase: React.FC = () => (
  <section aria-labelledby="sovereign-tokens-title" className="relative mb-24 overflow-hidden rounded-[2rem] border border-orange-400/35 bg-[#061225] text-left shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
    <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-orange-500/10 blur-[100px]" />
    <div className="relative px-5 py-7 sm:px-9 sm:py-10 lg:px-12">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-orange-300"><Coins size={15} /> Sovereign tokens</p>
          <h2 id="sovereign-tokens-title" className="font-outfit text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">Spend with intent. <span className="text-orange-400">Keep the choice.</span></h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">Connect agents to the right model, improve specialist models with evaluated feedback, and govern usage with clear budgets.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-300">
          <span className="rounded-full border border-orange-400/25 bg-orange-400/10 px-3 py-2">Cost</span>
          <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-2">Quality</span>
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2">Control</span>
        </div>
      </div>

      <div className="mt-9 rounded-[1.5rem] border border-blue-400/15 bg-[#030b19]/80 p-4 sm:p-6" aria-label="FireRouter token flow">
        <p className="mb-5 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">A route for each request</p>
        <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1.15fr_auto_1.25fr]">
          <div className={flowBox}>
            <div className="flex items-center gap-2 text-cyan-300"><Sparkles size={17} /><span className="text-[10px] font-black uppercase tracking-widest">Connect</span></div>
            <p className="mt-2 text-sm font-bold text-white">Apps & agents</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">Quanta agents and your chosen gateway</p>
          </div>
          <FlowArrow />
          <div className={flowBox}>
            <div className="flex items-center gap-2 text-blue-300"><GitBranch size={17} /><span className="text-[10px] font-black uppercase tracking-widest">Provider</span></div>
            <p className="mt-2 text-sm font-bold text-white">Fireworks API</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">Configured model connection</p>
          </div>
          <FlowArrow />
          <div className="min-w-0 rounded-2xl border border-orange-400/65 bg-gradient-to-br from-orange-500/20 via-[#152032] to-[#071429] px-4 py-4 text-left shadow-[0_0_30px_rgba(249,115,22,0.10)]">
            <div className="flex items-center gap-2 text-orange-300"><Route size={18} /><span className="text-[10px] font-black uppercase tracking-widest">Smart router</span></div>
            <p className="mt-2 text-base font-black text-white">FireRouter</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">Choose a cost and quality path per turn</p>
          </div>
          <FlowArrow />
          <div className="grid min-w-0 gap-2">
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 px-3 py-2.5"><span className="text-xs font-bold text-emerald-200">Open models</span></div>
            <div className="rounded-xl border border-violet-400/25 bg-violet-400/5 px-3 py-2.5"><span className="text-xs font-bold text-violet-200">Closed models on your provider account</span></div>
          </div>
        </div>
        <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500"><LockKeyhole size={14} className="mt-0.5 shrink-0" /> The selected cloud route determines where submitted context goes. Local Ollama remains the private inference path.</p>
      </div>

      <div className="mt-8 grid gap-0 border-y border-white/10 md:grid-cols-3 md:divide-x md:divide-white/10">
        <div className="py-6 pr-5 md:py-7">
          <div className="flex items-center gap-2 text-orange-300"><Route size={19} /><span className="text-[10px] font-black uppercase tracking-[0.2em]">01 · Route</span></div>
          <h3 className="mt-3 font-outfit text-xl font-bold text-white">FireRouter <span className="text-orange-400">· Save $</span></h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">Use a less costly model when it meets the task's quality bar. Reserve premium routes for work that needs them; measure savings against your own workload.</p>
        </div>
        <div className="border-t border-white/10 py-6 md:border-t-0 md:px-5 md:py-7">
          <div className="flex items-center gap-2 text-cyan-300"><SlidersHorizontal size={19} /><span className="text-[10px] font-black uppercase tracking-[0.2em]">02 · Adapt</span></div>
          <h3 className="mt-3 font-outfit text-xl font-bold text-white">Finetune RL</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">Train specialists against explicit reward criteria and reviewed examples. Check held-out results before using a tuned model for real work.</p>
        </div>
        <div className="border-t border-white/10 py-6 md:border-t-0 md:pl-5 md:py-7">
          <div className="flex items-center gap-2 text-emerald-300"><Gauge size={19} /><span className="text-[10px] font-black uppercase tracking-[0.2em]">03 · Govern</span></div>
          <h3 className="mt-3 font-outfit text-xl font-bold text-white">Nexus</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">See token usage, set spend limits, and choose the balance between model quality and cost in the Fireworks account layer.</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 text-xs leading-6 text-slate-400 lg:flex-row lg:items-center lg:justify-between">
        <p className="flex max-w-3xl items-start gap-2"><ShieldCheck size={16} className="mt-1 shrink-0 text-emerald-300" /><span><strong className="text-slate-200">Integration status:</strong> Quanta connects to Fireworks model endpoints today. FireRouter routing, Nexus controls, and RL training jobs need separate setup and are not yet managed in Quanta OS.</span></p>
        <div className="flex shrink-0 flex-wrap gap-x-5 gap-y-2 font-semibold text-blue-300">
          <a href="https://fireworks.ai/nexus" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"><BookOpen size={14} /> Nexus & FireRouter <span aria-hidden="true">↗</span></a>
          <a href="https://docs.fireworks.ai/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"><BookOpen size={14} /> Fine-tuning docs <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </div>
  </section>
);

export default SovereignTokensShowcase;
