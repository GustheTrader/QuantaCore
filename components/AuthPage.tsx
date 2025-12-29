
import React, { useState, useRef } from 'react';

interface AuthPageProps {
  onLogin: (data: { email: string, track: 'personal' | 'business' | 'trading' }) => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [track, setTrack] = useState<'personal' | 'business' | 'trading'>('personal');
  const [loading, setLoading] = useState(false);
  const authFormRef = useRef<HTMLDivElement>(null);

  const features = [
    {
      title: "Sovereign Memory",
      desc: "Local edge persistence. Your knowledge stays on your silicon. Zero cloud leakage.",
      icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM7 11V7a5 5 0 0110 0v4",
      accent: "text-emerald-400"
    },
    {
      title: "FPT-Omega Engine",
      desc: "First Principles Thinking framework. Deconstructing complexity into atomic logic units.",
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
      accent: "text-orange-500"
    },
    {
      title: "Neural Cortex",
      desc: "Centralized orchestration for all SME cores. Intelligent task and context routing.",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
      accent: "text-lime-400"
    },
    {
      title: "SME Council",
      desc: "Multi-agent strategic debate and executive synthesis grounded in live search data.",
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857",
      accent: "text-emerald-400"
    },
    {
      title: "Hybrid Inference",
      desc: "Cloud-speed scaling for public research, local inference for sensitive private data.",
      icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z",
      accent: "text-orange-500"
    },
    {
      title: "Privacy Protocol",
      desc: "Zero data collection policy. No telemetry, no training on user data. Purely sovereign.",
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
      accent: "text-lime-400"
    }
  ];

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    setLoading(true);
    setTimeout(() => onLogin({ email: email.toLowerCase().trim(), track }), 1500);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-emerald-500/30 overflow-x-hidden">
      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-40">
        <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none blur-[150px] animate-pulse"></div>
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none animate-glow"></div>
        
        <div className="max-w-6xl w-full z-10 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-block px-6 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-[0.5em] mb-12 shadow-2xl">
            Sovereign Neural Infrastructure Active
          </div>
          
          <h1 className="text-6xl md:text-[9.5rem] font-outfit font-black mb-12 leading-[0.85] tracking-tighter uppercase">
            Neural <span className="quantum-gradient-text italic">Quanta</span> <span className="block text-white">Logic Cores.</span>
          </h1>
          
          <p className="max-w-4xl mx-auto text-slate-400 text-xl md:text-3xl font-medium leading-relaxed mb-16 italic">
            The world's first <span className="text-orange-500 font-black">Polymath Intelligence System</span> built on FPT-Omega logic and total data sovereignty.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 mb-32">
            <button 
              onClick={() => authFormRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="px-14 py-7 quanta-btn-primary text-white rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-sm shadow-2xl active:scale-95 flex items-center space-x-4"
            >
              <span>Initialize Neural Link</span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
            <button className="px-14 py-7 bg-slate-900 border-2 border-slate-800 text-slate-400 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-sm hover:border-emerald-500/50 hover:text-white transition-all">
              Whitepaper v2.0
            </button>
          </div>

          {/* Infrastructure Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
            {features.map((f, i) => (
              <div key={i} className="glass-card p-10 rounded-[3rem] border-emerald-500/20 group hover:border-emerald-500/50 transition-all duration-500 hover:shadow-[0_0_40px_rgba(16,185,129,0.15)]">
                <div className={`w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-8 ${f.accent} group-hover:scale-110 transition-transform`}>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} /></svg>
                </div>
                <h3 className="text-2xl font-outfit font-black text-white mb-4 uppercase tracking-tighter italic">{f.title}</h3>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Auth Form Section */}
      <div ref={authFormRef} className="min-h-screen flex items-center justify-center p-6 relative bg-slate-950/90 border-t border-emerald-500/20">
        <div className="max-w-3xl w-full z-10 text-center">
          <div className="w-32 h-32 quanta-btn-primary rounded-[3rem] mx-auto mb-10 shadow-[0_0_60px_rgba(16,185,129,0.5)] flex items-center justify-center animate-glow">
            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h2 className="text-6xl font-outfit font-black text-white mb-4 uppercase tracking-tighter italic">Core <span className="text-emerald-400">Sync</span></h2>
          <p className="text-slate-500 font-black uppercase tracking-[0.5em] text-[11px] mb-20">Secure Operator Authentication</p>

          <div className="glass-card p-16 rounded-[4rem] border-emerald-500/20 shadow-2xl">
            <form onSubmit={handleAuth} className="space-y-12">
              <div className="flex justify-center">
                <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800 inline-flex shadow-inner">
                  <button type="button" onClick={() => setTrack('personal')} className={`px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${track === 'personal' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500'}`}>Personal</button>
                  <button type="button" onClick={() => setTrack('business')} className={`px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${track === 'business' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500'}`}>Business</button>
                  <button type="button" onClick={() => setTrack('trading')} className={`px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${track === 'trading' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500'}`}>Trading</button>
                </div>
              </div>

              <div className="text-left space-y-4">
                <label className="block text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em] px-2">Identifier Signature</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@quanta.ai"
                  className="w-full bg-slate-950 border-2 border-slate-800 text-white rounded-2xl py-8 px-10 focus:outline-none focus:border-emerald-500 transition-all font-mono text-base"
                  required
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-9 quanta-btn-primary text-white rounded-[2.5rem] font-black uppercase tracking-[0.5em] text-xs shadow-2xl transition-all flex items-center justify-center space-x-6 active:scale-95"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>Synchronizing...</span>
                  </>
                ) : 'Authenticate Quanta Link'}
              </button>

              <p className="text-slate-600 text-[9px] font-black uppercase tracking-[0.5em] leading-relaxed">
                Local-First &bull; Private Inference &bull; Sovereignty Guaranteed
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
