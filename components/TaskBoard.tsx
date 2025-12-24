
import React, { useState } from 'react';
import { Task } from '../types';
import { optimizeTasks } from '../services/geminiService';

const TaskBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', title: 'Prepare quarterly strategy deck', completed: false, priority: 'high', category: 'Work' },
    { id: '2', title: 'Research new AI models', completed: true, priority: 'medium', category: 'Study' },
    { id: '3', title: 'Email client feedback', completed: false, priority: 'medium', category: 'Work' },
  ]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTaskTitle,
      completed: false,
      priority: 'medium',
      category: 'General'
    };
    setTasks([newTask, ...tasks]);
    setNewTaskTitle('');
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const removeTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const handleOptimize = async () => {
    if (tasks.length === 0 || isOptimizing) return;
    setIsOptimizing(true);
    try {
      const titles = tasks.filter(t => !t.completed).map(t => t.title);
      const suggestions = await optimizeTasks(titles);
      setSuggestions(suggestions);
    } catch (error) {
      console.error(error);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-outfit font-bold">Task Management</h1>
          <p className="text-gray-400 mt-2">Manage your workflow and let AI optimize your productivity.</p>
        </div>
        <button
          onClick={handleOptimize}
          disabled={isOptimizing}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 text-white rounded-xl font-semibold transition-all shadow-lg flex items-center space-x-2"
        >
          {isOptimizing ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <span>AI Optimize Flow</span>
            </>
          )}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleAddTask} className="flex space-x-4">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <button type="submit" className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-all border border-gray-700">
              Add Task
            </button>
          </form>

          <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="divide-y divide-gray-800">
              {tasks.length === 0 ? (
                <div className="p-12 text-center text-gray-500">No tasks remaining. Time to relax?</div>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className={`group flex items-center p-6 transition-colors hover:bg-gray-800/50 ${task.completed ? 'opacity-50' : ''}`}>
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                        task.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-600 hover:border-indigo-400'
                      }`}
                    >
                      {task.completed && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <div className="ml-6 flex-1">
                      <p className={`text-lg font-medium ${task.completed ? 'line-through text-gray-500' : 'text-gray-100'}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center mt-1 space-x-3">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">{task.category}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                          task.priority === 'high' ? 'bg-red-500/10 text-red-400' : 
                          task.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-400' : 
                          'bg-green-500/10 text-green-400'
                        }`}>
                          {task.priority} Priority
                        </span>
                      </div>
                    </div>
                    <button onClick={() => removeTask(task.id)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-500 hover:text-red-400 transition-all">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-600/10 border border-indigo-500/20 p-6 rounded-3xl">
            <h2 className="text-xl font-outfit font-bold flex items-center space-x-3">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>AI Task Suggestions</span>
            </h2>
            <div className="mt-6 space-y-4">
              {suggestions.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Run optimization to see AI-driven flow suggestions.</p>
              ) : (
                suggestions.map((s, i) => (
                  <div key={i} className="flex items-start space-x-3 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                    <div className="w-5 h-5 min-w-[20px] rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-indigo-100">{s}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-3xl">
            <h3 className="font-bold mb-4">Productivity Tips</h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                <span>Focus on "Deep Work" for at least 90 minutes today.</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                <span>Try the 2-minute rule for small tasks.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskBoard;
