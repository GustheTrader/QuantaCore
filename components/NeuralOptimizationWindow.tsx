
import React, { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip } from 'recharts';
import { OptimizationTelemetry } from '../types';

interface NeuralOptimizationWindowProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  telemetry: OptimizationTelemetry;
}

export const NeuralOptimizationWindow: React.FC<NeuralOptimizationWindowProps> = ({ isOpen, onClose, agentName, telemetry }) => {
  // Generate mock historical data based on current telemetry for visualization
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
      <div className="p-8 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-outfit font-black uppercase tracking-tighter text-white">Neural Link Optimizer</h2>
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping mr-2"></span>
            Agent: {agentName}
          </p>
        </div>
        <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
        {/* Real-time Telemetry Charts */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Neural Synchronization</h3>
          <div className="h-40 w-full bg-slate-900/50 rounded-2xl border border-slate-800 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis hide dataKey="time" />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '10px' }}
                  itemStyle={{ color: '#6366f1' }}
                />
                <Line type="monotone" dataKey="sync" stroke="#6366f1" strokeWidth={3} dot={false} animationDuration={1000} />
                <Line type="monotone" dataKey="depth" stroke="#a855f7" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card p-4 rounded-2xl border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Reasoning Depth</p>
            <p className="text-2xl font-outfit font-black text-white">{telemetry.reasoningDepth}%</p>
            <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${telemetry.reasoningDepth}%` }}></div>
            </div>
          </div>
          <div className="glass-card p-4 rounded-2xl border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Context Purity</p>
            <p className="text-2xl font-outfit font-black text-white">{telemetry.contextPurity}%</p>
            <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-purple-500 transition-all duration-1000" style={{ width: `${telemetry.contextPurity}%` }}></div>
            </div>
          </div>
        </div>

        {/* Self-Improvement Log */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Optimization Log</h3>
            <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded uppercase font-bold">Auto-Scaling</span>
          </div>
          <div className="space-y-3">
            {telemetry.optimizations.map((opt, i) => (
              <div key={i} className="flex space-x-3 p-4 bg-slate-900/40 border border-slate-800/50 rounded-xl animate-in slide-in-from-left duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="w-5 h-5 min-w-[20px] rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                  <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-xs text-slate-300 font-medium leading-relaxed">{opt}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Neural Bridge Action */}
        <div className="pt-6">
           <button className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center space-x-2">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
             </svg>
             <span>Sync Optimization to SME Core</span>
           </button>
        </div>
      </div>
    </div>
  );
};
