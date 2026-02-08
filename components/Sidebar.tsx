
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getCredits } from '../services/creditService';
import { UserCredits } from '../types';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onLogout: () => void;
  track: 'personal' | 'business' | 'trading';
  profile: { name: string, callsign: string, personality: string };
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, onLogout, track, profile }) => {
  const location = useLocation();
  const [provider, setProvider] = useState('Gemini');
  const [credits, setCredits] = useState<UserCredits>(getCredits());

  useEffect(() => {
    const saved = localStorage.getItem('quanta_preferred_provider');
    if (saved) setProvider(saved.charAt(0).toUpperCase() + saved.slice(1));
    
    const updateCredits = () => setCredits(getCredits());
    window.addEventListener('quanta_credits_updated', updateCredits);
    return () => window.removeEventListener('quanta_credits_updated', updateCredits);
  }, [location.pathname]);

  const navItems = [
    { name: 'Quanta Core', icon: 'M13 10V3L4 14h7v7l9-11h-7z', path: '/' },
    { name: 'Unified Gateway', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z', path: '/gateway' },
    { name: 'Neural Chat', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', path: '/chat' },
    { name: 'Personal Assistant', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z', path: '/assistant' },
    { name: 'Deep Agent', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', path: '/deep-agent' },
    { name: 'Deep Diver', icon: 'M19 14l-7 7m0 0l-7-7m7 7V3', path: '/deep-diver' },
    { name: 'Agent Zero', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4', path: '/agent-zero' },
    { name: 'Edge Mech Network', icon: 'M13 10V3L4 14h7v7l9-11h-7z', path: '/edge-mech' }, // Reusing bolt icon but will style red
    { name: 'SME Council', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2', path: '/council' },
    { name: 'Projects', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 v2M7 7h10', path: '/projects' },
    { name: 'Sovereign Knowledge', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5', path: '/notebook' },
    { name: 'Visual Forge', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16', path: '/images' },
    { name: 'Cinematic Forge', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', path: '/videos' },
    { name: 'Process Flow', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2', path: '/tasks' },
  ];

  const renderNavLink = (item: { name: string, icon: string, path: string }) => {
    const isActive = location.pathname === item.path;
    const isOrange = ['SME Council', 'Projects', 'Deep Agent', 'Deep Diver', 'Neural Settings', 'MCP Connectors', 'Cinematic Forge', 'Agent Zero', 'Personal Assistant', 'Unified Gateway'].includes(item.name);
    const isCyan = item.name === 'Deep Diver';
    const isRed = item.name === 'Edge Mech Network';
    const isAssistant = item.name === 'Personal Assistant';
    
    // Default Styling
    let activeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]';
    let iconClass = 'text-emerald-400';
    let dotClass = 'bg-emerald-400';
    let textHoverClass = 'group-hover:text-emerald-400';

    if (isCyan) {
        activeClass = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]';
        iconClass = 'text-cyan-400';
        dotClass = 'bg-cyan-400';
    } else if (isAssistant) {
        activeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.1)]';
        iconClass = 'text-rose-400';
        dotClass = 'bg-rose-400';
    } else if (isRed) {
        activeClass = 'bg-red-600/10 text-red-500 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.15)]';
        iconClass = 'text-red-500';
        dotClass = 'bg-red-500';
        textHoverClass = 'group-hover:text-red-500';
    } else if (isOrange) {
        activeClass = 'text-orange-400 border-orange-500/10 bg-orange-500/5';
        iconClass = 'text-orange-400';
    }

    return (
      <Link
        key={item.name}
        to={item.path}
        className={`flex items-center p-2.5 rounded-xl transition-all group relative border ${
          isActive 
            ? activeClass
            : isRed 
              ? 'text-red-900/70 hover:text-red-500 border-transparent hover:bg-red-900/10'
              : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'
        }`}
      >
        <svg className={`w-5 h-5 min-w-[20px] ${isActive ? iconClass : isRed ? 'text-red-900/80 group-hover:text-red-500' : 'text-slate-600 ' + textHoverClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={item.icon} />
        </svg>
        {isOpen && <span className={`ml-3 font-black text-[11px] tracking-[0.1em] uppercase transition-all whitespace-nowrap ${isRed && !isActive ? 'text-red-900 group-hover:text-red-500' : ''}`}>{item.name}</span>}
        {isActive && isOpen && <div className={`absolute right-2.5 w-1 h-1 rounded-full shadow-[0_0_8px_currentColor] ${dotClass}`}></div>}
      </Link>
    );
  };

  return (
    <aside 
      className={`fixed top-0 left-0 h-full bg-[#020617] border-r border-emerald-500/10 z-[60] transition-all duration-500 
      ${isOpen ? 'w-64 translate-x-0 shadow-[20px_0_60px_rgba(0,0,0,0.8)]' : 'w-20 lg:translate-x-0 -translate-x-full'}`}
    >
      <div className="flex flex-col h-full">
        <div className="p-8 flex items-center justify-between">
          <Link to="/" className={`font-outfit font-black text-2xl tracking-tighter quantum-gradient-text transition-opacity ${!isOpen && 'lg:opacity-0'}`}>
            QUANTA
          </Link>
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className="hidden lg:flex w-8 h-8 items-center justify-center hover:bg-slate-800 rounded-lg text-emerald-400 transition-colors"
          >
            <svg className={`w-5 h-5 transition-transform duration-500 ${isOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map(renderNavLink)}
        </nav>

        {/* Credit Indicators */}
        <div className={`px-4 py-4 space-y-3 transition-all ${!isOpen ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-emerald-500/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[7px] font-black text-emerald-500/80 uppercase tracking-widest">Cloud IQ</span>
              <span className="text-[8px] font-bold text-white">{credits.cloudTokens.toLocaleString()}</span>
            </div>
            <div className="h-0.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 shadow-[0_0_8px_#10b981]" style={{ width: `${(credits.cloudTokens / 10000) * 100}%` }}></div>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-orange-500/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[7px] font-black text-orange-500/80 uppercase tracking-widest">Deep Agent</span>
              <span className="text-[8px] font-bold text-white">{credits.deepAgentTokens.toLocaleString()}</span>
            </div>
            <div className="h-0.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 shadow-[0_0_8px_#f97316]" style={{ width: `${(credits.deepAgentTokens / 5000) * 100}%` }}></div>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-indigo-500/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">Visual Energy</span>
              <span className="text-[8px] font-bold text-white">{credits.visualEnergy.toLocaleString()}</span>
            </div>
            <div className="h-0.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 shadow-[0_0_8px_#6366f1]" style={{ width: `${(credits.visualEnergy / 2000) * 100}%` }}></div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-2 border-t border-slate-800/50">
          <div className={`glass-card rounded-2xl p-3 flex items-center ${!isOpen ? 'justify-center' : 'space-x-3'}`}>
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.callsign}`} alt="Profile" className="w-8 h-8 rounded-lg bg-slate-800 border border-emerald-500/20 shadow-lg" />
            {isOpen && (
              <div className="overflow-hidden">
                <p className="text-[10px] font-bold text-white truncate uppercase">{profile.callsign}</p>
                <p className="text-[8px] text-emerald-400 uppercase tracking-tighter font-black">{track.toUpperCase()} LINK</p>
              </div>
            )}
          </div>

          <div className="space-y-1">
            {renderNavLink({ 
              name: 'Neural Settings', 
              icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 
              path: '/settings' 
            })}
          </div>

          <button 
            onClick={onLogout}
            className={`w-full flex items-center p-2 rounded-xl text-slate-500 hover:bg-orange-500/10 hover:text-orange-400 transition-all ${!isOpen ? 'justify-center' : ''}`}
          >
            <svg className="w-5 h-5 min-w-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m4 4H7m6 4v1a3 3 0 01-3 3" /></svg>
            {isOpen && <span className="ml-3 font-bold text-[11px] tracking-wide uppercase">De-sync</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
