
import React, { useState } from 'react';
import { optimizeContextWithLangfuse } from '../services/geminiService';
import { ContextOptimizationData } from '../types';

interface ContextOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
  initialText?: string;
}

export const ContextOptimizerModal: React.FC<ContextOptimizerModalProps> = ({ isOpen, onClose, onInsert, initialText = '' }) => {
  const [input, setInput] = useState(initialText);
  const [result, setResult] = useState<ContextOptimizationData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleOptimize = async () => {
    if (!input.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      const data = await optimizeContextWithLangfuse(input);
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#020617]/95 backdrop-blur-xl p-6 animate-in zoom-in-95 duration-300">
      <div className="w-full max-w-5xl h-[85vh] glass-card rounded-[3rem] border-slate-800 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col relative bg-[#0a0f1e]">
        {/* Header */}
        <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <div>
              <h2 className="text-2xl font-outfit font-black text-white uppercase tracking-tighter italic">Context <span className="text-indigo-400">Refinery</span></h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Managed by Langfuse</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-900 rounded-full text-slate-500 hover:text-white transition-all hover:bg-slate-800 border border-slate-800">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: Input */}
          <div className="flex-1 p-8 flex flex-col border-r border-slate-800/50 bg-slate-950/30">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4">Raw Thought Stream</label>
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Dump your messy thoughts, requirements, and goals here..."
              className="flex-1 bg-slate-900/50 border-2 border-slate-800 rounded-[2rem] p-6 text-slate-300 font-medium focus:border-indigo-500/50 focus:bg-slate-900/80 outline-none transition-all resize-none mb-6 text-sm leading-relaxed custom-scrollbar"
            />
            <button 
              onClick={handleOptimize}
              disabled={isProcessing || !input.trim()}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] shadow-xl shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Running Trace...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span>Optimize Context</span>
                </>
              )}
            </button>
          </div>

          {/* Right: Output */}
          <div className="flex-1 p-8 flex flex-col bg-[#050914] relative overflow-hidden">
            {result ? (
              <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between mb-6">
                   <label className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Structured Prompt</label>
                   <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                      <span className="text-[8px] font-mono text-slate-500">TRACE ID:</span>
                      <span className="text-[8px] font-mono text-indigo-400">{result.traceId}</span>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                   {/* Prompt Box */}
                   <div className="bg-slate-900 border border-emerald-500/20 rounded-[2rem] p-6 shadow-lg">
                      <p className="text-sm text-emerald-100/90 leading-relaxed font-mono whitespace-pre-wrap">{result.optimized}</p>
                   </div>

                   {/* Analysis Grid */}
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-800">
                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Role Assigned</p>
                         <p className="text-xs font-bold text-white">{result.structure.role}</p>
                      </div>
                      <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-800">
                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Core Task</p>
                         <p className="text-xs font-bold text-white truncate">{result.structure.task}</p>
                      </div>
                   </div>

                   {/* Missing Info Warning */}
                   {result.missingInfo.length > 0 && (
                     <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                        <div className="flex items-center space-x-2 mb-3">
                           <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                           <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Ambiguity Detected</span>
                        </div>
                        <ul className="space-y-1">
                           {result.missingInfo.map((info, i) => (
                             <li key={i} className="text-[11px] text-rose-200/80 font-medium">• {info}</li>
                           ))}
                        </ul>
                     </div>
                   )}
                </div>

                <button 
                  onClick={() => { onInsert(result.optimized); onClose(); }}
                  className="w-full mt-6 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl transition-all active:scale-95"
                >
                  Insert to Chat
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
                 <div className="w-24 h-24 rounded-3xl bg-slate-900 border-2 border-dashed border-slate-700 flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                 </div>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] leading-relaxed max-w-xs">
                   Awaiting raw input to begin trace...<br/>
                   Langfuse will analyze and restructure your context for maximum model adherence.
                 </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
