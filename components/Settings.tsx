
import React, { useState, useEffect } from 'react';
import { ApiSettings, UserCredits } from '../types';
import { invokeEdgeFunction } from '../services/supabaseService';

const VERIFIED_NOVITA_MODELS = [
  { id: 'moonshotai/kimi-k2-thinking', name: 'Kimi K2 (Thinking Core)', desc: 'Primary reasoning substrate' },
  { id: 'deepseek/deepseek-v3', name: 'DeepSeek V3 (Fast)', desc: 'Stable hyper-performance' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', desc: 'Alternative reasoning model' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', desc: 'Industry standard' }
];

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<ApiSettings>({
    computeMode: 'credits',
    geminiKey: '',
    groqKey: '',
    novitaKey: '',
    novitaModel: 'moonshotai/kimi-k2-thinking',
    localEndpoint: 'http://localhost:11434',
    preferredModel: 'llama3',
    storage: {
      provider: 'local',
      supabaseUrl: '',
      supabaseAnonKey: '',
      bucketName: 'quanta-vault',
      syncPrompts: true,
      syncOutputs: true,
      localPath: './quanta-backups'
    }
  });

  // Fixed error by adding visualEnergy property to UserCredits initialization
  const [credits, setCredits] = useState<UserCredits>({
    cloudTokens: 10000,
    deepAgentTokens: 5000,
    visualEnergy: 2000,
    lastSync: Date.now()
  });

  const [activeTab, setActiveTab] = useState<'api' | 'credits' | 'storage' | 'infra'>('api');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  
  const [isProbing, setIsProbing] = useState(false);
  const [probeLogs, setProbeLogs] = useState<string[]>([]);
  const [probeResult, setProbeResult] = useState<any>(null);

  useEffect(() => {
    const savedApi = localStorage.getItem('quanta_api_settings');
    if (savedApi) {
      const parsed = JSON.parse(savedApi);
      // Auto-migrate to moonshotai if previous attempts were 404ing or incorrect
      if (!parsed.novitaModel || parsed.novitaModel === 'deepseek/deepseek-r1' || parsed.novitaModel === 'deepseek/deepseek-v3') {
        parsed.novitaModel = 'moonshotai/kimi-k2-thinking';
      }
      if (!parsed.storage) {
        parsed.storage = {
          provider: 'local',
          supabaseUrl: '',
          supabaseAnonKey: '',
          bucketName: 'quanta-vault',
          syncPrompts: true,
          syncOutputs: true,
          localPath: './quanta-backups'
        };
      }
      setSettings(parsed);
    }

    const savedCredits = localStorage.getItem('quanta_user_credits');
    if (savedCredits) {
      setCredits(JSON.parse(savedCredits));
    } else {
      localStorage.setItem('quanta_user_credits', JSON.stringify(credits));
    }
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('quanta_api_settings', JSON.stringify(settings));
    setSaveStatus('Architecture Synced');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const runEdgeProbe = async () => {
    setIsProbing(true);
    setProbeResult(null);
    setProbeLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Initiating Neural Probe to 'quanta-diagnostic'...`]);
    
    try {
      const startTime = Date.now();
      const data = await invokeEdgeFunction('quanta-diagnostic', { ping: true, trace: "settings-infra-test" });
      const duration = Date.now() - startTime;
      
      setProbeResult({ ...data, latency: duration });
      setProbeLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Probe SUCCESS: Substrate active. Latency: ${duration}ms.`]);
    } catch (err: any) {
      setProbeLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Probe FAILED: Check Supabase function deployment.`]);
      setProbeResult({ error: true, message: err.message });
    } finally {
      setIsProbing(false);
    }
  };

  const toggleComputeMode = (mode: 'credits' | 'sovereign') => {
    setSettings(prev => ({ ...prev, computeMode: mode }));
  };

  return (
    <div className="animate-in fade-in duration-700 max-w-5xl mx-auto space-y-12 pb-32">
      <header className="text-center mb-16">
        <div className="inline-block px-6 py-2 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-[10px] font-black uppercase tracking-[0.5em] mb-6 shadow-2xl animate-pulse">
          Neural Architecture Console
        </div>
        <h1 className="text-6xl font-outfit font-black text-white uppercase tracking-tighter italic">System <span className="quantum-gradient-text italic">Settings</span></h1>
        <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mt-4">Calibrating global SME orchestration parameters</p>
      </header>

      <div className="flex justify-center mb-12">
        <div className="bg-slate-900/50 p-2 rounded-[2.5rem] border border-slate-800 flex shadow-inner">
          <button onClick={() => setActiveTab('api')} className={`px-10 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'api' ? 'bg-orange-600 text-white shadow-2xl animate-glow-orange' : 'text-slate-500 hover:text-slate-300'}`}>Compute</button>
          <button onClick={() => setActiveTab('storage')} className={`px-10 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'storage' ? 'bg-indigo-600 text-white shadow-2xl animate-glow' : 'text-slate-500 hover:text-slate-300'}`}>Storage</button>
          <button onClick={() => setActiveTab('infra')} className={`px-10 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'infra' ? 'bg-cyan-600 text-white shadow-2xl animate-glow' : 'text-slate-500 hover:text-slate-300'}`}>Infra Diagnostic</button>
          <button onClick={() => setActiveTab('credits')} className={`px-10 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'credits' ? 'bg-emerald-600 text-white shadow-2xl animate-glow' : 'text-slate-500 hover:text-slate-300'}`}>Credits</button>
        </div>
      </div>

      <div className="glass-card p-12 rounded-[4rem] border-slate-800/50 shadow-2xl relative overflow-hidden">
        {activeTab === 'api' ? (
          <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-8 bg-slate-950/50 border border-slate-800 rounded-[3rem] space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-outfit font-black text-white uppercase tracking-tighter italic">Inference Logic Path</h3>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Determine resource allocation source</p>
                </div>
                <div className="bg-black/40 p-1.5 rounded-2xl border border-slate-800 flex shadow-inner">
                  <button onClick={() => toggleComputeMode('credits')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settings.computeMode === 'credits' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}>App Credits</button>
                  <button onClick={() => toggleComputeMode('sovereign')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settings.computeMode === 'sovereign' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}>Sovereign (BYOK)</button>
                </div>
              </div>
            </div>

            <div className={`space-y-6 transition-all duration-500 ${settings.computeMode === 'credits' ? 'opacity-40 grayscale' : 'opacity-100'}`}>
              <label className="text-emerald-400 text-[11px] font-black uppercase tracking-[0.4em] px-2">Personal Gemini Core</label>
              <input type="password" disabled={settings.computeMode === 'credits'} value={settings.geminiKey} onChange={(e) => setSettings({...settings, geminiKey: e.target.value})} placeholder={settings.computeMode === 'credits' ? "Using Platform Credits..." : "Enter Personal Gemini API Key..."} className="w-full bg-slate-950 border-2 border-slate-800 rounded-3xl py-8 px-10 text-white font-mono focus:border-emerald-500 transition-all outline-none shadow-inner" />
            </div>

            <div className={`space-y-6 transition-all duration-500 ${settings.computeMode === 'credits' ? 'opacity-40 grayscale' : 'opacity-100'}`}>
              <label className="text-cyan-400 text-[11px] font-black uppercase tracking-[0.4em] px-2">Novita Core Configuration</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="password" disabled={settings.computeMode === 'credits'} value={settings.novitaKey} onChange={(e) => setSettings({...settings, novitaKey: e.target.value})} placeholder={settings.computeMode === 'credits' ? "Shared Substrate Key..." : "sk_************************************"} className="w-full bg-slate-950 border-2 border-slate-800 rounded-3xl py-6 px-10 text-white font-mono focus:border-cyan-500 outline-none shadow-inner" />
                <div className="relative">
                  <select disabled={settings.computeMode === 'credits'} value={settings.novitaModel} onChange={(e) => setSettings({...settings, novitaModel: e.target.value})} className="w-full bg-slate-950 border-2 border-slate-800 rounded-3xl py-6 px-10 text-white font-bold appearance-none focus:border-cyan-500 outline-none shadow-inner cursor-pointer">
                    {VERIFIED_NOVITA_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest px-4 italic">
                Active Selection: <span className="text-cyan-500">{settings.novitaModel}</span>. Kimi K2 is the recommended reasoning engine.
              </p>
            </div>

            <button onClick={handleSaveSettings} className="w-full py-10 quanta-btn-orange text-white rounded-[2.5rem] font-black uppercase tracking-[0.5em] text-[13px] transition-all">
              {saveStatus || "Commit Architecture Changes"}
            </button>
          </div>
        ) : activeTab === 'infra' ? (
          <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row gap-10">
              <div className="flex-1 space-y-8">
                <div>
                   <h3 className="text-2xl font-outfit font-black text-white uppercase tracking-tighter italic">Supabase Edge Substrate</h3>
                   <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Test the neural connection to serverless compute</p>
                </div>

                <div className="bg-slate-950 rounded-[2rem] border border-slate-800 p-8 font-mono text-[11px] h-80 overflow-y-auto custom-scrollbar shadow-inner relative">
                   <div className="absolute top-4 right-4 flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${isProbing ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                      <span className="text-[9px] font-black text-slate-500 uppercase">Latency: {probeResult?.latency || '0'}ms</span>
                   </div>
                   {probeLogs.length === 0 ? (
                     <p className="text-slate-700 italic">Awaiting diagnostic sequence initialization...</p>
                   ) : (
                     probeLogs.map((log, i) => (
                       <p key={i} className={`${log.includes('SUCCESS') ? 'text-emerald-400' : log.includes('FAILED') ? 'text-rose-400' : 'text-slate-400'} mb-2`}>
                         {log}
                       </p>
                     ))
                   )}
                   {probeResult && !probeResult.error && (
                     <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl animate-in zoom-in-95">
                        <p className="text-emerald-300 font-bold mb-2">TELEMETRY DECRYPTED:</p>
                        <pre className="text-[10px] text-emerald-400/80">{JSON.stringify(probeResult, null, 2)}</pre>
                     </div>
                   )}
                </div>

                <button onClick={runEdgeProbe} disabled={isProbing} className="w-full py-6 bg-cyan-600 hover:bg-cyan-500 text-white rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-2xl flex items-center justify-center space-x-4 transition-all">
                  {isProbing ? <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin"></div> : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      <span>Engage Infra Probe</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'storage' ? (
          <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-500">
             <div className="p-8 bg-slate-950/50 border border-slate-800 rounded-[3rem] space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-outfit font-black text-white uppercase tracking-tighter italic">Persistence Substrate</h3>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Select primary neural archival method</p>
                </div>
                <div className="bg-black/40 p-1.5 rounded-2xl border border-slate-800 flex shadow-inner">
                  {(['local', 'supabase', 'hybrid'] as const).map((p) => (
                    <button key={p} onClick={() => setSettings({...settings, storage: {...settings.storage, provider: p}})} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settings.storage.provider === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}>{p}</button>
                  ))}
                </div>
              </div>

              {/* Local Storage Config */}
              {(settings.storage.provider === 'local' || settings.storage.provider === 'hybrid') && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-emerald-400 text-[11px] font-black uppercase tracking-[0.4em] px-2">Local Drive Path</label>
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Node.js / Electron Bridge</span>
                  </div>
                  <input 
                    type="text" 
                    value={settings.storage.localPath || './quanta-backups'} 
                    onChange={(e) => setSettings({...settings, storage: {...settings.storage, localPath: e.target.value}})} 
                    placeholder="./quanta-backups" 
                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-3xl py-6 px-10 text-white font-mono focus:border-emerald-500 transition-all outline-none shadow-inner" 
                  />
                  <p className="text-[9px] text-slate-500 px-4 italic">Specify the relative or absolute path where the Neural Engine will write JSON/MD memories.</p>
                </div>
              )}

              {/* Supabase Storage Config */}
              {(settings.storage.provider === 'supabase' || settings.storage.provider === 'hybrid') && (
                <div className="space-y-6 animate-in fade-in pt-6 border-t border-slate-800/50">
                  <label className="text-emerald-400 text-[11px] font-black uppercase tracking-[0.4em] px-2">Supabase Cloud Vector</label>
                  
                  <div className="grid grid-cols-1 gap-6">
                    <input 
                      type="text" 
                      value={settings.storage.supabaseUrl} 
                      onChange={(e) => setSettings({...settings, storage: {...settings.storage, supabaseUrl: e.target.value}})} 
                      placeholder="Project URL (https://xyz.supabase.co)" 
                      className="w-full bg-slate-950 border-2 border-slate-800 rounded-3xl py-6 px-10 text-white font-mono focus:border-emerald-500 transition-all outline-none shadow-inner" 
                    />
                    <input 
                      type="password" 
                      value={settings.storage.supabaseAnonKey} 
                      onChange={(e) => setSettings({...settings, storage: {...settings.storage, supabaseAnonKey: e.target.value}})} 
                      placeholder="Anon Key (public)" 
                      className="w-full bg-slate-950 border-2 border-slate-800 rounded-3xl py-6 px-10 text-white font-mono focus:border-emerald-500 transition-all outline-none shadow-inner" 
                    />
                    <input 
                      type="text" 
                      value={settings.storage.bucketName} 
                      onChange={(e) => setSettings({...settings, storage: {...settings.storage, bucketName: e.target.value}})} 
                      placeholder="Storage Bucket Name (e.g. quanta-vault)" 
                      className="w-full bg-slate-950 border-2 border-slate-800 rounded-3xl py-6 px-10 text-white font-mono focus:border-emerald-500 transition-all outline-none shadow-inner" 
                    />
                  </div>
                </div>
              )}

              {/* Sync Toggles */}
              <div className="pt-8 border-t border-slate-800/50 flex flex-col md:flex-row gap-8">
                <label className="flex items-center space-x-4 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="peer sr-only"
                      checked={settings.storage.syncPrompts}
                      onChange={(e) => setSettings({...settings, storage: {...settings.storage, syncPrompts: e.target.checked}})}
                    />
                    <div className="w-12 h-7 bg-slate-900 rounded-full peer-checked:bg-indigo-600 transition-all border border-slate-700"></div>
                    <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-all peer-checked:translate-x-5 shadow-lg"></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest group-hover:text-indigo-400 transition-colors">Sync Prompt Data</span>
                    <span className="text-[9px] text-slate-500">Archive system instructions</span>
                  </div>
                </label>

                <label className="flex items-center space-x-4 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="peer sr-only"
                      checked={settings.storage.syncOutputs}
                      onChange={(e) => setSettings({...settings, storage: {...settings.storage, syncOutputs: e.target.checked}})}
                    />
                    <div className="w-12 h-7 bg-slate-900 rounded-full peer-checked:bg-orange-600 transition-all border border-slate-700"></div>
                    <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-all peer-checked:translate-x-5 shadow-lg"></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest group-hover:text-orange-400 transition-colors">Sync Generated Output</span>
                    <span className="text-[9px] text-slate-500">Save MD/JSON artifacts</span>
                  </div>
                </label>
              </div>

            </div>
            <button onClick={handleSaveSettings} className="w-full py-10 quanta-btn-primary text-white rounded-[2.5rem] font-black uppercase tracking-[0.5em] text-[13px] shadow-[0_0_50px_rgba(16,185,129,0.2)] transition-all active:scale-95">
              {saveStatus || "Sync Storage Protocols"}
            </button>
          </div>
        ) : (
          <div className="space-y-16 animate-in slide-in-from-right-4 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="glass-card p-10 rounded-[3rem] border-emerald-500/20 bg-emerald-500/5 relative group overflow-hidden">
                   <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 blur-[80px] group-hover:bg-emerald-500/20 transition-all"></div>
                   <div className="flex items-center justify-between mb-10">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em]">Cloud Intelligence Budget</p>
                      <div className={`px-3 py-1 rounded text-white text-[9px] font-black ${settings.computeMode === 'credits' ? 'bg-emerald-600' : 'bg-slate-700'}`}>{settings.computeMode === 'credits' ? 'ACTIVE' : 'BYPASSED'}</div>
                   </div>
                   <div className="space-y-2">
                      <p className="text-6xl font-outfit font-black text-white">{credits.cloudTokens.toLocaleString()}</p>
                   </div>
                </div>

                <div className="glass-card p-10 rounded-[3rem] border-orange-500/20 bg-orange-500/5 relative group overflow-hidden">
                   <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/10 blur-[80px] group-hover:bg-orange-500/20 transition-all"></div>
                   <div className="flex items-center justify-between mb-10">
                      <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em]">Deep Agent Protocol Units</p>
                      <div className={`px-3 py-1 rounded text-white text-[9px] font-black ${settings.computeMode === 'credits' ? 'bg-orange-600' : 'bg-slate-700'}`}>{settings.computeMode === 'credits' ? 'ACTIVE' : 'BYPASSED'}</div>
                   </div>
                   <div className="space-y-2">
                      <p className="text-6xl font-outfit font-black text-white">{credits.deepAgentTokens.toLocaleString()}</p>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
