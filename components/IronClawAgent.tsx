import React, { useState, useEffect, useRef } from 'react';

interface SecurityLog {
  id: string;
  timestamp: number;
  type: 'wasm' | 'injection' | 'network' | 'system';
  message: string;
  status: 'secure' | 'warning' | 'blocked';
}

const IronClawAgent: React.FC = () => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [activeSandbox, setActiveSandbox] = useState<string | null>(null);
  const [memoryStatus, setMemoryStatus] = useState<'idle' | 'indexing' | 'retrieving'>('idle');
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (type: SecurityLog['type'], message: string, status: SecurityLog['status'] = 'secure') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      type,
      message,
      status
    }]);
  };

  const handleExecute = async () => {
    if (!input.trim() || isProcessing) return;
    setIsProcessing(true);
    setLogs([]); // Clear previous logs for new execution
    
    // Simulation Sequence
    try {
      // 1. Prompt Injection Scan
      addLog('injection', 'Scanning input for prompt injection patterns...', 'secure');
      await new Promise(r => setTimeout(r, 800));
      addLog('injection', 'Input sanitized. No injection vectors detected.', 'secure');

      // 2. Memory Retrieval
      setMemoryStatus('retrieving');
      addLog('system', 'Querying Hybrid Vector/Keyword Index...', 'secure');
      await new Promise(r => setTimeout(r, 1200));
      setMemoryStatus('idle');
      addLog('system', 'Context retrieved from persistent storage.', 'secure');

      // 3. WASM Sandbox Init
      setActiveSandbox('initializing');
      addLog('wasm', 'Initializing isolated WASM container...', 'secure');
      await new Promise(r => setTimeout(r, 1000));
      setActiveSandbox('running');
      addLog('wasm', 'Sandbox active. Capabilities: [HTTP_OUTBOUND: ALLOWED (whitelist), FS: READ_ONLY]', 'secure');

      // 4. Execution (Mock)
      await new Promise(r => setTimeout(r, 2000));
      addLog('network', 'Outbound request to approved host: api.near.org', 'secure');
      
      // 5. Finalize
      setActiveSandbox(null);
      addLog('system', 'Execution complete. Sandbox destroyed.', 'secure');
      
    } catch (e) {
      addLog('system', 'Critical Failure in Rust Core.', 'blocked');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-1000 max-w-7xl mx-auto space-y-12 pb-40">
      <header className="text-center mb-16">
        <div className="inline-block px-6 py-2 rounded-full border border-orange-600/30 bg-orange-900/20 text-orange-500 text-[10px] font-black uppercase tracking-[0.5em] mb-6 shadow-[0_0_30px_rgba(234,88,12,0.2)]">
          Rust Security Core
        </div>
        <h1 className="text-6xl md:text-8xl font-outfit font-black text-white uppercase tracking-tighter italic">
          Iron <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-orange-600">Claw</span>
        </h1>
        <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mt-4">
          Secure WASM Sandbox &bull; Privacy-First Architecture
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Panel: Controls & Input */}
        <div className="lg:col-span-7 space-y-8">
          <div className="glass-card p-10 rounded-[3rem] border-orange-500/20 bg-[#0a0a0a] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 to-red-600 opacity-50"></div>
            
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-white text-[11px] font-black uppercase tracking-[0.3em]">Secure Command Input</h3>
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${activeSandbox ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></span>
                <span className="text-[9px] font-bold text-slate-500 uppercase">Sandbox {activeSandbox ? 'Active' : 'Ready'}</span>
              </div>
            </div>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter command for secure execution..."
              className="w-full h-40 bg-slate-900/50 border border-slate-800 rounded-3xl p-6 text-slate-200 font-mono text-sm focus:border-orange-500 transition-all resize-none outline-none mb-6"
            />

            <button
              onClick={handleExecute}
              disabled={isProcessing || !input.trim()}
              className="w-full py-6 bg-gradient-to-r from-orange-700 to-red-700 hover:from-orange-600 hover:to-red-600 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Securing Context...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  <span>Execute in IronClaw</span>
                </>
              )}
            </button>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 rounded-[2rem] bg-slate-900/40 border border-slate-800 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 v2M7 7h10" /></svg>
              </div>
              <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-1">WASM Sandbox</h4>
              <p className="text-[9px] text-slate-500">Isolated execution environment</p>
            </div>
            <div className="p-6 rounded-[2rem] bg-slate-900/40 border border-slate-800 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-1">Injection Defense</h4>
              <p className="text-[9px] text-slate-500">Pattern-based sanitization</p>
            </div>
          </div>
        </div>

        {/* Right Panel: Security Logs & Visualization */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card h-[600px] rounded-[3rem] border-slate-800 bg-black/80 p-8 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-20">
              <svg className="w-32 h-32 text-orange-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/></svg>
            </div>
            
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-6 z-10">Security Audit Log</h3>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 z-10 pr-2">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-50">
                  <div className="w-16 h-16 border-2 border-dashed border-slate-800 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest">System Idle</p>
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className={`p-4 rounded-xl border ${
                    log.status === 'secure' ? 'bg-emerald-900/10 border-emerald-500/20' :
                    log.status === 'warning' ? 'bg-orange-900/10 border-orange-500/20' :
                    'bg-rose-900/10 border-rose-500/20'
                  } animate-in slide-in-from-left-2`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[8px] font-black uppercase tracking-widest ${
                        log.type === 'wasm' ? 'text-orange-400' :
                        log.type === 'injection' ? 'text-red-400' :
                        log.type === 'network' ? 'text-blue-400' :
                        'text-slate-400'
                      }`}>{log.type}</span>
                      <span className="text-[8px] font-mono text-slate-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs font-mono text-slate-300">{log.message}</p>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Status Bar */}
            <div className="mt-6 pt-6 border-t border-slate-800 flex items-center justify-between">
               <div className="flex flex-col">
                 <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Memory State</span>
                 <span className={`text-[10px] font-bold uppercase ${memoryStatus === 'idle' ? 'text-slate-400' : 'text-orange-400 animate-pulse'}`}>
                   {memoryStatus === 'idle' ? 'Standby' : memoryStatus === 'indexing' ? 'Indexing...' : 'Retrieving...'}
                 </span>
               </div>
               <div className="flex flex-col text-right">
                 <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Rust Core</span>
                 <span className="text-[10px] font-bold text-emerald-500 uppercase">v0.4.2 (Stable)</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IronClawAgent;
