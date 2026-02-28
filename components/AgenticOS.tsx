
import React, { useState, useEffect } from 'react';
import { agentOS } from '../services/agentos/AgentOS';
import { VoiceAgent } from './VoiceAgent';
import { useFileIngestion } from '../hooks/useFileIngestion';
import { FileIngestionZone } from './FileIngestionZone';

interface AgenticOSProps {
  profile: { name: string, callsign: string, personality: string };
}

interface NoesisModule {
  id: string;
  name: string;
  category: 'perception' | 'action' | 'core';
  status: 'active' | 'standby' | 'processing';
  load: number;
  icon: string;
}

const AgenticOS: React.FC<AgenticOSProps> = ({ profile }) => {
  const [input, setInput] = useState('');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [telemetry, setTelemetry] = useState<any>(agentOS.getTelemetry());
  const { 
    isDragging, 
    ingestedFiles, 
    handleDragOver, 
    handleDragLeave, 
    handleDrop, 
    removeFile, 
    clearFiles 
  } = useFileIngestion();
  
  // Simulated System State
  const [visionLatency, setVisionLatency] = useState(12);
  const [memoryUsage, setMemoryUsage] = useState(24);
  const [visualStream, setVisualStream] = useState<string[]>([]);
  
  const [modules, setModules] = useState<NoesisModule[]>([
    { id: 'vis_cortex', name: 'Omni-Vision', category: 'perception', status: 'active', load: 45, icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7' },
    { id: 'aud_cortex', name: 'Echo-Locate', category: 'perception', status: 'standby', load: 12, icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3' },
    { id: 'act_driver', name: 'Kinetic Driver', category: 'action', status: 'active', load: 8, icon: 'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122' },
    { id: 'sys_core', name: 'Reasoning Kernel', category: 'core', status: 'active', load: 65, icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  ]);

  const [logs, setLogs] = useState<string[]>([
    'AgentOS Kernel v2.0 loaded.',
    'Sovereign Logic Substrate active.',
    'Awaiting operator intent...'
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisionLatency(prev => Math.max(8, Math.min(40, prev + (Math.random() * 10 - 5))));
      setMemoryUsage(prev => Math.max(20, Math.min(80, prev + (Math.random() * 5 - 2.5))));
      setTelemetry(agentOS.getTelemetry());
      
      setModules(prev => prev.map(m => ({
        ...m,
        load: Math.max(5, Math.min(95, m.load + (Math.random() * 10 - 5)))
      })));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (msg: string, type: 'info' | 'warn' | 'success' | 'kernel' = 'info') => {
    setLogs(prev => [...prev.slice(-12), `[${type.toUpperCase()}] ${msg}`]);
  };

  const handleCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && ingestedFiles.length === 0) || isProcessing) return;

    setIsProcessing(true);
    const currentFiles = [...ingestedFiles];
    addLog(`Operator Intent: "${input}"`, 'info');
    clearFiles();
    
    setVisualStream(prev => [...prev, "Initializing RCB..."]);
    addLog("Reasoning Kernel: Allocating RCB...", 'kernel');

    try {
      const fileContext = currentFiles.map(f => `[FILE: ${f.name}]: ${f.content}`).join('\n\n');
      
      // Use AgentOS runTask instead of direct AI call
      const response = await agentOS.runTask('AgenticOS', `${input}\n\n${fileContext}`);

      setVisualStream(prev => [...prev, `Synthesis Complete.`]);
      addLog(`RK Synthesis: ${response?.substring(0, 50)}...`, 'success');
      setInput('');
    } catch (e: any) {
      addLog(`Kernel Panic: ${e.message}`, 'warn');
    } finally {
      setTimeout(() => setIsProcessing(false), 1000);
    }
  };

  return (
    <FileIngestionZone
      isDragging={isDragging}
      ingestedFiles={ingestedFiles}
      onRemoveFile={removeFile}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="animate-in fade-in duration-1000 max-w-7xl mx-auto pb-40">
      <VoiceAgent 
        isActive={isVoiceActive}
        agentName="AgentOS Prime"
        systemInstruction={`You are the AgentOS Reasoning Kernel. You are precise, sovereign, and privacy-focused. Address the operator as ${profile.callsign}.`}
        onClose={() => setIsVoiceActive(false)}
        profile={profile}
        enabledSkills={['search', 'calendar', 'docs', 'drive']}
        voiceName="Zephyr"
      />

      {/* Header */}
      <header className="flex flex-col md:flex-row items-end justify-between gap-8 mb-12 border-b border-slate-800 pb-8">
        <div>
          <div className="flex items-center space-x-3 mb-4">
             <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Kernel Nominal
             </div>
             <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Global Drift: {telemetry.kernel.globalDrift.toFixed(2)}</div>
          </div>
          <h1 className="text-6xl font-outfit font-black text-white uppercase tracking-tighter italic">Agentic <span className="quantum-gradient-text">OS</span></h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mt-2">Sovereign Reasoning Kernel &bull; Privacy-First Substrate</p>
        </div>
        
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setIsVoiceActive(true)}
             className="group relative px-8 py-4 bg-slate-900 border-2 border-emerald-500/30 hover:border-emerald-500 text-emerald-400 rounded-2xl transition-all shadow-[0_0_30px_rgba(16,185,129,0.1)] hover:shadow-[0_0_50px_rgba(16,185,129,0.3)] overflow-hidden"
           >
             <div className="absolute inset-0 bg-emerald-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
             <div className="flex items-center space-x-3 relative z-10">
               <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
               <span className="text-[11px] font-black uppercase tracking-widest">Neural Link</span>
             </div>
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[700px]">
        
        {/* LEFT: S-MMU & Telemetry */}
        <div className="lg:col-span-3 flex flex-col gap-6">
           <div className="glass-card p-6 rounded-[2.5rem] border-slate-800 bg-slate-900/20">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">S-MMU Telemetry</h3>
              <div className="space-y-6">
                 <div>
                    <div className="flex justify-between mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                       <span>L1 Active Cache</span>
                       <span className="text-emerald-400">{telemetry.mmu.l1Size} / 5</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 transition-all duration-500" style={{width: `${(telemetry.mmu.l1Size/5)*100}%`}}></div>
                    </div>
                 </div>
                 <div>
                    <div className="flex justify-between mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                       <span>L2 Semantic RAM</span>
                       <span className="text-orange-400">{telemetry.mmu.l2Size} Pages</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                       <div className="h-full bg-orange-500 transition-all duration-500" style={{width: `${Math.min(100, telemetry.mmu.l2Size * 5)}%`}}></div>
                    </div>
                 </div>
                 <div>
                    <div className="flex justify-between mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                       <span>L3 Vector KB</span>
                       <span className="text-cyan-400">{telemetry.mmu.l3Size} Archived</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                       <div className="h-full bg-cyan-500 transition-all duration-500" style={{width: `${Math.min(100, telemetry.mmu.l3Size * 2)}%`}}></div>
                    </div>
                 </div>
              </div>
           </div>

           <div className="flex-1 glass-card p-6 rounded-[2.5rem] border-slate-800 bg-[#020617] flex flex-col overflow-hidden">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Active RCBs</h3>
              <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2">
                 {Object.values(telemetry.kernel.rcbs).map((rcb: any) => (
                   <div key={rcb.id} className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                      <div className="flex items-center space-x-3">
                         <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${rcb.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-600'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                         </div>
                         <div>
                            <div className="text-[10px] font-bold text-white uppercase truncate w-24">{rcb.id}</div>
                            <div className="text-[8px] font-mono text-slate-500">DRIFT: {rcb.driftMeter.toFixed(2)}</div>
                         </div>
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full ${rcb.status === 'active' ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : 'bg-orange-500'}`}></div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* CENTER: Main Orchestrator Interface */}
        <div className="lg:col-span-6 flex flex-col">
           <div className="glass-card flex-1 p-1 rounded-[3rem] border-emerald-500/20 bg-black/40 relative overflow-hidden shadow-2xl flex flex-col group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
              
              {/* Vision Stream */}
              <div className="flex-1 bg-slate-950 rounded-[2.8rem] relative overflow-hidden m-2 border border-slate-800">
                 <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-screen grayscale group-hover:grayscale-0 transition-all duration-1000"></div>
                 <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent"></div>
                 
                 {/* HUD Elements */}
                 <div className="absolute top-8 left-8 flex flex-col gap-2">
                    <div className="px-3 py-1 bg-black/50 backdrop-blur border border-emerald-500/30 rounded text-[9px] font-mono text-emerald-400 uppercase">
                       RK_CORE :: EXECUTING
                    </div>
                    <div className="px-3 py-1 bg-black/50 backdrop-blur border border-slate-700 rounded text-[9px] font-mono text-slate-400 uppercase">
                       SOVEREIGN_MODE :: ON
                    </div>
                 </div>

                 {/* Center Graphic */}
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative">
                       <div className="w-64 h-64 border border-emerald-500/10 rounded-full animate-[spin_10s_linear_infinite]"></div>
                       <div className="absolute inset-0 w-48 h-48 border border-emerald-500/20 rounded-full m-auto animate-[spin_15s_linear_infinite_reverse]"></div>
                       <div className="absolute inset-0 w-32 h-32 bg-emerald-500/5 rounded-full m-auto backdrop-blur-sm flex items-center justify-center border border-emerald-500/30">
                          <svg className="w-12 h-12 text-emerald-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                       </div>
                    </div>
                 </div>

                 {/* Logic Stream Overlay */}
                 <div className="absolute bottom-8 left-8 right-8 space-y-2">
                    {visualStream.slice(-3).map((line, i) => (
                       <div key={i} className="text-[10px] font-mono text-emerald-400/80 bg-black/60 px-3 py-1 rounded w-fit animate-in slide-in-from-bottom-2">
                          {line}
                       </div>
                    ))}
                 </div>
              </div>

              {/* Input Command Line */}
              <div className="p-6 relative">
                 <input 
                   value={input}
                   onChange={(e) => setInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleCommand(e)}
                   placeholder="Submit intent to Reasoning Kernel..."
                   className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-5 pl-6 pr-20 text-white font-mono text-sm focus:border-emerald-500 focus:bg-slate-900 transition-all outline-none"
                 />
                 <button 
                   onClick={(e) => handleCommand(e)}
                   disabled={!input.trim() || isProcessing}
                   className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400 transition-colors"
                 >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                 </button>
              </div>
           </div>
        </div>

        {/* RIGHT: Kernel Log */}
        <div className="lg:col-span-3 flex flex-col">
           <div className="glass-card flex-1 p-8 rounded-[2.5rem] border-slate-800 bg-slate-950 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-20">
                 <svg className="w-24 h-24 text-emerald-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Kernel Log</h3>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[9px] space-y-3 relative z-10">
                 {logs.map((log, i) => (
                   <div key={i} className={`pl-3 border-l-2 py-1 leading-relaxed ${
                     log.includes('INFO') ? 'border-slate-700 text-slate-400' :
                     log.includes('WARN') ? 'border-orange-500 text-orange-300' :
                     log.includes('KERNEL') ? 'border-emerald-500 text-emerald-300' :
                     'border-emerald-500 text-emerald-300'
                   }`}>
                     {log}
                   </div>
                 ))}
                 <div className="h-4"></div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800">
                 <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-slate-600">
                    <span>AgentOS: V2.0</span>
                    <span>Sovereign: TRUE</span>
                 </div>
              </div>
           </div>
        </div>

      </div>
      </div>
    </FileIngestionZone>
  );
};

export default AgenticOS;
