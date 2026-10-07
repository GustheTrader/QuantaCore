
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getCredits } from '../services/creditService';
import { UserCredits } from '../types';
import type { UserTrack } from '../types';
import { getAgentTrack } from '../lib/agent-tracks';
import { MISSION_CONTROL_NAV, NAVIGATION_GROUPS, AGENT_CATEGORIES } from '../lib/navigation';
import type { NavigationItem, NavigationGroup } from '../lib/navigation';
import { PROVIDER_CHOICES } from '../lib/inference-providers';
import { ConfirmationModal } from './ConfirmationModal';
import { loadLocalRuntime, type LocalRuntime } from '../services/inferenceService';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onLogout: () => void;
  track: UserTrack;
  profile: { name: string, callsign: string, personality: string };
  onOpenChat: (agentName: string) => void;
  onOpenTerminal: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, onLogout, track, profile, onOpenChat, onOpenTerminal }) => {
  const location = useLocation();
  const [provider, setProvider] = useState('Gemini');
  const [credits, setCredits] = useState<UserCredits>(getCredits());
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [runtime, setRuntime] = useState<LocalRuntime>();
  useEffect(() => { loadLocalRuntime().then(setRuntime).catch(() => setRuntime(undefined)); }, [location.pathname]);
  const agentStatus = (path: string) => {
    const id = path === '/openmuse' ? 'openmuse' : path === '/work-zone' ? 'paperclip' : '';
    const service = runtime?.services.find(s => s.id === id);
    return service ? service.status === 'responding' ? 'HTTP connected' : service.status === 'authentication-required' ? 'Sign-in needed' : 'Unavailable' : 'Connection unverified';
  };

  useEffect(() => {
    const saved = localStorage.getItem('quanta_preferred_provider');
    if (saved) setProvider(PROVIDER_CHOICES.find(item => item.id === saved)?.label || saved);
    
    const updateCredits = () => setCredits(getCredits());
    const updateProvider = () => {
      const next = localStorage.getItem('quanta_preferred_provider');
      setProvider(PROVIDER_CHOICES.find(item => item.id === next)?.label || 'Gemini');
    };
    window.addEventListener('quanta_credits_updated', updateCredits);
    window.addEventListener('quanta_provider_changed', updateProvider);
    return () => {
      window.removeEventListener('quanta_credits_updated', updateCredits);
      window.removeEventListener('quanta_provider_changed', updateProvider);
    };
  }, [location.pathname]);

  const accentStyles = {
    cyan: { active: 'bg-cyan-500/10 text-cyan-200 border-cyan-400/30', icon: 'text-cyan-300', dot: 'bg-cyan-300', heading: 'text-cyan-300' },
    blue: { active: 'bg-blue-500/10 text-blue-200 border-blue-400/30', icon: 'text-blue-300', dot: 'bg-blue-300', heading: 'text-blue-300' },
    violet: { active: 'bg-violet-500/10 text-violet-200 border-violet-400/30', icon: 'text-violet-300', dot: 'bg-violet-300', heading: 'text-violet-300' },
    emerald: { active: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/30', icon: 'text-emerald-300', dot: 'bg-emerald-300', heading: 'text-emerald-300' }
  };

  const renderNavLink = (item: NavigationItem, accent: NavigationGroup['accent'] = 'cyan') => {
    const isActive = location.pathname === item.path;
    const styles = accentStyles[accent];
    return (
      <Link
        key={item.path}
        to={item.path}
        title={item.description ? item.name + ' — ' + item.description : item.name}
        aria-label={item.name}
        aria-current={isActive ? 'page' : undefined}
        className={'flex items-center p-2.5 rounded-xl transition-colors motion-reduce:transition-none group relative border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ' + (!isOpen ? 'justify-center ' : '') + (isActive ? styles.active : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border-transparent')}
      >
        <svg aria-hidden="true" className={'w-5 h-5 min-w-[20px] ' + (isActive ? styles.icon : 'text-slate-500 group-hover:text-slate-200')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
        </svg>
        {isOpen && <span className="ml-3 font-semibold text-xs tracking-wide whitespace-nowrap">{item.name}</span>}
        {isActive && isOpen && <span aria-hidden="true" className={'absolute right-2.5 w-1 h-1 rounded-full ' + styles.dot} />}
      </Link>
    );
  };
  return (
    <aside 
      className={`fixed top-0 left-0 h-full bg-[#020617] border-r border-blue-400/15 z-[60] transition-all duration-500 motion-reduce:transition-none
      ${isOpen ? 'w-64 translate-x-0 shadow-[20px_0_60px_rgba(0,0,0,0.8)]' : 'w-20 lg:translate-x-0 -translate-x-full'}`}
    >
      <ConfirmationModal 
        isOpen={isLogoutModalOpen}
        title="De-sync Neural Link?"
        message="You are about to terminate your active session. You will need to re-authenticate to access the Quanta-OS substrate."
        confirmLabel="De-sync"
        cancelLabel="Stay Connected"
        onConfirm={onLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
        isDestructive={true}
      />
      <div className="flex flex-col h-full">
        <div className="p-4 flex items-center justify-between gap-2">
          <Link to="/" aria-label="Quanta OS Mission Control" className="min-w-0 text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 rounded-lg">
            {isOpen ? (
              <>
                <span className="block font-outfit font-black text-xl tracking-tight">QUANTA<span className="text-cyan-400"> OS</span></span>
                <span className="block mt-1 text-[8px] font-semibold tracking-wide text-slate-400">Brain · Hands · Nervous Systems</span>
              </>
            ) : <span className="font-outfit font-black text-xl text-cyan-300">Q</span>}
          </Link>
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            aria-label={isOpen ? 'Collapse navigation' : 'Expand navigation'}
            title={isOpen ? 'Collapse navigation' : 'Expand navigation'}
            className="hidden lg:flex shrink-0 w-7 h-8 items-center justify-center hover:bg-slate-800 rounded-lg text-cyan-400 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            <svg aria-hidden="true" className={`w-5 h-5 transition-transform duration-500 motion-reduce:transition-none ${isOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <nav aria-label="Quanta operating model" className="flex-1 min-h-0 px-4 py-2 overflow-y-auto custom-scrollbar">
          <div className="mb-2">{renderNavLink(MISSION_CONTROL_NAV)}</div>
          <button 
            onClick={() => onOpenChat('Neural Terminal')}
            aria-label="Open Neural Terminal"
            title="Open Neural Terminal"
            className={`w-full flex items-center p-2.5 rounded-xl transition-colors motion-reduce:transition-none group relative border border-blue-500/20 bg-blue-500/5 text-blue-300 hover:bg-blue-500/10 hover:border-blue-500/40 mb-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${!isOpen ? 'justify-center' : ''}`}
          >
            <svg className="w-5 h-5 min-w-[20px] text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {isOpen && <span className="ml-3 font-semibold text-xs tracking-wide whitespace-nowrap">Neural Terminal</span>}
          </button>
          <button
            type="button"
            onClick={onOpenTerminal}
            aria-label="Open Quanta CLI"
            title="Open Quanta CLI"
            className={`mb-4 flex w-full items-center rounded-xl border border-orange-400/25 bg-orange-400/5 p-2.5 text-orange-300 hover:border-orange-400/50 hover:bg-orange-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300 ${!isOpen ? 'justify-center' : ''}`}
          >
            <svg className="h-5 w-5 min-w-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16v12H4zM7 10l3 2-3 2m5 0h4" /></svg>
            {isOpen && <span className="ml-3 whitespace-nowrap text-xs font-semibold">Quanta CLI</span>}
          </button>
          {NAVIGATION_GROUPS.map((group, index) => (
            <section key={group.name} aria-labelledby={'nav-group-' + index} className="mt-5 first:mt-0">
              <button type="button" aria-expanded={isOpen && Boolean(expandedGroups[group.name])} aria-controls={'nav-items-' + index} aria-label={group.name === 'Hands' ? 'Agents' : group.name} title={group.name === 'Hands' ? 'Agents' : group.name} onClick={() => { if (!isOpen) setIsOpen(true); setExpandedGroups(previous => ({ ...previous, [group.name]: !isOpen || !previous[group.name] })); }} className="flex w-full items-center justify-between rounded-xl border border-slate-700/50 p-2.5 text-left hover:bg-slate-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
              {isOpen ? (
                <div className="px-2.5 mb-2">
                  <h2 id={'nav-group-' + index} className={'text-[10px] font-black uppercase tracking-[0.2em] ' + accentStyles[group.accent].heading}>{group.name === 'Hands' ? 'Agents' : group.name}</h2>
                  <p className="mt-1 text-[9px] leading-relaxed text-slate-500">{group.caption}</p>
                </div>
              ) : (
                <div className="text-xs font-bold text-cyan-200">
                  <span aria-hidden="true">{group.name === 'Hands' ? 'A' : group.name === 'Nervous Systems' ? 'N' : group.name[0]}</span>
                  <h2 id={'nav-group-' + index} className="sr-only">{group.name}: {group.caption}</h2>
                </div>
              )}
              {isOpen && <span aria-hidden="true" className="text-slate-400">{expandedGroups[group.name] ? '▾' : '▸'}</span>}
              </button>
              {isOpen && expandedGroups[group.name] && <div id={'nav-items-' + index} className="space-y-0.5 pt-2">{group.name === 'Hands'
                ? [...new Set(group.items.map(item => AGENT_CATEGORIES[item.path] || 'Other agents'))].map(category => (
                  <details key={category} className="rounded-lg border border-slate-800/70 my-1">
                    <summary className="cursor-pointer px-2.5 py-3 text-[10px] font-semibold text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">{category}</summary>
                    {group.items.filter(item => (AGENT_CATEGORIES[item.path] || 'Other agents') === category).map(item => <div key={item.path}>{renderNavLink(item, group.accent)}<p className="px-3 pb-2 text-[9px] text-slate-500">{agentStatus(item.path)}</p></div>)}
                  </details>
                )) : group.items.map(item => renderNavLink(item, group.accent))}{group.name === 'Hands' && <Link to="/startup" className="block p-3 text-xs text-cyan-300">Check agent connections →</Link>}</div>}
            </section>
          ))}
        </nav>

        {/* Credit Indicators */}
        {isOpen && <details className="px-4 py-3 border-t border-slate-800/60">
          <summary className="cursor-pointer text-[10px] font-semibold text-slate-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Compute credits · {provider}</summary>
          <div className="pt-3 space-y-3">
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
        </details>}

        <div className="p-4 space-y-2 border-t border-slate-800/50">
          <div title={profile.callsign + ' · ' + getAgentTrack(track).label} className={`glass-card rounded-2xl flex items-center ${!isOpen ? 'justify-center py-3 px-1' : 'p-3 space-x-3'}`}>
            <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-lg bg-blue-950 border border-blue-400/20 flex items-center justify-center text-[10px] font-bold text-blue-200">{profile.callsign.slice(0, 2).toUpperCase()}</span>
            {isOpen && (
              <div className="overflow-hidden">
                <p className="text-[10px] font-bold text-white truncate uppercase">{profile.callsign}</p>
                <p className="text-[8px] text-emerald-400 uppercase tracking-tighter font-black">{getAgentTrack(track).label} LINK</p>
              </div>
            )}
          </div>

          <div className="space-y-1">
            {renderNavLink({ 
              name: 'Settings',
              icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 
              path: '/settings' 
            })}
          </div>

          <button 
            onClick={() => setIsLogoutModalOpen(true)}
            aria-label="Sign out of Quanta OS"
            title="Sign out"
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
