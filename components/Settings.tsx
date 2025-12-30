
import React, { useState, useEffect } from 'react';
import { ApiSettings, UserCredits } from '../types';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<ApiSettings>({
    computeMode: 'credits',
    geminiKey: '',
    groqKey: '',
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

  const [credits, setCredits] = useState<UserCredits>({
    cloudTokens: 850000,
    deepAgentTokens: 1200,
    lastSync: Date.now()
  });

  const [activeTab, setActiveTab] = useState<'api' | 'credits' | 'storage'>('api');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    const savedApi = localStorage.getItem('quanta_api_settings');
    if (savedApi) {
      const parsed = JSON.parse(savedApi);
      // Ensure storage settings exist for legacy migration
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
          <button 
            onClick={() => setActiveTab('api')}
            className={`px-10 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'api' ? 'bg-orange-600 text-white shadow-2xl animate-glow-orange' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Compute
          </button>
          <button 
            onClick={() => setActiveTab('storage')}
            className={`px-10 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'storage' ? 'bg-indigo-600 text-white shadow-2xl animate-glow' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Storage Forge
          </button>
          <button 
            onClick={() => setActiveTab('credits')}
            className={`px-10 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'credits' ? 'bg-emerald-600 text-white shadow-2xl animate-glow' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Token Budget
          </button>
        </div>
      </div>

      <div className="glass-card p-12 rounded-[4rem] border-slate-800/50 shadow-2xl relative overflow-hidden">
        {activeTab === 'api' ? (
          <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-500">
            {/* Master Mode Toggle */}
            <div className="p-8 bg-slate-950/50 border border-slate-800 rounded-[3rem] space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-outfit font-black text-white uppercase tracking-tighter italic">Inference Logic Path</h3>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Determine resource allocation source</p>
                </div>
                <div className="bg-black/40 p-1.5 rounded-2xl border border-slate-800 flex shadow-inner">
                  <button 
                    onClick={() => toggleComputeMode('credits')}
                    className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settings.computeMode === 'credits' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}
                  >
                    App Credits
                  </button>
                  <button 
                    onClick={() => toggleComputeMode('sovereign')}
                    className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settings.computeMode === 'sovereign' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}
                  >
                    Sovereign (BYOK)
                  </button>
                </div>
              </div>
            </div>

            {/* Gemini - Personal Key */}
            <div className={`space-y-6 transition-all duration-500 ${settings.computeMode === 'credits' ? 'opacity-40 grayscale' : 'opacity-100'}`}>
              <label className="text-emerald-400 text-[11px] font-black uppercase tracking-[0.4em] px-2">Personal Gemini Core</label>
              <input 
                type="password"
                disabled={settings.computeMode === 'credits'}
                value={settings.geminiKey}
                onChange={(e) => setSettings({...settings, geminiKey: e.target.value})}
                placeholder={settings.computeMode === 'credits' ? "Using Platform Credits..." : "Enter Personal Gemini API Key..."}
                className="w-full bg-slate-950 border-2 border-slate-800 rounded-3xl py-8 px-10 text-white font-mono focus:border-emerald-500 transition-all outline-none shadow-inner"
              />
            </div>

            {/* Groq API */}
            <div className={`space-y-6 transition-all duration-500 ${settings.computeMode === 'credits' ? 'opacity-40 grayscale' : 'opacity-100'}`}>
              <label className="text-orange-400 text-[11px] font-black uppercase tracking-[0.4em] px-2">Personal Groq Bridge</label>
              <input 
                type="password"
                disabled={settings.computeMode === 'credits'}
                value={settings.groqKey}
                onChange={(e) => setSettings({...settings, groqKey: e.target.value})}
                placeholder={settings.computeMode === 'credits' ? "Using Platform Credits..." : "gsk_************************************"}
                className="w-full bg-slate-950 border-2 border-slate-800 rounded-3xl py-8 px-10 text-white font-mono focus:border-orange-500 transition-all outline-none shadow-inner"
              />
            </div>

            {/* Local LLM */}
            <div className={`space-y-6 transition-all duration-500 ${settings.computeMode === 'credits' ? 'opacity-40 grayscale' : 'opacity-100'}`}>
              <label className="text-cyan-400 text-[11px] font-black uppercase tracking-[0.4em] px-2">Local Sovereign Node (LLM Anywhere)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input 
                  type="text"
                  disabled={settings.computeMode === 'credits'}
                  value={settings.localEndpoint}
                  onChange={(e) => setSettings({...settings, localEndpoint: e.target.value})}
                  placeholder="Host (e.g. http://localhost:11434)"
                  className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-6 px-8 text-white font-mono focus:border-cyan-500 outline-none"
                />
                <input 
                  type="text"
                  disabled={settings.computeMode === 'credits'}
                  value={settings.preferredModel}
                  onChange={(e) => setSettings({...settings, preferredModel: e.target.value})}
                  placeholder="Model (e.g. llama3)"
                  className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-6 px-8 text-white font-mono focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            <button onClick={handleSaveSettings} className="w-full py-10 quanta-btn-orange text-white rounded-[2.5rem] font-black uppercase tracking-[0.5em] text-[13px] transition-all">
              {saveStatus || "Commit Architecture Changes"}
            </button>
          </div>
        ) : activeTab === 'storage' ? (
          <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-500">
            {/* Storage Provider Selection */}
            <div className="p-8 bg-slate-950/50 border border-slate-800 rounded-[3rem] space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-outfit font-black text-white uppercase tracking-tighter italic">Persistence Substrate</h3>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Select primary neural archival method</p>
                </div>
                <div className="bg-black/40 p-1.5 rounded-2xl border border-slate-800 flex shadow-inner">
                  {(['local', 'supabase', 'hybrid'] as const).map((p) => (
                    <button 
                      key={p}
                      onClick={() => setSettings({...settings, storage: {...settings.storage, provider: p}})}
                      className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settings.storage.provider === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className={`flex items-center justify-between p-6 rounded-2xl border transition-all cursor-pointer ${settings.storage.syncPrompts ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-slate-900/50 border-slate-800 text-slate-600'}`}>
                  <span className="text-[11px] font-black uppercase tracking-widest">Persist Logic Prompts</span>
                  <input type="checkbox" className="hidden" checked={settings.storage.syncPrompts} onChange={(e) => setSettings({...settings, storage: {...settings.storage, syncPrompts: e.target.checked}})} />
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${settings.storage.syncPrompts ? 'bg-emerald-500' : 'bg-slate-800'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.storage.syncPrompts ? 'right-1' : 'left-1'}`}></div>
                  </div>
                </label>
                <label className={`flex items-center justify-between p-6 rounded-2xl border transition-all cursor-pointer ${settings.storage.syncOutputs ? 'bg-orange-500/10 border-orange-500/50 text-orange-400' : 'bg-slate-900/50 border-slate-800 text-slate-600'}`}>
                  <span className="text-[11px] font-black uppercase tracking-widest">Archival Neural Output</span>
                  <input type="checkbox" className="hidden" checked={settings.storage.syncOutputs} onChange={(e) => setSettings({...settings, storage: {...settings.storage, syncOutputs: e.target.checked}})} />
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${settings.storage.syncOutputs ? 'bg-orange-500' : 'bg-slate-800'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.storage.syncOutputs ? 'right-1' : 'left-1'}`}></div>
                  </div>
                </label>
              </div>
            </div>

            {/* Supabase Options */}
            <div className={`space-y-6 transition-all duration-500 ${settings.storage.provider === 'local' ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
              <div className="flex items-center space-x-4 px-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 1.105 4.477 2 10 2s10-.895 10-2V7c0-1.105-4.477-2-10-2S4 5.895 4 7zm0 5c0 1.105 4.477 2 10 2s10-.895 10-2m-20 5c0 1.105 4.477 2 10 2s10-.895 10-2" /></svg>
                </div>
                <label className="text-emerald-400 text-[11px] font-black uppercase tracking-[0.4em]">Supabase Cloud Forge (Free Tier)</label>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <input 
                  type="text"
                  value={settings.storage.supabaseUrl}
                  onChange={(e) => setSettings({...settings, storage: {...settings.storage, supabaseUrl: e.target.value}})}
                  placeholder="Supabase Project URL (e.g. https://xyz.supabase.co)"
                  className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-6 px-8 text-white font-mono focus:border-emerald-500 outline-none"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <input 
                    type="password"
                    value={settings.storage.supabaseAnonKey}
                    onChange={(e) => setSettings({...settings, storage: {...settings.storage, supabaseAnonKey: e.target.value}})}
                    placeholder="Project Anon Key"
                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-6 px-8 text-white font-mono focus:border-emerald-500 outline-none"
                  />
                  <input 
                    type="text"
                    value={settings.storage.bucketName}
                    onChange={(e) => setSettings({...settings, storage: {...settings.storage, bucketName: e.target.value}})}
                    placeholder="Bucket Name (e.g. quanta-vault)"
                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-6 px-8 text-white font-mono focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
              <p className="text-[9px] text-slate-500 px-4 uppercase tracking-widest italic">Create a public or private bucket in your Supabase console to enable neural cloud sync.</p>
            </div>

            {/* Local Storage Parity */}
            <div className={`space-y-6 transition-all duration-500 ${settings.storage.provider === 'supabase' ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
              <div className="flex items-center space-x-4 px-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                </div>
                <label className="text-orange-400 text-[11px] font-black uppercase tracking-[0.4em]">Local Sovereign Storage (Filesystem)</label>
              </div>
              <input 
                type="text"
                value={settings.storage.localPath}
                onChange={(e) => setSettings({...settings, storage: {...settings.storage, localPath: e.target.value}})}
                placeholder="Local Path Alias (e.g. ./backups)"
                className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-6 px-8 text-white font-mono focus:border-orange-500 outline-none"
              />
              <p className="text-[9px] text-slate-600 px-4 uppercase tracking-widest italic">Ensures primary data persistence is locked to your physical hardware substrate.</p>
            </div>

            <button onClick={handleSaveSettings} className="w-full py-10 quanta-btn-primary text-white rounded-[2.5rem] font-black uppercase tracking-[0.5em] text-[13px] shadow-[0_0_50px_rgba(16,185,129,0.2)] transition-all">
              {saveStatus || "Sync Storage Protocols"}
            </button>
          </div>
        ) : (
          <div className="space-y-16 animate-in slide-in-from-right-4 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Cloud Gauge */}
                <div className="glass-card p-10 rounded-[3rem] border-emerald-500/20 bg-emerald-500/5 relative group overflow-hidden">
                   <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 blur-[80px] group-hover:bg-emerald-500/20 transition-all"></div>
                   <div className="flex items-center justify-between mb-10">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em]">Cloud Intelligence Budget</p>
                      <div className={`px-3 py-1 rounded text-white text-[9px] font-black ${settings.computeMode === 'credits' ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                        {settings.computeMode === 'credits' ? 'ACTIVE' : 'BYPASSED'}
                      </div>
                   </div>
                   <div className="space-y-2">
                      <p className="text-6xl font-outfit font-black text-white">{credits.cloudTokens.toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Monthly Allocation Tier</p>
                   </div>
                   <div className="mt-12 space-y-4">
                      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                         <div className={`h-full transition-all duration-1000 ${settings.computeMode === 'credits' ? 'bg-emerald-500 animate-glow' : 'bg-slate-800'}`} style={{ width: '85%' }}></div>
                      </div>
                      <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase">
                         <span>Allocated: 1M</span>
                         <span>{settings.computeMode === 'credits' ? '85% Remaining' : 'Logic Sovereign'}</span>
                      </div>
                   </div>
                </div>

                {/* Deep Agent Gauge */}
                <div className="glass-card p-10 rounded-[3rem] border-orange-500/20 bg-orange-500/5 relative group overflow-hidden">
                   <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/10 blur-[80px] group-hover:bg-orange-500/20 transition-all"></div>
                   <div className="flex items-center justify-between mb-10">
                      <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em]">Deep Agent Protocol Units</p>
                      <div className={`px-3 py-1 rounded text-white text-[9px] font-black ${settings.computeMode === 'credits' ? 'bg-orange-600' : 'bg-slate-700'}`}>
                         {settings.computeMode === 'credits' ? 'ACTIVE' : 'BYPASSED'}
                      </div>
                   </div>
                   <div className="space-y-2">
                      <p className="text-6xl font-outfit font-black text-white">{credits.deepAgentTokens.toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Hadal-Class Credits</p>
                   </div>
                   <div className="mt-12 space-y-4">
                      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                         <div className={`h-full transition-all duration-1000 ${settings.computeMode === 'credits' ? 'bg-orange-500 animate-glow-orange' : 'bg-slate-800'}`} style={{ width: '60%' }}></div>
                      </div>
                      <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase">
                         <span>Cycle Limit: 2k</span>
                         <span>{settings.computeMode === 'credits' ? '60% Remaining' : 'Logic Sovereign'}</span>
                      </div>
                   </div>
                </div>
             </div>

             <div className="space-y-8 bg-slate-950/50 p-10 rounded-[3rem] border border-slate-800 shadow-inner">
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-xl font-outfit font-black text-white uppercase tracking-tighter italic">Resource Log</h3>
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Last Sync: {new Date(credits.lastSync).toLocaleTimeString()}</span>
                </div>
                <div className="space-y-4">
                   {[
                     { task: 'Deep Search Protocol: Q-Alpha', cost: '-42 Deep Tokens', mode: 'Credits', color: 'text-orange-400' },
                     { task: 'Council Deliberation Trace', cost: '0 Tokens (Sovereign)', mode: 'BYOK', color: 'text-cyan-400' },
                     { task: 'Market Deconstruction Pulse', cost: '-2,100 Cloud Tokens', mode: 'Credits', color: 'text-emerald-400' },
                   ].map((log, i) => (
                     <div key={i} className="flex items-center justify-between p-4 bg-slate-900/30 rounded-2xl border border-slate-800/50 text-[10px] font-bold uppercase tracking-tight">
                        <div className="flex items-center space-x-4">
                           <div className={`w-1.5 h-1.5 rounded-full ${log.mode === 'BYOK' ? 'bg-cyan-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                           <span className="text-slate-300">{log.task}</span>
                        </div>
                        <span className={log.color}>{log.cost}</span>
                     </div>
                   ))}
                </div>
             </div>
             
             <button className="w-full py-8 bg-slate-900 text-slate-400 hover:text-white border border-slate-800 rounded-3xl font-black uppercase tracking-widest text-[11px] transition-all">
                Forge Additional Neural Credits
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
