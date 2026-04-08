

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ActionHub } from './ActionHub';
import { FPT_SYSTEM_PROMPT } from '../services/fptContent';

interface OperationLog {
  id: string;
  timestamp: number;
  phase: 'deconstruct' | 'axiom' | 'reconstruct' | 'tool' | 'ric' | 'result';
  message: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  data?: any;
}

interface CLIMessage {
  type: 'cli_command' | 'execution_result' | 'cli_status' | 'fpt_audit' | 'log';
  id?: string;
  payload?: any;
  timestamp: number;
}

interface DecisionAudit {
  decisionId: string;
  query: string;
  deconstruction: string[];
  axioms: string[];
  reconstruction: string;
  confidenceScore: number;
  actionItems: string[];
  traceId: string;
  latency: number;
}

const HermesOperations: React.FC = () => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [cliOutput, setCliOutput] = useState<string>('');
  const [currentPhase, setCurrentPhase] = useState<string>('idle');
  const [auditResult, setAuditResult] = useState<DecisionAudit | null>(null);
  const [executionSteps, setExecutionSteps] = useState<OperationLog[]>([]);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const addLog = useCallback((phase: OperationLog['phase'], message: string, status: OperationLog['status'] = 'running', data?: any) => {
    const log: OperationLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      phase,
      message,
      status,
      data
    };
    setLogs(prev => [...prev.slice(-50), log]);
    setExecutionSteps(prev => [...prev, log]);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    connectWebSocket();
    return () => ws?.close();
  }, []);

  const connectWebSocket = () => {
    setConnectionStatus('connecting');
    const socket = new WebSocket('ws://localhost:3001');
    
    socket.onopen = () => {
      setConnectionStatus('connected');
      addLog('ric', 'HermesBridge connected', 'complete');
    };

    socket.onmessage = (event) => {
      try {
        const message: CLIMessage = JSON.parse(event.data);
        handleCLIMessage(message);
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    socket.onclose = () => {
      setConnectionStatus('disconnected');
      addLog('ric', 'HermesBridge disconnected', 'error');
    };

    socket.onerror = () => {
      setConnectionStatus('error');
    };

    setWs(socket);
  };

  const handleCLIMessage = (message: CLIMessage) => {
    switch (message.type) {
      case 'cli_command':
        addLog('tool', `CLI Command: ${message.payload}`, 'complete');
        setCliOutput(prev => prev + `\n> ${message.payload}`);
        break;
      case 'execution_result':
        addLog('result', 'Execution complete', 'complete', message.payload);
        if (message.payload?.fptAudit) {
          setAuditResult(message.payload.fptAudit);
        }
        break;
      case 'cli_status':
        addLog('ric', `CLI Status: ${JSON.stringify(message.payload)}`, 'complete');
        break;
      case 'fpt_audit':
        addLog('axiom', 'FPT Audit received', 'complete', message.payload);
        break;
      case 'log':
        addLog('tool', message.payload, 'complete');
        break;
    }
  };

  const executeFPTQuery = async () => {
    if (!input.trim() || isProcessing) return;
    
    setIsProcessing(true);
    setLogs([]);
    setAuditResult(null);
    setExecutionSteps([]);
    setCliOutput('');

    try {
      setCurrentPhase('deconstruct');
      addLog('deconstruct', 'Initializing FPT-Omega engine...', 'running');
      await simulateDelay(400);
      addLog('deconstruct', 'Stripping analogical reasoning...', 'complete');
      addLog('deconstruct', 'Identifying embedded assumptions...', 'complete');

      setCurrentPhase('axiom');
      addLog('axiom', 'Isolating non-negotiable axioms...', 'running');
      await simulateDelay(600);
      addLog('axiom', 'Physics constraints verified', 'complete');
      addLog('axiom', 'Logic constraints verified', 'complete');
      addLog('axiom', 'Verified axioms: 3/3', 'complete');

      setCurrentPhase('reconstruct');
      addLog('reconstruct', 'Building decision from ground truth...', 'running');
      await simulateDelay(500);
      addLog('reconstruct', 'Cross-referencing FPT engine...', 'complete');

      setCurrentPhase('ric');
      addLog('ric', 'Checking for tool interrupts (RIC)...', 'running');
      await simulateDelay(300);
      addLog('ric', 'RIC: No interrupts required', 'complete');

      setCurrentPhase('result');
      addLog('result', 'FPT deliberation complete', 'complete');
      
      const mockAudit: DecisionAudit = {
        decisionId: Math.random().toString(36).substr(2, 9),
        query: input,
        deconstruction: [
          'Common assumption: "This is how industry does it" removed',
          'Legacy pattern: "Follow the leader" strategy stripped',
          'Cultural bias: "Growth at all costs" flagged as noise'
        ],
        axioms: [
          'A1: Resources are finite (physics constraint)',
          'A2: Cause precedes effect (temporal logic)',
          'A3: Value creation requires net positive output (economic truth)'
        ],
        reconstruction: `Based on verified axioms (A1, A2, A3), the optimal path is to ${input.substring(0, 50)}... reconstructed through first principles analysis.`,
        confidenceScore: 87,
        actionItems: [
          'Immediate: Validate primary assumption with data',
          'Short-term: Test axiom A3 against current metrics',
          'Long-term: Re-evaluate as constraints evolve'
        ],
        traceId: `TRACE-${Date.now()}`,
        latency: 1847
      };
      
      setAuditResult(mockAudit);

      ws?.send(JSON.stringify({
        type: 'execute',
        id: mockAudit.decisionId,
        payload: { command: input, fptContext: mockAudit },
        timestamp: Date.now()
      }));

    } catch (e: any) {
      addLog('result', `Error: ${e.message}`, 'error');
    } finally {
      setIsProcessing(false);
      setCurrentPhase('idle');
    }
  };

  const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'deconstruct': return 'text-rose-400';
      case 'axiom': return 'text-amber-400';
      case 'reconstruct': return 'text-emerald-400';
      case 'tool': return 'text-blue-400';
      case 'ric': return 'text-purple-400';
      case 'result': return 'text-cyan-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-emerald-500';
      case 'running': return 'bg-amber-500 animate-pulse';
      case 'error': return 'bg-rose-500';
      default: return 'bg-slate-600';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      executeFPTQuery();
    }
  };

  return (
    <div className="animate-in fade-in duration-1000 max-w-7xl mx-auto space-y-8 pb-40">
      <header className="text-center mb-12">
        <div className="inline-flex items-center space-x-3 px-6 py-2 rounded-full border border-orange-500/30 bg-orange-900/20 text-orange-400 text-[10px] font-black uppercase tracking-[0.4em] mb-6">
          <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-slate-500'}`}></span>
          <span>HermesBridge {connectionStatus}</span>
        </div>
        <h1 className="text-6xl md:text-7xl font-outfit font-black text-white uppercase tracking-tighter italic">
          Hermes <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-500 to-orange-500">Operations</span>
        </h1>
        <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mt-4">
          FPT-Omega Ground Truth Engine &bull; RIC Protocol
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-card p-8 rounded-[2rem] border-orange-500/20 bg-[#0a0a0a] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-400 opacity-60"></div>
            
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h3 className="text-white text-[11px] font-black uppercase tracking-[0.3em]">Decision Query</h3>
                <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${currentPhase !== 'idle' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500'}`}>
                  {currentPhase.toUpperCase()}
                </div>
              </div>
              <div className="text-[9px] font-mono text-slate-600">
                ⌘ + Enter to execute
              </div>
            </div>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter decision query for FPT-Omega analysis..."
              className="w-full h-48 bg-slate-900/50 border border-slate-800 rounded-2xl p-5 text-slate-200 font-mono text-sm focus:border-orange-500 transition-all resize-none outline-none"
            />

            <button
              onClick={executeFPTQuery}
              disabled={isProcessing || !input.trim()}
              className="w-full mt-4 py-5 bg-gradient-to-r from-orange-700 to-amber-700 hover:from-orange-600 hover:to-amber-600 disabled:from-slate-800 disabled:to-slate-800 text-white rounded-xl font-black uppercase tracking-[0.3em] text-[11px] shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processing FPT...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span>Execute FPT-Omega</span>
                </>
              )}
            </button>
          </div>

          {auditResult && (
            <div className="glass-card p-8 rounded-[2rem] border-emerald-500/30 bg-emerald-950/20 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em]">FPT Audit Trail</h3>
                <div className="flex items-center space-x-4">
                  <span className="text-[9px] text-slate-500 font-mono">ID: {auditResult.traceId}</span>
                  <span className="text-[9px] text-emerald-500 font-mono">{auditResult.latency}ms</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/20">
                  <div className="text-[8px] font-black uppercase text-rose-400 tracking-widest mb-3">Deconstruction</div>
                  <ul className="space-y-2">
                    {auditResult.deconstruction.map((d, i) => (
                      <li key={i} className="text-[10px] text-slate-400 font-mono flex items-start">
                        <span className="text-rose-500 mr-2">→</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/20">
                  <div className="text-[8px] font-black uppercase text-amber-400 tracking-widest mb-3">Axioms</div>
                  <ul className="space-y-2">
                    {auditResult.axioms.map((a, i) => (
                      <li key={i} className="text-[10px] text-slate-400 font-mono flex items-start">
                        <span className="text-amber-500 mr-2">◆</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
                  <div className="text-[8px] font-black uppercase text-emerald-400 tracking-widest mb-3">Confidence</div>
                  <div className="text-4xl font-black text-emerald-400">{auditResult.confidenceScore}%</div>
                  <div className="w-full h-1 bg-slate-800 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ width: `${auditResult.confidenceScore}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
                <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3">Reconstruction</div>
                <p className="text-sm text-slate-300 font-mono leading-relaxed">{auditResult.reconstruction}</p>
              </div>

              <div className="p-5 rounded-xl bg-orange-950/20 border border-orange-500/20">
                <div className="text-[8px] font-black text-orange-400 uppercase tracking-widest mb-3">Action Items</div>
                <ol className="space-y-2">
                  {auditResult.actionItems.map((item, i) => (
                    <li key={i} className="text-[11px] text-slate-300 font-mono flex items-start">
                      <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[9px] font-black flex items-center justify-center mr-3 shrink-0">{i + 1}</span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>

              <ActionHub 
                content={JSON.stringify(auditResult, null, 2)} 
                agentName="Hermes Operations" 
                title={`FPT Audit ${auditResult.decisionId}`} 
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card h-[500px] rounded-[2rem] border-slate-800 bg-black/80 p-6 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <svg className="w-24 h-24 text-orange-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/></svg>
            </div>
            
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 z-10">Execution Pipeline</h3>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 z-10 pr-2">
              {executionSteps.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-700">
                  <svg className="w-12 h-12 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Query</p>
                </div>
              ) : (
                executionSteps.map((step) => (
                  <div key={step.id} className={`p-3 rounded-lg border transition-all ${
                    step.status === 'complete' ? 'bg-emerald-950/20 border-emerald-500/20' :
                    step.status === 'running' ? 'bg-amber-950/20 border-amber-500/30 animate-pulse' :
                    step.status === 'error' ? 'bg-rose-950/20 border-rose-500/30' :
                    'bg-slate-900/50 border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[8px] font-black uppercase tracking-widest ${getPhaseColor(step.phase)}`}>
                        {step.phase}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(step.status)}`}></span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">{step.message}</p>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-[8px] font-black text-slate-600 uppercase">RIC</span>
                <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-slate-700'}`}></span>
              </div>
              <span className="text-[9px] font-mono text-slate-600">
                {executionSteps.filter(s => s.status === 'complete').length}/{executionSteps.length} steps
              </span>
            </div>
          </div>

          <div className="glass-card h-[200px] rounded-[2rem] border-slate-800 bg-black/80 p-6 flex flex-col">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4">CLI Output</h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[9px] text-slate-500 space-y-1">
              {cliOutput ? (
                cliOutput.split('\n').map((line, i) => (
                  <div key={i} className={line.startsWith('>') ? 'text-orange-400' : ''}>{line}</div>
                ))
              ) : (
                <div className="text-slate-700 italic">No CLI output yet...</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h4 className="text-white text-[10px] font-bold uppercase tracking-wider mb-1">RIC Protocol</h4>
              <p className="text-[8px] text-slate-500">Tool interrupt cycle</p>
            </div>
            <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <h4 className="text-white text-[10px] font-bold uppercase tracking-wider mb-1">FPT Engine</h4>
              <p className="text-[8px] text-slate-500">Ground truth only</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HermesOperations;