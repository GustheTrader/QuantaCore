
import React, { useState, useRef, useEffect } from 'react';
import { runDeepAgentLoop } from '../services/deepAgentService';
import { DeepAgentSession, DeepStep } from '../types';
import { exportToBrowser } from '../services/utils';
import { NeuralVoiceArchitect } from './NeuralVoiceArchitect';
import { ActionHub } from './ActionHub';

const DeepAgent: React.FC = () => {
  const [input, setInput] = useState('');
  const [session, setSession] = useState<DeepAgentSession | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVoiceArchitectOpen, setIsVoiceArchitectOpen] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session]);

  const handleDeepSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    setSession(null);
    
    await runDeepAgentLoop(input, (updatedSession) => {
      setSession(updatedSession);
      if (updatedSession.endTime) {
        setIsProcessing(false);
      }
    });
  };

  const getStepIcon = (type: string) => {
    switch(type) {
      case 'plan': return 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2';
      case 'search': return 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z';
      case 'analyze': return 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5';
      case 'critique': return 'M13 10V3L4 14h7v7l9-11h-7z';
      case 'synthesize': return 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 v2M7 7h10';
      default: return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  };

  return (
    <div className="animate-in fade-in duration-1000 max-w-6xl mx-auto space-y-16 pb-40">
      <NeuralVoiceArchitect 
        isOpen={isVoiceArchitectOpen} 
        onClose={() => setIsVoiceArchitectOpen(false)} 
        onResult={(res) => setInput(res)} 
        agentType="DeepAgent" 
      />
      
      <header className="mb-12 text-center">
        <div className="inline-block px-6 py-2 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-[10px] font-black uppercase tracking-[0.5em] mb-6 shadow-2xl">
          Deep Reasoning Protocol & LTM Synchronized
        </div>
        <h1 className="text-6xl md:text-8xl font-outfit font-black text-white uppercase tracking-tighter italic">Neural <span className="quantum-gradient-text italic">Deep Agent</span></h1>
        <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mt-4">Consulting Long-Term Memory for iterative synthesis</p>
      </header>

      {!session && (
        <div className="max-w-3xl mx-auto">
          <div className="glass-card p-12 rounded-[4rem] border-emerald-500/20 quanta-logic-gradient shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-white text-[11px] font-black uppercase tracking-[0.4em]">Submit Sovereign Inquiry</h3>
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
              placeholder="e.g. Based on our prior market research, analyze the impact of new tech regulations on Q3 forecasts..."
              className="w-full h-48 bg-slate-950/80 border-2 border-slate-800 rounded-[3rem] p-10 text-slate-100 font-mono text-lg focus:border-emerald-500 transition-all resize-none shadow-inner"
            />
            <button 
              onClick={handleDeepSearch}
              disabled={isProcessing || !input.trim()}
              className="w-full mt-10 py-8 quanta-btn-primary text-white rounded-[2.5rem] font-black uppercase tracking-[0.5em] text-[12px] shadow-2xl flex items-center justify-center space-x-4 active:scale-95 disabled:opacity-30"
            >
              {isProcessing ? 'Synchronizing LTM & Launching Loop...' : 'Launch Deep Agent'}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </div>
        </div>
      )}

      {session && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Thread Progress */}
          <div className="lg:col-span-4 space-y-6">
            <div className="sticky top-10">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] mb-6 pl-4">Neural Threading</h3>
              <div className="space-y-4">
                {session.steps.map((step, i) => (
                  <div key={step.id} className={`p-6 rounded-[2rem] border transition-all duration-500 ${
                    step.status === 'running' ? 'bg-orange-500/10 border-orange-500 shadow-xl' : 
                    step.status === 'complete' ? 'bg-emerald-500/10 border-emerald-500/50' : 
                    'bg-slate-900 border-slate-800 opacity-50'
                  }`}>
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                        step.status === 'running' ? 'bg-orange-600 text-white animate-pulse' : 
                        step.status === 'complete' ? 'bg-emerald-600 text-white' : 
                        'bg-slate-950 text-slate-700'
                      }`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={getStepIcon(step.type)} /></svg>
                      </div>
                      <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${
                          step.status === 'running' ? 'text-orange-400' : 'text-slate-500'
                        }`}>{step.status === 'running' ? 'Active Processor' : 'Node Complete'}</p>
                        <h4 className="text-sm font-black text-white uppercase tracking-tight">{step.label}</h4>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Report Area */}
          <div className="lg:col-span-8 space-y-12">
            {session.steps.filter(s => s.status === 'complete' || s.status === 'running').map((step, idx) => (
              <div key={idx} className="animate-in slide-in-from-bottom-4 duration-700">
                <div className={`glass-card p-12 rounded-[3.5rem] border-2 group ${
                  step.status === 'running' ? 'border-orange-500/30 bg-orange-500/5 shadow-2xl' : 'border-slate-800/50'
                }`}>
                  <div className="flex items-center justify-between mb-8">
                     <span className={`text-[9px] font-black uppercase tracking-[0.3em] px-4 py-2 rounded-xl border ${
                       step.status === 'running' ? 'border-orange-400 text-orange-400' : 'border-emerald-500/30 text-emerald-500'
                     }`}>
                        {step.type} Stage
                     </span>
                  </div>
                  
                  <div className="text-slate-200 text-lg leading-relaxed font-medium font-outfit italic">
                    {step.content ? (
                      <div className="whitespace-pre-wrap">"{step.content}"</div>
                    ) : (
                      <div className="flex items-center space-x-3 text-orange-400">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping"></div>
                        <span>Processing Neural Axioms...</span>
                      </div>
                    )}
                  </div>

                  {step.status === 'complete' && step.content && (
                    <ActionHub content={step.content} agentName="Deep Agent" title={step.label} />
                  )}
                </div>
              </div>
            ))}

            {session.finalResult && (
              <div className="animate-in zoom-in-95 duration-1000 group">
                <div className="glass-card p-16 rounded-[4rem] border-emerald-500 border-2 bg-emerald-500/5 shadow-[0_0_80px_rgba(16,185,129,0.15)] relative overflow-hidden">
                  <h2 className="text-4xl font-outfit font-black text-white uppercase tracking-tighter mb-10 italic">Sovereign Synthesis Report</h2>
                  <div className="prose prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-slate-100 text-xl leading-relaxed font-medium">
                      {session.finalResult}
                    </div>
                  </div>
                  
                  <div className="mt-16">
                    <ActionHub content={session.finalResult} agentName="Deep Agent" title={`Synthesis: ${session.query.substring(0, 30)}`} />
                  </div>

                  <div className="mt-8 pt-8 border-t border-emerald-500/20 flex items-center justify-between opacity-60">
                     <div className="flex flex-col">
                       <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.5em]">Report ID: {session.id}</p>
                       <p className="text-[9px] font-bold text-slate-500 uppercase mt-1 italic">Knowledge Block Archived to Supabase LTM</p>
                     </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default DeepAgent;
