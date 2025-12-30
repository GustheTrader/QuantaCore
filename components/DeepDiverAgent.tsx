
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { streamNovitaDeepDive } from '../services/novitaService';
import { DeepStep, DeepAgentSession } from '../types';
import { exportToBrowser } from '../services/utils';
import { NeuralVoiceArchitect } from './NeuralVoiceArchitect';
import { ActionHub } from './ActionHub';

const DEPTH_ZONES = [
  { depth: 0, name: 'Epipelagic Zone', color: 'text-blue-400' },
  { depth: 200, name: 'Mesopelagic Zone', color: 'text-indigo-400' },
  { depth: 1000, name: 'Bathypelagic Zone', color: 'text-purple-400' },
  { depth: 4000, name: 'Abyssopelagic Zone', color: 'text-cyan-500' },
  { depth: 6000, name: 'Hadalpelagic Zone', color: 'text-rose-500' }
];

const DeepDiverAgent: React.FC = () => {
  const [input, setInput] = useState('');
  const [session, setSession] = useState<DeepAgentSession | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [depth, setDepth] = useState(0);
  const [sonarActive, setSonarActive] = useState(false);
  const [isVoiceArchitectOpen, setIsVoiceArchitectOpen] = useState(false);
  const [activeModel, setActiveModel] = useState('moonshotai/kimi-k2-thinking');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session]);

  useEffect(() => {
    const saved = localStorage.getItem('quanta_api_settings');
    if (saved) {
      const settings = JSON.parse(saved);
      if (settings.novitaModel) setActiveModel(settings.novitaModel);
    }
  }, []);

  const currentZone = useMemo(() => {
    return [...DEPTH_ZONES].reverse().find(z => depth >= z.depth) || DEPTH_ZONES[0];
  }, [depth]);

  const handleDeepDive = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    setDepth(0);
    const sessionId = `DIV_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    setSession({
      id: sessionId,
      query: input,
      steps: [{ id: 'descent', type: 'dive', status: 'running', label: 'Breaching the Surface' }],
      startTime: Date.now()
    });

    const depthInterval = setInterval(() => {
      setDepth(prev => {
        const increment = isProcessing ? (Math.random() * 85) : 0;
        return Math.min(prev + increment, 10935);
      });
    }, 150);

    try {
      let accumulatedText = '';

      await streamNovitaDeepDive(input, (chunk) => {
        setSonarActive(true);
        setTimeout(() => setSonarActive(false), 100);
        
        if (chunk.text) {
          accumulatedText += chunk.text;
          setSession(prev => prev ? {
            ...prev,
            finalResult: accumulatedText,
            steps: prev.steps.map(s => s.id === 'descent' ? { 
              ...s, 
              status: chunk.done ? 'complete' : 'running' as any, 
              label: chunk.done ? 'Retrieval Terminated' : `Layer Data Decrypted at ${Math.round(depth)}m` 
            } : s)
          } : null);
        }

        if (chunk.done) {
          clearInterval(depthInterval);
          setIsProcessing(false);
          setSession(prev => prev ? { ...prev, endTime: Date.now() } : null);
        }
      });

    } catch (error: any) {
      clearInterval(depthInterval);
      setIsProcessing(false);
      setSession(prev => prev ? {
        ...prev,
        steps: [...prev.steps, { 
          id: 'error', 
          type: 'critique', 
          status: 'error', 
          label: 'Pressure Hull Breach',
          content: error.message || 'Signal lost in the abyss.'
        }],
        endTime: Date.now()
      } : null);
    }
  };

  return (
    <div className="animate-in fade-in duration-1000 max-w-6xl mx-auto space-y-16 pb-40 relative">
      <NeuralVoiceArchitect 
        isOpen={isVoiceArchitectOpen} 
        onClose={() => setIsVoiceArchitectOpen(false)} 
        onResult={(res) => setInput(res)} 
        agentType="DeepDiver" 
      />
      
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_0%,_#06b6d4_0%,_transparent_50%)]"></div>
      
      <header className="mb-12 text-center relative z-10">
        <div className="inline-block px-6 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase tracking-[0.5em] mb-6 shadow-[0_0_40px_rgba(6,182,212,0.2)] animate-pulse">
          Sovereign Retrieval System: Novita Active
        </div>
        <h1 className="text-6xl md:text-9xl font-outfit font-black text-white uppercase tracking-tighter leading-none italic">
          Deep <span className="text-cyan-400">Diver</span>
        </h1>
        <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mt-6">Engaging <span className="text-white">{activeModel.split('/').pop()}</span> Thinking Substrate</p>
      </header>

      {!session ? (
        <div className="max-w-3xl mx-auto animate-in zoom-in-95 duration-700">
          <div className="glass-card p-12 rounded-[4rem] border-cyan-500/20 bg-black/60 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
            
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-cyan-500 text-[11px] font-black uppercase tracking-[0.4em] flex items-center">
                <span className="w-2 h-2 bg-cyan-500 rounded-full mr-3 animate-ping"></span>
                Enter Target Data Coordinates
              </h3>
              <button 
                onClick={() => setIsVoiceArchitectOpen(true)}
                className="flex items-center space-x-3 px-4 py-2 rounded-xl bg-orange-600/10 border border-orange-500/30 text-orange-400 hover:bg-orange-600 hover:text-white transition-all shadow-xl animate-glow-orange group"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                <span className="text-[10px] font-black uppercase tracking-widest">Neural Voice Link</span>
              </button>
            </div>
            
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g. Deconstruct the causal relationship between current interest rate volatility and tech sector expansion..."
              className="w-full h-56 bg-slate-950/80 border-2 border-slate-800 rounded-[3rem] p-12 text-cyan-50 font-mono text-lg focus:border-cyan-500 transition-all resize-none shadow-inner placeholder-slate-800"
            />
            
            <button 
              onClick={handleDeepDive}
              disabled={isProcessing || !input.trim()}
              className={`w-full mt-12 py-10 rounded-[3rem] font-black uppercase tracking-[0.6em] text-[13px] shadow-2xl flex items-center justify-center space-x-6 transition-all active:scale-95 ${
                !input.trim() ? 'bg-slate-900 text-slate-700' : 'bg-cyan-600 text-black hover:bg-cyan-500 hover:shadow-[0_0_60px_rgba(6,182,212,0.3)]'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-4 border-black/20 border-t-black rounded-full animate-spin"></div>
                  <span>Initiating Descent...</span>
                </>
              ) : (
                <>
                  <span>Commence Deep Dive</span>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
          <div className="lg:col-span-4 space-y-6">
            <div className="sticky top-10">
              <div className={`glass-card p-10 rounded-[3rem] border-cyan-500/30 transition-all duration-300 ${sonarActive ? 'bg-cyan-500/10 border-cyan-400 scale-[1.02]' : 'bg-black/40'}`}>
                 <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">Telemetry Depth</p>
                    <span className={`text-[10px] font-black uppercase ${currentZone.color}`}>{currentZone.name}</span>
                 </div>
                 <p className="text-6xl font-outfit font-black text-white italic transition-all">
                   {Math.round(depth)}<span className="text-2xl text-cyan-900 ml-2">m</span>
                 </p>
                 <div className="h-2 w-full bg-slate-900 rounded-full mt-8 overflow-hidden border border-white/5">
                    <div className="h-full bg-cyan-500 transition-all duration-500 shadow-[0_0_15px_#06b6d4]" style={{ width: `${(depth / 10935) * 100}%` }}></div>
                 </div>
              </div>

              <div className="mt-12 space-y-4">
                 <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] pl-4 mb-6">Probe Sequence</h3>
                 {session.steps.map((step) => (
                   <div key={step.id} className={`p-6 rounded-[2rem] border transition-all duration-700 ${
                     step.status === 'running' ? 'bg-cyan-500/10 border-cyan-500 animate-pulse' : 
                     step.status === 'error' ? 'bg-rose-500/10 border-rose-500' :
                     'bg-slate-950/50 border-slate-800 opacity-60'
                   }`}>
                     <div className="flex items-center space-x-5">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 ${
                         step.status === 'running' ? 'bg-cyan-600 border-cyan-400 text-black' : 
                         step.status === 'error' ? 'bg-rose-600 border-rose-400 text-white' :
                         'bg-slate-900 border-slate-800 text-slate-600'
                       }`}>
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                       </div>
                       <div>
                         <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{step.type}</p>
                         <h4 className="text-sm font-black text-white uppercase tracking-tight">{step.label}</h4>
                       </div>
                     </div>
                   </div>
                 ))}
              </div>
              
              {session.endTime && (
                <button 
                  onClick={() => { setSession(null); setDepth(0); }}
                  className="w-full mt-10 py-6 bg-slate-900 text-slate-400 border border-slate-800 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:text-white transition-all"
                >
                  Terminate & Reset Submersible
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-12">
             <div className="glass-card p-12 rounded-[4rem] border-cyan-500/20 bg-black/80 min-h-[600px] relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                   <svg className="w-64 h-64 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" /></svg>
                </div>

                <div className="flex items-center justify-between mb-12 pb-8 border-b border-cyan-500/10">
                   <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${isProcessing ? 'bg-cyan-500 animate-ping' : 'bg-emerald-500'}`}></div>
                      <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.4em]">Signal Integrity: {isProcessing ? 'Streaming' : 'Stabilized'}</span>
                   </div>
                </div>

                <div className="prose prose-invert max-w-none">
                   {session.finalResult ? (
                     <>
                        <div className="whitespace-pre-wrap text-slate-100 text-xl leading-relaxed font-medium font-outfit italic selection:bg-cyan-500/40">
                            "{session.finalResult}"
                        </div>
                        <ActionHub content={session.finalResult} agentName="Deep Diver" title={`Dive Retrieval: ${session.query.substring(0, 30)}`} />
                     </>
                   ) : (
                     <div className="flex flex-col items-center justify-center py-40 space-y-8 opacity-40">
                        <div className="relative">
                           <div className="w-24 h-24 border-4 border-cyan-900 border-t-cyan-500 rounded-full animate-spin"></div>
                           <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                           </div>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.8em] text-cyan-500">Retrieving Abyssal Logic...</p>
                     </div>
                   )}
                </div>
             </div>
             <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default DeepDiverAgent;
