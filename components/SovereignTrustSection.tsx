import React from 'react';

const TRUST_PILLARS = [
  {
    title: 'Privacy',
    eyebrow: 'CONTROL THE DATA PATH',
    icon: 'M12 3l8 4v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4zm-3 9l2 2 4-4',
    accent: 'text-emerald-300',
    border: 'border-emerald-500/25',
    copy: 'Keep Obsidian as your source of truth. Connect a vault through a read-only sync and choose the inference provider before private notes are processed.',
  },
  {
    title: 'Memory',
    eyebrow: 'OPT IN PER BANK',
    icon: 'M4 7v10c0 2.2 3.6 4 8 4s8-1.8 8-4V7m-16 0c0 2.2 3.6 4 8 4s8-1.8 8-4m-16 0c0-2.2 3.6-4 8-4s8 1.8 8 4m0 5c0 2.2-3.6 4-8 4s-8-1.8-8-4',
    accent: 'text-cyan-300',
    border: 'border-cyan-500/25',
    copy: 'Memory Defense is off until enabled for a bank. Once configured, it scans future retain writes before storage and can redact a match or block the item.',
  },
  {
    title: 'Security',
    eyebrow: 'SCREEN · AUDIT · ALERT',
    icon: 'M12 11V7a4 4 0 00-8 0v4m-1 0h10v9H3v-9zm13-2l2 2 4-4',
    accent: 'text-orange-300',
    border: 'border-orange-500/25',
    copy: 'Known credential, API-key, database-URL, private-key, token, and common PII patterns are covered. Audit entries and webhook alerts are available when configured.',
  },
];

const SovereignTrustSection: React.FC = () => (
  <section className="mt-28 border-t border-emerald-500/15 pt-14 text-left" aria-labelledby="sovereign-trust-title">
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mb-2 font-mono text-[10px] font-black uppercase tracking-[0.34em] text-emerald-400">Privacy · Memory · Security</p>
        <h2 id="sovereign-trust-title" className="font-outfit text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
          Sovereign <span className="text-emerald-400">Trust</span>
        </h2>
      </div>
      <p className="max-w-2xl text-xs font-medium leading-relaxed text-slate-400 sm:text-sm">
        Protection belongs at the memory boundary: control where data goes, screen what is retained, and keep security decisions reviewable.
      </p>
    </div>

    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {TRUST_PILLARS.map((pillar) => (
        <article key={pillar.title} className={`rounded-[2rem] border ${pillar.border} bg-gradient-to-br from-slate-900/90 to-[#06100d] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.2)] sm:p-8`}>
          <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-950 ${pillar.accent}`}>
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={pillar.icon} />
            </svg>
          </div>
          <p className={`mb-2 font-mono text-[9px] font-black uppercase tracking-[0.22em] ${pillar.accent}`}>{pillar.eyebrow}</p>
          <h3 className="mb-3 font-outfit text-2xl font-black uppercase tracking-tight text-white">{pillar.title}</h3>
          <p className="text-xs font-medium leading-relaxed text-slate-400">{pillar.copy}</p>
        </article>
      ))}
    </div>

    <p className="mt-5 max-w-5xl text-[10px] leading-relaxed text-slate-500">
      Policies apply only to future retain calls on the bank where they are enabled. Existing memories are not retroactively scanned; audit logging and webhook alerts also require configuration. Pattern screening is a guardrail, not a substitute for rotating exposed credentials.
    </p>
  </section>
);

export default SovereignTrustSection;
