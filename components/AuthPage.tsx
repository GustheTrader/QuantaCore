
import React, { useState, useRef } from 'react';

const AuthPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [track, setTrack] = useState<'personal' | 'business'>('personal');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);
  const authFormRef = useRef<HTMLDivElement>(null);

  const scrollToAuth = () => {
    authFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please provide a neural identifier.');
      return;
    }
    setLoading(true);
    
    const session = {
      email: email,
      track: track
    };
    
    localStorage.setItem('quanta_session', JSON.stringify(session));
    
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const features = [
    { 
      icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z', 
      label: 'Local Inference', 
      desc: 'Tier 1 Security: Offline processing for highly sensitive neural data.', 
      svgIcon: 'cpu' 
    },
    { 
      icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z', 
      label: 'Cloud Access', 
      desc: 'Tier 2 Security: High-compute scaling for complex global synthesis.', 
      svgIcon: 'cloud' 
    },
    { 
      icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', 
      label: 'Hybrid Protocol', 
      desc: 'Autonomous switching based on data classification levels.', 
      svgIcon: 'switch' 
    },
    { 
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', 
      label: 'Sovereign Security', 
      desc: 'Unified encryption architecture across all processing tiers.', 
      svgIcon: 'shield' 
    },
  ];

  const personalAgents = [
    { name: "QPersonal Assistant", sub: "Life Optimization" },
    { name: "QWealth Architect", sub: "Asset Strategy" },
    { name: "QSpeculator Pro", sub: "Trade & Alpha" },
    { name: "QHealth Biohacker", sub: "Biology & Performance" },
    { name: "QCreative Engine", sub: "Neural Design" },
    { name: "QLegacy Planner", sub: "Estate Vision" },
    { name: "QMind Fortress", sub: "Mindset & Clarity" },
    { name: "QTravel Nomad", sub: "Freedom Logistics" },
    { name: "QSocial Architect", sub: "Relationship Capital" },
  ];

  const businessAgents = [
    { name: "QStrategy & CEO", sub: "Strategic Intel" },
    { name: "QGrowth & Marketing", sub: "Viral Funnels" },
    { name: "QFinance & CFO", sub: "Neural Cashflow" },
    { name: "QSales & Revenue", sub: "Pipeline Logic" },
    { name: "QOps & Efficiency", sub: "Workflow Architect" },
    { name: "QHR & Talent", sub: "Culture & Recruiting" },
    { name: "QProduct & Dev", sub: "R&D Acceleration" },
    { name: "QLegal & Risk", sub: "Compliance Shield" },
    { name: "QCustomer Success", sub: "Retention Engine" },
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-indigo-500/30 font-inter">
      {/* Specs Modal */}
      {showSpecs && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl overflow-y-auto p-6 md:p-12 animate-in fade-in duration-500">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-start mb-20">
              <div>
                <p className="text-indigo-400 font-black uppercase tracking-[0.5em] text-[10px] mb-4">Neural Infrastructure Specifications</p>
                <h2 className="text-5xl md:text-7xl font-outfit font-black uppercase tracking-tighter">Core <span className="quantum-gradient-text italic">Capabilities</span></h2>
              </div>
              <button 
                onClick={() => setShowSpecs(false)} 
                className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 hover:text-white transition-all hover:scale-110"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-32">
              <div className="space-y-12">
                <h3 className="text-2xl font-outfit font-black uppercase tracking-tight border-l-4 border-indigo-500 pl-6">Neural Bridges (Skills)</h3>
                <div className="space-y-6">
                  {[
                    { title: "Neural Search", desc: "Real-time web grounding & context synthesis" },
                    { title: "Gmail Bridge", desc: "Secure local interaction with your email history" },
                    { title: "Calendar Sync", desc: "Predictive scheduling and availability management" },
                    { title: "Docs Architect", desc: "Forging and summarizing complex documentation" },
                    { title: "Drive Vault", desc: "Sovereign file management and organization" },
                    { title: "Vision Forge", desc: "Advanced image synthesis and visual reasoning" }
                  ].map(skill => (
                    <div key={skill.title} className="glass-card p-6 rounded-3xl border-slate-800/50">
                      <p className="font-black text-xs uppercase tracking-tight text-white mb-1">{skill.title}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{skill.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-12">
                <h3 className="text-2xl font-outfit font-black uppercase tracking-tight border-l-4 border-purple-500 pl-6">Personal SME Roster</h3>
                <div className="grid grid-cols-1 gap-4">
                  {personalAgents.map(agent => (
                    <div key={agent.name} className="glass-card p-5 rounded-2xl border-purple-500/20 bg-purple-500/5">
                      <p className="font-black text-[11px] uppercase tracking-tight text-white">{agent.name}</p>
                      <p className="text-[9px] text-purple-400 uppercase font-bold tracking-[0.2em] mt-1">{agent.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-12">
                <h3 className="text-2xl font-outfit font-black uppercase tracking-tight border-l-4 border-blue-500 pl-6">Business SME Roster</h3>
                <div className="grid grid-cols-1 gap-4">
                  {businessAgents.map(agent => (
                    <div key={agent.name} className="glass-card p-5 rounded-2xl border-blue-500/20 bg-blue-500/5">
                      <p className="font-black text-[11px] uppercase tracking-tight text-white">{agent.name}</p>
                      <p className="text-[9px] text-blue-400 uppercase font-bold tracking-[0.2em] mt-1">{agent.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-card p-12 rounded-[4rem] border-indigo-500/30 text-center mb-20 relative overflow-hidden">
               <div className="absolute inset-0 bg-indigo-500/5 animate-pulse pointer-events-none"></div>
               <h3 className="text-3xl font-outfit font-black uppercase tracking-tighter mb-6">Local Sovereign Memory</h3>
               <p className="max-w-2xl mx-auto text-slate-400 text-sm leading-relaxed mb-10">
                 Quanta Core utilizes Memory Blocks—persistent context hashes that live on your device. These blocks allow your AI to learn your specific patterns, preferences, and history without ever transmitting raw data to a centralized server.
               </p>
               <button onClick={() => setShowSpecs(false)} className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl">Return to Protocol</button>
            </div>
          </div>
        </div>
      )}

      {/* Landing Section */}
      <div className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full conduit-bg opacity-5"></div>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[180px] pointer-events-none"></div>

        <div className="max-w-6xl w-full z-10 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <h1 className="text-5xl md:text-[7rem] font-outfit font-black mb-2 leading-[0.9] tracking-tighter">
            Personal and Business
          </h1>
          <h1 className="text-6xl md:text-[9rem] font-outfit font-black mb-10 leading-[0.9] tracking-tighter quantum-gradient-text italic">
            AI Cortex.
          </h1>
          
          <p className="max-w-2xl mx-auto text-slate-500 text-xl md:text-2xl font-medium leading-relaxed mb-12">
            Experience compassionate AI that runs locally, learns continuously, and never shares your data with anyone.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-24">
            <button 
              onClick={scrollToAuth}
              className="px-12 py-5 bg-white text-black rounded-full font-black uppercase tracking-widest text-sm hover:bg-slate-200 transition-all flex items-center space-x-3 shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-95"
            >
              <span>Get Started</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
            <button 
              onClick={() => setShowSpecs(true)}
              className="px-12 py-5 bg-slate-900/50 border border-slate-800 text-white rounded-full font-black uppercase tracking-widest text-sm hover:bg-slate-800 transition-all active:scale-95"
            >
              Learn More
            </button>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-32">
            {features.map((f, i) => (
              <div key={i} className="glass-card p-8 rounded-[2.5rem] border-slate-800/50 flex flex-col items-center text-center group hover:border-indigo-500/30 transition-all">
                <div className="w-12 h-12 bg-indigo-600/10 rounded-xl flex items-center justify-center mb-6 text-indigo-400 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} /></svg>
                </div>
                <h3 className="font-outfit font-black text-lg mb-1 uppercase tracking-tight">{f.label}</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Awareness Block */}
          <div className="max-w-3xl mx-auto mb-32">
             <div className="glass-card p-10 md:p-16 rounded-[4rem] border-slate-800/50 bg-slate-900/20 text-left relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent"></div>
                <h2 className="text-3xl font-outfit font-black text-center mb-10 uppercase tracking-tighter">Compassionate AI / ML  Awareness</h2>
                
                <div className="space-y-8">
                  <div className="flex items-start space-x-4">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.8)]"></div>
                    <div>
                      <span className="font-black text-white uppercase tracking-tight text-sm mr-2">Memory Blocks</span>
                      <span className="text-slate-500 text-sm font-medium">Persistent context that grows with you and stays private</span>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.8)]"></div>
                    <div>
                      <span className="font-black text-white uppercase tracking-tight text-sm mr-2">Self-Learning Loop</span>
                      <span className="text-slate-500 text-sm font-medium">Continuously adapts to your patterns without external training</span>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.8)]"></div>
                    <div>
                      <span className="font-black text-white uppercase tracking-tight text-sm mr-2">Interchangeable LLMs</span>
                      <span className="text-slate-500 text-sm font-medium">Switch between models while keeping your local data secure</span>
                    </div>
                  </div>
                </div>

                <div className="mt-12 pt-8 border-t border-slate-800/50 flex justify-center">
                  <div className="flex items-center space-x-3 px-6 py-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Your data never leaves your device. Period.</span>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Auth Entry Form */}
      <div ref={authFormRef} className="min-h-screen flex items-center justify-center p-6 relative">
        <div className="max-w-4xl w-full z-10">
          <div className="text-center mb-12">
            <div className="inline-block w-20 h-20 bg-indigo-600 rounded-2xl mb-8 shadow-[0_0_40px_rgba(99,102,241,0.6)] animate-pulse flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h1 className="text-6xl md:text-8xl font-outfit font-black text-white mb-4 uppercase tracking-tighter">
              Quanta <span className="quantum-gradient-text italic">Core</span>
            </h1>
            <p className="text-slate-500 font-black uppercase tracking-[0.5em] text-sm italic">Neural Entry Protocol</p>
          </div>

          <div className="glass-card p-10 md:p-16 rounded-[4rem] border-slate-800 shadow-2xl relative overflow-hidden max-w-2xl mx-auto">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
            
            <form onSubmit={handleAuth} className="space-y-8">
              <div className="flex justify-center mb-4">
                <div className="bg-slate-900/50 p-1 rounded-2xl border border-slate-800 inline-flex">
                  <button 
                    type="button"
                    onClick={() => setTrack('personal')}
                    className={`px-10 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${track === 'personal' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                  >
                    Personal
                  </button>
                  <button 
                    type="button"
                    onClick={() => setTrack('business')}
                    className={`px-10 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${track === 'business' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                  >
                    Business
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-1">Neural Identifier (Email)</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder="operator@quanta.core"
                    className="w-full bg-slate-900/50 border-2 border-slate-800 text-white rounded-2xl py-5 px-6 focus:outline-none focus:border-indigo-500 transition-all font-mono text-sm shadow-inner"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="animate-in shake duration-500 bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl">
                  <p className="text-rose-400 text-[10px] font-black text-center uppercase tracking-widest italic">{error}</p>
                </div>
              )}

              <button 
                disabled={loading}
                className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-xs shadow-[0_20px_40px_rgba(79,70,229,0.3)] transition-all flex items-center justify-center space-x-3 active:scale-95"
              >
                {loading ? (
                  <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <span>Establish Synchronization</span>
                )}
              </button>

              <div className="pt-4 text-center">
                <p className="text-slate-600 text-[8px] font-black uppercase tracking-[0.4em] leading-relaxed">
                  Edge persistence enabled &bull; Local Neural Cache active
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
