
import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskAttachment } from '../types';
import { optimizeTasks } from '../services/geminiService';
import { uploadToBucket, formatBytes } from '../services/storageBucketService';

const COVERS = [
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=2070&auto=format&fit=crop', // Abstract Neon
  'https://images.unsplash.com/photo-1620121692029-d088224ddc74?q=80&w=2032&auto=format&fit=crop', // Gradient
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop', // Space
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop', // Cyber
];

const TaskBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // File Input Ref
  const bucketInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('quanta_tasks_v2');
    if (saved) {
      setTasks(JSON.parse(saved));
    } else {
      // Seed Data
      const initial: Task[] = [
        { 
          id: '1', 
          title: 'Q3 Macro Strategy', 
          status: 'in-progress', 
          priority: 'high', 
          category: 'Strategy', 
          timestamp: Date.now(),
          icon: '📈',
          coverImage: COVERS[0],
          description: 'Analyze yield curve inversion and crypto correlation.',
          content: '## Objective\nDetermine exposure adjustment for upcoming FOMC meeting.\n\n- [ ] Review Bond Yields\n- [ ] Check BTC/ETH Correlation\n- [ ] Update Risk Parity Model',
          attachments: []
        },
        { 
          id: '2', 
          title: 'Neural Network Optimization', 
          status: 'todo', 
          priority: 'medium', 
          category: 'Engineering', 
          timestamp: Date.now(),
          icon: '🧠',
          description: 'Refine FPT-Omega logic gates.',
          content: 'We need to reduce the latency in the First Principles Engine.\n\nCurrent bottleneck: Axiom verification step.',
          attachments: []
        },
      ];
      setTasks(initial);
    }
  }, []);

  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('quanta_tasks_v2', JSON.stringify(tasks));
    }
  }, [tasks]);

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    if (activeTask && activeTask.id === id) {
      setActiveTask(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleAddNew = (status: Task['status']) => {
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'Untitled Page',
      status,
      priority: 'medium',
      category: 'General',
      timestamp: Date.now(),
      icon: '📄',
      attachments: []
    };
    setTasks([...tasks, newTask]);
    setActiveTask(newTask);
  };

  const handleOptimize = async () => {
    if (tasks.length === 0 || isOptimizing) return;
    setIsOptimizing(true);
    try {
      const titles = tasks.filter(t => t.status !== 'done').map(t => t.title);
      const suggestions = await optimizeTasks(titles);
      setSuggestions(suggestions);
    } catch (error) {
      console.error(error);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !activeTask) return;
    setIsUploading(true);
    const newAttachments: TaskAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const attachment = await uploadToBucket(file);
        newAttachments.push(attachment);
      } catch (e) {
        console.error("Upload failed", e);
      }
    }

    updateTask(activeTask.id, { attachments: [...activeTask.attachments, ...newAttachments] });
    setIsUploading(false);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: Task['status']) => {
    e.preventDefault();
    if (draggedTaskId) {
      updateTask(draggedTaskId, { status });
      setDraggedTaskId(null);
    }
  };

  const renderColumn = (status: Task['status'], label: string) => {
    const colTasks = tasks.filter(t => t.status === status);
    return (
      <div 
        className="flex-1 min-w-[300px] flex flex-col h-full bg-[#050505]/50 border-r border-slate-800/50 last:border-r-0"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(e, status)}
      >
        <div className="p-4 flex items-center justify-between border-b border-slate-800/50">
          <div className="flex items-center space-x-2">
            <span className={`w-2 h-2 rounded-full ${status === 'todo' ? 'bg-slate-500' : status === 'in-progress' ? 'bg-orange-500' : 'bg-emerald-500'}`}></span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
            <span className="text-[10px] text-slate-600 font-mono ml-2">{colTasks.length}</span>
          </div>
          <button onClick={() => handleAddNew(status)} className="text-slate-500 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
        
        <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">
          {colTasks.map(task => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => handleDragStart(e, task.id)}
              onClick={() => setActiveTask(task)}
              className={`group bg-slate-900 border border-slate-800 rounded-xl p-3 cursor-pointer hover:bg-slate-800 transition-all shadow-sm hover:shadow-lg active:scale-[0.98] ${draggedTaskId === task.id ? 'opacity-50' : ''}`}
            >
              {task.coverImage && (
                <div className="h-20 w-full rounded-lg mb-3 overflow-hidden">
                  <img src={task.coverImage} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="cover" />
                </div>
              )}
              <div className="flex items-start space-x-2">
                <span className="text-lg">{task.icon || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm text-slate-200 font-medium truncate">{task.title}</h4>
                  {task.category && <span className="text-[9px] text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded uppercase tracking-wider">{task.category}</span>}
                </div>
              </div>
            </div>
          ))}
          <button 
            onClick={() => handleAddNew(status)}
            className="w-full py-2 flex items-center justify-center text-[10px] text-slate-600 hover:text-slate-400 hover:bg-slate-900/50 rounded-lg transition-all"
          >
            + New
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-140px)] animate-in fade-in duration-700 flex flex-col">
      <header className="flex items-center justify-between px-8 py-6 border-b border-slate-800 bg-[#020617]">
        <div>
          <div className="flex items-center space-x-3 mb-1">
             <div className="p-1.5 bg-orange-500/10 rounded-lg">
                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
             </div>
             <h1 className="text-xl font-outfit font-black text-white uppercase tracking-tight">Process Flow</h1>
          </div>
          <p className="text-[10px] text-slate-500 font-mono ml-10">Workspace / Strategy Board</p>
        </div>
        <div className="flex space-x-4">
          <button 
            onClick={handleOptimize}
            disabled={isOptimizing}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg hover:text-white hover:border-orange-500/50 text-[10px] font-black uppercase tracking-widest transition-all"
          >
            {isOptimizing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            <span>Optimize Flow</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {renderColumn('todo', 'Not Started')}
        {renderColumn('in-progress', 'In Execution')}
        {renderColumn('done', 'Completed')}
      </div>

      {suggestions.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-orange-500/30 p-6 rounded-2xl shadow-2xl max-w-lg w-full animate-in slide-in-from-bottom-10 z-40">
           <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">AI Optimization Suggestion</span>
              <button onClick={() => setSuggestions([])} className="text-slate-500 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
           </div>
           <ul className="space-y-2">
             {suggestions.map((s, i) => (
               <li key={i} className="text-xs text-slate-300 font-medium flex items-start space-x-2">
                 <span className="text-orange-500">•</span>
                 <span>{s}</span>
               </li>
             ))}
           </ul>
        </div>
      )}

      {/* NOTION STYLE MODAL */}
      {activeTask && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex justify-center overflow-hidden" onClick={() => setActiveTask(null)}>
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl bg-[#0a0a0a] h-full shadow-2xl border-x border-slate-800 animate-in slide-in-from-bottom-10 duration-300 flex flex-col"
          >
            {/* Cover Image */}
            <div className="h-48 w-full bg-slate-900 relative group shrink-0">
              {activeTask.coverImage ? (
                <img src={activeTask.coverImage} className="w-full h-full object-cover" alt="cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-700 text-xs font-bold uppercase tracking-widest">No Cover</div>
              )}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-2 rounded-lg backdrop-blur-md">
                <button onClick={() => updateTask(activeTask.id, { coverImage: COVERS[Math.floor(Math.random()*COVERS.length)] })} className="text-[10px] font-bold text-white hover:text-orange-400">Change Cover</button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="max-w-3xl mx-auto px-12 py-10">
                {/* Icon & Title */}
                <div className="-mt-20 mb-8 relative">
                  <div className="text-6xl mb-4 drop-shadow-lg cursor-pointer hover:scale-110 transition-transform origin-bottom-left inline-block" onClick={() => updateTask(activeTask.id, { icon: ['📄','📈','🧠','🚀','💎'][Math.floor(Math.random()*5)] })}>
                    {activeTask.icon}
                  </div>
                  <input 
                    value={activeTask.title} 
                    onChange={(e) => updateTask(activeTask.id, { title: e.target.value })}
                    className="w-full bg-transparent text-4xl font-bold text-white placeholder-slate-600 outline-none font-outfit"
                    placeholder="Untitled"
                  />
                </div>

                {/* Properties Grid */}
                <div className="grid grid-cols-[120px_1fr] gap-y-4 gap-x-4 mb-10 text-sm">
                  <div className="text-slate-500 font-medium flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Status</span>
                  </div>
                  <div>
                    <select 
                      value={activeTask.status} 
                      onChange={(e) => updateTask(activeTask.id, { status: e.target.value as any })}
                      className="bg-slate-900 border border-slate-800 text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors outline-none"
                    >
                      <option value="todo">Not Started</option>
                      <option value="in-progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>

                  <div className="text-slate-500 font-medium flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                    <span>Category</span>
                  </div>
                  <div>
                    <input 
                      value={activeTask.category} 
                      onChange={(e) => updateTask(activeTask.id, { category: e.target.value })}
                      className="bg-transparent text-white border-b border-transparent hover:border-slate-700 focus:border-orange-500 outline-none px-1"
                    />
                  </div>
                </div>

                <div className="h-px bg-slate-800 w-full mb-8"></div>

                {/* Markdown Editor Area */}
                <textarea 
                  value={activeTask.content || ''} 
                  onChange={(e) => updateTask(activeTask.id, { content: e.target.value })}
                  placeholder="Type '/' for commands..." 
                  className="w-full h-[300px] bg-transparent text-slate-300 text-lg leading-relaxed outline-none resize-none placeholder-slate-700"
                />

                {/* Big Storage Bucket (S3/Local) */}
                <div className="mt-12 pt-12 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                      <span>Storage Bucket (Local + S3)</span>
                    </h3>
                    <div className="text-[9px] text-slate-600 uppercase tracking-widest">
                      {activeTask.attachments.length} Objects &bull; {formatBytes(activeTask.attachments.reduce((acc, curr) => acc + curr.size, 0))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {activeTask.attachments.map(file => (
                      <div key={file.id} className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800 rounded-xl group hover:border-slate-700 transition-all">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-xs uppercase">
                            {file.type.split('/')[1] || 'FILE'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white truncate max-w-[200px]">{file.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{formatBytes(file.size)} &bull; {file.synced ? 'S3 Synced' : 'Local Only'}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                           <span className="text-[9px] font-mono text-emerald-500/50 border border-emerald-500/20 px-2 py-1 rounded bg-emerald-500/5">{file.s3Url}</span>
                           <a href={file.localUrl} download={file.name} className="p-2 text-slate-500 hover:text-white transition-colors">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                           </a>
                        </div>
                      </div>
                    ))}

                    <div 
                      onClick={() => bucketInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-slate-600 hover:text-orange-500 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all cursor-pointer"
                    >
                      <input type="file" ref={bucketInputRef} className="hidden" multiple onChange={(e) => handleFileUpload(e.target.files)} />
                      {isUploading ? (
                        <div className="flex flex-col items-center animate-pulse">
                          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                          <span className="text-[10px] font-black uppercase tracking-widest">Replicating to Bucket...</span>
                        </div>
                      ) : (
                        <>
                          <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                          <span className="text-[10px] font-black uppercase tracking-widest">Upload to Big Storage</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskBoard;
