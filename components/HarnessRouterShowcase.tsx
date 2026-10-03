import React from 'react';

export default function HarnessRouterShowcase() {
  return (
    <section aria-labelledby="gnoesis-si-harness-router" className="my-16 overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/50 via-slate-950/90 to-indigo-950/50 p-5 text-left sm:my-20 sm:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200">Gnoesis SI Harness Router · QuantaCore pilot</div>
          <h2 id="gnoesis-si-harness-router" className="text-2xl font-black text-white sm:text-3xl">Choose or swap the harness for each case.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">A research case, code task, and data audit can each use a different eligible harness and model. QuantaCore keeps the problem, permissions, and approval policy; the router records the requested route and what actually served the run.</p>
        </div>
        <div className="shrink-0 rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-[10px] font-bold uppercase leading-5 tracking-wide text-cyan-100">Test path<br />Sign in → Mission Control → Harness Router</div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-100">Swap per case</h3>
          <p className="mt-2 text-xs leading-5 text-slate-400">Rerun the same case with another eligible harness to compare its fit, without treating one runtime as the winner for every job.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-100">Compare evidence</h3>
          <p className="mt-2 text-xs leading-5 text-slate-400">Hold the case and rubric steady. Measure verified quality, tool success, cost, latency, failures, and abstention for each harness × model pair.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-100">Keep control</h3>
          <p className="mt-2 text-xs leading-5 text-slate-400">Check permissions and budgets before a run; inspect route identity and outputs afterward. Consequential actions stay with the operator.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <figure className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-3">
          <a href="/images/gnoesis-harness-router-splash.png" target="_blank" rel="noreferrer" aria-label="Open the Gnoesis Harness Router case-by-case routing illustration">
            <img src="/images/gnoesis-harness-router-splash.png" alt="Research, coding, and data case studies connect through a central router to different interchangeable agent harnesses." width={1536} height={1024} loading="lazy" decoding="async" className="h-[280px] w-full rounded-xl object-contain sm:h-[340px]" />
          </a>
          <figcaption className="px-1 pt-3 text-[11px] leading-5 text-slate-400">One router, different harness choices for different case studies.</figcaption>
        </figure>
        <figure className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-3">
          <a href="/images/gnoesis-harness-router-case-study-routing.png" target="_blank" rel="noreferrer" aria-label="Open the Harness Router evaluation flow illustration">
            <img src="/images/gnoesis-harness-router-case-study-routing.png" alt="Research, code, and data tasks pass through policy gates, choose separate harness routes, and feed a shared evidence record." width={1536} height={1024} loading="lazy" decoding="async" className="h-[280px] w-full rounded-xl object-contain sm:h-[340px]" />
          </a>
          <figcaption className="px-1 pt-3 text-[11px] leading-5 text-slate-400">Filter each route by capability and policy, then compare the case results.</figcaption>
        </figure>
      </div>

      <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-slate-400">The current pilot supports manual harness and model selection for bounded tests. Evidence-ranked recommendations are still under evaluation; visual routes are illustrative and do not promise live availability or a quality winner. No trading execution.</p>
    </section>
  );
}
