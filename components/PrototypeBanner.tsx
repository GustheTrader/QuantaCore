import React from 'react';

// Marks screens whose numbers, logs or results are simulated. Simulated output must
// never be read as measured operation, security evidence or trading performance.
export const PrototypeBanner: React.FC<{ what: string }> = ({ what }) => (
  <div role="note" className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-xs leading-relaxed text-amber-100">
    <span className="mr-2 rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">Prototype · simulated</span>
    {what} These are not measured results.
  </div>
);

export default PrototypeBanner;
