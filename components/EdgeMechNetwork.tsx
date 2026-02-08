
import React, { useState, useEffect, useRef } from 'react';
import { EdgeDomain, EdgeSession, MechNode } from '../types';
import { spinUpMechNode, simulateRedisMetrics, generateEdgeLogic } from '../services/edgeService';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const EdgeMechNetwork: React.FC = () => {
  const [session, setSession] = useState<EdgeSession>({
    isActive: false,
    domains: [],
    nodes: [],
    logs: [],
    redisMetrics: { opsPerSec: 0, hitRate: 0, memoryUsage: '0GB' }
  });

  const [latencyData, setLatencyData] = useState<{time: number, latency: number}[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.logs]);

  // Simulation Loop
  useEffect(() => {
    let interval: any;
    if (session.isActive) {
      interval = setInterval(() => {
        // Update Redis Metrics
        const redis = simulateRedisMetrics();
        
        // Update Latency Graph
        setLatencyData(prev => {
          const newData = [...prev, { time: Date.now(), latency: Math.floor(Math.random() * 60) + 10 }];
          return newData.slice(-30); // Keep last 30 ticks
        });

        // Randomly update node status
        setSession(prev => ({
          ...prev,
          redisMetrics: redis,
          nodes: prev.nodes.map(n => ({
            ...n,
            load: Math.min(100, Math.max(0, n.load + (Math.random() * 20 - 10))),
            status: n.load > 80 ? 'hot' : 'idle'
          }))
        }));

        // Occasional Logic Generation
        if (Math.random() > 0.7) {
           generateEdgeLogic(session.domains, (newLog) => {
             setSession(prev => ({ ...prev, logs: [...prev.logs, newLog] }));
           });
        }

      }, 1000);
    }
    return () => clearInterval(interval);
  }, [session.isActive]);

  const toggleDomain = (domain: EdgeDomain) => {
    setSession(prev => {
      const exists = prev.domains.includes(domain);
      return {
        ...prev,
        domains: exists ? prev.domains.filter(d => d !== domain) : [...prev.domains, domain]
      };
    });
  };

  const toggleNetwork = () => {
    if (session.isActive) {
      setSession(prev => ({ ...prev, isActive: false, nodes: [] }));
    } else {
      // Spin up initial nodes
      const nodes = Array.from({ length: 6 }).map((_, i) => spinUpMechNode(`mech-${i}`));
      setSession(prev => ({ ...prev, isActive: true, nodes }));
      generateEdgeLogic(session.domains.length ? session.domains : ['crypto'], (l) => {
         setSession(prev => ({ ...prev, logs: [...prev.logs, l] }));
      });
    }
  };

  return (
    <div className="animate-in fade-in duration-700 pb-32">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-4">
             <div className="px-4 py-1 bg-red-900/20 border border-red-500/50 text-red-500 rounded-full text-[9px] font-black uppercase tracking-[0.3em] animate-pulse">
                Premium Hot Path
             </div>
             <div className="text-[10px] font-mono text-slate-500">CLOUDFLARE_EDGE :: REDIS_STACK</div>
          </div>
          <h1 className="text-5xl md:text-7xl font-outfit font-black text-white uppercase tracking-tighter italic">
            EDGE <span className="text-red-500">MECH</span> NETWORK
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mt-4">
            High-Frequency Execution Environment
          </p>
        </div>
        
        <button 
          onClick={toggleNetwork}
          className={`w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-500 shadow-[0_0_50px_rgba(239,68,68,0.2)] hover:scale-105 active:scale-95 ${session.isActive ? 'border-red-500 bg-red-500/10 text-red-500 animate-glow-red' : 'border-slate-800 bg-slate-900 text-slate-500'}`}
        >
          <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          <span className="text-[10px] font-black uppercase tracking-widest">{session.isActive ? 'KILL' : 'IGNITE'}</span>
        </button>
      </header>

      {/* Control Plane */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
        <div className="glass-card p-6 rounded-[2.5rem] border-slate-800 bg-[#050505]">
           <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Target Domains</h3>
           <div className="space-y-3">
             {(['futures', 'crypto', 'prediction', 'sports_arb'] as EdgeDomain[]).map(d => (
               <button 
                 key={d}
                 onClick={() => toggleDomain(d)}
                 className={`w-full py-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex justify-between px-6 ${session.domains.includes(d) ? 'bg-red-900/20 border-red-500 text-red-400' : 'bg-slate-900 border-slate-800 text-slate-600 hover:border-slate-600'}`}
               >
                 <span>{d.replace('_', ' ')}</span>
                 <div className={`w-2 h-2 rounded-full ${session.domains.includes(d) ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-slate-700'}`}></div>
               </button>
             ))}
           </div>
        </div>

        <div className="lg:col-span-3 glass-card p-8 rounded-[2.5rem] border-slate-800 bg-[#050505] relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-transparent to-red-600 opacity-50"></div>
           <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em]">Redis Hot Path Telemetry</h3>
              <span className="font-mono text-[10px] text-slate-500">us-east-1 :: 6379</span>
           </div>
           
           <div className="grid grid-cols-3 gap-8 mb-8">
              <div>
                 <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Ops/Sec</p>
                 <p className="text-3xl font-mono text-white">{session.isActive ? session.redisMetrics.opsPerSec.toLocaleString() : '0'}</p>
              </div>
              <div>
                 <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Cache Hit Rate</p>
                 <p className="text-3xl font-mono text-emerald-400">{session.isActive ? `${(session.redisMetrics.hitRate * 100).toFixed(2)}%` : '0%'}</p>
              </div>
              <div>
                 <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Mem Usage</p>
                 <p className="text-3xl font-mono text-orange-400">{session.isActive ? session.redisMetrics.memoryUsage : '0GB'}</p>
              </div>
           </div>

           <div className="h-32 w-full bg-slate-900/30 rounded-xl border border-slate-800/50 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={latencyData}>
                  <defs>
                    <linearGradient id="colorLat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis hide dataKey="time" />
                  <YAxis hide />
                  <Tooltip contentStyle={{backgroundColor: '#000', borderColor: '#333'}} itemStyle={{fontSize: '10px', color: '#ef4444'}} />
                  <Area type="monotone" dataKey="latency" stroke="#ef4444" fillOpacity={1} fill="url(#colorLat)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* Nodes & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[500px]">
         {/* Mech Node Map */}
         <div className="glass-card p-8 rounded-[3rem] border-slate-800 bg-[#050505] flex flex-col">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Cloudflare Mech Topology</h3>
            
            {session.isActive ? (
              <div className="flex-1 grid grid-cols-3 gap-4 auto-rows-min">
                 {session.nodes.map(node => (
                   <div key={node.id} className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between aspect-square ${node.status === 'hot' ? 'bg-red-900/10 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-slate-900 border-slate-800'}`}>
                      <div className="flex justify-between items-start">
                         <div className={`w-2 h-2 rounded-full ${node.status === 'hot' ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`}></div>
                         <span className="text-[8px] font-mono text-slate-500">{node.region}</span>
                      </div>
                      <div className="text-center">
                         <div className="text-2xl font-black text-white">{node.id.split('-')[1]}</div>
                         <div className="text-[9px] font-bold text-slate-600 uppercase">Worker Node</div>
                      </div>
                      <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                         <div className="h-full bg-red-500 transition-all duration-500" style={{width: `${node.load}%`}}></div>
                      </div>
                   </div>
                 ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl opacity-30">
                 <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 v2M7 7h10" /></svg>
                 <p className="text-[10px] font-black uppercase tracking-widest">Network Offline</p>
              </div>
            )}
         </div>

         {/* Execution Log */}
         <div className="glass-card p-8 rounded-[3rem] border-red-900/20 bg-black flex flex-col relative overflow-hidden">
            <div className="absolute top-4 right-4 text-[9px] font-mono text-red-900 animate-pulse">LIVE_EXEC_STREAM</div>
            <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-xs space-y-3 pr-2">
               {session.logs.map(log => (
                 <div key={log.id} className="animate-in slide-in-from-left-2 duration-100 flex space-x-3">
                    <span className="text-slate-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString([], {hour12: false, fractionalSecondDigits: 3} as any)}]</span>
                    <span className={`font-bold shrink-0 w-12 ${log.source === 'REDIS' ? 'text-indigo-400' : log.source === 'MECH' ? 'text-red-400' : 'text-slate-400'}`}>{log.source}</span>
                    <span className={`break-all ${log.level === 'exec' ? 'text-white' : 'text-slate-400'}`}>
                      {log.message}
                      {log.latency && <span className="text-emerald-500 ml-2">[{log.latency}ms]</span>}
                    </span>
                 </div>
               ))}
               <div ref={logEndRef} />
            </div>
         </div>
      </div>
      
      <style>{`
        @keyframes glow-red {
          0%, 100% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.5); }
          50% { box-shadow: 0 0 50px rgba(239, 68, 68, 0.6); border-color: rgba(239, 68, 68, 1); }
        }
        .animate-glow-red { animation: glow-red 2s infinite; }
      `}</style>
    </div>
  );
};

export default EdgeMechNetwork;
