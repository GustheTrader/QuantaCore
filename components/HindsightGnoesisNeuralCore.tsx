import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { motionTokens } from '../lib/motion-tokens';
import MultiStrategyRetrieval from './MultiStrategyRetrieval';

const FLOWS = [
  'M 168 337 C 194 337 188 185 212 185',
  'M 168 337 C 192 337 190 306 212 306',
  'M 168 337 C 194 337 188 485 212 485',
  'M 372 182 C 402 182 405 132 442 132',
  'M 647 132 C 660 132 664 132 677 132',
  'M 886 132 C 916 162 866 300 894 325',
  'M 372 292 C 402 292 414 318 442 318',
  'M 372 345 C 405 345 410 378 442 378',
  'M 372 398 C 408 398 410 438 442 438',
  'M 632 318 C 644 318 646 326 656 326',
  'M 632 378 C 644 378 646 450 656 450',
  'M 632 438 C 650 438 642 350 656 350',
  'M 894 326 C 920 326 935 238 971 238',
  'M 894 450 C 925 429 935 263 971 263',
  'M 1065 320 L 1065 330',
  'M 1065 405 L 1065 416',
  'M 971 367 C 938 367 924 344 894 344',
  'M 971 382 C 936 390 925 452 894 452',
  'M 971 450 C 932 486 928 598 920 598',
  'M 372 485 C 404 485 407 598 442 598',
];

const SvgText: React.FC<{
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  fill?: string;
  weight?: number;
  anchor?: 'start' | 'middle' | 'end';
  spacing?: number;
}> = ({ x, y, children, size = 12, fill = '#d1d5db', weight = 600, anchor = 'start', spacing = 0 }) => (
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

const PanelTitle: React.FC<{ x: number; y: number; children: React.ReactNode; color?: string }> = ({ x, y, children, color = '#a8b3b5' }) => (
  <SvgText x={x} y={y} size={10} fill={color} weight={800} spacing={0.8}>{children}</SvgText>
);

const HindsightGnoesisNeuralCore: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();
  const [pageVisible, setPageVisible] = useState(false);
  const animateFlows = !prefersReducedMotion && pageVisible;

  useEffect(() => {
    const syncVisibility = () => setPageVisible(document.visibilityState !== 'hidden');
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  const flowTransition = animateFlows
    ? { duration: motionTokens.duration.crawl * 7, ease: motionTokens.easing.linear, repeat: Infinity }
    : { duration: motionTokens.duration.fast, ease: motionTokens.easing.smooth };

  return (
    <section className="mb-28 text-left" aria-labelledby="hindsight-core-title">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 font-mono text-[10px] font-black uppercase tracking-[0.34em] text-emerald-400">Second brain · production routing design</p>
          <h2 id="hindsight-core-title" className="font-outfit text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
            Hindsight <span className="text-emerald-400">Gnoesis Neural Core</span>
          </h2>
          <p className="mt-2 max-w-3xl text-xs font-medium leading-relaxed text-slate-400 sm:text-sm">
            A living map from Obsidian source notes to retained memories, recall paths, and synthesized knowledge.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-300 sm:self-auto">
          <span className={`h-1.5 w-1.5 rounded-full bg-emerald-400 ${animateFlows ? 'animate-pulse' : ''}`} />
          Target design · gated route
        </div>
      </div>

      <div
        className="overflow-x-auto rounded-2xl border border-emerald-500/20 bg-[#080d0f] shadow-[0_24px_80px_rgba(0,0,0,0.32)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
        tabIndex={0}
        aria-label="Scrollable Hindsight memory architecture map"
      >
        <svg
          className="block h-auto min-w-[980px] w-full"
          viewBox="0 0 1200 690"
          role="img"
          aria-labelledby="hindsight-map-title hindsight-map-desc"
        >
          <title id="hindsight-map-title">Hindsight Gnoesis Neural Core memory flow</title>
          <desc id="hindsight-map-desc">
        Obsidian vault notes enter the Hindsight API through retain, recall, and reflect paths. A gated FPT-Omega route handles eligible deep research, novel solving, and cross-domain work; evidence and SME review protect facts and observations before synthesis.
          </desc>
          <defs>
            <pattern id="hindsight-dots" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="#879394" fillOpacity="0.2" />
            </pattern>
            <linearGradient id="hindsight-flow" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="58%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#a3e635" />
            </linearGradient>
            <marker id="hindsight-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64777a" />
            </marker>
            <marker id="hindsight-arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#34d399" />
            </marker>
          </defs>

          <rect width="1200" height="690" fill="#0b1012" />
          <rect width="1200" height="690" fill="url(#hindsight-dots)" />

          {/* Quiet, fixed route lines establish the map before the moving flow. */}
          <g fill="none" stroke="#627176" strokeOpacity="0.48" strokeWidth="1.35" markerEnd="url(#hindsight-arrow)">
            {FLOWS.map((path, index) => <path key={`base-${index}`} d={path} />)}
          </g>
          <g fill="none" stroke="url(#hindsight-flow)" strokeWidth="2.1" strokeDasharray="5 11" strokeLinecap="round" opacity={animateFlows ? 0.88 : 0.48}>
            {FLOWS.map((path, index) => (
              <motion.path
                key={`flow-${index}`}
                d={path}
                initial={false}
                animate={animateFlows ? { strokeDashoffset: [0, -48] } : { strokeDashoffset: 0 }}
                transition={flowTransition}
              />
            ))}
          </g>

          {/* Agent and API */}
          <g>
            <rect x="188" y="105" width="202" height="465" rx="16" fill="#101719" fillOpacity="0.95" stroke="#344448" />
            <PanelTitle x={207} y={126}>HINDSIGHT API</PanelTitle>

            <rect x="212" y="148" width="160" height="67" rx="10" fill="#171f21" stroke="#465559" />
            <SvgText x={292} y={174} anchor="middle" size={13} fill="#f3f4f6" weight={800}>Retain</SvgText>
            <SvgText x={292} y={195} anchor="middle" size={10} fill="#9ca3af">LLM extraction</SvgText>

            <rect x="212" y="234" width="160" height="199" rx="13" fill="#0d1517" stroke="#34d399" strokeOpacity="0.78" />
            <PanelTitle x={228} y={254} color="#6ee7b7">RECALL</PanelTitle>
            <rect x="226" y="266" width="132" height="46" rx="8" fill="#14211f" stroke="#2dd4bf" strokeOpacity="0.72" />
            <SvgText x={242} y={286} size={11} fill="#f3f4f6" weight={800}>Semantic</SvgText>
            <SvgText x={242} y={301} size={9} fill="#9ca3af">meaning</SvgText>
            <rect x="226" y="320" width="132" height="46" rx="8" fill="#14211f" stroke="#2dd4bf" strokeOpacity="0.54" />
            <SvgText x={242} y={340} size={11} fill="#f3f4f6" weight={800}>Keyword</SvgText>
            <SvgText x={242} y={355} size={9} fill="#9ca3af">exact words</SvgText>
            <rect x="226" y="374" width="132" height="46" rx="8" fill="#14211f" stroke="#2dd4bf" strokeOpacity="0.54" />
            <SvgText x={242} y={394} size={11} fill="#f3f4f6" weight={800}>Graph</SvgText>
            <SvgText x={242} y={409} size={9} fill="#9ca3af">via entities</SvgText>

            <rect x="212" y="450" width="160" height="91" rx="10" fill="#111a1d" stroke="#34d399" strokeOpacity="0.65" />
            <SvgText x={292} y={473} anchor="middle" size={12} fill="#f3f4f6" weight={800}>Reflect</SvgText>
            <SvgText x={292} y={491} anchor="middle" size={9} fill="#9ca3af">agent loop</SvgText>
            <SvgText x={228} y={515} size={9} fill="#6ee7b7">search · recall · refine</SvgText>
          </g>

          <g>
            <rect x="22" y="277" width="146" height="120" rx="12" fill="#12191c" stroke="#34d399" strokeOpacity="0.88" />
            <SvgText x={38} y={299} size={12} fill="#f3f4f6" weight={800}>Quanta OS Agent</SvgText>
            <rect x="34" y="312" width="122" height="71" rx="7" fill="#0b1113" stroke="#385055" strokeDasharray="4 3" />
            <SvgText x={45} y={331} size={8} fill="#6ee7b7" weight={800} spacing={0.5}>QUESTION</SvgText>
            <SvgText x={45} y={348} size={9} fill="#cbd5d8">What does my vault</SvgText>
            <SvgText x={45} y={363} size={9} fill="#cbd5d8">say about this work?</SvgText>
          </g>

          {/* Memory bank and source documents */}
          <g>
            <rect x="420" y="35" width="500" height="190" rx="15" fill="#0f1719" stroke="#334449" />
            <PanelTitle x={440} y={57}>MEMORY BANK</PanelTitle>
            <rect x="440" y="72" width="460" height="132" rx="12" fill="#111a1d" stroke="#34d399" strokeOpacity="0.7" />
            <PanelTitle x={458} y={94} color="#6ee7b7">SOURCES</PanelTitle>

            <rect x="458" y="108" width="189" height="78" rx="9" fill="#171f21" stroke="#3c4b4e" />
            <SvgText x={474} y={130} size={11} fill="#e5e7eb" weight={800}>Obsidian Vault</SvgText>
            <SvgText x={474} y={148} size={9} fill="#9ca3af">Markdown notes · source of truth</SvgText>
            <rect x="474" y="158" width="126" height="17" rx="8" fill="#0b1512" stroke="#1f6b4a" />
            <SvgText x={537} y={170} anchor="middle" size={8} fill="#6ee7b7" weight={800}>LOCAL VAULT INPUT</SvgText>

            <rect x="677" y="108" width="205" height="78" rx="9" fill="#171f21" stroke="#38bdf8" strokeOpacity="0.8" />
            <SvgText x={694} y={130} size={11} fill="#e5e7eb" weight={800}>Chunks</SvgText>
            <SvgText x={694} y={148} size={9} fill="#9ca3af">Extracted, source-linked passages</SvgText>
            <rect x="694" y="158" width="170" height="17" rx="4" fill="#10191d" stroke="#31505d" strokeDasharray="3 2" />
            <SvgText x={705} y={170} size={8} fill="#cbd5e1"># notes · facts · references</SvgText>
          </g>

          {/* Search indexes and durable memories */}
          <g>
            <rect x="420" y="245" width="500" height="282" rx="15" fill="#0f1719" stroke="#334449" />
            <PanelTitle x={440} y={267}>MEMORIES</PanelTitle>

            <rect x="440" y="282" width="192" height="226" rx="12" fill="#111a1d" stroke="#34d399" strokeOpacity="0.68" />
            <PanelTitle x={457} y={304} color="#6ee7b7">INDEXES</PanelTitle>
            <rect x="456" y="317" width="160" height="45" rx="8" fill="#171f21" stroke="#38bdf8" strokeOpacity="0.7" />
            <SvgText x={472} y={337} size={10} fill="#e5e7eb" weight={800}>Vectors</SvgText>
            <SvgText x={472} y={351} size={8} fill="#9ca3af">semantic recall</SvgText>
            <rect x="456" y="371" width="160" height="45" rx="8" fill="#171f21" stroke="#38bdf8" strokeOpacity="0.62" />
            <SvgText x={472} y={391} size={10} fill="#e5e7eb" weight={800}>Full text</SvgText>
            <SvgText x={472} y={405} size={8} fill="#9ca3af">keyword search</SvgText>
            <rect x="456" y="425" width="160" height="45" rx="8" fill="#171f21" stroke="#38bdf8" strokeOpacity="0.62" />
            <SvgText x={472} y={445} size={10} fill="#e5e7eb" weight={800}>Entity graph</SvgText>
            <SvgText x={472} y={459} size={8} fill="#9ca3af">people · projects · links</SvgText>
            <SvgText x={457} y={490} size={8} fill="#76878b">Dates stay attached to context</SvgText>

            <rect x="656" y="282" width="238" height="100" rx="10" fill="#111a1d" stroke="#38bdf8" strokeOpacity="0.68" />
            <SvgText x={674} y={306} size={11} fill="#e5e7eb" weight={800}>Facts</SvgText>
            <SvgText x={674} y={324} size={9} fill="#9ca3af">world · experience · cited sources</SvgText>
            <rect x="674" y="338" width="200" height="29" rx="5" fill="#0b1113" stroke="#31505d" strokeDasharray="3 2" />
            <SvgText x={684} y={356} size={8} fill="#cbd5e1">Alice joined Google · Mar 2026</SvgText>

            <rect x="656" y="402" width="238" height="106" rx="10" fill="#111a1d" stroke="#38bdf8" strokeOpacity="0.68" />
            <SvgText x={674} y={426} size={11} fill="#e5e7eb" weight={800}>Observations</SvgText>
            <SvgText x={674} y={444} size={9} fill="#9ca3af">consolidated beliefs · history-aware</SvgText>
            <rect x="674" y="458" width="200" height="32" rx="5" fill="#0b1113" stroke="#31505d" strokeDasharray="3 2" />
            <SvgText x={684} y={478} size={8} fill="#cbd5e1">Alice works on the research team</SvgText>
          </g>

          {/* Background worker and synthesis */}
          <g>
            <rect x="950" y="145" width="230" height="353" rx="15" fill="#101719" stroke="#344448" />
            <PanelTitle x={970} y={168}>HINDSIGHT WORKER</PanelTitle>
            <rect x="971" y="184" width="188" height="136" rx="10" fill="#102019" stroke="#34d399" strokeOpacity="0.88" />
            <SvgText x={1065} y={205} anchor="middle" size={9} fill="#a7f3d0" weight={800}>FPT-OMEGA SMART ROUTER</SvgText>
            <SvgText x={1065} y={224} anchor="middle" size={8} fill="#d1fae5">deep · novel · cross-domain only</SvgText>
            <rect x="987" y="235" width="156" height="34" rx="5" fill="#0b1113" stroke="#296548" />
            <SvgText x={1065} y={249} anchor="middle" size={7} fill="#6ee7b7">engineering · physics</SvgText>
            <SvgText x={1065} y={261} anchor="middle" size={7} fill="#6ee7b7">quantum · metaphysics</SvgText>
            <SvgText x={1065} y={288} anchor="middle" size={7} fill="#9ca3af">gate miss → standard path</SvgText>
            <SvgText x={1065} y={304} anchor="middle" size={7} fill="#a5b4fc">evidence + SME review</SvgText>

            <rect x="971" y="330" width="188" height="75" rx="10" fill="#171f21" stroke="#4a5a5d" />
            <SvgText x={1065} y={352} anchor="middle" size={11} fill="#f3f4f6" weight={800}>Consolidation</SvgText>
            <SvgText x={1065} y={370} anchor="middle" size={8} fill="#9ca3af">verify · classify · preserve lineage</SvgText>
            <SvgText x={1065} y={389} anchor="middle" size={8} fill="#6ee7b7">facts stay source-backed</SvgText>

            <rect x="971" y="416" width="188" height="62" rx="10" fill="#171f21" stroke="#4a5a5d" />
            <SvgText x={1065} y={439} anchor="middle" size={11} fill="#f3f4f6" weight={800}>Refresh</SvgText>
            <SvgText x={1065} y={458} anchor="middle" size={8} fill="#9ca3af">observations → knowledge</SvgText>
          </g>

          <g>
            <rect x="420" y="545" width="500" height="118" rx="15" fill="#0f1719" stroke="#34d399" strokeOpacity="0.72" />
            <PanelTitle x={440} y={567} color="#6ee7b7">SYNTHESIZED</PanelTitle>
            <rect x="442" y="580" width="211" height="63" rx="9" fill="#141e1d" stroke="#476153" />
            <SvgText x={458} y={604} size={10} fill="#e5e7eb" weight={800}>Mental Models</SvgText>
            <SvgText x={458} y={622} size={8} fill="#9ca3af">stable patterns · reviewed context</SvgText>
            <rect x="677" y="580" width="215" height="63" rx="9" fill="#141e1d" stroke="#476153" />
            <SvgText x={693} y={604} size={10} fill="#e5e7eb" weight={800}>Knowledge Pages</SvgText>
            <SvgText x={693} y={622} size={8} fill="#9ca3af">vault-linked · ready for recall</SvgText>
          </g>

          {/* Route captions */}
          <g fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="8" fontWeight="700">
            <rect x="174" y="241" width="53" height="16" rx="8" fill="#10191b" stroke="#344448" />
            <text x="200" y="252" fill="#a7b6b8" textAnchor="middle">retain()</text>
            <rect x="379" y="365" width="53" height="16" rx="8" fill="#0c2019" stroke="#21734d" />
            <text x="405" y="376" fill="#6ee7b7" textAnchor="middle">recall()</text>
            <rect x="383" y="516" width="49" height="16" rx="8" fill="#0c2019" stroke="#21734d" />
            <text x="407" y="527" fill="#6ee7b7" textAnchor="middle">reflect()</text>
          </g>
        </svg>
      </div>
      <p className="mt-3 px-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
        Obsidian vault → retain &amp; recall → conditional FPT-Omega route → evidence and SME review → facts, observations, synthesized knowledge
      </p>
      <p className="mt-2 max-w-5xl px-1 text-[11px] leading-relaxed text-slate-500">
        FPT-Omega runs only when a qualifying domain and deep-research, novel-solving, or cross-domain task are both present. Otherwise, memory uses the standard route. Derived hypotheses stay labeled; facts keep source provenance.
      </p>

      <MultiStrategyRetrieval animateFlows={animateFlows} />
    </section>
  );
};

export default HindsightGnoesisNeuralCore;
