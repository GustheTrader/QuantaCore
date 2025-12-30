
import React, { useState, useRef } from 'react';
import { exportToBrowser } from '../services/utils';
import { WHITEPAPER_TEXT } from '../services/whitepaperContent';

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
      title: "Storage Sovereignty",
      desc: (
        <ul className="space-y-1 mt-2">
          <li>• <span className="font-bold text-white">Sovereign AI</span> compute cores.</li>
          <li>• Secure <span className="font-bold text-white">Data</span> governance.</li>
          <li>• Encrypted Prompt isolation.</li>
          <li>• <span className="font-bold text-white">Output</span> saved to your <span className="font-bold text-emerald-400">Cloud Bucket</span>.</li>
        </ul>
      ),
      icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v10a2 2 0 00-2 2v10a2 2 0 002 2z",
      accent: "text-orange-500",
      border: "border-orange-500/20"
    },
    {
      title: "FPT-Omega Engine",
      desc: "First Principles Thinking framework. Deconstructing complexity into atomic logic units.",
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
      accent: "text-emerald-500",
      border: "border-emerald-500/20"
    },
    {
      title: "Neural Cortex",
      desc: "Centralized orchestration for all SME cores. Intelligent task and context routing.",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
      accent: "text-orange-400",
      border: "border-orange-500/20"
    },
    {
      title: "SME Council",
      desc: "Multi-agent strategic debate and executive synthesis grounded in live search data.",
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857",
      accent: "text-emerald-400",
      border: "border-emerald-500/20"
    },
    {
      title: "Hybrid Inference",
      desc: "Cloud-speed scaling for public research, local inference for sensitive private data.",
      icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z",
      accent: "text-orange-500",
      border: "border-orange-500/20"
    },
    {
      title: "Privacy Protocol",
      desc: "Zero data collection policy. No telemetry, no training on user data. Purely sovereign.",
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
      accent: "text-emerald-400",
      border: "border-emerald-500/20"
    }
  ];

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    setLoading(true);
    setTimeout(() => onLogin({ email: email.toLowerCase().trim(), track }), 1500);
  };

  const downloadWhitepaper = () => {
    exportToBrowser("QuantaAI_Sovereign_Intelligence_Whitepaper", WHITEPAPER_TEXT);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-orange-500/30 overflow-x-hidden">
      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-40">
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 via-transparent to-orange-500/5 pointer-events-none blur-[150px] animate-pulse"></div>
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-orange-900/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="max-w-6xl w-full z-10 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center space-x-3 px-6 py-2 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-[10px] font-black uppercase tracking-[0.5em] mb-12 shadow-[0_0_30px_rgba(249,115,22,0.15)]">
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping"></span>
            <span>Neural Infrastructure v4.2 Active</span>
          </div>
          
          <h1 className="text-6xl md:text-[9.5rem] font-outfit font-black mb-4 leading-[0.8] tracking-tighter uppercase">
            Neural <span className="quantum-gradient-text italic">Quanta</span> <br/>
            <span className="text-white relative">
              Logic Cores.
              <div className="absolute -right-12 top-1/2 w-8 h-8 bg-orange-500 blur-2xl opacity-40"></div>
            </span>
          </h1>
          
          <div className="mb-12 mt-6">
            <h2 className="text-3xl md:text-5xl font-outfit font-black uppercase tracking-tighter italic">
              Sovereign <span className="text-orange-500">AI</span> <span className="text-emerald-400">Nervous System.</span>
            </h2>
          </div>
          
          <p className="max-w-4xl mx-auto text-slate-400 text-xl md:text-2xl font-medium leading-relaxed mb-20 italic">
            Private intelligence loops anchored in a <span className="text-white font-black border-b-2 border-orange-500/50 pb-1">sovereign substrate</span> for the autonomous operator.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 mb-32">
            <button 
              onClick={() => authFormRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="px-14 py-7 quanta-btn-orange text-white rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-sm shadow-[0_0_50px_rgba(249,115,22,0.3)] active:scale-95 flex items-center space-x-4 transition-all"
            >
              <span>Initialize Neural Link</span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </button>
            <button 
              onClick={downloadWhitepaper}
              className="px-14 py-7 bg-slate-900 border-2 border-slate-800 text-slate-400 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-sm hover:border-orange-500/50 hover:text-white transition-all flex items-center space-x-3 group"
            >
              <svg className="w-5 h-5 group-hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              <span>Whitepaper v1.0</span>
            </button>
          </div>

          {/* Infrastructure Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
            {features.map((f, i) => (
              <div key={i} className={`sme-card-enhanced p-10 rounded-[3rem] group border ${f.border} transition-all duration-500`}>
                <div className={`w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mb-8 ${f.accent} group-hover:scale-110 group-hover:border-current transition-all shadow-inner`}>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} /></svg>
                </div>
                <h3 className="text-2xl font-outfit font-black text-white mb-4 uppercase tracking-tighter italic group-hover:text-white">{f.title}</h3>
                <div className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed">
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Auth Form Section */}
      <div ref={authFormRef} className="min-h-screen flex items-center justify-center p-6 relative bg-slate-950/90 border-t border-orange-500/20">
        <div className="max-w-3xl w-full z-10 text-center">
          <div className="w-32 h-32 quanta-btn-orange rounded-[3rem] mx-auto mb-10 shadow-[0_0_60px_rgba(249,115,22,0.4)] flex items-center justify-center animate-glow">
            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h2 className="text-6xl font-outfit font-black text-white mb-4 uppercase tracking-tighter italic">Core <span className="text-orange-500">Sync</span></h2>
          <p className="text-slate-500 font-black uppercase tracking-[0.5em] text-[11px] mb-20">Secure Operator Authentication</p>

          <div className="bg-[#020617] p-16 rounded-[4rem] shadow-2xl border-2 border-orange-500/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/5 blur-3xl pointer-events-none"></div>
            <form onSubmit={handleAuth} className="space-y-12">
              <div className="flex justify-center">
                <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800 inline-flex shadow-inner">
                  {(['personal', 'business', 'trading'] as const).map((t) => (
                    <button 
                      key={t}
                      type="button" 
                      onClick={() => setTrack(t)} 
                      className={`px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${track === t ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-left space-y-4">
                <label className="block text-orange-400 text-[10px] font-black uppercase tracking-[0.4em] px-2">Identifier Signature</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@quanta.ai"
                  className="w-full bg-slate-950 border-2 border-slate-800 text-white rounded-2xl py-8 px-10 focus:outline-none focus:border-orange-500 transition-all font-mono text-base shadow-inner"
                  required
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-9 quanta-btn-orange text-white rounded-[2.5rem] font-black uppercase tracking-[0.5em] text-xs shadow-[0_0_40px_rgba(249,115,22,0.2)] transition-all flex items-center justify-center space-x-6 active:scale-95"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>Synchronizing...</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate Quanta Link</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </>
                )}
              </button>

              <div className="pt-4 flex items-center justify-center space-x-4 opacity-60">
                 <div className="h-px w-8 bg-slate-800"></div>
                 <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.5em]">
                   Privacy <span className="text-orange-500/80">&</span> Sovereignty
                 </p>
                 <div className="h-px w-8 bg-slate-800"></div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
