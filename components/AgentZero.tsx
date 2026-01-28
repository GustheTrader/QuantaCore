
import React, { useState, useEffect, useRef } from 'react';
import { ZeroLogEntry, AgentZeroSession } from '../types';
import { GoogleGenAI } from "@google/genai";
import { ActionHub } from './ActionHub';

const AgentZero: React.FC = () => {
  const [input, setInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [session, setSession] = useState<AgentZeroSession>({
    id: `ROOT_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    status: 'idle',
    dockerStatus: 'offline',
    logs: [],
    workspace: '/quanta/root-level-agency'
  });
  
  // Simulated visual buffer for "Desktop Vision"
  const [visualScanLine, setVisualScanLine] = useState(0);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkSystems = async () => {
      setSession(prev => ({ ...prev, dockerStatus: 'connected' }));
    };
    checkSystems();
    
    addLog('info', 'ROOT AGENCY CORE INITIALIZED.');
    addLog('info', 'Binding to display :0 (1920x1080)...');
    addLog('info', 'HID Input streams active (Mouse/Keyboard).');
    addLog('info', `FileSystem Mount: ${session.workspace}`);
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.logs]);

  // Visual scan simulation
  useEffect(() => {
    if (isExecuting) {
      const interval = setInterval(() => {
        setVisualScanLine(prev => (prev + 5) % 100);
      }, 50);
      return () => clearInterval(interval);
    } else {
      setVisualScanLine(0);
    }
  }, [isExecuting]);

  const addLog = (type: ZeroLogEntry['type'], content: string, agentName?: string) => {
    const newLog: ZeroLogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      agentName,
      content,
      timestamp: Date.now()
    };
    setSession(prev => ({ ...prev, logs: [...prev.logs, newLog] }));
  };

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isExecuting) return;

    const cmd = input.trim();
    setInput('');
    setIsExecuting(true);
    setSession(prev => ({ ...prev, status: 'executing' }));
    
    addLog('agent', cmd, 'ROOT_USER');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      addLog('info', 'Acquiring visual target...');
      addLog('info', 'Generating Action Chain...');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are Agent Zero (Root Level Computer Agency). Execute logic for: "${cmd}". 
        CONTEXT: Full Desktop Access. 
        WORKSPACE: ${session.workspace}.
        
        Simulate a low-level action log including mouse clicks, typing, and terminal commands.`,
        config: {
          systemInstruction: "You are the Root Computer Agent. You control the OS directly. Output logs that look like automated computer actions (e.g., [MOUSE_MOVE], [CLICK], [TYPE])."
        }
      });

      const output = response.text || "Action complete.";
      
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          await new Promise(r => setTimeout(r, 300)); // Simulate processing delay
          addLog('code', line);
        }
      }
      
      addLog('info', 'Task Thread Resolving...');
      addLog('info', 'Resources released to OS.');
      
    } catch (error: any) {
      addLog('error', `Kernel Exception: ${error.message}`);
    } finally {
      setIsExecuting(false);
      setSession(prev => ({ ...prev, status: 'idle' }));
    }
  };

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col lg:flex-row gap-8 animate-in fade-in duration-700 overflow-hidden">
      {/* LEFT: DESKTOP VISION & STATUS */}
      <div className="w-full lg:w-96 flex flex-col space-y-6 shrink-0">
        {/* Mock Desktop Vision */}
        <div className="glass-card p-1 rounded-[3rem] border-emerald-500/30 shadow-2xl bg-black overflow-hidden relative group h-64">
           <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700"></div>
           <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay"></div>
           
           {/* Scanline Effect */}
           {isExecuting && (
             <div 
               className="absolute left-0 w-full h-1 bg-emerald-400 shadow-[0_0_20px_#10b981] opacity-70 z-10"
               style={{ top: `${visualScanLine}%` }}
             ></div>
           )}
           
           <div className="absolute top-6 left-6 right-6 flex justify-between items-start">
              <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-emerald-500/30">
                 <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Live Desktop Feed</p>
                 <p className="text-[8px] text-white font-mono">1920x1080 @ 60hz</p>
              </div>
              {isExecuting && (
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]"></div>
              )}
           </div>
           
           <div className="absolute bottom-6 left-6 right-6">
              <p className="text-[9px] font-mono text-emerald-500/70 truncate">Analysis: {isExecuting ? 'Processing Visual Vectors...' : 'Idle'}</p>
           </div>
        </div>

        {/* System Stats */}
        <div className="glass-card p-8 rounded-[3rem] border-slate-800 shadow-2xl flex flex-col bg-[#020617]/50 flex-1">
           <div className="flex items-center justify-between mb-8">
              <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Root Status</h2>
              <div className={`px-3 py-1 rounded-full border text-[8px] font-black uppercase ${session.dockerStatus === 'connected' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-rose-500/10 border-rose-500/50 text-rose-400'}`}>
                {session.dockerStatus === 'connected' ? 'ONLINE' : 'OFFLINE'}
              </div>
           </div>

           <div className="space-y-4">
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex justify-between items-center">
                 <span className="text-[9px] font-bold text-slate-500 uppercase">CPU Load</span>
                 <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 animate-pulse" style={{ width: isExecuting ? '85%' : '12%' }}></div>
                 </div>
              </div>
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex justify-between items-center">
                 <span className="text-[9px] font-bold text-slate-500 uppercase">Mem Alloc</span>
                 <span className="text-[10px] font-mono text-emerald-400">4.2GB / 16GB</span>
              </div>
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex justify-between items-center">
                 <span className="text-[9px] font-bold text-slate-500 uppercase">Active Threads</span>
                 <span className="text-[10px] font-mono text-white">{isExecuting ? '14' : '3'}</span>
              </div>
           </div>
           
           <div className="mt-auto pt-6">
              <p className="text-[8px] text-slate-600 uppercase tracking-widest text-center">Full Computer Agency Enabled</p>
           </div>
        </div>
      </div>

      {/* RIGHT: TERMINAL FEED */}
      <div className="flex-1 flex flex-col space-y-6">
        <div className="glass-card flex-1 p-10 rounded-[3.5rem] border-slate-800 shadow-2xl relative overflow-hidden flex flex-col bg-[#010409]">
           <div className="flex items-center space-x-4 mb-6 pb-4 border-b border-white/5">
              <div className="flex space-x-1.5">
                 <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-orange-500/50"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
              </div>
              <div className="flex-1 text-center">
                 <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">ROOT_AGENCY_TERMINAL :: {session.id}</span>
              </div>
           </div>

           <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[13px] space-y-3 pr-4">
              {session.logs.map((log) => (
                <div key={log.id} className="animate-in slide-in-from-bottom-1 duration-200">
                   {log.type === 'agent' ? (
                     <div className="flex space-x-3 text-orange-400 font-bold mt-4 mb-2">
                        <span className="shrink-0">root@quanta:~$</span>
                        <span className="text-white">{log.content}</span>
                     </div>
                   ) : (
                     <div className={`flex items-start space-x-3 ${log.type === 'error' ? 'text-rose-400' : 'text-slate-400'}`}>
                        <span className="shrink-0 opacity-50">[{new Date(log.timestamp).toLocaleTimeString([], {hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}]</span>
                        <span className={log.content.includes('[') ? 'text-emerald-400' : ''}>{log.content}</span>
                     </div>
                   )}
                </div>
              ))}
              {isExecuting && (
                <div className="flex items-center space-x-2 text-emerald-500/50 animate-pulse mt-2">
                   <span className="w-2 h-4 bg-emerald-500 block"></span>
                </div>
              )}
              <div ref={terminalEndRef} />
           </div>

           <form onSubmit={handleCommand} className="mt-8 pt-6 border-t border-white/5">
              <div className="relative group">
                 <div className="absolute left-6 top-1/2 -translate-y-1/2 text-orange-500 font-mono font-bold">root@quanta:~$</div>
                 <input 
                   value={input}
                   onChange={e => setInput(e.target.value)}
                   disabled={isExecuting}
                   autoFocus
                   placeholder="Execute root command..."
                   className="w-full bg-[#0d1117] border border-slate-800 rounded-2xl py-5 pl-36 pr-32 text-white font-mono text-sm focus:border-orange-500/50 outline-none transition-all shadow-inner group-hover:bg-[#161b22]"
                 />
                 <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <button 
                      type="submit" 
                      disabled={isExecuting || !input.trim()}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isExecuting ? 'text-slate-600' : 'bg-slate-800 text-slate-300 hover:text-white'}`}
                    >
                       EXEC
                    </button>
                 </div>
              </div>
           </form>
        </div>
      </div>
    </div>
  );
};

export default AgentZero;
