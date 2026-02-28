
import React, { useState } from 'react';
import { agentOS } from '../services/agentos/AgentOS';
import { hermes } from '../services/agentos/HermesProtocol';
import { FileIngestionZone } from './FileIngestionZone';
import { useFileIngestion } from '../hooks/useFileIngestion';

interface HermesAgentProps {
  profile: { name: string, callsign: string, personality: string };
}

const HermesAgent: React.FC<HermesAgentProps> = ({ profile }) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const { 
    isDragging, 
    ingestedFiles, 
    handleDragOver, 
    handleDragLeave, 
    handleDrop, 
    removeFile, 
    clearFiles 
  } = useFileIngestion();

  const addLog = (msg: string, type: 'info' | 'tool' | 'success' = 'info') => {
    setLogs(prev => [...prev.slice(-15), `[${type.toUpperCase()}] ${msg}`]);
  };

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    addLog(`Initializing Hermes Protocol for intent: ${input.substring(0, 30)}...`, 'info');

    try {
      // 1. Run through AgentOS Kernel
      const response = await agentOS.runTask('Hermes', input);
      
      // 2. Check for Hermes-specific tool interrupts
      const interrupt = await hermes.processInterrupt(response || "", [
        { name: 'search_web', execute: async (args: any) => ({ results: [`Found data for ${args.query}`] }) },
        { name: 'read_file', execute: async (args: any) => ({ content: `Content of ${args.path}` }) }
      ]);

      if (interrupt) {
        addLog(`RIC: Tool Interrupt Handled.`, 'tool');
      }

      addLog(`Hermes Synthesis Complete.`, 'success');
      setInput('');
    } catch (err: any) {
      addLog(`Hermes Protocol Error: ${err.message}`, 'info');
    } finally {
      setIsProcessing(false);
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
      <div className="max-w-5xl mx-auto pb-40 animate-in fade-in duration-700">
        <header className="mb-12 border-b border-slate-800 pb-8 flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-outfit font-black text-white uppercase tracking-tighter italic">Hermes <span className="text-orange-500">Agent</span></h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mt-2">High-Fidelity Tool Orchestration &bull; RIC Protocol</p>
          </div>
          <div className="px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-400 text-[10px] font-black uppercase tracking-widest">
            Stable: Deep
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-8 rounded-[2.5rem] border-slate-800 bg-slate-950/50">
              <form onSubmit={handleExecute} className="space-y-6">
                <textarea 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter complex multi-tool intent..."
                  className="w-full h-40 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white font-mono text-sm focus:border-orange-500 outline-none transition-all"
                />
                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-orange-500/20 transition-all flex items-center justify-center space-x-3"
                >
                  {isProcessing ? (
                    <span className="animate-pulse">Executing Hermes Protocol...</span>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      <span>Initialize Execution</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="glass-card p-8 rounded-[2.5rem] border-slate-800 bg-slate-900/20">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Hermes Protocol Specs</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                  <div className="text-[8px] text-slate-500 uppercase mb-1">Tool Schema</div>
                  <div className="text-[10px] text-orange-400 font-mono">XML_TAGGED_JSON</div>
                </div>
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                  <div className="text-[8px] text-slate-500 uppercase mb-1">Interrupt Mode</div>
                  <div className="text-[10px] text-orange-400 font-mono">RIC_SYNC</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="glass-card flex-1 p-8 rounded-[2.5rem] border-slate-800 bg-black flex flex-col overflow-hidden">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Execution Log</h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[9px] space-y-3">
                {logs.map((log, i) => (
                  <div key={i} className={`pl-3 border-l-2 py-1 ${
                    log.includes('TOOL') ? 'border-orange-500 text-orange-300' :
                    log.includes('SUCCESS') ? 'border-emerald-500 text-emerald-300' :
                    'border-slate-700 text-slate-400'
                  }`}>
                    {log}
                  </div>
                ))}
                {logs.length === 0 && <div className="text-slate-700 italic">Awaiting protocol initialization...</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </FileIngestionZone>
  );
};

export default HermesAgent;
