
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { NeuralProject, ProjectChat, ProjectFile, ChatMessage } from '../types';
import { exportToBrowser } from '../services/utils';
import { chatWithSME } from '../services/geminiService';
import { syncProjectsToSupabase, fetchProjectsFromSupabase } from '../services/supabaseService';
import { ConfirmationModal } from './ConfirmationModal';

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<NeuralProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, type: 'project' | 'file', id?: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadProjects = async () => {
      // Try Supabase first
      const remote = await fetchProjectsFromSupabase();
      if (remote) {
        setProjects(remote);
        localStorage.setItem('quanta_projects_v2', JSON.stringify(remote));
      } else {
        const saved = localStorage.getItem('quanta_projects_v2');
        if (saved) {
          setProjects(JSON.parse(saved));
        } else {
          // Migrate legacy if exists or start fresh
          const legacy = localStorage.getItem('quanta_projects');
          if (legacy) {
            const migrated = JSON.parse(legacy).map((p: any) => ({
              ...p,
              customInstructions: '',
              files: [],
              chats: p.ideas?.map((idea: string, i: number) => ({
                id: `chat_${i}`,
                title: idea.substring(0, 30),
                lastActive: Date.now(),
                messages: [{ role: 'user', content: idea, timestamp: Date.now() }]
              })) || []
            }));
            setProjects(migrated);
            localStorage.setItem('quanta_projects_v2', JSON.stringify(migrated));
          }
        }
      }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem('quanta_projects_v2', JSON.stringify(projects));
      syncProjectsToSupabase(projects);
    }
  }, [projects]);

  const activeProject = projects.find(p => p.id === activeProjectId);

  const createProject = (title: string, desc: string) => {
    const newProj: NeuralProject = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      description: desc,
      status: 'active',
      customInstructions: '',
      files: [],
      chats: [],
      skills: [],
      ideas: [],
      createdAt: Date.now()
    };
    setProjects([newProj, ...projects]);
    setActiveProjectId(newProj.id);
    setIsAddingProject(false);
  };

  const processFiles = (files: File[]) => {
    if (!activeProjectId) return;
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        const newFile: ProjectFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          content: content
        };
        setProjects(prev => prev.map(p => 
          p.id === activeProjectId ? { ...p, files: [...p.files, newFile] } : p
        ));
      };
      
      // Handle images as Data URL, everything else as Text for context ingestion
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !activeProjectId) return;
    processFiles(Array.from(e.target.files));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleTransmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !activeProject || isProcessing) return;

    setIsProcessing(true);
    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: Date.now() };
    
    const fileContext = activeProject.files.map(f => `[FILE: ${f.name}]\n${f.content.substring(0, 10000)}... (truncated)`).join('\n\n');
    const systemInstruction = `${activeProject.customInstructions}\n\nProject Context:\n${activeProject.description}\n\nAttached Data:\n${fileContext}`;

    try {
      const response = await chatWithSME(
        input, 
        [], 
        activeProject.title, 
        systemInstruction, 
        searchEnabled ? ['search'] : []
      );

      const modelMsg: ChatMessage = { role: 'model', content: response.text, timestamp: Date.now(), sources: response.sources };
      
      const newChat: ProjectChat = {
        id: Math.random().toString(36).substr(2, 9),
        title: input.substring(0, 40),
        lastActive: Date.now(),
        messages: [userMsg, modelMsg]
      };

      setProjects(prev => prev.map(p => 
        p.id === activeProjectId ? { ...p, chats: [newChat, ...p.chats] } : p
      ));
      setInput('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) return 'IMG';
    if (ext === 'pdf') return 'PDF';
    if (['doc', 'docx'].includes(ext || '')) return 'DOC';
    return 'TXT';
  };

  return (
    <div className="min-h-screen animate-in fade-in duration-700">
      {!activeProject ? (
        <div className="max-w-4xl mx-auto pt-20">
          <header className="mb-16 text-center">
            <h1 className="text-6xl font-outfit font-black text-white uppercase tracking-tighter mb-4 italic">Neural <span className="quantum-gradient-text">Project Hub</span></h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px]">Select a cognitive track or initialize new logic</p>
          </header>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <button 
              onClick={() => setIsAddingProject(true)}
              className="glass-card p-12 rounded-[3.5rem] border-2 border-dashed border-orange-500/30 hover:border-orange-500/60 hover:bg-orange-500/5 transition-all group flex flex-col items-center justify-center text-center h-80"
            >
              <div className="w-16 h-16 rounded-2xl bg-orange-600/20 text-orange-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
              </div>
              <h3 className="text-2xl font-outfit font-black text-white uppercase tracking-tighter italic">Initialize Forge</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Forge specialized SME workspace</p>
            </button>

            {projects.map(p => (
              <button 
                key={p.id}
                onClick={() => setActiveProjectId(p.id)}
                className="glass-card p-10 rounded-[3.5rem] border-orange-500/20 hover:border-orange-500/50 transition-all text-left flex flex-col justify-between group h-80 overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-100 transition-opacity">
                   <span className="text-[8px] font-mono text-slate-500 uppercase">{p.id}</span>
                </div>
                <div>
                   <h3 className="text-3xl font-outfit font-black text-white uppercase tracking-tighter italic group-hover:text-orange-400 transition-colors">{p.title}</h3>
                   <p className="text-slate-500 text-[11px] font-bold uppercase tracking-[0.2em] mt-2 line-clamp-2">{p.description}</p>
                </div>
                <div className="flex space-x-4">
                   <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest">{p.chats.length} Chats</div>
                   <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest">{p.files.length} Context Files</div>
                </div>
              </button>
            ))}
          </div>

          {isAddingProject && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 animate-in zoom-in-95 duration-300">
               <div className="glass-card w-full max-w-xl rounded-[3rem] border-orange-500/30 overflow-hidden shadow-2xl">
                  <div className="p-10 border-b border-slate-800">
                    <h2 className="text-3xl font-outfit font-black text-white uppercase tracking-tighter italic">Project <span className="text-orange-500">Designation</span></h2>
                  </div>
                  <div className="p-10 space-y-8">
                     <div className="space-y-3">
                        <label className="text-orange-400 text-[10px] font-black uppercase tracking-[0.4em]">Project Name</label>
                        <input id="new-proj-title" placeholder="e.g. Q-Trading Alpha" className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-5 px-8 text-white font-bold outline-none focus:border-orange-500 transition-all" />
                     </div>
                     <div className="space-y-3">
                        <label className="text-orange-400 text-[10px] font-black uppercase tracking-[0.4em]">Briefing (Description)</label>
                        <textarea id="new-proj-desc" placeholder="Strategic objectives..." className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-5 px-8 text-white outline-none focus:border-orange-500 transition-all min-h-[120px]" />
                     </div>
                     <div className="flex space-x-4 pt-4">
                        <button onClick={() => setIsAddingProject(false)} className="flex-1 py-5 bg-slate-900 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Cancel</button>
                        <button 
                          onClick={() => {
                            const t = (document.getElementById('new-proj-title') as HTMLInputElement).value;
                            const d = (document.getElementById('new-proj-desc') as HTMLTextAreaElement).value;
                            if (t) createProject(t, d);
                          }}
                          className="flex-[2] py-5 quanta-btn-orange text-white rounded-2xl font-black uppercase text-[11px] shadow-2xl"
                        >
                          Initialize Forge
                        </button>
                     </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
               <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
               </div>
               <div>
                  <div className="flex items-center space-x-3">
                    <h2 className="text-4xl font-outfit font-black text-white uppercase tracking-tighter italic">Project: <span className="quantum-gradient-text">{activeProject.title}</span></h2>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => setDeleteModal({ isOpen: true, type: 'project', id: activeProject.id })}
                        className="text-slate-600 hover:text-rose-500 transition-colors p-2"
                        title="Delete Project"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                      <button onClick={() => setActiveProjectId(null)} className="text-slate-600 hover:text-white transition-colors p-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px] mt-1">{activeProject.description}</p>
               </div>
            </div>
          </div>

          {deleteModal && (
            <ConfirmationModal
              isOpen={deleteModal.isOpen}
              onClose={() => setDeleteModal(null)}
              onConfirm={() => {
                if (deleteModal.type === 'project') {
                  const updated = projects.filter(p => p.id !== deleteModal.id);
                  setProjects(updated);
                  setActiveProjectId(null);
                } else {
                  setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, files: p.files.filter(f => f.id !== deleteModal.id) } : p));
                }
              }}
              title={deleteModal.type === 'project' ? "Delete Project?" : "Delete File?"}
              message={deleteModal.type === 'project' ? "This will permanently erase the project and all associated data." : "This file will be removed from the project context."}
              confirmLabel="Delete"
              isDestructive={true}
            />
          )}

          {/* Central Input Block */}
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="glass-card rounded-[2.5rem] p-8 shadow-2xl border-orange-500/20 relative group">
               <textarea 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Write something for the project cortex..."
                  className="w-full bg-transparent border-none outline-none text-white text-xl font-medium placeholder-slate-600 min-h-[120px] resize-none"
               />
               <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center space-x-4">
                     <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-500 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                     </button>
                     <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                     <button 
                       onClick={() => setSearchEnabled(!searchEnabled)}
                       className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${searchEnabled ? 'bg-orange-500/20 text-orange-400' : 'text-slate-500 hover:bg-slate-800'}`}
                     >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                     </button>
                     <div className="h-6 w-px bg-slate-800"></div>
                     <div className="relative group/mode">
                        <button className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-800">
                           <span>Chat</span>
                           <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                     </div>
                  </div>
                  <div className="flex items-center space-x-4">
                     <button className="w-10 h-10 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-500 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7 7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                     </button>
                     <button 
                       onClick={handleTransmit}
                       disabled={isProcessing || !input.trim()}
                       className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isProcessing ? 'bg-slate-800 animate-pulse' : 'bg-white text-black hover:bg-orange-500 hover:text-white'}`}
                     >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                     </button>
                  </div>
               </div>
            </div>

            {/* Action Pills */}
            <div className="flex flex-wrap justify-center gap-3">
               {[
                 { label: 'Image', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01' },
                 { label: 'Code', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
                 { label: 'Playground', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z' },
                 { label: 'Powerpoint', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18v16H3V4z' },
                 { label: 'Deep Research', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
                 { label: 'More', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
               ].map((tool) => (
                 <button key={tool.label} className="flex items-center space-x-3 px-6 py-3 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 transition-all text-[11px] font-black uppercase tracking-widest shadow-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tool.icon} /></svg>
                    <span>{tool.label}</span>
                 </button>
               ))}
            </div>
          </div>

          {/* Sidebar & Dashboard Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-8">
            {/* Left: Chat History */}
            <div className="lg:col-span-4 space-y-6">
               <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                 <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Your chats in the project</h3>
               </div>
               <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-4">
                  {activeProject.chats.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-slate-800 rounded-3xl opacity-30">
                       <p className="text-[9px] font-black uppercase">No active logic tracks</p>
                    </div>
                  ) : (
                    activeProject.chats.map(chat => (
                      <div key={chat.id} className="p-6 glass-card rounded-[2rem] border-slate-800 hover:border-orange-500/30 transition-all group flex items-start justify-between">
                         <div>
                            <h4 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-orange-400 transition-colors">{chat.title}</h4>
                            <div className="flex items-center space-x-2 mt-2">
                               <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                               <span className="text-[8px] font-bold text-slate-600 uppercase">{new Date(chat.lastActive).toLocaleDateString()}</span>
                            </div>
                         </div>
                         <button className="text-slate-700 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
                         </button>
                      </div>
                    ))
                  )}
               </div>
            </div>

            {/* Right: Controls & Data */}
            <div className="lg:col-span-8 space-y-8">
               {/* Custom Instructions */}
               <div className="glass-card p-10 rounded-[3rem] border-orange-500/20 bg-orange-500/5">
                  <div className="flex items-center justify-between mb-8">
                     <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-orange-400">
                           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                        </div>
                        <h3 className="text-xl font-outfit font-black text-white uppercase tracking-tighter italic">Custom Instructions</h3>
                     </div>
                     <button 
                       onClick={() => setIsEditingInstructions(!isEditingInstructions)}
                       className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 tracking-widest"
                     >
                       {isEditingInstructions ? 'Save' : 'Edit'}
                     </button>
                  </div>
                  {isEditingInstructions ? (
                    <textarea 
                       value={activeProject.customInstructions}
                       onChange={(e) => {
                         const val = e.target.value;
                         setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, customInstructions: val } : p));
                       }}
                       className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 text-slate-300 font-mono text-xs min-h-[150px] outline-none focus:border-orange-500 transition-all"
                       placeholder="Define specific high-edge angles, bankroll rules, or system constraints..."
                    />
                  ) : (
                    <p className="text-[11px] font-medium text-slate-500 leading-relaxed uppercase tracking-tighter italic min-h-[40px]">
                       {activeProject.customInstructions || "No active instruction kernel. Inject specialized SME behavioral logic here to guide all project chats."}
                    </p>
                  )}
               </div>

               {/* Project Files with Drop Zone */}
               <div 
                 className={`glass-card p-10 rounded-[3rem] border-slate-800/50 relative transition-all duration-300 ${isDragging ? 'border-emerald-500 bg-emerald-500/5 shadow-[0_0_50px_rgba(16,185,129,0.1)]' : ''}`}
                 onDragOver={handleDragOver}
                 onDragLeave={handleDragLeave}
                 onDrop={handleDrop}
               >
                  {isDragging && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 rounded-[3rem] backdrop-blur-sm animate-in fade-in duration-300">
                      <div className="text-center p-8 bg-slate-900 border border-emerald-500 rounded-3xl shadow-2xl">
                        <svg className="w-16 h-16 text-emerald-400 mx-auto mb-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        <p className="text-xl font-black text-white uppercase tracking-widest">Ingest Data</p>
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.2em] mt-2">All Formats Accepted</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-8">
                     <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400">
                           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </div>
                        <h3 className="text-xl font-outfit font-black text-white uppercase tracking-tighter italic">Project Files <span className="text-slate-600 ml-2">({activeProject.files.length} Items)</span></h3>
                     </div>
                     <button 
                       onClick={() => projectUploadRef.current?.click()}
                       className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 tracking-widest flex items-center space-x-2 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 transition-all hover:border-indigo-500/50"
                     >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                       <span>Upload</span>
                     </button>
                     <input type="file" ref={projectUploadRef} className="hidden" multiple onChange={(e) => e.target.files && processFiles(Array.from(e.target.files))} />
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-4">
                    {activeProject.files.length === 0 ? (
                      <div className="py-12 border-2 border-dashed border-slate-800 rounded-[2rem] text-center">
                         <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Drag & Drop Documents Here</p>
                      </div>
                    ) : (
                      activeProject.files.map(file => (
                        <div key={file.id} className="p-4 bg-slate-900/30 rounded-2xl flex items-center justify-between group hover:bg-slate-900/60 transition-all border border-transparent hover:border-indigo-500/20">
                           <div className="flex items-center space-x-5">
                              <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                                 <span className="text-[8px] font-black text-slate-500">{getFileIcon(file.name)}</span>
                              </div>
                              <div>
                                 <h4 className="text-[11px] font-black text-slate-300 uppercase truncate max-w-[300px]">{file.name}</h4>
                                 <p className="text-[8px] font-bold text-slate-600 uppercase mt-1">{formatSize(file.size)} &bull; Context Local</p>
                              </div>
                           </div>
                           <button 
                             onClick={() => setDeleteModal({ isOpen: true, type: 'file', id: file.id })}
                             className="text-slate-700 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                           >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862" /></svg>
                           </button>
                        </div>
                      ))
                    )}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
