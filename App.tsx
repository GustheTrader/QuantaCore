
import React, { Component, useState, useEffect, ErrorInfo, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import DeepAgent from './components/DeepAgent';
import DeepDiverAgent from './components/DeepDiverAgent';
import AgentZero from './components/AgentZero';
import IronClawAgent from './components/IronClawAgent';
import EdgeMechNetwork from './components/EdgeMechNetwork';
import ImageGenerator from './components/ImageGenerator';
import VideoGenerator from './components/VideoGenerator';
import TaskBoard from './components/TaskBoard';
import AuthPage from './components/AuthPage';
import ProfileSetup from './components/ProfileSetup';
import Notebook from './components/Notebook';
import Council from './components/Council';
import Projects from './components/Projects';
import SMEBuilder from './components/SMEBuilder';
import PersistentMemory from './components/PersistentMemory';
import Settings from './components/Settings';
import MCPConnectors from './components/MCPConnectors';
import AgenticOS from './components/AgenticOS';
import HermesAgent from './components/HermesAgent';
import Gateway from './components/Gateway';
import { FloatingChatManager } from './components/FloatingChatManager';
import { useChatWindows } from './hooks/useChatWindows';
import { isSupabaseConfigured, supabase, signOut } from './services/supabaseService';
import type { UserTrack } from './types';
import AgentControlPlane from './components/AgentControlPlane';
import NeuralCoreConsole from './components/NeuralCoreConsole';
import CodingHarness from './components/CodingHarness';
import OpenMuseAgent from './components/OpenMuseAgent';
import QuantaCliTerminal from './components/QuantaCliTerminal';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  
  // Explicitly declaring props to resolve TS error 'Property props does not exist'
  public props: Readonly<ErrorBoundaryProps> & Readonly<{ children?: ReactNode }>;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical System Failure:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen bg-[#020617] flex flex-col items-center justify-center p-10 text-center">
          <div className="w-24 h-24 bg-rose-600/20 border border-rose-500/50 rounded-full flex items-center justify-center mb-8 animate-pulse">
            <svg className="w-12 h-12 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h1 className="text-4xl font-outfit font-black text-white mb-4 uppercase tracking-tighter">Neural Link Severed</h1>
          <p className="text-slate-500 max-w-md mb-8 font-mono text-xs leading-relaxed uppercase tracking-widest">{this.state.error?.message || "Internal Kernel Panic within Quanta-OS Engine."}</p>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl active:scale-95 transition-all"
          >
            Purge Memory & Reboot
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [session, setSession] = useState<{ email: string, track: UserTrack } | null>(null);
  const [profile, setProfile] = useState<{ name: string, callsign: string, personality: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const { windows, openChat, closeChat, toggleMinimize, focusWindow, addMessage } = useChatWindows();
  const openTerminal = () => {
    const url = new URL(window.location.href);
    url.hash = '/terminal';
    const popup = window.open(url.toString(), 'quanta-cli', 'popup=yes,width=960,height=700,resizable=yes,scrollbars=yes');
    if (popup) popup.focus();
    else setTerminalOpen(true);
  };

  useEffect(() => {
    if (import.meta.env.PROD) {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      let active = true;
      const applyAuthSession = (authSession: any) => {
        if (!active) return;
        const user = authSession?.user;
        if (!user?.id) {
          setSession(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        const allowedTracks: UserTrack[] = ['personal', 'consumer', 'business', 'trading', 'education', 'guest', 'investing', 'growth'];
        const requestedTrack = user.user_metadata?.track;
        const sessionEmail = user.email || user.user_metadata?.contact_email || `guest-${String(user.id).slice(0, 8)}@guest.invalid`;
        const nextSession = { email: String(sessionEmail).toLowerCase(), track: allowedTracks.includes(requestedTrack) ? requestedTrack as UserTrack : 'personal' as UserTrack };
        setSession(nextSession);
        try {
          const savedProfile = localStorage.getItem(`quanta_profile_${nextSession.email}`);
          setProfile(savedProfile ? JSON.parse(savedProfile) : null);
        } catch { setProfile(null); }
        setLoading(false);
      };
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, authSession: any) => applyAuthSession(authSession));
      supabase.auth.getSession().then(({ data }: any) => applyAuthSession(data.session)).catch(() => {
        if (active) { setSession(null); setLoading(false); }
      });
      return () => { active = false; subscription.unsubscribe(); };
    }

    const initApp = async () => {
      try {
        const storedSession = localStorage.getItem('quanta_session');
        if (storedSession) {
          const parsed = JSON.parse(storedSession);
          setSession(parsed);
          
          const savedProfile = localStorage.getItem(`quanta_profile_${parsed.email}`);
          if (savedProfile) {
            setProfile(JSON.parse(savedProfile));
          }
        }
      } catch (err) {
        console.error('Session restoration failed:', err);
      } finally {
          setTimeout(() => setLoading(false), 1200);
      }
    };

    initApp();
  }, []);

  const handleLogin = (userData: { email: string, track: UserTrack }) => {
    localStorage.setItem('quanta_session', JSON.stringify(userData));
    setSession(userData);
    window.location.hash = '/';
    const savedProfile = localStorage.getItem(`quanta_profile_${userData.email}`);
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    }
  };

  const handleActivateAgent = (track: UserTrack) => {
    if (!session) return;
    const nextSession = { ...session, track };
    localStorage.setItem('quanta_session', JSON.stringify(nextSession));
    setSession(nextSession);
    window.location.hash = track === 'personal' || track === 'consumer' ? `/openmuse?agent=${track}` : '/agent?mode=work';
  };

  const handleLogout = async () => {
    localStorage.removeItem('quanta_session');
    setSession(null);
    setProfile(null);
    try {
      await signOut();
    } catch (e) {}
    window.location.hash = '/';
  };

  const handleProfileComplete = (profileData: { name: string, callsign: string, personality: string }) => {
    if (session) {
      localStorage.setItem(`quanta_profile_${session.email}`, JSON.stringify(profileData));
      setProfile(profileData);
      window.location.hash = '/';
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] animate-pulse flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(99,102,241,0.5)]">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="flex flex-col items-center space-y-2">
          <p className="text-slate-500 font-black uppercase tracking-[0.5em] text-[10px] italic">Synchronizing Quanta-OS Core...</p>
          <div className="w-32 h-0.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 animate-[loading_2s_ease-in-out_infinite]"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <HashRouter>
        {!session ? (
          <AuthPage onLogin={handleLogin} />
        ) : !profile ? (
          <ProfileSetup onComplete={handleProfileComplete} email={session.email} track={session.track} />
        ) : (
          <>
          <Routes>
            <Route path="/terminal" element={<QuantaCliTerminal standalone />} />
            <Route path="/agent" element={<AgentControlPlane track={session.track} profile={profile} email={session.email} onActivateAgent={handleActivateAgent} onOpenTerminal={openTerminal} />} />
            <Route path="*" element={<div className="flex h-screen bg-[#020617] text-gray-100 overflow-hidden selection:bg-indigo-500/30">
            <Sidebar 
              isOpen={isSidebarOpen} 
              setIsOpen={setIsSidebarOpen} 
              onLogout={handleLogout} 
              track={session.track} 
              profile={profile} 
              onOpenChat={openChat}
              onOpenTerminal={openTerminal}
            />
            <main className={`flex-1 flex flex-col h-full transition-all duration-500 ease-in-out ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
              <div className="lg:hidden h-20 bg-[#020617]/95 backdrop-blur-xl border-b border-slate-800 flex items-center px-8 z-50">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                </button>
                <span className="ml-4 font-outfit font-black text-2xl tracking-tighter quantum-gradient-text uppercase italic">QUANTA-OS AGENTS</span>
              </div>
              <div className="flex-1 overflow-y-auto p-6 lg:p-14 custom-scrollbar">
                <div className="max-w-7xl mx-auto w-full h-full relative">
                  <Routes>
                    <Route path="/" element={<Dashboard track={session.track} profile={profile} onOpenChat={openChat} onActivateAgent={handleActivateAgent} onOpenTerminal={openTerminal} />} />
                    <Route path="/coding-harness" element={<CodingHarness onOpenTerminal={openTerminal} />} />
                    <Route path="/openmuse" element={<OpenMuseAgent track={session.track} onActivateAgent={handleActivateAgent} />} />
                    <Route path="/chat" element={<ChatInterface profile={profile} />} />
                    <Route path="/neural-core" element={<NeuralCoreConsole />} />
                    <Route path="/gateway" element={<Gateway />} />
                    <Route path="/agentic-os" element={<AgenticOS profile={profile} onOpenChat={openChat} />} />
                    <Route path="/hermes" element={<HermesAgent profile={profile} onOpenChat={openChat} />} />
                    <Route path="/deep-agent" element={<DeepAgent />} />
                    <Route path="/deep-diver" element={<DeepDiverAgent />} />
                    <Route path="/agent-zero" element={<AgentZero profile={profile} onOpenChat={openChat} />} />
                    <Route path="/iron-claw" element={<IronClawAgent />} />
                    <Route path="/edge-mech" element={<EdgeMechNetwork />} />
                    <Route path="/council" element={<Council />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/mcp" element={<MCPConnectors />} />
                    <Route path="/images" element={<ImageGenerator />} />
                    <Route path="/videos" element={<VideoGenerator />} />
                    <Route path="/tasks" element={<TaskBoard />} />
                    <Route path="/notebook" element={<Notebook />} />
                    <Route path="/sme-builder" element={<SMEBuilder />} />
                    <Route path="/memory" element={<PersistentMemory />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </div>
              </div>
            </main>
            <FloatingChatManager windows={windows} onClose={closeChat} onMinimize={toggleMinimize} onFocus={focusWindow} onAddMessage={addMessage} profile={profile} />
          </div>} />
          </Routes>
          {terminalOpen && <QuantaCliTerminal onClose={() => setTerminalOpen(false)} />}
          </>
        )}
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;
