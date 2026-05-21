
import React, { useState, useEffect, useRef } from 'react';
import { ZeroLogEntry, AgentZeroSession } from '../types';
import { safeGenerateContent } from '../services/geminiService';
import { ActionHub } from './ActionHub';
import { Folder, FolderOpen, FileCode, Terminal, Cpu, HardDrive, Settings, Activity, X, PlusCircle, CheckCircle, Flame, Server, Play, Square } from 'lucide-react';

interface AgentZeroProps {
  profile: { name: string, callsign: string, personality: string };
  onOpenChat: (agentName: string) => void;
}

interface SourceNode {
  id: string;
  title: string;
  content: string;
  type: 'document' | 'link' | 'text' | 'image';
}

const AgentZero: React.FC<AgentZeroProps> = ({ profile, onOpenChat }) => {
  const [input, setInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [availableSources, setAvailableSources] = useState<SourceNode[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [sfWeather, setSfWeather] = useState<string>('Querying SF atmospheric data...');
  const [delegateAgent, setDelegateAgent] = useState<'Zero' | 'Hermes' | 'DeepAgent' | 'IronClaw' | 'ClaudeCode'>('Zero');
  const [claudeProvider, setClaudeProvider] = useState<'DeepSeek' | 'NVIDIA' | 'Ollama' | 'OpenRouter' | 'Kimi' | 'Wafer'>('DeepSeek');
  const [claudeModel, setClaudeModel] = useState<string>('deepseek-dark-reasoner');
  const [proxyRunning, setProxyRunning] = useState<boolean>(true);
  
  const [activeLeftTab, setActiveLeftTab] = useState<'systems' | 'workspace'>('systems');
  const [expandedFolders, setExpandedFolders] = useState<string[]>(['core', 'daemons']);
  const [selectedFileContents, setSelectedFileContents] = useState<{ path: string; name: string; text: string; size: string } | null>(null);
  const [createFileName, setCreateFileName] = useState('');
  const [createFileContent, setCreateFileContent] = useState('');
  const [isCreatingFile, setIsCreatingFile] = useState(false);

  // Initial workspace file tree representation based on the session's workspace path
  const [workspaceFiles, setWorkspaceFiles] = useState([
    { path: 'core/kernel.bin', name: 'kernel.bin', size: '240 KB', type: 'system', folder: 'core', text: '[SYSTEM BINARY MODULE]\n\nNeural weights: ACTIVE\nHardware translation: ENABLED\nSyscall registers: 64-bit sandbox\nIntegrity hash: SHA256_e4e3c984fdac\nInstruction rate: 2.1 GHz\nSignal mapping: direct OS level ioctls\nNeural-Link status: LOCKED' },
    { path: 'core/neural_linking.ts', name: 'neural_linking.ts', size: '14.2 KB', type: 'code', folder: 'core', text: 'import { GoogleGenAI } from "@google/genai";\n\nexport async function linkAgent() {\n  const key = process.env.GEMINI_API_KEY;\n  console.log("Kernel linking dynamic neural layers...");\n  if (!key) {\n    throw new Error("[ROOT EXCEPTION] GEMINI_API_KEY is not defined in current vault!");\n  }\n  // Bridge established successfully\n  return new GoogleGenAI({ apiKey: key });\n}' },
    { path: 'daemons/claude_proxy.ts', name: 'claude_proxy.ts', size: '4.2 KB', type: 'code', folder: 'daemons', text: 'import express from "express";\nconst router = express.Router();\n\n// Bridge provider for Alishahryar1/free-claude-code\nrouter.post("/v1/chat/completions", (req, res) => {\n  console.log("Routing via Free-Claude-Code Proxy...");\n  // Translates Claude messages into open model format\n  const model = req.body.model || "deepseek-dark-reasoner";\n  res.json({ model, status: "forwarded" });\n});' },
    { path: 'daemons/climatology_sensor.sh', name: 'climatology_sensor.sh', size: '1.8 KB', type: 'script', folder: 'daemons', text: '#!/bin/bash\n# Periodically fetches SF weather statistics using grounding\ncurl -s "https://wttr.in/SanFrancisco?format=3"\necho "[SENSOR] SF weather metrics logged to system telemetry database..."' },
    { path: 'configs/provider_map.json', name: 'provider_map.json', size: '340 B', type: 'config', folder: 'configs', text: '{\n  "default": "DeepSeek",\n  "fallback": "NVIDIA",\n  "models": ["deepseek-dark-reasoner", "llama-3.3-70b"],\n  "proxyPort": 8080\n}' },
    { path: 'notebook_storage.json', name: 'notebook_storage.json', size: '3.6 KB', type: 'database', folder: '', text: '{\n  "records": [\n    { "id": 1, "title": "System Arch Note", "body": "Bridge agentic loops to host shell directly via Agent Zero root container." }\n  ]\n}' },
    { path: 'env.vault', name: 'env.vault', size: '128 B', type: 'vault', folder: '', text: 'VAULT_SECRET_EVE=ENCRYPTED_SHA256_943c2c1a8bf929ea\nAPI_KEY_ROTATION=ENABLED\nKEEPALIVE_INTERVAL=30' }
  ]);

  const [activeProcesses, setActiveProcesses] = useState([
    { pid: 1022, name: 'claude-code-proxy', cpu: 0.1, mem: '45 MB', status: 'RUNNING' },
    { pid: 1054, name: 'gemini-neural-linker', cpu: 0.0, mem: '120 MB', status: 'IDLE' },
    { pid: 2201, name: 'weather-telemetry', cpu: 0.0, mem: '12 MB', status: 'SLEEP' },
    { pid: 4192, name: 'root-shell-session', cpu: 0.2, mem: '8 MB', status: 'ONLINE' }
  ]);

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

  const fetchSFWeather = async () => {
    try {
      addLog('info', 'Searching current weather in San Francisco via satellite telemetry...');
      const response = await safeGenerateContent(
        'gemini-3-flash-preview',
        'Find the current weather in San Francisco. Return only a short high-density status, like "58°F, Foggy, Wind 12mph". Do not output any conversational filler.',
        {
          systemInstruction: "You are a weather metric fetcher. Return only the temperature, conditions, and wind in San Francisco using Google search grounding.",
          tools: [{ googleSearch: {} }]
        }
      );
      const resultText = response.text?.trim() || 'Unavailable';
      setSfWeather(resultText);
      addLog('info', `SF ATMOSPHERIC CORRELATION SEARCH DETERMINED: ${resultText}`);
    } catch (error: any) {
      console.error('Error fetching SF weather via googleSearch:', error);
      setSfWeather('Unavailable');
      addLog('error', 'Diagnostics failed: SF climatology search timed out.');
    }
  };

  useEffect(() => {
    const checkSystems = async () => {
      setSession(prev => ({ ...prev, dockerStatus: 'connected' }));
    };
    checkSystems();
    
    const storedSources = localStorage.getItem('quanta_notebook');
    if (storedSources) setAvailableSources(JSON.parse(storedSources));

    const storedContext = localStorage.getItem('agent_zero_context');
    if (storedContext) setSelectedSourceIds(JSON.parse(storedContext));
    
    addLog('info', 'ROOT AGENCY CORE INITIALIZED.');
    addLog('info', 'Binding to display :0 (1920x1080)...');
    addLog('info', 'HID Input streams active (Mouse/Keyboard).');
    addLog('info', `FileSystem Mount: ${session.workspace}`);

    fetchSFWeather();
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

  // Tick processes to simulate active resources
  useEffect(() => {
    const procInterval = setInterval(() => {
      setActiveProcesses(prev =>
        prev.map(p => {
          if (p.name === 'gemini-neural-linker') {
            return {
              ...p,
              status: isExecuting ? 'COMPUTING' : 'IDLE',
              cpu: isExecuting ? parseFloat((Math.random() * 25 + 15).toFixed(1)) : 0.0,
              mem: isExecuting ? '192 MB' : '120 MB'
            };
          }
          if (p.name === 'claude-code-proxy') {
            return {
              ...p,
              status: proxyRunning ? 'RUNNING' : 'STANDBY',
              cpu: proxyRunning ? parseFloat((Math.random() * 2.2 + 0.4).toFixed(1)) : 0.0,
              mem: proxyRunning ? '45 MB' : '4 MB'
            };
          }
          if (p.name === 'weather-telemetry') {
            const isSpiking = Math.random() > 0.8;
            return {
              ...p,
              status: isSpiking ? 'ACTIVE' : 'SLEEP',
              cpu: isSpiking ? parseFloat((Math.random() * 1.5 + 0.2).toFixed(1)) : 0.0,
              mem: '12 MB'
            };
          }
          if (p.name === 'root-shell-session') {
            return {
              ...p,
              cpu: parseFloat((Math.random() * 0.8 + 0.1).toFixed(1))
            };
          }
          return p;
        })
      );
    }, 1500);
    return () => clearInterval(procInterval);
  }, [isExecuting, proxyRunning]);

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
      addLog('info', 'Acquiring visual target...');
      addLog('info', `Routing task thread to delegate core: [${delegateAgent.toUpperCase()}]`);
      addLog('info', 'Generating Action Chain...');
      
      const contextSources = availableSources.filter(s => selectedSourceIds.includes(s.id));
      const contextContent = contextSources.map(s => `[SOURCE: ${s.title}]: ${s.content}`).join('\n\n');
      
      const agentContexts = {
        Zero: "Direct Execution Mode: Act as the absolute central kernel agent with direct OS level agency.",
        Hermes: "Delegated to HERMES (Agile Speed specialist): Act as a highly optimized, fast reasoning neural micro-kernel. Respond with hyper-precise, extremely fast execution telemetry, and agile action blocks.",
        DeepAgent: "Delegated to DEEPAGENT (Deep Analysis specialist): Perform exhaustive context tracking, deep system-state investigation, and write multi-step, layered action plans with deep diagnostic logging.",
        IronClaw: "Delegated to IRONCLAW (System Security & Hardening specialist): Execute rigorous syntax and logic checks, strictly validate input parameters, run sanitization and sandbox protocols, and print hardened diagnostics.",
        ClaudeCode: `Delegated to CLAUDECODE [Free Claude Code Proxy active at http://localhost:8080/v1 under proxy provider: ${claudeProvider} | Model: ${claudeModel}]: Execute agentic development actions using the free-claude-code CLI tool. Simulate terminal shell interaction, deep multi-file patch generation, automated git commit integrations, search indexes, and self-correcting test validations conforming to the official claude-code developer tool standard, all bridged over the Alishahryar1/free-claude-code pipeline.`
      };
      
      const response = await safeGenerateContent(
        'gemini-3-flash-preview',
        `You are Agent Zero (Root Level Computer Agency) delegating work to ${delegateAgent}. 
        DELEGATE INSTRUCTION SET: ${agentContexts[delegateAgent]}
        Execute logic for: "${cmd}". 
        CONTEXT: Full Desktop Access. 
        WORKSPACE: ${session.workspace}.
        
        ${contextContent ? `ADDITIONAL CONTEXT:\n${contextContent}` : ''}
        
        Simulate a low-level action log containing keyboard operations, clicks, terminal outputs, and system tasks matching the personality and specialty of ${delegateAgent}.`,
        {
          systemInstruction: `You are the Root Computer Agent. You control the OS directly. Currently delegating task execution to ${delegateAgent}. Output logs that look like automated computer actions (e.g., [MOUSE_MOVE], [CLICK], [TYPE]) conforming to the delegates style.`,
          tools: [{ googleSearch: {} }, { duckDuckGoSearch: {} }]
        }
      );

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
      console.error("Agent Zero Error:", error);
      let content = `Kernel Exception: ${error.message}`;
      if (error.message?.includes('QUOTA_EXCEEDED')) {
        content = "Neural Energy Depleted: You've exceeded your Gemini API quota. Please check your billing details or wait a moment before trying again.";
      }
      addLog('error', content);
    } finally {
      setIsExecuting(false);
      setSession(prev => ({ ...prev, status: 'idle' }));
    }
  };

  const toggleSource = (id: string) => {
    const newIds = selectedSourceIds.includes(id) 
      ? selectedSourceIds.filter(i => i !== id)
      : [...selectedSourceIds, id];
    setSelectedSourceIds(newIds);
    localStorage.setItem('agent_zero_context', JSON.stringify(newIds));
  };

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col lg:flex-row gap-8 animate-in fade-in duration-700 overflow-hidden">
      {isContextModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1117] border border-slate-800 rounded-3xl p-8 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">Select Context Sources</h2>
            <div className="space-y-4">
              {availableSources.map(source => (
                <div key={source.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                  <span className="text-slate-300 font-mono text-sm">{source.title}</span>
                  <button 
                    onClick={() => toggleSource(source.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${selectedSourceIds.includes(source.id) ? 'bg-emerald-500 text-black' : 'bg-slate-700 text-slate-300'}`}
                  >
                    {selectedSourceIds.includes(source.id) ? 'Selected' : 'Select'}
                  </button>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setIsContextModalOpen(false)}
              className="mt-8 w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* LEFT: DESKTOP VISION & STATUS */}
      <div className="w-full lg:w-96 flex flex-col space-y-4 shrink-0 overflow-y-auto custom-scrollbar" style={{ maxHeight: '100%' }}>
         
         {/* Monospace Tab Manager */}
         <div className="bg-[#0b0f19] border border-slate-850 p-1.5 rounded-[1.2rem] flex gap-1.5">
            <button
              onClick={() => setActiveLeftTab('systems')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[0.8rem] text-[9.5px] font-black uppercase tracking-wider transition-all duration-250 cursor-pointer ${
                activeLeftTab === 'systems'
                  ? 'bg-slate-800 text-white border border-slate-700/60 shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
              }`}
            >
               <Cpu className="w-3.5 h-3.5 text-orange-400" />
               Host Config
            </button>
            <button
              onClick={() => setActiveLeftTab('workspace')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[0.8rem] text-[9.5px] font-black uppercase tracking-wider transition-all duration-250 cursor-pointer ${
                activeLeftTab === 'workspace'
                  ? 'bg-slate-800 text-white border border-slate-700/60 shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
              }`}
            >
               <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
               Workspace Tree
            </button>
         </div>

         {activeLeftTab === 'systems' ? (
            <div className="flex flex-col space-y-6 flex-1">
               {/* Mock Desktop Vision */}
               <div className="glass-card p-1 rounded-[3rem] border-emerald-500/30 shadow-2xl bg-black overflow-hidden relative group h-64 shrink-0">
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
                     <button 
                       onClick={() => onOpenChat('Agent Zero')}
                       className="p-2 text-slate-600 hover:text-indigo-400 transition-colors"
                       title="Pop-out Neural Terminal"
                     >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 002 2v12a2 2 0 002 2z" /></svg>
                     </button>
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
                      <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col gap-2">
                         <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold text-slate-500 uppercase">SF Climatology</span>
                            <span className="text-[10px] font-mono text-orange-400 font-bold text-right">{sfWeather}</span>
                         </div>
                         <div className="flex justify-end">
                            <button
                               type="button"
                               onClick={fetchSFWeather}
                               className="text-[8px] text-slate-500 hover:text-orange-400 font-black uppercase tracking-widest cursor-pointer transition-colors focus:outline-none"
                            >
                               [Re-Query Weather]
                            </button>
                         </div>
                      </div>
                       {delegateAgent === 'ClaudeCode' && (
                         <div className="p-4 bg-slate-900/80 border border-indigo-500/30 rounded-2xl flex flex-col gap-3 animate-in slide-in-from-bottom duration-300">
                            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                               <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">🤖 Free Claude Code CLI</span>
                               <a 
                                 href="https://github.com/Alishahryar1/free-claude-code" 
                                 target="_blank" 
                                 rel="noreferrer"
                                 className="text-[8px] font-mono text-slate-500 hover:text-indigo-400 uppercase transition-colors"
                               >
                                  [SOURCE REPO]
                               </a>
                            </div>
                            <div className="flex flex-col gap-2">
                               <div className="flex justify-between items-center">
                                  <span className="text-[8px] text-slate-500 uppercase font-bold">API Provider</span>
                                  <select 
                                    value={claudeProvider} 
                                    onChange={(e) => {
                                      const provider = e.target.value as any;
                                      setClaudeProvider(provider);
                                      if (provider === 'DeepSeek') setClaudeModel('deepseek-dark-reasoner');
                                      else if (provider === 'NVIDIA') setClaudeModel('nvidia/llama3-70b');
                                      else if (provider === 'Ollama') setClaudeModel('llama-3.1-8b-instruct');
                                      else if (provider === 'OpenRouter') setClaudeModel('meta-llama/llama-3.3-70b-instruct');
                                      else if (provider === 'Kimi') setClaudeModel('kimi-api-v1');
                                      else if (provider === 'Wafer') setClaudeModel('wafer-3-sonnet');
                                      addLog('info', `[FREE-CLAUDE-CODE] Target provider updated to: ${provider}`);
                                    }}
                                    className="bg-slate-950 border border-slate-800 text-[9px] text-indigo-400 font-mono font-bold rounded px-1.5 py-0.5 focus:outline-none focus:border-slate-800"
                                  >
                                     <option value="DeepSeek">DeepSeek</option>
                                     <option value="NVIDIA">NVIDIA NIM</option>
                                     <option value="Ollama">Ollama (Local)</option>
                                     <option value="OpenRouter">OpenRouter</option>
                                     <option value="Kimi">Kimi Platform</option>
                                     <option value="Wafer">Wafer.ai</option>
                                  </select>
                               </div>
                               <div className="flex justify-between items-center">
                                  <span className="text-[8px] text-slate-500 uppercase font-bold">Proxy Target Model</span>
                                  <input 
                                    value={claudeModel}
                                    onChange={(e) => setClaudeModel(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 text-[9px] text-white font-mono rounded px-1.5 py-0.5 w-32 focus:outline-none text-right"
                                  />
                               </div>
                               <div className="flex justify-between items-center text-[8px]">
                                  <span className="text-slate-500 uppercase font-bold">Proxy Daemon Status</span>
                                  <span className={`font-mono font-black uppercase ${proxyRunning ? 'text-emerald-400' : 'text-rose-500'}`}>
                                     {proxyRunning ? '● RUNNING' : '○ STANDBY'}
                                  </span>
                               </div>
                            </div>
                            <div className="flex justify-between items-center gap-2 border-t border-slate-800 pt-2">
                               <button
                                  type="button"
                                  onClick={() => {
                                    setProxyRunning(!proxyRunning);
                                    addLog('info', proxyRunning ? '[FREE-CLAUDE-CODE] Stopped proxy redirect daemon.' : '[FREE-CLAUDE-CODE] Online checkout completed. Proxy redirect daemon active on port 8080.');
                                  }}
                                  className="text-[8px] bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 px-2 py-1 rounded cursor-pointer uppercase transition-colors"
                               >
                                  {proxyRunning ? 'Stop Proxy' : 'Start Proxy'}
                               </button>
                               <button
                                  type="button"
                                  onClick={async () => {
                                    addLog('info', '[FREE-CLAUDE-CODE] Fetching latest proxy configs from Alishahryar1/free-claude-code via git...');
                                    await new Promise(r => setTimeout(r, 600));
                                    addLog('info', '[FREE-CLAUDE-CODE] Initializing npm installation for global components...');
                                    await new Promise(r => setTimeout(r, 600));
                                    addLog('info', `[FREE-CLAUDE-CODE] Generating local configuration proxy map directing Claude-Code CLI to ${claudeProvider}...`);
                                    await new Promise(r => setTimeout(r, 600));
                                    addLog('info', `[FREE-CLAUDE-CODE] Proxy server initialized successfully on port 8080!`);
                                    setProxyRunning(true);
                                  }}
                                  className="text-[8px] bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 px-2.5 py-1 rounded cursor-pointer font-bold uppercase tracking-wider transition-colors"
                               >
                                  Initialize Daemon
                               </button>
                            </div>
                         </div>
                       )}
                  </div>
                  
                  <div className="mt-auto pt-6">
                     <p className="text-[8px] text-slate-600 uppercase tracking-widest text-center">Full Computer Agency Enabled</p>
                  </div>
               </div>
            </div>
         ) : (
            <div className="glass-card p-6 rounded-[2.5rem] border-slate-800 shadow-2xl flex flex-col bg-[#020617]/50 flex-1 min-h-[460px]">
               <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                  <div className="flex flex-col">
                     <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">Workspace Inode Mount</span>
                     <span className="text-[10px] font-mono text-indigo-400 font-bold truncate max-w-[180px]">{session.workspace}</span>
                  </div>
                  <button
                     onClick={() => {
                       setSelectedFileContents(null);
                       setIsCreatingFile(false);
                     }}
                     className="text-[8px] text-slate-500 hover:text-white uppercase font-bold tracking-widest cursor-pointer"
                  >
                     [Clear]
                  </button>
               </div>

               {selectedFileContents ? (
                  <div className="flex-1 flex flex-col gap-3 animate-in fade-in duration-300">
                     <div className="flex justify-between items-center bg-slate-900/50 p-2.5 border border-slate-800 rounded-xl">
                        <div className="flex flex-col">
                           <span className="text-[9.5px] font-mono text-emerald-400 font-bold">{selectedFileContents.name}</span>
                           <span className="text-[7.5px] font-mono text-slate-500">{selectedFileContents.size} | sector allocation</span>
                        </div>
                        <button
                          onClick={() => setSelectedFileContents(null)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                     </div>
                     
                     <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-900/80 flex-1 font-mono text-[9px] text-slate-300 overflow-y-auto max-h-[190px] whitespace-pre-wrap leading-relaxed custom-scrollbar">
                        {selectedFileContents.text}
                     </div>

                     <div className="flex justify-end gap-2 mt-auto">
                        <button
                          onClick={() => {
                            addLog('info', `[DISK] Static logic scan performed for node ${selectedFileContents.name} -> Syntax VALID.`);
                          }}
                          className="text-[8px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-2 py-1.5 rounded cursor-pointer uppercase font-bold"
                        >
                          Scan Block
                        </button>
                        <button
                          onClick={() => setSelectedFileContents(null)}
                          className="text-[8px] bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 px-2.5 py-1.5 rounded cursor-pointer font-bold uppercase transition-colors"
                        >
                          Close Node
                        </button>
                     </div>
                  </div>
               ) : isCreatingFile ? (
                  <div className="flex-1 flex flex-col gap-3 animate-in fade-in duration-300">
                     <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Allocate New Node</span>
                     <input 
                       type="text"
                       placeholder="filename.ts / path..."
                       value={createFileName}
                       onChange={(e) => setCreateFileName(e.target.value)}
                       className="bg-slate-950 border border-slate-805 text-[10px] text-white font-mono rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:border-indigo-500"
                     />
                     <textarea
                       placeholder="Write initial node contents..."
                       rows={4}
                       value={createFileContent}
                       onChange={(e) => setCreateFileContent(e.target.value)}
                       className="bg-slate-950 border border-slate-805 text-[10.5px] text-slate-300 font-mono rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:border-indigo-500 resize-none"
                     />
                     <div className="flex justify-end gap-2 mt-auto">
                        <button
                          onClick={() => setIsCreatingFile(false)}
                          className="text-[8px] border border-slate-800 text-slate-400 px-2 py-1 rounded cursor-pointer uppercase hover:bg-slate-900"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (!createFileName.trim()) return;
                            const extension = createFileName.split('.').pop() || 'file';
                            const newFile = {
                              path: createFileName.includes('/') ? createFileName : `configs/${createFileName}`,
                              name: createFileName.split('/').pop() || createFileName,
                              size: '1.2 KB',
                              type: extension === 'ts' || extension === 'js' ? 'code' : 'text',
                              folder: createFileName.includes('/') ? createFileName.split('/')[0] : 'configs',
                              text: createFileContent || '// Custom Allocated Node'
                            };
                            setWorkspaceFiles(prev => [...prev, newFile]);
                            addLog('info', `[DISK] Block write completed. Inode /quanta/root-level-agency/${newFile.path} allocated.`);
                            setIsCreatingFile(false);
                            setCreateFileName('');
                            setCreateFileContent('');
                          }}
                          className="text-[8px] bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 px-2.5 py-1 rounded cursor-pointer font-bold uppercase hover:text-emerald-800"
                        >
                          Commit Inode
                        </button>
                     </div>
                  </div>
               ) : (
                  <div className="flex-1 flex flex-col gap-3">
                     <div className="flex justify-between items-center text-[8px] font-mono text-slate-400 uppercase tracking-wider">
                        <span>Workspace Inode Index</span>
                        <button
                          onClick={() => setIsCreatingFile(true)}
                          className="text-indigo-400 hover:text-indigo-300 font-bold uppercase flex items-center gap-1 cursor-pointer"
                        >
                          <PlusCircle className="w-3 h-3" />
                          Add File
                        </button>
                     </div>

                     <div className="space-y-2 max-h-[148px] overflow-y-auto custom-scrollbar pr-1 font-mono text-[9.5px] text-slate-300 select-none">
                        {/* Folders & Nested Files */}
                        {['core', 'daemons', 'configs'].map((folder) => {
                          const isExpanded = expandedFolders.includes(folder);
                          const nestedFiles = workspaceFiles.filter(f => f.folder === folder);
                          
                          return (
                            <div key={folder} className="space-y-0.5">
                               <div 
                                 onClick={() => {
                                   setExpandedFolders(prev => 
                                     prev.includes(folder) ? prev.filter(f => f !== folder) : [...prev, folder]
                                   );
                                 }}
                                 className="flex items-center gap-1.5 text-orange-400/80 hover:text-orange-300 cursor-pointer transition-colors"
                               >
                                  {isExpanded ? <FolderOpen className="w-3 h-3" /> : <Folder className="w-3 h-3" />}
                                  <span className="font-bold">{folder}/</span>
                                  <span className="text-[7.5px] text-slate-500">({nestedFiles.length})</span>
                               </div>
                               {isExpanded && (
                                 <div className="pl-3.5 border-l border-slate-900 space-y-0.5 mt-0.5 mb-1.5">
                                    {nestedFiles.map(file => (
                                      <div 
                                        key={file.path}
                                        onClick={() => setSelectedFileContents({ name: file.name, path: file.path, text: file.text, size: file.size })}
                                        className="flex items-center justify-between text-slate-400 hover:text-slate-200 cursor-pointer py-0.5 group transition-colors"
                                      >
                                         <div className="flex items-center gap-1.5">
                                            <FileCode className="w-3 h-3 text-indigo-505 group-hover:text-indigo-400" />
                                            <span>{file.name}</span>
                                         </div>
                                         <span className="text-[7px] text-slate-600 group-hover:text-slate-500 pr-1">{file.size}</span>
                                      </div>
                                    ))}
                                    {nestedFiles.length === 0 && (
                                      <span className="text-[7px] text-slate-700 italic pl-1">Empty directory</span>
                                    )}
                                 </div>
                               )}
                            </div>
                          );
                        })}

                        {/* Root Level Files */}
                        {workspaceFiles.filter(f => !f.folder).map(file => (
                          <div 
                            key={file.path}
                            onClick={() => setSelectedFileContents({ name: file.name, path: file.path, text: file.text, size: file.size })}
                            className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer py-0.5 group transition-colors"
                          >
                             <div className="flex items-center gap-1.5">
                                <FileCode className="w-3 h-3 text-emerald-505 group-hover:text-emerald-400" />
                                <span>{file.name}</span>
                             </div>
                             <span className="text-[7px] text-slate-600 pr-1">{file.size}</span>
                          </div>
                        ))}
                     </div>

                     {/* Process Inspector block */}
                     <div className="border-t border-white/5 pt-3.5 flex-1 flex flex-col min-h-[140px]">
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest font-black uppercase">Active Processes</span>
                           <span className="flex items-center gap-1 text-[7px] font-mono text-emerald-400 uppercase tracking-widest font-black">
                              <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping"></span>
                              Ticking
                           </span>
                        </div>

                        <div className="space-y-1 overflow-y-auto max-h-[110px] custom-scrollbar pr-1">
                           {activeProcesses.map(proc => (
                              <div key={proc.pid} className="p-1.5 bg-slate-950/70 border border-slate-900 rounded-lg flex items-center justify-between font-mono text-[8.5px]">
                                 <div className="flex flex-col">
                                    <div className="flex items-center gap-1 bg-slate-900/50 px-1 py-0.2 rounded w-max">
                                       <span className="text-slate-500 text-[7px]">PID {proc.pid}</span>
                                       <span className="text-white font-bold">{proc.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[7px] text-slate-500 mt-0.5">
                                       <span>CPU: <strong className="text-slate-300">{proc.cpu}%</strong></span>
                                       <span>MEM: <strong className="text-slate-300">{proc.mem}</strong></span>
                                    </div>
                                 </div>
                                 
                                 <div className="flex items-center gap-1">
                                    <span className={`text-[6.5px] font-bold px-1 py-0.2 rounded border uppercase font-black tracking-wider ${
                                      proc.status === 'RUNNING' || proc.status === 'ONLINE' || proc.status === 'ACTIVE'
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                        : proc.status === 'COMPUTING'
                                        ? 'bg-orange-500/15 border-orange-500/35 text-orange-400 animate-pulse'
                                        : 'bg-slate-800/10 border-slate-800/30 text-slate-400'
                                    }`}>
                                       {proc.status}
                                    </span>

                                    {proc.name === 'claude-code-proxy' ? (
                                      <button
                                        onClick={() => {
                                          setProxyRunning(!proxyRunning);
                                          addLog('info', proxyRunning 
                                            ? `[KERNEL] Dispatch signal SIGKILL to PID ${proc.pid}. Listener standby.`
                                            : `[KERNEL] Dispatch fork and child_process spawn for Free Claude Code. Port 8080 active.`
                                          );
                                        }}
                                        className="text-[7px] hover:text-white cursor-pointer px-1 py-0.2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 font-bold uppercase rounded transition-colors"
                                      >
                                         {proxyRunning ? 'Kill' : 'Spawn'}
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          addLog('info', `[KERNEL] Dispatched manual health ping to process PID ${proc.pid}... Signal SUCCESS.`);
                                        }}
                                        className="text-[7px] text-slate-500 hover:text-white cursor-pointer px-1 py-0.2 hover:bg-slate-900 border border-transparent font-bold uppercase rounded transition-colors"
                                      >
                                         Ping
                                      </button>
                                    )}
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               )}
            </div>
         )}
      </div>

      {/* RIGHT: TERMINAL FEED */}
      <div className="flex-1 flex flex-col space-y-6">
        <div className="glass-card flex-1 p-10 rounded-[3.5rem] border-slate-800 shadow-2xl relative overflow-hidden flex flex-col bg-[#010409] group">
           <div className="flex items-center space-x-4 mb-6 pb-4 border-b border-white/5">
              <div className="flex space-x-1.5">
                 <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-orange-500/50"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
              </div>
              <div className="flex-1 text-center hidden md:block">
                 <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">ROOT_AGENCY_TERMINAL :: {session.id}</span>
              </div>
              <div className="flex items-center gap-3">
                 <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Delegate:</span>
                 <select
                    value={delegateAgent}
                    onChange={(e) => {
                      const selected = e.target.value as any;
                      setDelegateAgent(selected);
                      addLog('info', `DELEGATION TARGET SWAPPED -> ACTOR CORE [${selected.toUpperCase()}] ACTIVE`);
                    }}
                    className="bg-[#0f172a] border border-slate-800 text-[10px] text-orange-400 font-mono font-bold uppercase tracking-wider rounded-lg px-2.5 py-1 focus:outline-none focus:border-orange-500/50 hover:border-slate-700 transition-colors cursor-pointer outline-none"
                 >
                    <option value="Zero">Zero (Root)</option>
                    <option value="Hermes">Hermes</option>
                    <option value="DeepAgent">DeepAgent</option>
                    <option value="IronClaw">IronClaw</option>
                    <option value="ClaudeCode">Free Claude Code</option>
                 </select>
              </div>
              <button 
                onClick={() => setIsContextModalOpen(true)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-widest"
              >
                Context ({selectedSourceIds.length})
              </button>
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

           {session.logs.length > 0 && (
             <div className="px-10 pb-4">
               <ActionHub content={session.logs.map(l => `[${new Date(l.timestamp).toISOString()}] ${l.agentName ? l.agentName + ': ' : ''}${l.content}`).join('\n')} agentName="Agent Zero" title="Terminal Log" />
             </div>
           )}

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
