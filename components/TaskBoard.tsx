
import React, { useState, useEffect } from 'react';
import { Task } from '../types';
import { optimizeTasks } from '../services/geminiService';

const TaskBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('General');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('quanta_tasks');
    if (saved) {
      setTasks(JSON.parse(saved));
    } else {
      const initial: Task[] = [
        { id: '1', title: 'Prepare quarterly strategy deck', status: 'todo', priority: 'high', category: 'Work', timestamp: Date.now() },
        { id: '2', title: 'Research new AI models', status: 'done', priority: 'medium', category: 'Study', timestamp: Date.now() },
        { id: '3', title: 'Email client feedback', status: 'in-progress', priority: 'medium', category: 'Work', timestamp: Date.now() },
      ];
      setTasks(initial);
      localStorage.setItem('quanta_tasks', JSON.stringify(initial));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('quanta_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTaskTitle,
      status: 'todo',
      priority: 'medium',
      category: newTaskCategory,
      timestamp: Date.now()
    };
    setTasks([newTask, ...tasks]);
    setNewTaskTitle('');
    setIsAdding(false);
  };

  const moveTask = (id: string, newStatus: Task['status']) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));
  };

  const removeTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
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

  const renderColumn = (status: Task['status'], title: string, colorClass: string) => {
    const columnTasks = tasks.filter(t => t.status === status);
    return (
      <div className="flex flex-col h-full min-w-[320px] bg-slate-900/40 rounded-[2.5rem] border border-slate-800/50 p-6">
        <div className="flex items-center justify-between mb-6 px-4">
          <div className="flex items-center space-x-3">
            <div className={`w-2 h-2 rounded-full ${colorClass} shadow-[0_0_10px_currentColor]`}></div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">{title}</h3>
          </div>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-800/50 px-3 py-1 rounded-lg">
            {columnTasks.length}
          </span>
        </div>
        
        <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
          {columnTasks.map((task) => (
            <div key={task.id} className="glass-card p-6 rounded-3xl border border-slate-800 hover:border-emerald-500/30 transition-all group animate-in slide-in-from-bottom-2 duration-300">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400/70 bg-emerald-500/5 px-2 py-1 rounded-md border border-emerald-500/10">
                  {task.category}
                </span>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => removeTask(task.id)} className="p-1.5 text-slate-600 hover:text-rose-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              
              <h4 className="text-white text-sm font-bold leading-relaxed mb-6 font-outfit uppercase tracking-tight">
                {task.title}
              </h4>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
                <div className="flex space-x-2">
                  {status !== 'todo' && (
                    <button 
                      onClick={() => moveTask(task.id, status === 'done' ? 'in-progress' : 'todo')}
                      className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-500 hover:text-white transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                  )}
                  {status !== 'done' && (
                    <button 
                      onClick={() => moveTask(task.id, status === 'todo' ? 'in-progress' : 'done')}
                      className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  )}
                </div>
                <div className={`text-[8px] font-black uppercase tracking-tighter ${
                  task.priority === 'high' ? 'text-rose-500' : task.priority === 'medium' ? 'text-orange-500' : 'text-emerald-500'
                }`}>
                  {task.priority} Priority
                </div>
              </div>
            </div>
          ))}
          {columnTasks.length === 0 && (
            <div className="py-12 text-center text-slate-700 border-2 border-dashed border-slate-800/50 rounded-3xl">
              <p className="text-[9px] font-black uppercase tracking-widest">No nodes in track</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-16">
        <div>
          <h1 className="text-6xl font-outfit font-black text-white uppercase tracking-tighter leading-none italic">
            Process <span className="quantum-gradient-text italic">Flow</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mt-4">Autonomous execution pipeline and logic tracking</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setIsAdding(true)}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] transition-all shadow-xl shadow-emerald-500/10 flex items-center space-x-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            <span>Initialize Node</span>
          </button>
          <button
            onClick={handleOptimize}
            disabled={isOptimizing}
            className="px-8 py-4 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-orange-500/50 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] transition-all shadow-lg flex items-center space-x-3"
          >
            {isOptimizing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            )}
            <span>AI Flow Sync</span>
          </button>
        </div>
      </header>

      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-6 animate-in zoom-in-95 duration-300">
          <div className="glass-card w-full max-w-xl rounded-[3rem] border-emerald-500/30 overflow-hidden shadow-2xl">
            <div className="p-10 border-b border-slate-800">
              <h2 className="text-3xl font-outfit font-black text-white uppercase tracking-tighter italic">Process <span className="text-emerald-400">Initialization</span></h2>
            </div>
            <form onSubmit={handleAddTask} className="p-10 space-y-8">
              <div className="space-y-3">
                <label className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em]">Node Description</label>
                <input 
                  autoFocus
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="What logic core needs tracking?" 
                  className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-5 px-8 text-white font-bold outline-none focus:border-emerald-500 transition-all" 
                />
              </div>
              <div className="space-y-3">
                <label className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em]">Functional Category</label>
                <select 
                  value={newTaskCategory}
                  onChange={(e) => setNewTaskCategory(e.target.value)}
                  className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-5 px-8 text-white font-bold outline-none focus:border-emerald-500 transition-all appearance-none"
                >
                  <option>General</option>
                  <option>Strategic</option>
                  <option>Technical</option>
                  <option>Capital</option>
                  <option>Personal</option>
                </select>
              </div>
              <div className="flex space-x-4 pt-4">
                <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-5 bg-slate-900 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Abort</button>
                <button type="submit" className="flex-[2] py-5 quanta-btn-primary text-white rounded-2xl font-black uppercase text-[11px] shadow-2xl">Initialize Node</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 min-h-[600px]">
        {renderColumn('todo', 'Input Backlog', 'bg-slate-500')}
        {renderColumn('in-progress', 'Neural Synthesis', 'bg-orange-500')}
        {renderColumn('done', 'Finalized Archive', 'bg-emerald-500')}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-20 glass-card p-12 rounded-[3.5rem] border-orange-500/20 bg-orange-500/5 animate-in slide-in-from-bottom-8 duration-700">
          <div className="flex items-center space-x-4 mb-10">
            <div className="w-10 h-10 rounded-xl bg-orange-600/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h2 className="text-2xl font-outfit font-black text-white uppercase tracking-tighter italic">AI Optimization <span className="text-orange-500">Protocol</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-start space-x-5 p-6 bg-black/40 rounded-[2rem] border border-orange-500/10 group hover:border-orange-500/30 transition-all">
                <div className="w-6 h-6 min-w-[24px] rounded-lg bg-orange-600 text-white flex items-center justify-center text-[10px] font-black">
                  {i + 1}
                </div>
                <p className="text-[13px] text-slate-300 font-medium leading-relaxed italic group-hover:text-white transition-colors">{s}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 pt-8 border-t border-orange-500/10 flex items-center justify-between">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">First Principles Optimization Active</p>
            <button onClick={() => setSuggestions([])} className="text-[9px] font-black text-orange-500 uppercase tracking-widest hover:text-white transition-all">Dismiss Trace</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskBoard;
