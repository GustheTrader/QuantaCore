
import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import ImageGenerator from './components/ImageGenerator';
import TaskBoard from './components/TaskBoard';
import AuthPage from './components/AuthPage';
import ProfileSetup from './components/ProfileSetup';
import Notebook from './components/Notebook';
import { supabase, signOut } from './services/supabaseService';

// Error Boundary to catch and display rendering crashes
class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen bg-[#020617] flex flex-col items-center justify-center p-10 text-center">
          <h1 className="text-4xl font-outfit font-black text-white mb-4 uppercase tracking-tighter">Neural Link Severed</h1>
          <p className="text-slate-500 max-w-md mb-8 font-mono text-xs">{this.state.error?.message || "An unknown error occurred within the Quanta Core."}</p>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs"
          >
            Reset Neural Interface
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [session, setSession] = useState<{ email: string, track: 'personal' | 'business' } | null>(null);
  const [profile, setProfile] = useState<{ name: string, callsign: string, personality: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        // 1. Check Local Persistence First
        const storedSession = localStorage.getItem('quanta_session');
        if (storedSession && isMounted) {
          const parsed = JSON.parse(storedSession);
          setSession(parsed);
          const savedProfile = localStorage.getItem(`quanta_profile_${parsed.email}`);
          if (savedProfile) setProfile(JSON.parse(savedProfile));
        }

        // 2. Check Supabase (Critical for Magic Link redirects)
        const { data: { session: sbSession } } = await supabase.auth.getSession();
        if (sbSession && isMounted) {
          const userData = {
            email: sbSession.user.email || '',
            track: sbSession.user.user_metadata?.track || 'personal'
          };
          setSession(userData);
          const savedProfile = localStorage.getItem(`quanta_profile_${userData.email}`);
          if (savedProfile) setProfile(JSON.parse(savedProfile));
        }
      } catch (err) {
        console.error('Session restoration failed:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Listen for Auth changes (Magic Link success, Sign Out, etc)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sbSession) => {
      if (sbSession && isMounted) {
        const userData = {
          email: sbSession.user.email || '',
          track: sbSession.user.user_metadata?.track || 'personal'
        };
        setSession(userData);
        const savedProfile = localStorage.getItem(`quanta_profile_${userData.email}`);
        if (savedProfile) setProfile(JSON.parse(savedProfile));
        setLoading(false);
      }
    });

    checkSession();

    // Secondary fail-safe for loading screen
    const failSafe = setTimeout(() => {
      if (isMounted && loading) setLoading(false);
    }, 4000);

    return () => { 
      isMounted = false; 
      subscription.unsubscribe();
      clearTimeout(failSafe);
    };
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem('quanta_session');
    try {
      await signOut();
    } catch (e) {}
    setSession(null);
    setProfile(null);
    window.location.hash = '/';
    window.location.reload(); 
  };

  const handleProfileComplete = (profileData: { name: string, callsign: string, personality: string }) => {
    if (session) {
      localStorage.setItem(`quanta_profile_${session.email}`, JSON.stringify(profileData));
      setProfile(profileData);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl animate-pulse flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(99,102,241,0.4)]">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">Establishing Neural Connection...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <HashRouter>
        {!session ? (
          <AuthPage />
        ) : !profile ? (
          <ProfileSetup onComplete={handleProfileComplete} email={session.email} />
        ) : (
          <div className="flex h-screen bg-[#020617] text-gray-100 overflow-hidden selection:bg-indigo-500/30">
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} onLogout={handleLogout} track={session.track} profile={profile} />

            <main className={`flex-1 flex flex-col h-full transition-all duration-500 ease-in-out ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
              <div className="lg:hidden h-16 bg-[#020617]/80 backdrop-blur-xl border-b border-slate-800 flex items-center px-6 z-50">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                </button>
                <span className="ml-4 font-outfit font-black text-xl tracking-tighter quantum-gradient-text uppercase">QUANTA</span>
              </div>

              <div className="flex-1 overflow-y-auto p-6 lg:p-12">
                <div className="max-w-7xl mx-auto w-full h-full relative">
                  <Routes>
                    <Route path="/" element={<Dashboard track={session.track} profile={profile} />} />
                    <Route path="/chat" element={<ChatInterface profile={profile} />} />
                    <Route path="/images" element={<ImageGenerator />} />
                    <Route path="/tasks" element={<TaskBoard />} />
                    <Route path="/notebook" element={<Notebook />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </div>
              </div>
            </main>
          </div>
        )}
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;
