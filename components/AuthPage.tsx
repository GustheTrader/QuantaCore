
import React, { useState } from 'react';
import { signInWithMagicLink } from '../services/supabaseService';

const AuthPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [track, setTrack] = useState<'personal' | 'business'>('personal');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please provide a neural identifier.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await signInWithMagicLink(email, isSignUp ? track : undefined);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Quantum handshake failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background FX */}
      <div className="absolute top-0 left-0 w-full h-full conduit-bg opacity-10"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-indigo-600/10 rounded-full blur-[180px]"></div>
      
      <div className="max-w-4xl w-full z-10">
        <div className="text-center mb-12">
          <div className="inline-block w-20 h-20 bg-indigo-600 rounded-2xl mb-8 shadow-[0_0_40px_rgba(99,102,241,0.6)] animate-pulse flex items-center justify-center">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h1 className="text-6xl md:text-8xl font-outfit font-black text-white mb-4 uppercase tracking-tighter">
            Quanta <span className="quantum-gradient-text italic">Core</span>
          </h1>
          <p className="text-slate-500 font-black uppercase tracking-[0.5em] text-sm">Synchronize your intelligence track</p>
        </div>

        <div className="glass-card p-10 md:p-16 rounded-[4rem] border-slate-800 shadow-2xl relative overflow-hidden max-w-2xl mx-auto">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
          
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="flex justify-center mb-8">
              <div className="bg-slate-900/50 p-1 rounded-2xl border border-slate-800 inline-flex">
                <div className="flex flex-col items-center">
                  <button 
                    type="button"
                    onClick={() => { setIsSignUp(false); setSuccess(false); }}
                    className={`px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isSignUp ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                  >
                    Sync
                  </button>
                  <span className="text-[8px] font-bold text-slate-600 uppercase mt-1 tracking-widest">sign on</span>
                </div>
                <div className="flex flex-col items-center ml-1">
                  <button 
                    type="button"
                    onClick={() => { setIsSignUp(true); setSuccess(false); }}
                    className={`px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isSignUp ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                  >
                    Forge
                  </button>
                  <span className="text-[8px] font-bold text-slate-600 uppercase mt-1 tracking-widest">sign up</span>
                </div>
              </div>
            </div>

            {isSignUp && !success && (
              <div className="flex justify-center space-x-4 mb-8">
                <button 
                  type="button"
                  onClick={() => setTrack('personal')}
                  className={`flex-1 p-4 rounded-2xl border transition-all text-center ${track === 'personal' ? 'bg-purple-600/20 border-purple-500 text-white' : 'bg-slate-900/50 border-slate-800 text-slate-500'}`}
                >
                  <p className="text-[10px] font-black uppercase tracking-tighter">Personal Core</p>
                </button>
                <button 
                  type="button"
                  onClick={() => setTrack('business')}
                  className={`flex-1 p-4 rounded-2xl border transition-all text-center ${track === 'business' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-slate-900/50 border-slate-800 text-slate-500'}`}
                >
                  <p className="text-[10px] font-black uppercase tracking-tighter">Business Core</p>
                </button>
              </div>
            )}

            {!success ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-indigo-400 text-[9px] font-black uppercase tracking-widest mb-2 px-1">Neural Identifier (Email)</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder="operator@quanta.core"
                    className="w-full bg-slate-900/50 border-2 border-slate-800 text-white rounded-2xl py-4 px-6 focus:outline-none focus:border-indigo-500 transition-all font-mono text-sm"
                  />
                  <p className="text-[9px] text-slate-600 mt-3 uppercase font-bold px-1 tracking-tight">Access will be granted via a magic neural link sent to your identifier.</p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-xl font-outfit font-black text-white uppercase tracking-tighter">Link Transmitted</h3>
                <p className="text-slate-400 text-xs mt-2 font-medium">Check your neural inbox for the activation link to gain access.</p>
                <button 
                  onClick={() => setSuccess(false)}
                  className="mt-8 text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:text-indigo-300 transition-colors"
                >
                  Re-attempt Transmission
                </button>
              </div>
            )}

            {error && <p className="text-indigo-400 text-[10px] font-bold text-center uppercase tracking-tight italic">{error}</p>}

            {!success && (
              <button 
                disabled={loading}
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-indigo-500/20 transition-all flex items-center justify-center space-x-3"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <span>{isSignUp ? 'Forge Magic Link' : 'Sync Magic Link'}</span>
                )}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
