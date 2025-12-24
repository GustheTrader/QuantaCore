
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onLogout: () => void;
  track: 'personal' | 'business';
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, onLogout, track }) => {
  const location = useLocation();

  const navItems = [
    { name: 'Quantum Core', icon: 'M13 10V3L4 14h7v7l9-11h-7z', path: '/' },
    { name: 'Neural Chat', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', path: '/chat' },
    { name: 'LM Notebook', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', path: '/notebook' },
    { name: 'Visual Forge', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', path: '/images' },
    { name: 'Process Flow', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', path: '/tasks' },
  ];

  return (
    <aside 
      className={`fixed top-0 left-0 h-full bg-[#020617] border-r border-slate-800 z-[60] transition-all duration-500 
      ${isOpen ? 'w-64 translate-x-0 shadow-[20px_0_40px_rgba(0,0,0,0.5)]' : 'w-20 lg:translate-x-0 -translate-x-full'}`}
    >
      <div className="flex flex-col h-full">
        <div className="p-8 flex items-center justify-between">
          <Link to="/" className={`font-outfit font-black text-2xl tracking-tighter quantum-gradient-text transition-opacity ${!isOpen && 'lg:opacity-0'}`}>
            QUANTA
          </Link>
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className="hidden lg:flex w-8 h-8 items-center justify-center hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
          >
            <svg className={`w-5 h-5 transition-transform duration-500 ${isOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center p-3 rounded-xl transition-all group relative ${
                  isActive 
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                    : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <svg className={`w-6 h-6 min-w-[24px] ${isActive ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {isOpen && <span className="ml-4 font-bold text-sm tracking-wide uppercase transition-all whitespace-nowrap">{item.name}</span>}
                {isActive && isOpen && <div className="absolute right-3 w-1.5 h-1.5 bg-indigo-500 rounded-full pillar-glow"></div>}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 space-y-3 border-t border-slate-800/50">
          <div className={`glass-card rounded-2xl p-4 flex items-center ${!isOpen ? 'justify-center' : 'space-x-3'}`}>
            <div className="relative">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${track}`} alt="Profile" className="w-10 h-10 rounded-xl bg-slate-800" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[#020617] rounded-full"></div>
            </div>
            {isOpen && (
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate uppercase">Quantum Operator</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{track} Core</p>
              </div>
            )}
          </div>
          <button 
            onClick={onLogout}
            className={`w-full flex items-center p-3 rounded-xl text-slate-500 hover:bg-rose-900/10 hover:text-rose-400 transition-all ${!isOpen ? 'justify-center' : ''}`}
          >
            <svg className="w-6 h-6 min-w-[24px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            {isOpen && <span className="ml-4 font-bold text-sm tracking-wide uppercase">De-sync</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
