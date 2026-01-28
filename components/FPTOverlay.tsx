
import React from 'react';
import { FPT_RESEARCH_DATA } from '../services/fptContent';

interface FPTOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FPTOverlay: React.FC<FPTOverlayProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#020617]/95 backdrop-blur-xl p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-4xl h-[80vh] glass-card rounded-[3rem] border-emerald-500/30 overflow-hidden flex flex-col shadow-[0_0_100px_rgba(16,185,129,0.15)] relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>
        
        {/* Header */}
        <div className="p-10 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500 flex items-center justify-center text-emerald-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <div>
              <h2 className="text-3xl font-outfit font-black text-white uppercase tracking-tighter italic">First Principles <span className="quantum-gradient-text">Engine</span></h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">The Architecture of Truth</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-900 rounded-full text-slate-500 hover:text-white transition-all hover:bg-slate-800">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-12">
          <div className="max-w-3xl mx-auto space-y-16">
            <div className="prose prose-invert max-w-none">
              <p className="text-2xl text-slate-200 font-light leading-relaxed italic border-l-4 border-emerald-500 pl-6 mb-12">
                "Reasoning by analogy is like building a house on sand. First Principles Thinking is digging until you hit the bedrock of physics, and building up from there."
              </p>
            </div>

            {FPT_RESEARCH_DATA.sections.map((section, idx) => (
              <div key={idx} className="group">
                <h3 className="text-xl font-outfit font-black text-white uppercase tracking-tight mb-4 flex items-center space-x-3">
                  <span className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-emerald-500">{idx + 1}</span>
                  <span>{section.heading.split('. ')[1]}</span>
                </h3>
                <div className="pl-11 border-l border-slate-800 group-hover:border-emerald-500/30 transition-colors duration-500">
                  <p className="text-slate-400 leading-relaxed text-sm font-medium">{section.content}</p>
                </div>
              </div>
            ))}

            <div className="p-8 bg-emerald-900/10 border border-emerald-500/20 rounded-[2rem] flex flex-col md:flex-row items-center gap-8">
               <div className="flex-1">
                 <h4 className="text-emerald-400 font-black uppercase tracking-widest text-xs mb-2">Auditable Trace System</h4>
                 <p className="text-slate-300 text-xs leading-relaxed">
                   When the FPT Engine is toggled ON, every response includes a transparent breakdown of the Deconstruction, Assumptions Removed, and Axioms used. This allows you to audit the "thought process" of the AI.
                 </p>
               </div>
               <div className="w-full md:w-auto">
                 <div className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest text-center shadow-lg shadow-emerald-500/20">
                   Audit Active
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
