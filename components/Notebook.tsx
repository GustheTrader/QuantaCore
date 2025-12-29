
import React, { useState, useEffect, useRef } from 'react';
import { MemoryBlock } from '../types';
import { syncMemoryToSupabase, fetchMemoriesFromSupabase, deleteMemoryFromSupabase } from '../services/supabaseService';

const Notebook: React.FC = () => {
  const [memories, setMemories] = useState<MemoryBlock[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [newMemory, setNewMemory] = useState<{
    title: string;
    content: string;
    category: string;
    assignedAgents: string[];
  }>({ 
    title: '', 
    content: '', 
    category: 'General',
    assignedAgents: [] 
  });

  const [availableAgents, setAvailableAgents] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const remote = await fetchMemoriesFromSupabase();
      if (remote) {
        setMemories(remote);
      } else {
        const local = localStorage.getItem('quanta_notebook');
        if (local) setMemories(JSON.parse(local));
      }

      const sessionStr = localStorage.getItem('quanta_session');
      if (sessionStr) {
        const { track } = JSON.parse(sessionStr);
        
        const personalAgents = [
          "QAssistant", "QWealth", "QHealth", 
          "QCreative", "QLegacy", "QMind",
          "QNomad", "QSocial", "QSpeculator"
        ];
        const businessAgents = [
          "QStrategy", "QGrowth", "QFinance",
          "QSales", "QOps", "QLegal",
          "QTalent", "QProduct", "QSuccess"
        ];
        const tradingAgents = [
          "QTradeAnalyst", "QNewsSentry", "QSentimentEngine",
          "QRiskQuant", "QVolExpert", "QOptionStrategist",
          "QThetaBurn", "QYieldHunter", "QMacroEdge"
        ];
        
        const standard = track === 'personal' ? personalAgents : track === 'business' ? businessAgents : tradingAgents;
        const customStr = localStorage.getItem(`quanta_custom_agents_${track}`);
        const custom = customStr ? JSON.parse(customStr).map((a: any) => a.name) : [];
        
        setAvailableAgents([...standard, ...custom, "All Agents"]);
      }
    };
    
    loadData();
  }, []);

  const saveMemory = async () => {
    if (!newMemory.title || !newMemory.content) return;
    const memory: MemoryBlock = {
      id: Math.random().toString(36).substr(2, 9),
      ...newMemory,
      timestamp: Date.now()
    };
    
    const updated = [memory, ...memories];
    setMemories(updated);
    localStorage.setItem('quanta_notebook', JSON.stringify(updated));
    await syncMemoryToSupabase(memory);
    
    setNewMemory({ title: '', content: '', category: 'General', assignedAgents: [] });
    setIsAdding(false);
  };

  const deleteMemory = async (id: string) => {
    const updated = memories.filter(m => m.id !== id);
    setMemories(updated);
    localStorage.setItem('quanta_notebook', JSON.stringify(updated));
    await deleteMemoryFromSupabase(id);
  };

  const updateMemoryAssignments = async (id: string, agent: string) => {
    const updated = memories.map(m => {
      if (m.id === id) {
        const alreadyAssigned = m.assignedAgents.includes(agent);
        const newAgents = alreadyAssigned 
          ? m.assignedAgents.filter(a => a !== agent)
          : [...m.assignedAgents, agent];
        
        const updatedMemory = { ...m, assignedAgents: newAgents };
        syncMemoryToSupabase(updatedMemory);
        return updatedMemory;
      }
      return m;
    });
    
    setMemories(updated);
    localStorage.setItem('quanta_notebook', JSON.stringify(updated));
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setNewMemory(prev => ({ 
        ...prev, 
        content: prev.content + (prev.content ? '\n\n' : '') + `[FILE CONTENT: ${file.name}]\n` + text,
        title: prev.title || file.name.split('.')[0]
      }));
    };
    if (file.type.includes('text') || file.name.endsWith('.csv') || file.name.endsWith('.log') || file.name.endsWith('.md')) {
      reader.readAsText(file);
    } else {
      setNewMemory(prev => ({
        ...prev,
        content: prev.content + `\nAttached Blob Reference: ${file.name} (${file.size} bytes, ${file.type})`
      }));
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        handleFile(e.dataTransfer.files[i]);
      }
    }
  };

  return (
    <div className="animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
        <div>
          <h1 className="text-4xl font-outfit font-black text-white uppercase tracking-tighter">SME <span className="quantum-gradient-text italic">Notebook</span></h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mt-2">Sovereign Polymath Knowledge Base</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-indigo-500/30 transition-all active:scale-95"
        >
          Forge SME Memory Block
        </button>
      </header>

      {isAdding && (
        <div className="glass-card p-10 rounded-[3rem] border-indigo-500/30 mb-12 animate-in slide-in-from-top-6 duration-500 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3 block">Memory Designation</label>
                  <input 
                    type="text" 
                    value={newMemory.title}
                    onChange={(e) => setNewMemory({...newMemory, title: e.target.value})}
                    placeholder="e.g. Portfolio Strategy V1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white font-outfit font-bold shadow-inner focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3 block">Neural Category</label>
                  <select 
                    value={newMemory.category}
                    onChange={(e) => setNewMemory({...newMemory, category: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white font-bold shadow-inner focus:border-indigo-500 transition-all"
                  >
                    <option>General</option>
                    <option>Strategic</option>
                    <option>Technical</option>
                    <option>Financial</option>
                    <option>Personal</option>
                    <option>System Prompt</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3 block">Data Ingestion</label>
                <div 
                  onDragEnter={handleDrag} 
                  onDragLeave={handleDrag} 
                  onDragOver={handleDrag} 
                  onDrop={handleDrop}
                  className={`relative w-full min-h-[150px] rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer ${dragActive ? 'bg-indigo-600/10 border-indigo-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input type="file" ref={fileInputRef} multiple onChange={(e) => {
                    if (e.target.files) {
                      for (let i = 0; i < e.target.files.length; i++) handleFile(e.target.files[i]);
                    }
                  }} className="hidden" />
                  <div className="text-center p-6">
                    <svg className="w-10 h-10 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Drop ANY data here or <span className="text-indigo-400">click to browse</span></p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3 block">Extracted Knowledge</label>
                <textarea 
                  rows={8}
                  value={newMemory.content}
                  onChange={(e) => setNewMemory({...newMemory, content: e.target.value})}
                  placeholder="Paste raw data or refine extracted knowledge here..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] p-8 text-slate-300 font-mono text-sm shadow-inner focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-6">
              <label className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] block">SME Core Assignment</label>
              <div className="bg-slate-950/50 border border-slate-800 rounded-[2rem] p-6 max-h-[600px] overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  {availableAgents.map(agent => (
                    <div 
                      key={agent}
                      onClick={() => {
                        setNewMemory(prev => ({
                          ...prev,
                          assignedAgents: prev.assignedAgents.includes(agent) 
                            ? prev.assignedAgents.filter(a => a !== agent)
                            : [...prev.assignedAgents, agent]
                        }));
                      }}
                      className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border ${newMemory.assignedAgents.includes(agent) ? 'bg-indigo-600/10 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-tight truncate">{agent}</span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${newMemory.assignedAgents.includes(agent) ? 'border-indigo-400 bg-indigo-400' : 'border-slate-700'}`}>
                        {newMemory.assignedAgents.includes(agent) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-6 mt-12 pt-10 border-t border-slate-900">
            <button onClick={() => setIsAdding(false)} className="flex-1 py-5 bg-slate-900 hover:bg-slate-800 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] text-slate-500 transition-all">Abort Integration</button>
            <button onClick={saveMemory} className="flex-1 py-5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-indigo-500/20 transition-all">Sync to SME Vector Core</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {memories.map(m => (
          <div key={m.id} className="glass-card p-8 rounded-[2.5rem] border-slate-800/50 flex flex-col group hover:border-indigo-500/30 transition-all shadow-xl relative overflow-visible">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/10">{m.category}</span>
              <div className="flex items-center space-x-2">
                 <div className="relative">
                    <button 
                      onClick={() => setActiveDropdown(activeDropdown === m.id ? null : m.id)}
                      className="text-slate-500 hover:text-indigo-400 transition-colors p-2 rounded-lg bg-slate-900/50 border border-slate-800"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4" /></svg>
                    </button>
                    {activeDropdown === m.id && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-indigo-500/30 rounded-xl shadow-2xl z-50 p-2 animate-in zoom-in-95 duration-200">
                         <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                            {availableAgents.map(agent => (
                              <button 
                                key={agent}
                                onClick={() => updateMemoryAssignments(m.id, agent)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-[9px] font-bold uppercase flex items-center justify-between transition-colors ${m.assignedAgents.includes(agent) ? 'bg-indigo-600/20 text-indigo-300' : 'hover:bg-slate-800 text-slate-500'}`}
                              >
                                <span className="truncate mr-2">{agent}</span>
                                {m.assignedAgents.includes(agent) && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              </button>
                            ))}
                         </div>
                      </div>
                    )}
                 </div>
                 <button onClick={() => deleteMemory(m.id)} className="text-slate-700 hover:text-rose-500 transition-colors p-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862" /></svg>
                 </button>
              </div>
            </div>
            <h3 className="text-white font-outfit font-black text-xl mb-4 uppercase tracking-tighter leading-none">{m.title}</h3>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {m.assignedAgents?.map(agent => (
                <span key={agent} className="text-[8px] font-black text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-2 py-0.5 rounded-md uppercase">{agent}</span>
              ))}
            </div>
            <p className="text-slate-400 text-xs leading-relaxed line-clamp-6 flex-1 opacity-80 group-hover:opacity-100 transition-opacity font-medium">{m.content}</p>
          </div>
        ))}
      </div>
      {activeDropdown && (
        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setActiveDropdown(null)} />
      )}
    </div>
  );
};

export default Notebook;
