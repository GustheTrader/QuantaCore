
import React, { useState, useEffect } from 'react';
import { MCPConnector, MCPConnectorType } from '../types';

const MCPConnectors: React.FC = () => {
  const [connectors, setConnectors] = useState<MCPConnector[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<MCPConnectorType>('local');
  const [activeTab, setActiveTab] = useState<'all' | 'local' | 'docker'>('all');

  useEffect(() => {
    const saved = localStorage.getItem('quanta_mcp_connectors');
    if (saved) {
      setConnectors(JSON.parse(saved));
    } else {
      // Default initial connectors for demo
      const defaults: MCPConnector[] = [
        {
          id: 'mcp_01',
          name: 'Filesystem Forge',
          type: 'local',
          status: 'active',
          endpoint: 'stdio://mcp-filesystem',
          assignedAgents: ['QAssistant', 'QOps'],
          config: { command: 'npx @modelcontextprotocol/server-filesystem ./vault', sovereignShield: true }
        },
        {
          id: 'mcp_02',
          name: 'Isolated SQL Hub',
          type: 'docker',
          status: 'disconnected',
          endpoint: 'docker://postgres-mcp-agent',
          assignedAgents: ['QFinance'],
          config: { image: 'mcp/postgres-connector:latest', ports: ['5432:5432'], sovereignShield: false }
        },
        {
          id: 'mcp_03',
          name: 'NotebookLM Neural Bridge',
          type: 'local',
          status: 'disconnected',
          endpoint: 'stdio://notebooklm-server',
          assignedAgents: ['DeepAgent', 'QResearch', 'QAssistant', 'Council'],
          config: {
            command: 'node ./mcp-servers/notebooklm/dist/index.js',
            env: {
              'NOTEBOOKLM_COOKIE_FILE': './mcp-servers/notebooklm/notebooklm-cookies.json',
              'NOTEBOOKLM_HEADLESS': 'true'
            },
            sovereignShield: true
          }
        }
      ];
      setConnectors(defaults);
      localStorage.setItem('quanta_mcp_connectors', JSON.stringify(defaults));
    }
  }, []);

  const saveConnectors = (updated: MCPConnector[]) => {
    setConnectors(updated);
    localStorage.setItem('quanta_mcp_connectors', JSON.stringify(updated));
  };

  const handleAddConnector = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
    const endpoint = (form.elements.namedItem('endpoint') as HTMLInputElement).value;
    
    // Fix: Explicitly casting status to its literal type to prevent TS from widening it to 'string'
    const connector: MCPConnector = {
      id: `mcp_${Math.random().toString(36).substr(2, 6)}`,
      name,
      type: newType,
      status: 'active' as const,
      endpoint,
      assignedAgents: [],
      config: {
        command: newType === 'local' ? (form.elements.namedItem('command') as HTMLInputElement).value : '',
        image: newType === 'docker' ? (form.elements.namedItem('image') as HTMLInputElement).value : '',
        sovereignShield: true
      }
    };

    saveConnectors([connector, ...connectors]);
    setIsAdding(false);
  };

  const toggleStatus = (id: string) => {
    // Fix: Explicitly typing the map result and casting the ternary status to prevent type widening to 'string'
    const updated = connectors.map((c): MCPConnector => 
      c.id === id ? { ...c, status: (c.status === 'active' ? 'disconnected' : 'active') as 'active' | 'error' | 'disconnected' } : c
    );
    saveConnectors(updated);
  };

  const filteredConnectors = connectors.filter(c => activeTab === 'all' || c.type === activeTab);

  return (
    <div className="animate-in fade-in duration-1000 max-w-7xl mx-auto pb-40">
      <header className="mb-20 text-center">
        <div className="inline-block px-6 py-2 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-[10px] font-black uppercase tracking-[0.5em] mb-6 shadow-2xl animate-pulse">
          Model Context Protocol Bridge
        </div>
        <h1 className="text-6xl md:text-8xl font-outfit font-black text-white uppercase tracking-tighter italic leading-none">
          Neural <span className="quantum-gradient-text italic">Connectors</span>
        </h1>
        <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mt-8">Extending SME sensory reach via Local and Containerized substrates</p>
      </header>

      <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-8">
        <div className="bg-slate-900/50 p-2 rounded-[2.5rem] border border-slate-800 flex shadow-inner">
          {(['all', 'local', 'docker'] as const).map((t) => (
            <button 
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-10 py-4 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-orange-600 text-white shadow-2xl animate-glow-orange' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {t} Nodes
            </button>
          ))}
        </div>

        <button 
          onClick={() => setIsAdding(true)}
          className="px-12 py-5 quanta-btn-primary text-white rounded-[2rem] font-black uppercase tracking-[0.4em] text-[11px] shadow-2xl flex items-center space-x-4 transition-all hover:scale-105"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
          <span>Forge New Connector</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredConnectors.map((c) => (
          <div key={c.id} className={`glass-card p-10 rounded-[3.5rem] border-2 transition-all duration-500 group relative overflow-hidden ${c.status === 'active' ? 'border-emerald-500/30' : 'border-slate-800 opacity-60'}`}>
            {c.status === 'active' && (
              <div className="absolute -right-12 -top-12 w-32 h-32 bg-emerald-500/5 blur-3xl group-hover:bg-emerald-500/10 transition-all"></div>
            )}
            
            <div className="flex items-start justify-between mb-10">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${c.status === 'active' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-700'}`}>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.type === 'local' ? 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2-2v10a2 2 0 002 2z' : 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 v2M7 7h10'} />
                </svg>
              </div>
              <div className="flex flex-col items-end">
                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border mb-2 ${c.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                  {c.status}
                </span>
                <span className="text-[8px] font-mono text-slate-600 uppercase tracking-tighter">{c.id}</span>
              </div>
            </div>

            <h3 className="text-2xl font-outfit font-black text-white uppercase tracking-tighter italic mb-2 group-hover:text-orange-400 transition-colors">{c.name}</h3>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-tight mb-8 truncate">{c.endpoint}</p>

            <div className="space-y-6 flex-1">
              <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-500">
                  <span>Assigned Agents</span>
                  <span className="text-orange-500">{c.assignedAgents.length} Link(s)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.assignedAgents.length > 0 ? c.assignedAgents.map(a => (
                    <span key={a} className="px-2 py-1 bg-slate-900 rounded-md border border-white/5 text-[8px] font-bold text-slate-400">{a}</span>
                  )) : (
                    <span className="text-[8px] italic text-slate-700 uppercase tracking-widest">Awaiting SME Binding...</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between px-2">
                <div className="flex items-center space-x-2">
                   <div className={`w-2 h-2 rounded-full ${c.config.sovereignShield ? 'bg-orange-500 shadow-[0_0_8px_#f97316]' : 'bg-slate-800'}`}></div>
                   <span className="text-[9px] font-black text-slate-500 uppercase">Sovereign Shield</span>
                </div>
                <div className="text-[9px] font-black text-emerald-500/80 uppercase">
                  {c.type === 'local' ? 'Process Stream' : 'Docker Virtualization'}
                </div>
              </div>
            </div>

            <div className="mt-10 flex space-x-4">
               <button 
                 onClick={() => toggleStatus(c.id)}
                 className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border ${
                   c.status === 'active' ? 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white' : 'quanta-btn-primary text-white shadow-xl'
                 }`}
               >
                 {c.status === 'active' ? 'De-sync' : 'Initialize'}
               </button>
               <button className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 hover:text-orange-400 transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
               </button>
            </div>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-6 animate-in fade-in zoom-in-95 duration-300">
           <div className="glass-card w-full max-w-2xl rounded-[4rem] border-orange-500/30 overflow-hidden shadow-2xl relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent"></div>
              
              <div className="p-12 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-outfit font-black text-white uppercase tracking-tighter italic">Connector <span className="text-orange-500">Forge</span></h2>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Configuring Model Context Protocol Layer</p>
                </div>
                <button onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-white transition-colors">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleAddConnector} className="p-12 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-center mb-8">
                  <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800 inline-flex shadow-inner">
                    {(['local', 'docker'] as const).map((t) => (
                      <button 
                        key={t}
                        type="button" 
                        onClick={() => setNewType(t)} 
                        className={`px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newType === t ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-orange-400 text-[10px] font-black uppercase tracking-[0.4em] block ml-2">Node Name</label>
                  <input name="name" required placeholder="e.g. Postgres-Bridge-01" className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-5 px-8 text-white font-bold outline-none focus:border-orange-500 transition-all" />
                </div>

                <div className="space-y-4">
                  <label className="text-orange-400 text-[10px] font-black uppercase tracking-[0.4em] block ml-2">Endpoint URI</label>
                  <input name="endpoint" required placeholder={newType === 'local' ? "stdio://connector-name" : "docker://container-name"} className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-5 px-8 text-white font-mono text-sm outline-none focus:border-orange-500 transition-all" />
                </div>

                {newType === 'local' ? (
                  <div className="space-y-4">
                    <label className="text-orange-400 text-[10px] font-black uppercase tracking-[0.4em] block ml-2">Runtime Command</label>
                    <input name="command" required placeholder="npx @modelcontextprotocol/server-..." className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-5 px-8 text-white font-mono text-sm outline-none focus:border-orange-500 transition-all" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="text-orange-400 text-[10px] font-black uppercase tracking-[0.4em] block ml-2">Docker Image Signature</label>
                    <input name="image" required placeholder="registry/image-name:tag" className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-5 px-8 text-white font-mono text-sm outline-none focus:border-orange-500 transition-all" />
                  </div>
                )}

                <div className="pt-8 flex space-x-6">
                  <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-6 bg-slate-900 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px]">Abort Forge</button>
                  <button type="submit" className="flex-[2] py-6 quanta-btn-orange text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl">Integrate Node</button>
                </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default MCPConnectors;
