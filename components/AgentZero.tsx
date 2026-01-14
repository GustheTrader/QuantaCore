
import React, { useState, useEffect, useRef } from 'react';
import { ZeroLogEntry, AgentZeroSession } from '../types';
import { GoogleGenAI } from "@google/genai";
import { ActionHub } from './ActionHub';

const AgentZero: React.FC = () => {
  const [input, setInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [session, setSession] = useState<AgentZeroSession>({
    id: `Z_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    status: 'idle',
    dockerStatus: 'offline',
    logs: [],
    workspace: '/quanta/zero-workspace'
  });
  
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check local Docker daemon status (Mock simulation of local bridge)
    const checkDocker = async () => {
      // Logic would go here to check localhost:2375 or a custom bridge
      setSession(prev => ({ ...prev, dockerStatus: 'connected' }));
    };
    checkDocker();
    
    // Initial system logs
    addLog('info', 'Agent Zero initializing dynamic logic substrate...');
    addLog('info', 'Connecting to Docker Desktop engine...');
    addLog('info', `Local workspace anchored: ${session.workspace}`);
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.logs]);

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
    
    addLog('agent', cmd, 'Operator');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Simulate Agent Zero "Internal Monologue" + Sub-agent spawning
      addLog('info', 'Spawning Sub-Agent: Coder-01...');
      addLog('code', 'import os\nimport docker\nprint("Scanning workspace for optimization targets...")');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are Agent Zero (Local Dynamic Agent). Execute logic for: "${cmd}". 
        DOCKER STATUS: CONNECTED. 
        WORKSPACE: ${session.workspace}.
        
        Provide a structured log output simulating sub-agent collaboration and final terminal output.`,
        config: {
          systemInstruction: "You are Agent Zero, a dynamic multi-agent framework. You use Docker to execute code and manage local files. Be technical, terminal-oriented, and efficient."
        }
      });

      const output = response.text || "Execution terminated without output.";
      
      addLog('output', output, 'Sub-Agent: Coder-01');
      addLog('info', 'Execution finalized. Resources released.');
      
    } catch (error: any) {
      addLog('error', `Logic Failure: ${error.message}`);
    } finally {
      setIsExecuting(false);
      setSession(prev => ({ ...prev, status: 'idle' }));
    }
  };

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col lg:flex-row gap-8 animate-in fade-in duration-700 overflow-hidden">
      {/* LEFT: WORKSPACE & DOCKER MONITOR */}
      <div className="w-full lg:w-80 flex flex-col space-y-6 shrink-0">
        <div className="glass-card p-8 rounded-[3rem] border-orange-500/20 shadow-2xl flex flex-col bg-[#020617]/50 h-1/2">
           <div className="flex items-center justify-between mb-8">
              <h2 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.4em]">Substrate Node</h2>
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full border ${session.dockerStatus === 'connected' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-rose-500/10 border-rose-500/50 text-rose-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${session.dockerStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></div>
                <span className="text-[8px] font-black uppercase">Docker</span>
              </div>
           </div>

           <div className="space-y-6">
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                 <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Active ID</p>
                 <p className="text-xs font-mono text-white truncate">{session.id}</p>
              </div>
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                 <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Local Workspace</p>
                 <p className="text-xs font-mono text-emerald-400 truncate">{session.workspace}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-2xl text-center">
                    <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Agents</p>
                    <p className="text-xl font-outfit font-black text-orange-500">03</p>
                 </div>
                 <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-2xl text-center">
                    <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Mem</p>
                    <p className="text-xl font-outfit font-black text-emerald-500">128MB</p>
                 </div>
              </div>
           </div>
        </div>

        <div className="glass-card p-8 rounded-[3rem] border-slate-800 shadow-2xl flex flex-col bg-[#020617]/50 flex-1 overflow-hidden">
           <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Local Vault</h2>
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v10a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
           </div>
           <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
              {['main.py', 'mcp_bridge.json', 'requirements.txt', '.env.local'].map(f => (
                <div key={f} className="p-3 bg-slate-900/30 border border-slate-800 rounded-xl flex items-center space-x-3 group hover:border-orange-500/30 transition-all cursor-pointer">
                   <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                   <span className="text-[10px] font-mono text-slate-400 truncate group-hover:text-white transition-colors">{f}</span>
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* RIGHT: TERMINAL FEED */}
      <div className="flex-1 flex flex-col space-y-6">
        <div className="glass-card flex-1 p-8 rounded-[3.5rem] border-slate-800 shadow-2xl relative overflow-hidden flex flex-col bg-[#010409]">
           <div className="flex items-center space-x-4 mb-6 pb-4 border-b border-white/5">
              <div className="flex space-x-1.5">
                 <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-orange-500/50"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
              </div>
              <div className="flex-1 text-center">
                 <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest italic">Agent Zero Terminal (v4.0.2)</span>
              </div>
           </div>

           <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[13px] space-y-4 pr-4">
              {session.logs.map((log) => (
                <div key={log.id} className="animate-in slide-in-from-bottom-1 duration-300">
                   {log.type === 'agent' ? (
                     <div className="flex space-x-3 text-orange-400 font-black">
                        <span className="shrink-0">➜ {log.agentName}:</span>
                        <span className="text-white">"{log.content}"</span>
                     </div>
                   ) : log.type === 'code' ? (
                     <div className="bg-slate-900/50 rounded-xl p-6 border-l-4 border-emerald-500/50 my-4">
                        <pre className="text-emerald-400/90 whitespace-pre-wrap">{log.content}</pre>
                     </div>
                   ) : log.type === 'error' ? (
                     <div className="text-rose-500 font-bold bg-rose-500/5 p-4 rounded-xl border border-rose-500/20">
                        [FATAL_LOGIC_EXCEPTION]: {log.content}
                     </div>
                   ) : log.type === 'output' ? (
                     <div className="text-slate-300 leading-relaxed py-2 pl-6 border-l border-slate-800">
                        {log.content}
                        <div className="mt-4">
                           <ActionHub content={log.content} agentName="Agent Zero" />
                        </div>
                     </div>
                   ) : (
                     <div className="text-slate-600 italic text-[11px] flex items-center space-x-3">
                        <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                        <span>{log.content}</span>
                     </div>
                   )}
                </div>
              ))}
              {isExecuting && (
                <div className="flex items-center space-x-3 text-orange-500 animate-pulse">
                   <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                   <span>Recursive reasoning in progress...</span>
                </div>
              )}
              <div ref={terminalEndRef} />
           </div>

           <form onSubmit={handleCommand} className="mt-8 pt-6 border-t border-white/5">
              <div className="relative">
                 <div className="absolute left-6 top-1/2 -translate-y-1/2 text-orange-500 font-mono font-bold">➜</div>
                 <input 
                   value={input}
                   onChange={e => setInput(e.target.value)}
                   disabled={isExecuting}
                   placeholder="Launch dynamic agent task..."
                   className="w-full bg-[#020617] border border-slate-800 rounded-2xl py-5 pl-14 pr-32 text-white font-mono text-sm focus:border-orange-500/50 outline-none transition-all shadow-inner"
                 />
                 <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest hidden md:block">ENTER TO EXEC</span>
                    <button 
                      type="submit" 
                      disabled={isExecuting || !input.trim()}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isExecuting ? 'bg-slate-800' : 'bg-orange-600 text-white shadow-lg active:scale-95'}`}
                    >
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
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
