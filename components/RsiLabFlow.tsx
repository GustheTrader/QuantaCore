import React, { useId, useState, useEffect } from 'react';

export default function RsiLabFlow({ active }: { active: boolean }) {
  const id = useId().replaceAll(':', '');
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const query = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReduced(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  const nodes = [
    { x:20, y:30, w:145, title:'Frozen harness', sub:'Profile + model weights' },
    { x:205, y:30, w:165, title:'RRSI proposal + critic', sub:'Isolated candidate worktrees' },
    { x:410, y:30, w:160, title:'Measured trials', sub:'Frozen tasks and budgets' },
    { x:610, y:30, w:150, title:'Native selection', sub:'Score, cost and noise gates' },
    { x:800, y:30, w:175, title:'Holdout + review', sub:'Final inactive profile export' },
    { x:205, y:150, w:190, title:'Recorded discovery worlds', sub:'Measured branches only' },
    { x:435, y:150, w:190, title:'Dream-inspired replay', sub:'Train / validation world split' },
    { x:665, y:150, w:200, title:'Qualified scheduling policy', sub:'Bounded next-round parallelism' }
  ];
  const paths = ['M165 64H205','M370 64H410','M570 64H610','M760 64H800',
    'M685 98V115H300V150','M395 184H435','M625 184H665','M765 150V130H490V98',
    'M685 98V225H285V98'];
  return <div className="relative mt-7 overflow-x-auto rounded-2xl border border-blue-400/15 bg-[#030a17]/65 p-3">
    <svg role="img" aria-label="Outer RRSI harness evolution with an inner recorded-world replay loop and final human review" viewBox="0 0 1000 255" className="min-w-[760px] w-full">
      <defs><linearGradient id={`${id}-line`}><stop stopColor="#22d3ee"/><stop offset="1" stopColor="#a78bfa"/></linearGradient><marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill="#60a5fa"/></marker></defs>
      {paths.map((d,i)=><path key={d} d={d} fill="none" stroke={i===8?'#fb923c':`url(#${id}-line)`} strokeWidth="1.4" opacity={i === 8 ? 0.55 : 0.75} markerEnd={`url(#${id}-arrow)`} strokeDasharray={active?'5 6':undefined}>{active && !reduced && <animate attributeName="stroke-dashoffset" from="33" to="0" dur="3s" repeatCount="indefinite"/>}</path>)}
      {nodes.map((n,i)=><g key={n.title}><rect x={n.x} y={n.y} width={n.w} height="68" rx="12" fill={i>4?'#15162f':'#0b1930'} stroke={i>4?'#8b5cf6':'#3b82f6'} strokeOpacity=".4"/><text x={n.x+12} y={n.y+27} fill={i>4?'#c4b5fd':'#e2e8f0'} fontSize="12" fontWeight="600">{n.title}</text><text x={n.x+12} y={n.y+47} fill="#64748b" fontSize="10">{n.sub}</text></g>)}
      <text x="435" y="243" fill="#fb923c" fontSize="10">OUTER LOOP · next lab harness</text>
      <text x="800" y="126" fill="#94a3b8" fontSize="10">Review before adoption</text>
    </svg>
  </div>;
}
