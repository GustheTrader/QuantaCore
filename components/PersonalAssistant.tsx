
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { NeuralVoiceArchitect } from './NeuralVoiceArchitect';

interface PersonalAssistantProps {
  profile: { name: string, callsign: string, personality: string };
}

interface MoltSkill {
  id: string;
  name: string;
  category: 'perception' | 'action' | 'system';
  version: string;
  description: string;
  active: boolean;
  icon: string;
}

const PersonalAssistant: React.FC<PersonalAssistantProps> = ({ profile }) => {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [systemLog, setSystemLog] = useState<string[]>(['Moltbot Core v2.1 initialized', 'ClawdHub repository synced', 'Waiting for operator command...']);
  
  const [skills, setSkills] = useState<MoltSkill[]>([
    { id: 'ocr', name: 'Optical Vision', category: 'perception', version: '1.4.2', description: 'Real-time screen OCR and object detection.', active: true, icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
    { id: 'browser', name: 'Chromium Driver', category: 'action', version: '2.0.1', description: 'Headless navigation and DOM manipulation.', active: true, icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9' },
    { id: 'mouse', name: 'HID Controller', category: 'action', version: '1.1.0', description: 'Direct mouse/keyboard event injection.', active: true, icon: 'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122' },
    { id: 'fs', name: 'File System', category: 'system', version: '0.9.5', description: 'Local read/write access to approved dirs.', active: false, icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
    { id: 'term', name: 'Shell Exec', category: 'system', version: '1.2.0', description: 'Bash/Powershell command execution.', active: false, icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' }
  ]);

  const toggleSkill = (id: string) => {
    setSkills(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
    addLog(`Skill [${id}] state changed.`);
  };

  const addLog = (entry: string) => {
    setSystemLog(prev => [...prev.slice(-6), `[${new Date().toLocaleTimeString()}] ${entry}`]);
  };

  const handleCommand = async (e?: React.FormEvent, cmdOverride?: string) => {
    if (e) e.preventDefault();
    
    const cmd = cmdOverride || input;
    if (!cmd.trim() || isProcessing) return;

    if (cmdOverride) setInput(cmdOverride);

    setIsProcessing(true);
    setResponse(null);
    addLog(`USER COMMAND: "${cmd}"`);

    // Simulate Moltbot Planning Phase
    const activeSkills = skills.filter(s => s.active).map(s => s.name).join(', ');
    
    setTimeout(() => addLog(`Analyzing via Moltbot Core...`), 400);
    setTimeout(() => addLog(`Checking capabilities: [${activeSkills}]`), 800);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are the Moltbot Personal Assistant.
        USER: "${cmd}"
        ACTIVE SKILLS: ${activeSkills}
        
        1. Formulate a technical plan to execute this on the local machine.
        2. Provide a short, robotic confirmation.
        
        Return valid JSON: { "plan": ["step 1", "step 2"], "response": "text" }`,
        config: { responseMimeType: 'application/json' }
      });

      const data = JSON.parse(res.text || '{}');
      
      if (data.plan) {
        data.plan.forEach((step: string, i: number) => {
            setTimeout(() => addLog(`EXEC: ${step}`), 1200 + (i * 600));
        });
      }
      setResponse(data.response || "Task initiated.");
      if (!cmdOverride) setInput('');
    } catch (e) {
      console.error(e);
      setResponse("Neural link unstable. Unable to formulate Moltbot plan.");
      addLog("ERROR: API handshake failed.");
    } finally {
      setTimeout(() => setIsProcessing(false), 2000);
    }
  };

  return (
    <div className="animate-in fade-in duration-1000 max-w-7xl mx-auto pb-40">
      <NeuralVoiceArchitect 
        isOpen={isVoiceOpen} 
        onClose={() => setIsVoiceOpen(false)} 
        onResult={(res) => handleCommand(undefined, res)} 
        agentType="DeepAgent"
        autoStart={true}
      />

      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-rose-500/20 pb-8">
        <div>
          <div className="flex items-center space-x-3 mb-4">
             <div className="bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-md">Moltbot V2</div>
             <a href="https://github.com/Jeffguys/moltbot" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-rose-400 text-[10px] font-bold uppercase tracking-widest flex items-center space-x-1 transition-colors">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                <span>Jeffguys/Moltbot</span>
             </a>
          </div>
          <h1 className="text-5xl font-outfit font-black text-white uppercase tracking-tighter italic">Desktop <span className="text-rose-500">Orchestrator</span></h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mt-2">Local Computer Agency Dashboard</p>
        </div>
        
        <div className="flex items-center space-x-6">
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Operator</p>
              <p className="text-white font-bold">{profile.callsign}</p>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Load</p>
              <div className="flex items-center space-x-2">
                 <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 animate-pulse w-[40%]"></div>
                 </div>
              </div>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[600px]">
        
        {/* LEFT: System Status & Logs */}
        <div className="lg:col-span-3 flex flex-col gap-6">
           <div className="glass-card p-6 rounded-[2rem] border-rose-500/20 bg-rose-500/5">
              <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-[0.3em] mb-4">Core Telemetry</h3>
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">VISION</span>
                    <span className="text-[10px] font-mono text-emerald-400">ACTIVE</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">HID LINK</span>
                    <span className="text-[10px] font-mono text-emerald-400">CONNECTED</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">LATENCY</span>
                    <span className="text-[10px] font-mono text-white">24ms</span>
                 </div>
              </div>
           </div>

           <div className="glass-card flex-1 p-6 rounded-[2rem] border-slate-800 bg-[#020617] flex flex-col overflow-hidden">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Moltbot Terminal</h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[9px] space-y-2 text-slate-300">
                 {systemLog.map((log, i) => (
                   <div key={i} className="break-words border-l-2 border-slate-800 pl-2 opacity-80 hover:opacity-100">
                     {log}
                   </div>
                 ))}
                 {isProcessing && <div className="animate-pulse text-rose-400">>> PROCESSING_LOGIC_CHAIN...</div>}
              </div>
           </div>
        </div>

        {/* CENTER: Main Command Interface */}
        <div className="lg:col-span-6 flex flex-col">
           <div className="glass-card flex-1 p-8 rounded-[3rem] border-rose-500/20 bg-black/40 relative overflow-hidden shadow-[0_0_50px_rgba(244,63,94,0.05)] flex flex-col">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent"></div>
              
              {/* Visual Feed Simulation */}
              <div className="h-48 bg-slate-900/50 rounded-3xl border border-slate-800 mb-6 relative overflow-hidden group">
                 <div className="absolute inset-0 flex items-center justify-center opacity-30 group-hover:opacity-50 transition-opacity">
                    <svg className="w-16 h-16 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                 </div>
                 <div className="absolute top-4 left-4 px-2 py-1 bg-black/60 rounded text-[8px] font-mono text-rose-400 border border-rose-500/30">LIVE FEED: IDLE</div>
                 <div className="absolute bottom-0 left-0 w-full h-px bg-rose-500/50 animate-[scan_2s_linear_infinite]"></div>
              </div>

              {/* Response Area */}
              <div className="flex-1 mb-6 flex flex-col justify-end">
                 {response ? (
                   <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-3xl animate-in zoom-in-95">
                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">Moltbot Response</p>
                      <p className="text-white text-lg font-medium italic leading-relaxed">"{response}"</p>
                   </div>
                 ) : (
                   <div className="text-center opacity-40">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Awaiting Instruction</p>
                   </div>
                 )}
              </div>

              {/* Input Area */}
              <div className="relative">
                 <input 
                   value={input}
                   onChange={(e) => setInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleCommand(e)}
                   placeholder="Command the Moltbot Core..."
                   className="w-full bg-slate-950 border-2 border-slate-800 rounded-[2rem] py-6 pl-8 pr-32 text-white font-outfit text-lg focus:border-rose-500 focus:outline-none transition-all shadow-inner"
                 />
                 <div className="absolute right-3 top-1/2 -translate-y-1/2 flex space-x-2">
                    <button 
                      onClick={() => setIsVoiceOpen(true)}
                      className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 flex items-center justify-center transition-all"
                    >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </button>
                    <button 
                      onClick={(e) => handleCommand(e)}
                      disabled={!input.trim() || isProcessing}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${isProcessing ? 'bg-slate-800 cursor-wait' : 'bg-rose-600 text-white hover:bg-rose-500'}`}
                    >
                       {isProcessing ? (
                         <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                       ) : (
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                       )}
                    </button>
                 </div>
              </div>
           </div>
        </div>

        {/* RIGHT: ClawdHub Skills */}
        <div className="lg:col-span-3 flex flex-col">
           <div className="glass-card flex-1 p-6 rounded-[2.5rem] border-slate-800 bg-slate-900/20 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                 <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">ClawdHub Skills</h3>
                 <a href="https://clawdhub.com" target="_blank" rel="noreferrer" className="text-[9px] font-bold text-rose-400 hover:underline">Visit Store</a>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                 {skills.map(skill => (
                   <div 
                     key={skill.id} 
                     className={`p-4 rounded-2xl border transition-all ${skill.active ? 'bg-slate-800 border-rose-500/30' : 'bg-slate-950 border-slate-800 opacity-60'}`}
                   >
                      <div className="flex items-center justify-between mb-2">
                         <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${skill.active ? 'bg-rose-500 text-white' : 'bg-slate-900 text-slate-600'}`}>
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={skill.icon} /></svg>
                            </div>
                            <div>
                               <p className="text-xs font-bold text-white uppercase">{skill.name}</p>
                               <p className="text-[8px] text-slate-500 font-mono">v{skill.version}</p>
                            </div>
                         </div>
                         <button 
                           onClick={() => toggleSkill(skill.id)}
                           className={`w-8 h-4 rounded-full relative transition-colors ${skill.active ? 'bg-rose-500' : 'bg-slate-700'}`}
                         >
                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${skill.active ? 'translate-x-4' : 'translate-x-0'}`}></div>
                         </button>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-relaxed">{skill.description}</p>
                   </div>
                 ))}
                 
                 <div className="p-4 border-2 border-dashed border-slate-800 rounded-2xl text-center">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">More Skills Available</p>
                    <a href="https://clawdhub.com" target="_blank" rel="noreferrer" className="text-[9px] font-bold text-rose-500 hover:text-white transition-colors">Browse Marketplace &rarr;</a>
                 </div>
              </div>
           </div>
        </div>

      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default PersonalAssistant;
