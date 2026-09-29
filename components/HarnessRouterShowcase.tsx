import React from 'react';

export default function HarnessRouterShowcase() {
  return (
    <section aria-labelledby="gnoesis-si-harness-router" className="my-16 overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/50 via-slate-950/90 to-indigo-950/50 p-5 text-left sm:my-20 sm:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200">Gnoesis SI Harness Router · QuantaCore pilot</div>
          <h2 id="gnoesis-si-harness-router" className="text-2xl font-black text-white sm:text-3xl">One contract. Choose a harness for the job.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">The Unified Harness Protocol gives QuantaCore a shared way to submit bounded work and inspect the run. That makes it practical to compare compatible harness and model combinations by task, while QuantaCore retains problem choice, policy, and human approval.</p>
        </div>
        <div className="shrink-0 rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-[10px] font-bold uppercase leading-5 tracking-wide text-cyan-100">Test path<br />Sign in → Mission Control → Harness Router</div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-100">Integrate once</h3>
          <p className="mt-2 text-xs leading-5 text-slate-400">Share task semantics for harness selection, continuing sessions, streamed progress, files, artifacts, cancellation, and structured failures.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-100">Route by evidence</h3>
          <p className="mt-2 text-xs leading-5 text-slate-400">The target is task-specific fit across eligibility, quality, evidence, cost, latency, and reliability—not a universal model leaderboard.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-100">Inspect each run</h3>
          <p className="mt-2 text-xs leading-5 text-slate-400">Keep route identity, progress, outputs, failures, and evaluation evidence visible so an operator can review the result.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <figure className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-3">
          <a href="/images/uhp-harnessrouter-overview.png" target="_blank" rel="noreferrer" aria-label="Open the Unified Harness Protocol overview image at full size">
            <img src="/images/uhp-harnessrouter-overview.png" alt="Reference diagram of the Unified Harness Protocol connecting an application, agent harnesses, and shared components such as tools, models, permissions, sessions, files, and artifacts." loading="lazy" decoding="async" className="h-[280px] w-full object-contain sm:h-[340px]" />
          </a>
          <figcaption className="px-1 pt-3 text-[11px] leading-5 text-slate-400">Unified Harness Protocol overview. Enabled capabilities still depend on the connected runtime and its configuration.</figcaption>
        </figure>
        <figure className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-3">
          <a href="/images/harnessrouter-agent-catalog-reference.png" target="_blank" rel="noreferrer" aria-label="Open the multi-harness catalog reference image at full size">
            <img src="/images/harnessrouter-agent-catalog-reference.png" alt="Reference screenshot showing a catalog of agent harness names around a one API message." loading="lazy" decoding="async" className="h-[280px] w-full object-contain sm:h-[340px]" />
          </a>
          <figcaption className="px-1 pt-3 text-[11px] leading-5 text-slate-400">Multi-harness catalog reference. Its pictured count is not a live availability guarantee; the connected router's catalog is authoritative.</figcaption>
        </figure>
      </div>

      <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-slate-400">Pilot status: local Docker connectivity is verified, but a model provider and API key are still needed for model-backed runs. Compatibility is not a quality ranking, and this research-only integration does not authorize trading execution.</p>
    </section>
  );
}
