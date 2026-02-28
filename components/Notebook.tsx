
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { SourceNode } from '../types';
import { syncMemoryToSupabase, fetchMemoriesFromSupabase, deleteMemoryFromSupabase } from '../services/supabaseService';
import { ConfirmationModal } from './ConfirmationModal';

const SOURCE_LIMIT = 50;

const Notebook: React.FC = () => {
  const [sources, setSources] = useState<SourceNode[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [isUploadPortalOpen, setIsUploadPortalOpen] = useState(false);
  const [isProcessingSource, setIsProcessingSource] = useState(false);
  const [guideSummary, setGuideSummary] = useState<string | null>(null);
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [isCompacting, setIsCompacting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, id?: string } | null>(null);
  
  // Specific Upload Sub-modes
  const [uploadMode, setUploadMode] = useState<'main' | 'link' | 'text'>('main');
  const [linkInput, setLinkInput] = useState('');
  const [textInput, setTextInput] = useState({ title: '', content: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const remote = await fetchMemoriesFromSupabase();
      if (remote) {
        setSources(remote as any);
      } else {
        const local = localStorage.getItem('quanta_notebook');
        if (local) setSources(JSON.parse(local));
      }
    };
    loadData();
  }, []);

  const handleFileUpload = async (file: File) => {
    if (sources.length >= SOURCE_LIMIT) return;
    setIsProcessingSource(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      await processAndAddSource(file.name, text, file.type.includes('pdf') ? 'pdf' : 'doc');
      setIsUploadPortalOpen(false);
      setUploadMode('main');
    };
    reader.readAsText(file);
  };

  const handleLinkSubmit = async (type: 'Website' | 'YouTube') => {
    if (!linkInput.trim()) return;
    setIsProcessingSource(true);
    // In a real scenario, this would trigger a scraping service. 
    // Here we simulate the RAG capture.
    await processAndAddSource(`${type}: ${linkInput}`, `Knowledge captured from link: ${linkInput}`, 'url', linkInput);
    setLinkInput('');
    setIsUploadPortalOpen(false);
    setUploadMode('main');
  };

  const handleTextSubmit = async () => {
    if (!textInput.content.trim()) return;
    setIsProcessingSource(true);
    await processAndAddSource(textInput.title || 'Pasted Content', textInput.content, 'doc');
    setTextInput({ title: '', content: '' });
    setIsUploadPortalOpen(false);
    setUploadMode('main');
  };

  const processAndAddSource = async (title: string, content: string, type: SourceNode['type'], url?: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const summaryResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a Source Analyst. Provide a high-density, 3-sentence summary of this knowledge block. TITLE: ${title}. CONTENT: ${content.substring(0, 5000)}`,
      });

      const source: SourceNode = {
        id: `src_${Math.random().toString(36).substr(2, 9)}`,
        title,
        content,
        type,
        category: 'Grounded Source',
        assignedAgents: ['All Agents'],
        timestamp: Date.now(),
        metadata: {
          url,
          wordCount: content.split(' ').length,
          summary: summaryResponse.text
        }
      };

      const updated = [source, ...sources];
      setSources(updated);
      localStorage.setItem('quanta_notebook', JSON.stringify(updated));
      await syncMemoryToSupabase(source as any);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessingSource(false);
    }
  };

  const generateNotebookGuide = async () => {
    if (sources.length === 0) return;
    setIsGeneratingGuide(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `You are a Knowledge Architect. Synthesize a "Notebook Guide" for the active sources:
      ${sources.map(s => `[SOURCE: ${s.title}]: ${s.metadata?.summary}`).join('\n')}
      
      Provide themes, suggested inquiries, and key axioms.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      setGuideSummary(response.text || "Failed to generate guide.");
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingGuide(false);
    }
  };

  const handleCompaction = async () => {
    if (sources.length < 2) return;
    setIsCompacting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const contentToCompact = sources.map(s => `[SOURCE: ${s.title}]: ${s.content.substring(0, 3000)}...`).join('\n\n');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are the Sovereign Knowledge Architect. 
        TASK: Compact the following ${sources.length} memory blocks into a SINGLE, high-density "Master Context Block".
        
        RULES:
        1. Strip all conversational filler.
        2. Merge duplicate concepts.
        3. Retain specific entities, dates, and axioms.
        4. Output structure: Markdown with clear headers.
        
        INPUT DATA:
        ${contentToCompact}`,
      });

      const compactedText = response.text;
      if (!compactedText) throw new Error("Compaction failed");

      const masterNode: SourceNode = {
          id: `compact_${Date.now()}`,
          title: `Compacted Knowledge Block (${new Date().toLocaleDateString()})`,
          content: compactedText,
          type: 'distilled',
          category: 'Compacted Archive',
          assignedAgents: ['All Agents'],
          timestamp: Date.now(),
          metadata: {
              wordCount: compactedText.split(' ').length,
              summary: "High-density compaction of previous memory states."
          }
      };

      // In this mode, we replace the displayed list with the master node for clarity
      const updated = [masterNode]; 
      setSources(updated);
      localStorage.setItem('quanta_notebook', JSON.stringify(updated));
      await syncMemoryToSupabase(masterNode);
      // Note: Original sources are effectively "archived" by removal from the active list.
      
    } catch(e) {
      console.error("Compaction error", e);
    } finally {
      setIsCompacting(false);
    }
  };

  const deleteSource = async (id: string) => {
    const updated = sources.filter(s => s.id !== id);
    setSources(updated);
    localStorage.setItem('quanta_notebook', JSON.stringify(updated));
    await deleteMemoryFromSupabase(id);
    if (activeSourceId === id) setActiveSourceId(null);
  };

  const activeSource = sources.find(s => s.id === activeSourceId);

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col lg:flex-row gap-8 animate-in fade-in duration-700 overflow-hidden relative">
      
      {/* UPLOAD PORTAL MODAL (NotebookLM Clone) */}
      {isUploadPortalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/95 backdrop-blur-xl p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-4xl glass-card rounded-[3rem] border-slate-800 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
            <div className="p-8 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5" /></svg>
                <h2 className="text-xl font-outfit font-black text-white uppercase tracking-tighter italic">Knowledge <span className="text-emerald-400">Portal</span></h2>
              </div>
              <button onClick={() => { setIsUploadPortalOpen(false); setUploadMode('main'); }} className="p-2 text-slate-500 hover:text-white transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-12 space-y-10">
              {uploadMode === 'main' ? (
                <>
                  {/* Primary Dropzone */}
                  <div 
                    onClick={() => !isProcessingSource && fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 rounded-[2.5rem] p-16 flex flex-col items-center justify-center text-center group hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all cursor-pointer relative overflow-hidden"
                  >
                    <div className="w-16 h-16 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Upload sources</h3>
                    <p className="text-slate-500 font-medium">Drag & drop or <span className="text-indigo-400">choose file</span> to upload</p>
                    <p className="text-[10px] font-black uppercase text-slate-700 tracking-widest mt-12">Supported: PDF, TXT, MD, DOCX, AUDIO</p>
                    {isProcessingSource && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>

                  {/* Mode Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <button className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl text-left group hover:border-slate-600 transition-all flex items-start space-x-4">
                      <svg className="w-6 h-6 text-slate-500 group-hover:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H6a2 2 0 00-2 2z" /></svg>
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Google Workspace</p>
                        <p className="text-xs font-bold text-slate-300">Google Drive</p>
                      </div>
                    </button>
                    <button onClick={() => setUploadMode('link')} className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl text-left group hover:border-slate-600 transition-all flex items-start space-x-4">
                      <svg className="w-6 h-6 text-slate-500 group-hover:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.828a4.48 4.48 0 011.884-1.884m3.158 1.884a4 4 0 105.656-5.656l-4-4a4 4 0 00-5.656 5.656l1.103 1.103" /></svg>
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Link</p>
                        <p className="text-xs font-bold text-slate-300">Website / YouTube</p>
                      </div>
                    </button>
                    <button onClick={() => setUploadMode('text')} className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl text-left group hover:border-slate-600 transition-all flex items-start space-x-4">
                      <svg className="w-6 h-6 text-slate-500 group-hover:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Paste text</p>
                        <p className="text-xs font-bold text-slate-300">Copied text</p>
                      </div>
                    </button>
                  </div>
                </>
              ) : uploadMode === 'link' ? (
                <div className="animate-in slide-in-from-right-4 duration-300 space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">Import from Link</h3>
                    <button onClick={() => setUploadMode('main')} className="text-slate-500 text-[10px] font-black uppercase hover:text-white">Back</button>
                  </div>
                  <input 
                    value={linkInput} 
                    onChange={e => setLinkInput(e.target.value)} 
                    placeholder="https://example.com/article" 
                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-6 px-8 text-white focus:border-emerald-500 outline-none transition-all"
                  />
                  <div className="flex space-x-4">
                    <button onClick={() => handleLinkSubmit('Website')} className="flex-1 py-5 bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] hover:bg-slate-700 transition-all">Website</button>
                    <button onClick={() => handleLinkSubmit('YouTube')} className="flex-1 py-5 bg-rose-900/20 text-rose-500 border border-rose-500/20 rounded-2xl font-black uppercase text-[10px] hover:bg-rose-900/40 transition-all">YouTube</button>
                  </div>
                </div>
              ) : (
                <div className="animate-in slide-in-from-right-4 duration-300 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">Paste Knowledge Block</h3>
                    <button onClick={() => setUploadMode('main')} className="text-slate-500 text-[10px] font-black uppercase hover:text-white">Back</button>
                  </div>
                  <input 
                    value={textInput.title} 
                    onChange={e => setTextInput({...textInput, title: e.target.value})} 
                    placeholder="Source Title (optional)" 
                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-4 px-8 text-white focus:border-emerald-500 outline-none transition-all"
                  />
                  <textarea 
                    value={textInput.content} 
                    onChange={e => setTextInput({...textInput, content: e.target.value})} 
                    placeholder="Paste your text here..." 
                    className="w-full h-64 bg-slate-950 border-2 border-slate-800 rounded-3xl py-6 px-8 text-white focus:border-emerald-500 outline-none transition-all resize-none"
                  />
                  <button onClick={handleTextSubmit} className="w-full py-6 quanta-btn-primary text-white rounded-2xl font-black uppercase text-[11px] shadow-2xl">Integrate Text</button>
                </div>
              )}

              {/* Limit Footer */}
              <div className="pt-10 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 v2M7 7h10" /></svg>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Source limit</span>
                </div>
                <div className="flex-1 mx-8 h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-indigo-600 transition-all duration-1000" 
                    style={{ width: `${(sources.length / SOURCE_LIMIT) * 100}%` }}
                  ></div>
                </div>
                <span className="text-[11px] font-black text-slate-400">{sources.length} / {SOURCE_LIMIT}</span>
              </div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} />
          </div>
        </div>
      )}

      {/* LEFT: SOURCE MANAGER SIDEBAR */}
      <div className="w-full lg:w-96 flex flex-col space-y-6 shrink-0">
        <div className="glass-card p-8 rounded-[2.5rem] border-emerald-500/20 shadow-2xl flex flex-col h-full bg-[#020617]/50">
           <div className="flex items-center justify-between mb-8">
              <h2 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em]">Context Topology</h2>
              <div className="flex space-x-2">
                <button 
                  onClick={handleCompaction}
                  disabled={isCompacting || sources.length < 2}
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all shadow-xl ${isCompacting ? 'bg-orange-500 text-white animate-pulse' : 'bg-slate-900 border-slate-700 text-orange-400 hover:border-orange-500 hover:bg-orange-500/10'}`}
                  title="Run Neural Compaction"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 v2M7 7h10" /></svg>
                </button>
                <button 
                  onClick={() => setIsUploadPortalOpen(true)}
                  className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all shadow-xl"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
           </div>

           <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
             {sources.length === 0 ? (
               <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl opacity-30">
                  <p className="text-[9px] font-black uppercase">Knowledge Base Empty</p>
               </div>
             ) : (
               sources.map(source => (
                 <button 
                   key={source.id} 
                   onClick={() => setActiveSourceId(source.id)}
                   className={`w-full p-4 rounded-2xl border text-left transition-all group relative overflow-hidden flex flex-col gap-2 ${activeSourceId === source.id ? 'bg-emerald-600/10 border-emerald-500 shadow-lg' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                 >
                   <div className="flex items-center space-x-3 mb-1">
                      <div className={`w-8 h-8 rounded-lg bg-slate-950 border border-emerald-500/20 flex items-center justify-center text-[10px] font-black shrink-0 ${source.type === 'pdf' ? 'text-rose-400' : source.type === 'url' ? 'text-cyan-400' : 'text-emerald-500'}`}>
                        {source.type.toUpperCase().substring(0, 3)}
                      </div>
                      <h3 className="text-xs font-black text-white uppercase truncate">{source.title}</h3>
                   </div>
                   
                   {/* Context Block Visual */}
                   <div className="w-full flex items-center space-x-2 px-1">
                      <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                         <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{width: `${Math.min(100, (source.metadata?.wordCount || 0) / 50)}%`}}></div>
                      </div>
                      <span className="text-[8px] font-mono text-slate-500">{source.metadata?.wordCount || 0} words</span>
                   </div>

                   <button 
                     onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, id: source.id }); }}
                     className="absolute top-4 right-4 p-1 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-500 transition-all"
                   >
                     <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>
                 </button>
               ))
             )}
           </div>

           {deleteModal && (
             <ConfirmationModal
               isOpen={deleteModal.isOpen}
               onClose={() => setDeleteModal(null)}
               onConfirm={() => {
                 if (deleteModal.id) deleteSource(deleteModal.id);
               }}
               title="Delete Knowledge Source?"
               message="This source will be permanently removed from the neural archive."
               confirmLabel="Delete"
               isDestructive={true}
             />
           )}

           <div className="pt-6 border-t border-slate-800">
              <button 
                onClick={generateNotebookGuide}
                disabled={isGeneratingGuide || sources.length === 0}
                className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl animate-glow flex items-center justify-center space-x-3"
              >
                {isGeneratingGuide ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                <span>Neural Notebook Guide</span>
              </button>
           </div>
        </div>
      </div>

      {/* RIGHT: KNOWLEDGE EXPLORER / DOCUMENT VIEW */}
      <div className="flex-1 flex flex-col space-y-6">
        <div className="glass-card flex-1 p-12 rounded-[3.5rem] border-slate-800/50 shadow-2xl relative overflow-hidden flex flex-col bg-slate-900/20">
          {activeSource ? (
            <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-500">
               <header className="flex items-center justify-between mb-10 pb-6 border-b border-slate-800">
                  <div>
                    <h1 className="text-3xl font-outfit font-black text-white uppercase tracking-tighter italic">{activeSource.title}</h1>
                    <div className="flex items-center space-x-4 mt-2">
                       <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">{activeSource.type} Node</span>
                       {activeSource.metadata?.url && <a href={activeSource.metadata.url} target="_blank" className="text-[10px] text-indigo-400 font-black uppercase tracking-widest hover:underline">Link Source</a>}
                       <span className="text-[10px] font-bold text-slate-500 uppercase">{activeSource.metadata?.wordCount} Words Archived</span>
                    </div>
                  </div>
               </header>
               
               <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-10">
                  <section className="p-8 bg-indigo-600/5 border border-indigo-500/20 rounded-[2.5rem] relative">
                     <div className="absolute -top-3 -left-3 px-4 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest">Logic Synthesis</div>
                     <h3 className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Neural Overview</h3>
                     <p className="text-slate-200 text-lg leading-relaxed font-medium italic">"{activeSource.metadata?.summary}"</p>
                  </section>

                  <section className="prose prose-invert max-w-none">
                     <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mb-8">Full Source Content</h3>
                     <div className="whitespace-pre-wrap text-slate-300 font-mono text-sm leading-relaxed bg-slate-950/40 p-8 rounded-3xl border border-slate-800/50">
                        {activeSource.content}
                     </div>
                  </section>
               </div>
            </div>
          ) : guideSummary ? (
            <div className="flex flex-col h-full animate-in zoom-in-95 duration-500">
               <header className="mb-12">
                  <h1 className="text-4xl font-outfit font-black text-white uppercase tracking-tighter italic">Notebook <span className="text-orange-500">Guide</span></h1>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">Synthesized cross-source intelligence substrate</p>
               </header>
               <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 whitespace-pre-wrap text-slate-100 text-lg leading-relaxed font-medium font-outfit bg-slate-950/30 p-10 rounded-[3rem] border border-orange-500/10">
                  {guideSummary}
               </div>
               <button onClick={() => setGuideSummary(null)} className="mt-8 py-4 bg-slate-900 border border-slate-800 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">Close Neural Guide</button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 opacity-40">
               <div className="w-40 h-40 rounded-full border-4 border-dashed border-emerald-500/20 flex items-center justify-center">
                  <svg className="w-20 h-20 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5" /></svg>
               </div>
               <div>
                  <h2 className="text-2xl font-outfit font-black text-white uppercase tracking-tighter">Sovereign Knowledge Base</h2>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-4 max-w-md mx-auto leading-loose">
                    Persistent context blocks grounded in local memory.
                    Open the portal to inject sources or compact existing knowledge nodes.
                  </p>
                  <button 
                    onClick={() => setIsUploadPortalOpen(true)}
                    className="mt-12 px-10 py-5 bg-emerald-600 text-white rounded-full font-black uppercase text-[11px] tracking-widest shadow-xl animate-glow"
                  >
                    Open Upload Portal
                  </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notebook;
