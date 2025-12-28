
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onLogout: () => void;
  track: 'personal' | 'business';
  profile: { name: string, callsign: string, personality: string };
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, onLogout, track, profile }) => {
  const location = useLocation();

  const navItems = [
    { name: 'Quanta Core', icon: 'M13 10V3L4 14h7v7l9-11h-7z', path: '/' },
    { name: 'Neural Chat', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', path: '/chat' },
    { name: 'SME Council', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2', path: '/council' },
    { name: 'Sovereign Memory', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5', path: '/notebook' },
    { name: 'Visual Forge', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16', path: '/images' },
    { name: 'Process Flow', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2', path: '/tasks' },
  ];

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

        <nav className="flex-1 px-4 py-4 space-y-3 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isCouncil = item.name === 'SME Council';
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center p-3 rounded-xl transition-all group relative border ${
                  isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                    : isCouncil 
                      ? 'text-orange-400/70 hover:text-orange-400 border-orange-500/10 bg-orange-500/5'
                      : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'
                }`}
              >
                <svg className={`w-6 h-6 min-w-[24px] ${isActive ? 'text-emerald-400' : isCouncil ? 'text-orange-400' : 'text-slate-600 group-hover:text-emerald-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={item.icon} />
                </svg>
                {isOpen && <span className={`ml-4 font-bold text-sm tracking-wide uppercase transition-all whitespace-nowrap ${isCouncil ? 'text-orange-100' : ''}`}>{item.name}</span>}
                {isActive && isOpen && <div className="absolute right-3 w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_10px_#10b981]"></div>}
              </Link>
            );
          })}
        </nav>

        {/* Neural Protocol Highlight */}
        <div className={`mx-4 mb-4 p-4 rounded-2xl bg-mesh border border-emerald-500/20 transition-all ${!isOpen ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Logic Active</span>
          </div>
          <p className="text-[10px] font-black text-white uppercase tracking-tighter">FPT-Omega Engine</p>
          <div className="h-1 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-orange-500 w-3/4"></div>
          </div>
        </div>

        <div className="p-6 space-y-3 border-t border-slate-800/50">
          <div className={`glass-card rounded-2xl p-4 flex items-center ${!isOpen ? 'justify-center' : 'space-x-3'}`}>
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.callsign}`} alt="Profile" className="w-10 h-10 rounded-xl bg-slate-800 border border-emerald-500/20 shadow-lg shadow-emerald-500/10" />
            {isOpen && (
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate uppercase">{profile.callsign}</p>
                <p className="text-[9px] text-emerald-400 uppercase tracking-tighter font-black">Operator Prime</p>
              </div>
            )}
          </div>
          <button 
            onClick={onLogout}
            className={`w-full flex items-center p-3 rounded-xl text-slate-500 hover:bg-orange-500/10 hover:text-orange-400 transition-all ${!isOpen ? 'justify-center' : ''}`}
          >
            <svg className="w-6 h-6 min-w-[24px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m4 4H7m6 4v1a3 3 0 01-3 3" /></svg>
            {isOpen && <span className="ml-4 font-bold text-sm tracking-wide uppercase">De-sync</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
