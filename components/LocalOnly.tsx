import React from 'react';
import { useLocation } from 'react-router-dom';
import { isHostedSite, localOnlyReason } from '../lib/hosted-capabilities';

// On the hosted site, shows why a screen is unavailable instead of rendering a
// screen whose API calls cannot succeed there.
export const LocalOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const reason = localOnlyReason(pathname);
  if (!reason || !isHostedSite()) return <>{children}</>;
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-3xl border border-slate-800 bg-slate-950/70 p-8 text-center">
      <h2 className="text-lg font-bold text-white">Available in the local app</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">{reason} Start QuantaCore on your computer and open <span className="font-mono text-slate-300">http://127.0.0.1:3000</span> to use it.</p>
    </div>
  );
};

export default LocalOnly;
