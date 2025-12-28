
import React, { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip } from 'recharts';
import { OptimizationTelemetry } from '../types';

interface NeuralOptimizationWindowProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  telemetry: OptimizationTelemetry;
  optimizationResult?: {
    optimizedPrompt: string;
    improvements: string[];
    traceScore: number;
  } | null;
  isOptimizing?: boolean;
  onApply?: () => void;
}

export const NeuralOptimizationWindow: React.FC<NeuralOptimizationWindowProps> = ({ 
  isOpen, 
  onClose, 
  agentName, 
  telemetry,
  optimizationResult,
  isOptimizing,
  onApply
}) => {
  const chartData = useMemo(() => {
    return Array.from({ length: 10 }).map((_, i) => ({
      time: i,
      sync: Math.min(100, Math.max(0, telemetry.neuralSync - (10 - i) * 2 + Math.random() * 5)),
      depth: Math.min(100, Math.max(0, telemetry.reasoningDepth - (10 - i) * 3 + Math.random() * 8))
    }));
  }, [telemetry]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full lg:w-[450px] bg-[#020617]/95 border-l border-indigo-500/30 backdrop-blur-2xl z-[80] shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col animate-in slide-in-from-right duration-500">
      <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
        <div>
          <h2 className="text-xl font-outfit font-black uppercase tracking-tighter text-white">Neural Management</h2>
          <div className="flex items-center mt-1">
            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase font-black mr-2">Langfuse Connected</span>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Trace: {Math.random().toString(36).substring(7).toUpperCase()}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
        {/* Context Optimizer Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Context Optimizer</h3>
            {optimizationResult && (
              <div className="flex items-center space-x-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Score:</span>
                <span className={`text-xs font-black ${(optimizationResult.traceScore > 0.8) ? 'text-emerald-400' : 'text-orange-400'}`}>
                  {(optimizationResult.traceScore * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {isOptimizing ? (
            <div className="p-10 bg-slate-900/40 border border-indigo-500/20 rounded-[2.5rem] flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Refining Logic Context...</p>
            </div>
          ) : optimizationResult ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
              <div className="p-6 bg-slate-900/80 border border-indigo-500/30 rounded-3xl relative">
                <p className="text-white text-sm leading-relaxed italic mb-4">"{optimizationResult.optimizedPrompt}"</p>
                <button 
                  onClick={onApply}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all"
                >
                  Apply Optimized Context
                </button>
              </div>
              
              <div className="space-y-3">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Logic Improvements</p>
                {optimizationResult.improvements.map((imp, idx) => (
                  <div key={idx} className="flex items-start space-x-3 p-3 bg-slate-900/30 border border-slate-800 rounded-xl">
                    <div className="w-4 h-4 mt-0.5 rounded bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium leading-tight">{imp}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-10 border-2 border-dashed border-slate-800 rounded-[2.5rem] text-center">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-relaxed">
                Awaiting input in Neural Link buffer for optimization...
              </p>
            </div>
          )}
        </section>

        {/* Telemetry Charts */}
        <section className="space-y-4 pt-4 border-t border-slate-800">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">SME Performance Metrics</h3>
          <div className="h-40 w-full bg-slate-950/50 rounded-2xl border border-slate-800 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis hide dataKey="time" />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '10px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Line type="monotone" dataKey="sync" stroke="#10b981" strokeWidth={3} dot={false} animationDuration={1000} />
                <Line type="monotone" dataKey="depth" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card p-5 rounded-3xl border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Sync Depth</p>
            <p className="text-3xl font-outfit font-black text-white">{telemetry.reasoningDepth}%</p>
            <div className="w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${telemetry.reasoningDepth}%` }}></div>
            </div>
          </div>
          <div className="glass-card p-5 rounded-3xl border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Axiom Purity</p>
            <p className="text-3xl font-outfit font-black text-white">{telemetry.contextPurity}%</p>
            <div className="w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${telemetry.contextPurity}%` }}></div>
            </div>
          </div>
        </div>

        {/* Self-Improvement Log */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Inference Telemetry</h3>
            <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded uppercase font-black">Active Trace</span>
          </div>
          <div className="space-y-3">
            {telemetry.optimizations.map((opt, i) => (
              <div key={i} className="flex space-x-3 p-4 bg-slate-900/40 border border-slate-800/50 rounded-xl animate-in slide-in-from-left duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="w-5 h-5 min-w-[20px] rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-[11px] text-slate-300 font-medium leading-relaxed">{opt}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
