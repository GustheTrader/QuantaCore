
import React from 'react';

interface ContextOptimizerBarProps {
  onOptimize: () => void;
  isOptimizing: boolean;
  activeContextCount: number;
  onClearContext?: () => void;
  optimizationResult?: {
    optimizedPrompt: string;
    improvements: string[];
    traceScore: number;
    compressionRatio: number;
    intelligenceDensity: number;
  } | null;
  onApply?: () => void;
}

export const ContextOptimizerBar: React.FC<ContextOptimizerBarProps> = ({
  onOptimize,
  isOptimizing,
  activeContextCount,
  onClearContext,
  optimizationResult,
  onApply
}) => {
  return (
    <div className="mb-4 animate-in slide-in-from-bottom-2 duration-500">
      <div className="bg-[#020617] rounded-full p-4 border border-emerald-500/20 flex items-center justify-between shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-orange-500/5 pointer-events-none"></div>
        
        <div className="flex items-center space-x-12 px-6 z-10">
          {/* Left: Context Node Info */}
          <div className="flex items-center space-x-4">
             <div className={`w-3.5 h-3.5 rounded-full border-2 border-white/10 shadow-[0_0_10px_currentColor] transition-all duration-700 ${activeContextCount > 0 ? 'bg-emerald-500 text-emerald-500 animate-pulse' : 'bg-slate-800 text-slate-800'}`}></div>
             <div className="flex flex-col">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Context Management</span>
               <span className="text-[12px] font-black text-white uppercase tracking-tight italic leading-none">{activeContextCount} Neural Nodes Active</span>
             </div>
          </div>

          <div className="h-8 w-px bg-slate-800/80"></div>

          {/* Middle: Density Meter */}
          <div className="flex items-center space-x-6">
             <div className="flex flex-col">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5">Density Meter</span>
               <div className="w-28 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                 <div 
                   className="h-full bg-gradient-to-r from-emerald-500 to-orange-500 transition-all duration-1000" 
                   style={{ width: `${(optimizationResult?.intelligenceDensity || 0.4) * 100}%` }}
                 ></div>
               </div>
             </div>
             
             <div className="flex flex-col">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Cortex Status</span>
               <span className="text-[11px] font-black text-emerald-400 uppercase tracking-tight italic leading-none">Budget Optimization Ready</span>
             </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 z-10 px-2">
          {/* CONTEXT OPTIMIZER BUTTON */}
          <button 
            type="button"
            onClick={onOptimize}
            disabled={isOptimizing}
            className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition-all flex items-center space-x-3 border shadow-xl ${
              isOptimizing 
                ? 'bg-orange-600/20 border-orange-500/50 text-orange-400' 
                : 'bg-gradient-to-r from-orange-600 to-orange-500 text-white border-orange-400 hover:scale-[1.02] active:scale-95 animate-glow-orange'
            }`}
          >
            {isOptimizing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
            )}
            <span>Context Optimizer</span>
          </button>
          
          {/* PURGE BUTTON */}
          {onClearContext && (
            <button 
               type="button"
               onClick={onClearContext}
               className="px-6 py-3 rounded-2xl bg-[#020617] border border-slate-800 text-slate-500 hover:text-orange-500 hover:border-orange-500/50 text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-inner"
            >
              Purge
            </button>
          )}
        </div>
      </div>
      
      {/* Result Flyout */}
      {optimizationResult && (
        <div className="mt-4 p-8 bg-[#020617] rounded-[2.5rem] border border-orange-500/30 animate-in zoom-in-95 duration-500 relative overflow-hidden shadow-2xl">
           <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-orange-500 to-transparent"></div>
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                 <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 border border-orange-500/20">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                 </div>
                 <span className="text-[11px] font-black text-orange-500 uppercase tracking-[0.3em] italic">Compression Core Synced</span>
              </div>
              <div className="flex items-center space-x-6">
                 <div className="text-right">
                    <span className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Efficiency</span>
                    <span className="text-emerald-400 text-xs font-black">+{Math.round((1 - optimizationResult.compressionRatio) * 100)}%</span>
                 </div>
                 {onApply && (
                   <button 
                     type="button"
                     onClick={onApply}
                     className="px-6 py-2 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all shadow-lg active:scale-95"
                   >
                     Apply Logic
                   </button>
                 )}
              </div>
           </div>
           <div className="p-5 bg-black/40 rounded-2xl border border-slate-800/50 shadow-inner">
              <p className="text-slate-300 text-base leading-relaxed italic font-medium">"{optimizationResult.optimizedPrompt}"</p>
           </div>
        </div>
      )}
    </div>
  );
};
