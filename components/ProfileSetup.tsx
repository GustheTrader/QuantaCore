
import React, { useState, useEffect } from 'react';

interface ProfileSetupProps {
  onComplete: (data: { name: string, callsign: string, personality: string }) => void;
  email: string;
}

const PERSONALITIES = [
  { 
    name: 'Analytic Prime', 
    desc: 'Highly logical, precise, and data-driven. Zero emotional fluff.', 
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    color: 'text-blue-400',
    bg: 'bg-blue-600/10'
  },
  { 
    name: 'Aetheris Warmth', 
    desc: 'Conversational, encouraging, and supportive. Focuses on user well-being.', 
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    color: 'text-rose-400',
    bg: 'bg-rose-600/10'
  },
  { 
    name: 'Minimalist Node', 
    desc: 'Ultra-concise responses. Perfect for high-speed operators.', 
    icon: 'M4 6h16M4 12h16M4 18h7',
    color: 'text-slate-400',
    bg: 'bg-slate-800/20'
  },
  { 
    name: 'Cyber-Tactician', 
    desc: 'Technical, aggressive, and futuristic. High-performance mindset.', 
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    color: 'text-indigo-400',
    bg: 'bg-indigo-600/10'
  },
  { 
    name: 'Zen Architect', 
    desc: 'Philosophical, calm, and balanced. Focuses on the bigger picture.', 
    icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
    color: 'text-emerald-400',
    bg: 'bg-emerald-600/10'
  },
  { 
    name: 'Quantum Flow', 
    desc: 'Conscious awareness and rapid expansion. Prioritizes breakthrough flow-state insights.', 
    icon: 'M13 10V3L4 14h7v7l9-11h-7z M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9',
    color: 'text-cyan-400',
    bg: 'bg-cyan-600/10'
  }
];

const ProfileSetup: React.FC<ProfileSetupProps> = ({ onComplete, email }) => {
  const [name, setName] = useState('');
  const [callsign, setCallsign] = useState('');
  const [personality, setPersonality] = useState('Analytic Prime');
  const [step, setStep] = useState(1);
  const [isFinalizing, setIsFinalizing] = useState(false);

  useEffect(() => {
    // If name changes and callsign is empty, sync them for UX
    if (name && !callsign) {
      setCallsign(name.split(' ')[0]);
    }
  }, [name]);

  const handleFinalize = () => {
    if (!name) return;
    setIsFinalizing(true);
    // Add small delay for dramatic neural sync effect
    setTimeout(() => {
      onComplete({ 
        name, 
        callsign: callsign || name, 
        personality 
      });
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[800px] bg-indigo-600/5 rounded-full blur-[200px]"></div>
      
      <div className="max-w-4xl w-full z-10 space-y-12">
        <div className="text-center">
          <p className="text-indigo-400 font-black uppercase tracking-[0.5em] text-[10px] mb-4">Neural Handshake Successful</p>
          <h1 className="text-5xl md:text-7xl font-outfit font-black text-white uppercase tracking-tighter">
            Personalize <span className="quantum-gradient-text italic">Your Core</span>
          </h1>
        </div>

        <div className="glass-card p-10 md:p-16 rounded-[4rem] border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
          
          {step === 1 ? (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-8">
                <div>
                  <label className="block text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4 px-1">Legal Designation (Name)</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full bg-slate-900/50 border-2 border-slate-800 text-white rounded-2xl py-6 px-8 focus:outline-none focus:border-indigo-500 transition-all font-outfit font-bold text-xl shadow-inner"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4 px-1">Neural Callsign (Preferred Address)</label>
                  <input 
                    type="text" 
                    value={callsign}
                    onChange={(e) => setCallsign(e.target.value)}
                    placeholder="e.g. Commander, Operator, or Nickname"
                    className="w-full bg-slate-900/50 border-2 border-slate-800 text-white rounded-2xl py-6 px-8 focus:outline-none focus:border-indigo-500 transition-all font-outfit font-bold text-xl shadow-inner"
                  />
                  <p className="text-[10px] text-slate-500 mt-4 uppercase font-bold tracking-widest text-center">Your agents will use this callsign in all vocal and textual transmissions.</p>
                </div>
              </div>

              <button 
                onClick={() => setStep(2)}
                disabled={!name}
                className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-xs shadow-xl transition-all active:scale-95 flex items-center justify-center space-x-3"
              >
                <span>Define Personality Matrix</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </div>
          ) : (
            <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-6">
                <label className="block text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4 px-1 text-center">Core Neural Temperament</label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PERSONALITIES.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => setPersonality(p.name)}
                      className={`p-6 rounded-3xl border-2 transition-all text-left flex flex-col h-full group ${personality === p.name ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'}`}
                    >
                      <div className={`w-10 h-10 rounded-xl mb-6 flex items-center justify-center ${p.bg} ${p.color} transition-transform group-hover:scale-110`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={p.icon} /></svg>
                      </div>
                      <h3 className="font-outfit font-black text-white text-sm uppercase tracking-tighter mb-2">{p.name}</h3>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-bold uppercase tracking-tight opacity-70">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex space-x-4">
                <button 
                  onClick={() => setStep(1)}
                  disabled={isFinalizing}
                  className="flex-1 py-6 bg-slate-900 text-slate-500 border border-slate-800 rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] hover:text-white transition-all disabled:opacity-50"
                >
                  Back
                </button>
                <button 
                  onClick={handleFinalize}
                  disabled={isFinalizing}
                  className="flex-[2] py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-xs shadow-xl transition-all active:scale-95 flex items-center justify-center"
                >
                  {isFinalizing ? (
                    <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    "Finalize Neural Sync"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="text-center text-slate-600 text-[9px] font-black uppercase tracking-[0.5em]">Identity synchronized to local edge &bull; {email}</p>
      </div>
    </div>
  );
};

export default ProfileSetup;
