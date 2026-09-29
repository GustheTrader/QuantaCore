'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AGENT_TRACKS } from '../lib/agent-tracks';
import { motionTokens, springs } from '../lib/motion-tokens';
import type { UserTrack } from '../types';

interface AgentActivationSelectorProps {
  value: UserTrack;
  onChange: (track: UserTrack) => void;
  disabled?: boolean;
  activateOnSelect?: boolean;
}

const AgentActivationSelector: React.FC<AgentActivationSelectorProps> = ({
  value, onChange, disabled = false, activateOnSelect = false
}) => {
  const reducedMotion = useReducedMotion();

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-5 text-left text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
        {activateOnSelect ? 'Your operation agents' : 'Choose your agent'}
      </legend>
      <p className="mb-5 text-left text-sm leading-relaxed text-slate-400">
        Explore what each agent can help you do. These example case studies turn the context you provide into plans, comparisons and research briefs.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {AGENT_TRACKS.map(agent => {
          const selected = value === agent.id;
          return (
            <motion.button
              key={agent.id}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={agent.label}
              aria-describedby={`agent-${agent.id}-description`}
              onClick={() => onChange(agent.id)}
              whileHover={reducedMotion || disabled ? undefined : { y: -motionTokens.distance.xs, scale: motionTokens.scale.pop }}
              whileTap={reducedMotion || disabled ? undefined : { scale: motionTokens.scale.press }}
              transition={reducedMotion ? { duration: motionTokens.duration.fast } : springs.snappy}
              style={{
                background: `linear-gradient(135deg, ${agent.from}${selected ? '35' : '14'}, ${agent.to}${selected ? '24' : '09'})`,
                borderColor: `${agent.from}${selected ? 'bb' : '35'}`,
                boxShadow: selected ? `0 0 24px ${agent.from}20, inset 0 1px 0 ${agent.from}30` : 'none'
              }}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border p-4 sm:p-5 text-left disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <motion.span
                aria-hidden="true"
                animate={{ opacity: selected ? 1 : 0 }}
                transition={{ duration: motionTokens.duration.fast }}
                style={{ background: `linear-gradient(115deg, transparent, ${agent.from}20, transparent)` }}
                className="pointer-events-none absolute inset-0"
              />
              <div className="relative flex items-center justify-between mb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/60" style={{ color: agent.from }}>
                  <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={agent.icon} />
                  </svg>
                </span>
                <span aria-hidden="true" className={`flex h-6 w-6 items-center justify-center rounded-full ${selected ? 'bg-white/15 text-white' : 'text-slate-500 group-hover:text-white'}`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={selected ? 'M5 12l4 4L19 6' : 'M7 17L17 7M7 7h10v10'} />
                  </svg>
                </span>
              </div>
              <span className="relative block text-sm sm:text-base font-outfit font-black text-white leading-tight mb-2">{agent.label}</span>
              <span id={`agent-${agent.id}-description`} className="relative block min-h-[2.5rem] text-xs leading-relaxed text-slate-400">{agent.description}</span>
              <span className="relative mt-4 block text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">What we can do</span>
              <span role="list" className="relative mt-2 flex flex-wrap gap-1.5">
                {agent.capabilities.map(capability => (
                  <span role="listitem" key={capability} className="rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1 text-[10px] leading-relaxed text-slate-200">{capability}</span>
                ))}
              </span>
              <span className="relative mt-5 block text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: agent.from }}>Example case studies</span>
              <span role="list" className="relative mb-5 mt-3 block space-y-3">
                {agent.caseStudies.map(caseStudy => (
                  <span role="listitem" key={caseStudy.title} className="block border-l-2 pl-3" style={{ borderColor: `${agent.from}60` }}>
                    <span className="block text-xs font-semibold leading-relaxed text-slate-200">{caseStudy.title}</span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">{caseStudy.outcome}</span>
                  </span>
                ))}
              </span>
              <span className="relative mt-auto flex items-center gap-2 border-t border-white/10 pt-4 text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: agent.from }}>
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: selected ? agent.from : `${agent.from}60` }} />
                {selected ? (activateOnSelect ? 'Active · open again' : 'Selected') : (activateOnSelect ? 'Activate agent' : 'Select agent')}
              </span>
            </motion.button>
          );
        })}
      </div>
    </fieldset>
  );
};

export default AgentActivationSelector;
