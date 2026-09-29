import React from 'react';
import { motion } from 'motion/react';
import { motionTokens } from '../lib/motion-tokens';

type MultiStrategyRetrievalProps = {
  animateFlows: boolean;
};

const routeLines = [
  { d: 'M 188 299 C 204 299 205 210 224 210', delay: 0 },
  { d: 'M 188 299 C 207 299 205 276 224 276', delay: 0 },
  { d: 'M 188 299 C 207 299 205 342 224 342', delay: 0 },
  { d: 'M 188 299 C 204 299 205 408 224 408', delay: 0 },
  { d: 'M 406 210 C 420 210 423 210 438 210', delay: 1.2 },
  { d: 'M 406 276 C 420 276 423 276 438 276', delay: 1.2 },
  { d: 'M 406 342 C 420 342 423 342 438 342', delay: 1.2 },
  { d: 'M 406 408 C 420 408 423 408 438 408', delay: 1.2 },
  { d: 'M 620 210 C 638 210 635 288 646 288', delay: 2.4 },
  { d: 'M 620 276 C 638 276 638 298 646 298', delay: 2.4 },
  { d: 'M 620 342 C 638 342 638 318 646 318', delay: 2.4 },
  { d: 'M 620 408 C 638 408 635 328 646 328', delay: 2.4 },
  { d: 'M 824 308 C 836 308 834 176 842 176', delay: 3.6 },
  { d: 'M 1000 202 L 1000 214', delay: 4.8 },
  { d: 'M 1000 281 L 1000 293', delay: 6 },
  { d: 'M 1000 360 L 1000 372', delay: 7.2 },
  { d: 'M 1164 441 C 1184 475 1135 521 1092 521 L 148 521 C 109 521 96 480 96 424', delay: 8.4 },
];

const RetrievalText: React.FC<{
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  fill?: string;
  weight?: number;
  anchor?: 'start' | 'middle' | 'end';
  spacing?: number;
}> = ({ x, y, children, size = 11, fill = '#dbe5ee', weight = 600, anchor = 'start', spacing = 0 }) => (
  <text
    x={x}
    y={y}
    fill={fill}
    fontSize={size}
    fontWeight={weight}
    textAnchor={anchor}
    letterSpacing={spacing}
    fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
  >
    {children}
  </text>
);

const FlowPulse: React.FC<{ d: string; delay: number; enabled: boolean }> = ({ d, delay, enabled }) => (
  <motion.path
    d={d}
    fill="none"
    stroke="url(#tempr-flow)"
    strokeWidth="2.4"
    strokeDasharray="3 16"
    strokeLinecap="round"
    initial={false}
    animate={enabled ? { strokeDashoffset: [0, -38], opacity: [0.15, 1, 0.15] } : { strokeDashoffset: 0, opacity: 0.3 }}
    transition={enabled
      ? { duration: 1.15, ease: motionTokens.easing.linear, repeat: Infinity, repeatDelay: 7.3, delay }
      : { duration: motionTokens.duration.fast }}
  />
);

const MultiStrategyRetrieval: React.FC<MultiStrategyRetrievalProps> = ({ animateFlows }) => (
  <section className="mt-10 overflow-hidden rounded-2xl border border-blue-400/15 bg-[#07111c]" aria-labelledby="tempr-title">
    <div className="flex flex-col gap-3 border-b border-slate-700/50 px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-cyan-300">Retrieval pipeline · staged evidence flow</p>
          <h3 id="tempr-title" className="font-outfit text-xl font-bold text-white sm:text-2xl">Multi-Strategy Retrieval <span className="text-cyan-300">(TEMPR)</span></h3>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-200">
          <span className={`h-1.5 w-1.5 rounded-full bg-cyan-300 ${animateFlows ? 'animate-pulse' : ''}`} />
          Illustrative architecture
        </span>
      </div>
      <p className="max-w-3xl text-xs leading-6 text-slate-400 sm:text-sm">Four recall strategies search in parallel. Results then move through deliberate fusion, relevance, evidence and token-budget checkpoints before selected context loops back to the agent.</p>
    </div>

    <div className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400" tabIndex={0} aria-label="Scrollable multi-strategy retrieval flow diagram">
      <svg className="block h-auto min-w-[1080px] w-full" viewBox="0 0 1200 570" role="img" aria-labelledby="tempr-map-title tempr-map-desc">
        <title id="tempr-map-title">Multi-strategy retrieval with staged ranking and iterative recall</title>
        <desc id="tempr-map-desc">A question runs through semantic, keyword, graph and temporal recall in parallel. Their indexed candidates are combined, reranked, adjusted by recency, time and evidence, fitted to a token budget, then returned to the agent for an optional next recall pass.</desc>
        <defs>
          <pattern id="tempr-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="#879394" fillOpacity="0.16" /></pattern>
          <linearGradient id="tempr-flow" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor="#38bdf8" /><stop offset="55%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#34d399" /></linearGradient>
          <marker id="tempr-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#71879a" /></marker>
          <marker id="tempr-arrow-bright" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" /></marker>
        </defs>

        <rect width="1200" height="570" fill="#09111a" />
        <rect width="1200" height="570" fill="url(#tempr-dots)" />

        {/* The question is the recall loop's stable entry and return point. */}
        <g>
          <rect x="28" y="236" width="160" height="184" rx="14" fill="#101a25" stroke="#38bdf8" strokeOpacity="0.84" />
          <RetrievalText x={46} y={260} size={9} fill="#7dd3fc" weight={800} spacing={0.9}>AGENT QUERY</RetrievalText>
          <rect x="42" y="276" width="132" height="92" rx="8" fill="#0a121b" stroke="#315166" strokeDasharray="4 3" />
          <RetrievalText x={54} y={298} size={8} fill="#93c5fd" weight={800}>QUESTION</RetrievalText>
          <RetrievalText x={54} y={320} size={10} fill="#e2e8f0">What evidence</RetrievalText>
          <RetrievalText x={54} y={336} size={10} fill="#e2e8f0">best answers this</RetrievalText>
          <RetrievalText x={54} y={352} size={10} fill="#e2e8f0">query?</RetrievalText>
          <RetrievalText x={108} y={397} size={8} fill="#7dd3fc" anchor="middle" weight={800}>QUERY ↔ CONTEXT</RetrievalText>
        </g>

        {/* Parallel recall arms */}
        <g>
          <rect x="214" y="150" width="196" height="312" rx="14" fill="#101a25" stroke="#355064" />
          <RetrievalText x={230} y={174} size={9} fill="#93c5fd" weight={800} spacing={0.7}>RECALL · 4 ARMS IN PARALLEL</RetrievalText>
          {[
            { y: 190, name: 'Semantic', hint: 'meaning · vectors' },
            { y: 256, name: 'Keyword', hint: 'exact terms · BM25' },
            { y: 322, name: 'Graph', hint: 'entity relationships' },
            { y: 388, name: 'Temporal', hint: 'time · date windows' },
          ].map(({ y, name, hint }) => (
            <g key={name}>
              <rect x="228" y={y} width="168" height="48" rx="9" fill="#121f2b" stroke="#3b82a6" strokeOpacity="0.72" />
              <RetrievalText x={244} y={y + 20} size={10} fill="#f1f5f9" weight={800}>{name}</RetrievalText>
              <RetrievalText x={244} y={y + 36} size={8} fill="#94a3b8">{hint}</RetrievalText>
            </g>
          ))}
        </g>

        {/* Matching index for each strategy */}
        <g>
          <rect x="428" y="150" width="202" height="312" rx="14" fill="#101a25" stroke="#355064" />
          <RetrievalText x={444} y={174} size={9} fill="#93c5fd" weight={800} spacing={0.8}>SEARCH INDEXES</RetrievalText>
          {[
            { y: 190, name: 'Vectors', hint: 'nearest by meaning' },
            { y: 256, name: 'Full text', hint: 'ranked word matches' },
            { y: 322, name: 'Entity graph', hint: 'people · projects · links' },
            { y: 388, name: 'Dates', hint: 'bounded time scope' },
          ].map(({ y, name, hint }) => (
            <g key={name}>
              <rect x="442" y={y} width="174" height="48" rx="9" fill="#111e29" stroke="#38bdf8" strokeOpacity="0.62" />
              <RetrievalText x={458} y={y + 20} size={10} fill="#e2e8f0" weight={800}>{name}</RetrievalText>
              <RetrievalText x={458} y={y + 36} size={8} fill="#94a3b8">{hint}</RetrievalText>
            </g>
          ))}
        </g>

        {/* Evidence pool preserves lineage before ranking. */}
        <g>
          <rect x="650" y="226" width="174" height="164" rx="14" fill="#101a25" stroke="#38bdf8" strokeOpacity="0.72" />
          <RetrievalText x={737} y={253} size={12} fill="#f1f5f9" weight={800} anchor="middle">Candidate</RetrievalText>
          <RetrievalText x={737} y={270} size={12} fill="#f1f5f9" weight={800} anchor="middle">memories</RetrievalText>
          <RetrievalText x={737} y={294} size={8} fill="#94a3b8" anchor="middle">merge · deduplicate · retain IDs</RetrievalText>
          <rect x="668" y="310" width="138" height="54" rx="6" fill="#0a121b" stroke="#315166" strokeDasharray="3 3" />
          <RetrievalText x={680} y={330} size={8} fill="#7dd3fc" weight={800}>SOURCE-LINKED</RetrievalText>
          <RetrievalText x={680} y={347} size={8} fill="#cbd5e1">memory · date · provenance</RetrievalText>
          <RetrievalText x={737} y={380} size={8} fill="#67e8f9" weight={700} anchor="middle">4 paths → 1 candidate set</RetrievalText>
        </g>

        {/* Ranking checkpoints slow the route in a clear, serial order. */}
        <g>
          <rect x="846" y="92" width="318" height="372" rx="16" fill="#101a25" stroke="#355064" />
          <RetrievalText x={866} y={117} size={9} fill="#93c5fd" weight={800} spacing={0.8}>RANKING · SERIAL CHECKPOINTS</RetrievalText>
          {[
            { y: 138, step: '01', name: 'RRF fusion', hint: 'combine lists · deduplicate' },
            { y: 217, step: '02', name: 'Cross-encoder', hint: 'score query ↔ candidate' },
            { y: 296, step: '03', name: 'Evidence boosts', hint: 'recency · time · proof' },
            { y: 375, step: '04', name: 'Token budget', hint: 'keep the strongest context' },
          ].map(({ y, step, name, hint }, index) => (
            <g key={step}>
              <rect x="866" y={y} width="278" height="64" rx="10" fill={index === 3 ? '#10231f' : '#111e29'} stroke={index === 3 ? '#34d399' : '#3b82a6'} strokeOpacity={index === 3 ? '0.78' : '0.62'} />
              <rect x="880" y={y + 17} width="28" height="28" rx="8" fill={index === 3 ? '#063b35' : '#102d42'} />
              <RetrievalText x={894} y={y + 35} size={8} fill={index === 3 ? '#6ee7b7' : '#7dd3fc'} weight={800} anchor="middle">{step}</RetrievalText>
              <RetrievalText x={920} y={y + 26} size={10} fill="#f1f5f9" weight={800}>{name}</RetrievalText>
              <RetrievalText x={920} y={y + 44} size={8} fill="#94a3b8">{hint}</RetrievalText>
            </g>
          ))}
          <RetrievalText x={1005} y={455} size={8} fill="#6ee7b7" weight={800} anchor="middle">RANKED CONTEXT → AGENT</RetrievalText>
        </g>

        {/* Render routes over the panel backgrounds so the staged links remain visible in the gutters. */}
        <g fill="none" stroke="#62778a" strokeOpacity="0.72" strokeWidth="1.35" markerEnd="url(#tempr-arrow)" pointerEvents="none">
          {routeLines.map(({ d }, index) => <path key={`base-${index}`} d={d} />)}
        </g>
        <g pointerEvents="none">
          {routeLines.map(({ d, delay }, index) => <FlowPulse key={`pulse-${index}`} d={d} delay={delay} enabled={animateFlows} />)}
        </g>

        <g>
          <rect x="54" y="481" width="174" height="24" rx="12" fill="#0b1a26" stroke="#315166" />
          <RetrievalText x={141} y={497} size={8} fill="#7dd3fc" weight={800} anchor="middle" spacing={0.5}>OPTIONAL ITERATION</RetrievalText>
          <rect x="564" y="481" width="274" height="24" rx="12" fill="#0b1a26" stroke="#315166" />
          <RetrievalText x={701} y={497} size={8} fill="#a5b4fc" weight={700} anchor="middle">dwell at each checkpoint · then continue</RetrievalText>
          <rect x="252" y="508" width="282" height="24" rx="12" fill="#0b1a26" stroke="#315166" />
          <RetrievalText x={393} y={524} size={8} fill="#cbd5e1" weight={700} anchor="middle">new question + selected evidence → recall again</RetrievalText>
        </g>
      </svg>
    </div>
    <p className="border-t border-slate-700/50 px-5 py-4 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500 sm:px-7">
      Parallel recall → candidate fusion → deliberate ranking gates → token fit → cited context returns to the query loop
    </p>
  </section>
);

export default MultiStrategyRetrieval;
