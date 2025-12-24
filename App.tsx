
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import ImageGenerator from './components/ImageGenerator';
import TaskBoard from './components/TaskBoard';
import AuthPage from './components/AuthPage';
import Notebook from './components/Notebook';
import { supabase, signOut } from './services/supabaseService';

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [session, setSession] = useState<{ email: string, track: 'personal' | 'business' } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession({
          email: session.user.email || '',
          track: session.user.user_metadata.track || 'personal'
        });
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession({
          email: session.user.email || '',
          track: session.user.user_metadata.track || 'personal'
        });
      } else {
        setSession(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut();
    setSession(null);
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl animate-pulse flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">Synchronizing Neural Core...</p>
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  return (
    <HashRouter>
      <div className="flex h-screen bg-[#020617] text-gray-100 overflow-hidden selection:bg-indigo-500/30">
        <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#020617]/80 backdrop-blur-xl border-b border-slate-800 flex items-center px-6 z-50">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
          <span className="ml-4 font-outfit font-black text-xl tracking-tighter quantum-gradient-text uppercase">QUANTA</span>
        </div>

        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} onLogout={handleLogout} track={session.track} />

        <main className={`flex-1 flex flex-col h-full transition-all duration-500 ease-in-out ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
          <div className="flex-1 overflow-y-auto p-6 lg:p-12 mt-16 lg:mt-0">
            <div className="max-w-7xl mx-auto w-full h-full relative">
              <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] -z-10 animate-pulse-slow"></div>
              <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-500/5 rounded-full blur-[100px] -z-10 animate-pulse-slow [animation-delay:2s]"></div>
              
              <Routes>
                <Route path="/" element={<Dashboard track={session.track} />} />
                <Route path="/chat" element={<ChatInterface />} />
                <Route path="/images" element={<ImageGenerator />} />
                <Route path="/tasks" element={<TaskBoard />} />
                <Route path="/notebook" element={<Notebook />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </div>
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
