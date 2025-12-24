
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { VoiceAgent } from './VoiceAgent';

interface AgentProps {
  name: string;
  subhead: string;
  desc: string;
  icon: string;
  tags: string[];
  iconBg: string;
  iconColor: string;
}

interface DashboardProps {
  track: 'personal' | 'business';
  profile: { name: string, callsign: string, personality: string };
}

const SuperAgentCard: React.FC<AgentProps & { 
  onVoice: () => void, 
  onConfigure: () => void, 
  isCustom?: boolean,
  activeSkills: string[]
}> = ({ name, subhead, desc, icon, tags, iconBg, iconColor, onVoice, onConfigure, isCustom, activeSkills }) => {
  const navigate = useNavigate();
  
  const skillIcons: Record<string, string> = {
    search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    gmail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    docs: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    drive: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v10a2 2 0 00-2 2v10a2 2 0 002 2z',
    vision: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'
  };

  return (
    <div className={`glass-card p-6 rounded-3xl flex flex-col h-full border transition-all duration-500 group hover:bg-slate-900/60 ${isCustom ? 'border-dashed border-indigo-500/40 bg-indigo-500/5' : 'border-slate-800/50 hover:border-indigo-500/30'}`}>
      <div className="mb-6 flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border border-white/5 shadow-inner shadow-white/5 ${iconBg} ${iconColor} transition-transform group-hover:scale-110`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} /></svg>
        </div>
        <div className="flex space-x-2">
           <button onClick={(e) => { e.stopPropagation(); onConfigure(); }} title="Forge Skillset" className="w-8 h-8 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-center text-slate-500 hover:text-white hover:border-indigo-500 transition-all">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
           </button>
           <button onClick={(e) => { e.stopPropagation(); onVoice(); }} title="Live Voice Neural Link" className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
           </button>
        </div>
      </div>
      <h3 className="font-outfit font-bold text-xl text-white mb-1 truncate">{name}</h3>
      <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-4">{subhead}</p>
      
      <div className="flex space-x-1.5 mb-4">
        {activeSkills.map(skillId => (
          <div key={skillId} className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-sm" title={skillId}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={skillIcons[skillId] || ''} />
            </svg>
          </div>
        ))}
      </div>

      <p className="text-slate-400 text-xs leading-relaxed mb-6 flex-1 opacity-80 group-hover:opacity-100 transition-opacity line-clamp-3">{desc}</p>
      
      <div className="flex flex-wrap gap-2 mb-6 pt-4 border-t border-slate-800/50">
        {tags.map((t, idx) => (
          <span key={t} className={`text-[9px] px-2.5 py-1 rounded-md font-bold uppercase tracking-tighter border ${idx === tags.length - 1 ? 'bg-slate-800/50 border-slate-700/50 text-slate-500' : 'bg-slate-900/50 border-slate-800 text-slate-400 group-hover:border-slate-700'}`}>{t}</span>
        ))}
      </div>
      
      <button onClick={() => navigate('/chat', { state: { agent: name } })} className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center space-x-2">
        <span>Launch Agent</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
      </button>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ track, profile }) => {
  const navigate = useNavigate();
  const [voiceConfig, setVoiceConfig] = useState({ active: false, agentName: '', prompt: '', skills: ['search'] });
  const [configModal, setConfigModal] = useState({ active: false, agentName: '', prompt: '', skills: ['search'] as string[], isCustom: false });
  const [authModal, setAuthModal] = useState<{ active: boolean, type: 'google' | 'company' | null }>({ active: false, type: null });
  const [isSyncing, setIsSyncing] = useState(false);
  const [customAgents, setCustomAgents] = useState<any[]>([]);
  const [customConfigs, setCustomConfigs] = useState<Record<string, { prompt: string, skills: string[] }>>({});
  const [connections, setConnections] = useState<Record<string, boolean>>({ google: false, company: false });

  useEffect(() => {
    const savedConfigs = localStorage.getItem('quanta_agent_configs');
    if (savedConfigs) setCustomConfigs(JSON.parse(savedConfigs));

    const savedCustom = localStorage.getItem(`quanta_custom_agents_${track}`);
    if (savedCustom) setCustomAgents(JSON.parse(savedCustom));

    const savedConnections = localStorage.getItem('quanta_connections');
    if (savedConnections) setConnections(JSON.parse(savedConnections));
  }, [track]);

  const initiateAuth = (type: 'google' | 'company') => {
    setAuthModal({ active: true, type });
  };

  const completeAuth = () => {
    if (!authModal.type) return;
    setIsSyncing(true);
    setTimeout(() => {
      const updated = { ...connections, [authModal.type!]: true };
      setConnections(updated);
      localStorage.setItem('quanta_connections', JSON.stringify(updated));
      setIsSyncing(false);
      setAuthModal({ active: false, type: null });
    }, 2000);
  };

  const disconnect = (type: 'google' | 'company') => {
    const updated = { ...connections, [type]: false };
    setConnections(updated);
    localStorage.setItem('quanta_connections', JSON.stringify(updated));
  };

  const saveConfig = (name: string, prompt: string, skills: string[]) => {
    const updated = { ...customConfigs, [name]: { prompt, skills } };
    setCustomConfigs(updated);
    localStorage.setItem('quanta_agent_configs', JSON.stringify(updated));

    if (configModal.isCustom) {
      const exists = customAgents.find(a => a.name === name);
      if (!exists) {
        const newAgent = { 
          name, 
          subhead: 'Custom Neural Core', 
          desc: prompt.substring(0, 100) + '...', 
          icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4', 
          iconBg: 'bg-indigo-600/20', 
          iconColor: 'text-indigo-400', 
          tags: ['Custom', 'Neural'],
          isCustom: true
        };
        const updatedCustom = [...customAgents, newAgent];
        setCustomAgents(updatedCustom);
        localStorage.setItem(`quanta_custom_agents_${track}`, JSON.stringify(updatedCustom));
      } else {
        const updatedCustom = customAgents.map(a => a.name === name ? { ...a, desc: prompt.substring(0, 100) + '...' } : a);
        setCustomAgents(updatedCustom);
        localStorage.setItem(`quanta_custom_agents_${track}`, JSON.stringify(updatedCustom));
      }
    }
    setConfigModal({ ...configModal, active: false });
  };

  const personalAgents: AgentProps[] = [
    { name: "QPersonal Assistant", subhead: "High-Performance Life", desc: "Total life management, scheduling, and productivity optimization.", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", iconBg: "bg-purple-600/20", iconColor: "text-purple-400", tags: ["Life", "Focus", "+2"] },
    { name: "QWealth Architect", subhead: "Portfolio & Arbitrage", desc: "Advanced wealth management and asset allocation strategies.", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2", iconBg: "bg-amber-600/20", iconColor: "text-amber-400", tags: ["Wealth", "Asset", "+2"] },
    { name: "QSpeculator Pro", subhead: "Trade & Alpha Bot", desc: "Deep market speculation and automated arbitrage detection.", icon: "M13 10V3L4 14h7v7l9-11h-7z", iconBg: "bg-emerald-600/20", iconColor: "text-emerald-400", tags: ["Alpha", "Arb", "+2"] },
    { name: "QHealth Biohacker", subhead: "Biology & Fitness", desc: "Data-driven health optimization and human performance scaling.", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364", iconBg: "bg-rose-600/20", iconColor: "text-rose-400", tags: ["Bio", "Vitality", "+2"] },
    { name: "QCreative Engine", subhead: "Neural Design & Copy", desc: "Full-stack creativity, visual forge, and narrative architectural skills.", icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4", iconBg: "bg-indigo-600/20", iconColor: "text-indigo-400", tags: ["Art", "Narrative", "+2"] },
    { name: "QLegacy Planner", subhead: "Estate & Long-term", desc: "Generational planning, trusts, and long-horizon vision execution.", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", iconBg: "bg-cyan-600/20", iconColor: "text-cyan-400", tags: ["Legacy", "Plan", "+2"] },
    { name: "QMind Fortress", subhead: "Mindset & Clarity", desc: "Cognitive performance optimization, meditation routines, and mental resilience training.", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", iconBg: "bg-blue-600/20", iconColor: "text-blue-400", tags: ["Mind", "Resilience", "+2"] },
    { name: "QTravel Nomad", subhead: "Logistics & Freedom", desc: "Complex itinerary planning, visa automation, and nomadic lifestyle logistics.", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z", iconBg: "bg-emerald-600/20", iconColor: "text-emerald-400", tags: ["Travel", "Global", "+2"] },
    { name: "QSocial Architect", subhead: "Network & Status", desc: "Strategic networking, event tracking, and high-value relationship management.", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857", iconBg: "bg-rose-600/20", iconColor: "text-rose-400", tags: ["Network", "Social", "+2"] },
  ];

  const businessAgents: AgentProps[] = [
    { name: "QStrategy & CEO", subhead: "Strategic Intel & Board", desc: "Virtual board member for high-level scaling and market positioning.", icon: "M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", iconBg: "bg-blue-600/20", iconColor: "text-blue-400", tags: ["Board", "Exit", "+2"] },
    { name: "QGrowth & Marketing", subhead: "Viral Logic & Funnels", desc: "Algorithmic social strategy and multi-channel marketing automation.", icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15", iconBg: "bg-orange-600/20", iconColor: "text-orange-400", tags: ["Viral", "Ads", "+2"] },
    { name: "QFinance & CFO", subhead: "Accounting & Cashflow", desc: "Neural P&L analysis, tax optimization, and burn-rate tracking.", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2", iconBg: "bg-emerald-600/20", iconColor: "text-emerald-400", tags: ["Burn", "CFO", "+2"] },
    { name: "QSales & Revenue", subhead: "Closing & Pipeline", desc: "Outbound automation, lead scoring, and revenue-per-employee scaling.", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", iconBg: "bg-rose-600/20", iconColor: "text-rose-400", tags: ["Sales", "Pipe", "+2"] },
    { name: "QOps & Efficiency", subhead: "Workflow & ERP", desc: "Operational bottleneck removal and system architecture management.", icon: "M4 6h16M4 10h16M4 14h16M4 18h16", iconBg: "bg-slate-600/20", iconColor: "text-slate-400", tags: ["SOP", "ERP", "+2"] },
    { name: "QHR & Talent", subhead: "Culture & Recruiting", desc: "Talent acquisition strategy and internal organizational culture design.", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857", iconBg: "bg-indigo-600/20", iconColor: "text-indigo-400", tags: ["Talent", "HR", "+2"] },
    { name: "QProduct & Dev", subhead: "R&D & Engineering", desc: "Technical roadmap acceleration, code audit, and engineering team scaling.", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4", iconBg: "bg-cyan-600/20", iconColor: "text-cyan-400", tags: ["Dev", "Agile", "+2"] },
    { name: "QLegal & Risk", subhead: "Compliance & Shield", desc: "Automated contract review, risk mitigation analysis, and regulatory compliance checking.", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944", iconBg: "bg-purple-600/20", iconColor: "text-purple-400", tags: ["Legal", "Risk", "+2"] },
    { name: "QCustomer Success", subhead: "Retention & Delight", desc: "Churn prediction modeling and proactive customer experience strategies.", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364", iconBg: "bg-emerald-600/20", iconColor: "text-emerald-400", tags: ["Churn", "CS", "+2"] },
  ];

  const currentAgents = track === 'personal' ? personalAgents : businessAgents;

  // Performance Analytics Data
  const performanceData = useMemo(() => {
    return currentAgents.slice(0, 6).map(agent => ({
      name: agent.name.split(' ')[0], // Short name for chart
      fullName: agent.name,
      completion: Math.floor(Math.random() * 15) + 85, // 85-100%
      latency: Math.floor(Math.random() * 200) + 300, // 300-500ms
      satisfaction: (Math.random() * 0.8 + 4.2).toFixed(1) // 4.2-5.0
    }));
  }, [currentAgents]);

  const timelineData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => ({
      day: `Day ${i + 1}`,
      efficiency: Math.floor(Math.random() * 20) + 75,
      tasks: Math.floor(Math.random() * 10) + 5
    }));
  }, []);
  
  const skillDefinitions = [
    { id: 'search', name: 'Neural Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', color: 'text-indigo-400', desc: 'Real-time web grounding and news synthesis.' },
    { id: 'gmail', name: 'Gmail Link', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'text-red-400', desc: 'Secure email search, reading, and drafting.' },
    { id: 'calendar', name: 'Calendar Sync', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'text-blue-400', desc: 'Intelligent scheduling and event management.' },
    { id: 'docs', name: 'Docs Architect', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'text-green-400', desc: 'Create and summarize high-fidelity documents.' },
    { id: 'drive', name: 'Drive Vault', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v10a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'text-amber-500', desc: 'Sovereign management of Drive files and folders.' },
    { id: 'vision', name: 'Vision Forge', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z', color: 'text-purple-400', desc: 'Neural image generation and visual reasoning.' },
  ];

  const handleOpenConfigure = (agent: AgentProps, isCustom: boolean) => {
    const existing = customConfigs[agent.name];
    setConfigModal({
      active: true,
      agentName: agent.name,
      prompt: existing?.prompt || agent.desc,
      skills: existing?.skills || ['search'],
      isCustom
    });
  };

  return (
    <div className="animate-in fade-in duration-1000 pb-20 relative">
      <VoiceAgent 
        isActive={voiceConfig.active} 
        agentName={voiceConfig.agentName} 
        systemInstruction={voiceConfig.prompt} 
        enabledSkills={voiceConfig.skills}
        onClose={() => setVoiceConfig({ ...voiceConfig, active: false })} 
        profile={profile}
      />

      {/* Auth Handshake Modal */}
      {authModal.active && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
           <div className="glass-card p-12 rounded-[4rem] w-full max-w-lg text-center border-indigo-500/30 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
              <div className="mb-8">
                <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-6 transition-all duration-500 ${isSyncing ? 'bg-indigo-600 animate-pulse scale-110 shadow-[0_0_50px_rgba(99,102,241,0.5)]' : 'bg-slate-900 border border-slate-800'}`}>
                  {authModal.type === 'google' ? (
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-1.94 5.39-7.84 5.39-5.09 0-9.25-4.22-9.25-9.42s4.16-9.42 9.25-9.42c2.9 0 4.84 1.21 5.95 2.27l2.58-2.5c-1.66-1.55-3.83-2.5-8.53-2.5C5.41 0 0 5.41 0 12s5.41 12 12 12c6.88 0 11.45-4.84 11.45-11.65 0-.78-.08-1.38-.18-1.97h-10.79z"/></svg>
                  ) : (
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  )}
                </div>
                <h2 className="text-3xl font-outfit font-black uppercase tracking-tighter text-white">Neural Handshake</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">{isSyncing ? 'Establishing Secure Tunnel...' : `Authorize ${authModal.type} Account`}</p>
              </div>
              {!isSyncing ? (
                <div className="space-y-4">
                  <p className="text-slate-400 text-xs leading-relaxed mb-8">Synchronize your {authModal.type} credentials with Quanta's sovereign memory layer. No data leaves your local edge environment.</p>
                  <button onClick={completeAuth} className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all flex items-center justify-center space-x-3 shadow-xl">
                    <span>Connect Now</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </button>
                  <button onClick={() => setAuthModal({ active: false, type: null })} className="w-full py-4 text-slate-500 font-bold uppercase tracking-widest text-[10px]">Cancel Connection</button>
                </div>
              ) : (
                <div className="flex flex-col items-center py-10">
                   <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 animate-[loading_2s_ease-in-out_infinite]"></div>
                   </div>
                   <p className="mt-6 font-mono text-[9px] text-indigo-400/60 uppercase">ENCRYPTING NEURAL BRIDGE...</p>
                </div>
              )}
           </div>
        </div>
      )}

      {/* AGENT CONFIGURATION MODAL */}
      {configModal.active && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
           <div className="glass-card p-8 rounded-[2rem] w-full max-w-4xl border-indigo-500/20 max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h2 className="text-3xl font-outfit font-black uppercase tracking-tighter">Forge: {configModal.agentName || 'New Neural Core'}</h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Connect Workspace skills & independent neural logic</p>
                </div>
                <button onClick={() => setConfigModal({ ...configModal, active: false })} className="text-slate-500 hover:text-white transition-colors p-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="mb-6">
                     <label className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.25em] mb-2 block">Agent Designation</label>
                     <input 
                       type="text" 
                       value={configModal.agentName} 
                       onChange={(e) => setConfigModal({ ...configModal, agentName: e.target.value })} 
                       className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white font-outfit font-bold shadow-inner focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                       placeholder="e.g. QNiche Specialist"
                     />
                  </div>
                  <label className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.25em] mb-3 block">Specialized System Logic</label>
                  <textarea 
                    value={configModal.prompt} 
                    onChange={(e) => setConfigModal({ ...configModal, prompt: e.target.value })} 
                    className="w-full h-80 bg-slate-950 border border-slate-800 rounded-[2rem] p-8 text-slate-300 font-mono text-sm leading-relaxed shadow-inner focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" 
                    placeholder="Describe the specialized niche and unique directives for this neural core..."
                  />
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <label className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.25em] block">Enable/Disable Skills</label>
                    <span className="text-[9px] text-slate-600 font-mono uppercase tracking-tighter">{configModal.skills.length} / {skillDefinitions.length} Connected</span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3.5">
                    {skillDefinitions.map(skill => {
                      const isEnabled = configModal.skills.includes(skill.id);
                      return (
                        <div 
                          key={skill.id} 
                          onClick={() => {
                            setConfigModal(prev => ({...prev, skills: isEnabled ? prev.skills.filter(s => s !== skill.id) : [...prev.skills, skill.id]}));
                          }} 
                          className={`p-5 rounded-[1.5rem] border transition-all cursor-pointer flex items-center space-x-5 ${isEnabled ? 'bg-indigo-600/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.1)]' : 'bg-slate-900/50 border-slate-800 text-slate-600 hover:border-slate-700'}`}
                        >
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isEnabled ? 'bg-indigo-500 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={skill.icon} /></svg>
                          </div>
                          <div className="flex-1">
                            <p className={`font-black text-xs uppercase tracking-tight transition-colors ${isEnabled ? 'text-white' : 'text-slate-500'}`}>{skill.name}</p>
                            <p className="text-[10px] opacity-70 leading-relaxed mt-1">{skill.desc}</p>
                          </div>
                          <div className="relative inline-flex items-center cursor-pointer">
                            <div className={`w-10 h-5 rounded-full transition-colors ${isEnabled ? 'bg-indigo-500' : 'bg-slate-700'}`}></div>
                            <div className={`absolute left-1 w-3 h-3 bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-4 mt-12 pt-8 border-t border-slate-800">
                 <button onClick={() => setConfigModal({ ...configModal, active: false })} className="flex-1 py-5 bg-slate-800 hover:bg-slate-700 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] text-slate-400 transition-all">Discard Changes</button>
                 <button onClick={() => saveConfig(configModal.agentName, configModal.prompt, configModal.skills)} className="flex-1 py-5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-indigo-500/25 transition-all">Sync SME Neural Core</button>
              </div>
           </div>
        </div>
      )}

      <nav className="flex items-center justify-between mb-20">
        <div className="flex items-center space-x-3 group cursor-pointer">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)] group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-outfit font-black text-2xl tracking-tighter text-white uppercase italic">Quanta <span className="text-indigo-400">{track} Core</span></span>
        </div>
        
        <div className="hidden lg:flex items-center space-x-4">
           <div 
            className={`flex items-center space-x-3 px-4 py-2 rounded-xl border transition-all cursor-pointer ${connections.google ? 'bg-blue-600/10 border-blue-500/30' : 'bg-slate-900 border-slate-800 grayscale'}`} 
            onClick={() => connections.google ? disconnect('google') : initiateAuth('google')}
           >
              <div className={`w-2 h-2 rounded-full ${connections.google ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`}></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Google Link</span>
              <span className={`text-[8px] font-bold px-1.5 rounded ${connections.google ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'}`}>{connections.google ? 'SYNCED' : 'OFFLINE'}</span>
           </div>
           <div 
            className={`flex items-center space-x-3 px-4 py-2 rounded-xl border transition-all cursor-pointer ${connections.company ? 'bg-indigo-600/10 border-indigo-500/30' : 'bg-slate-900 border-slate-800 grayscale'}`} 
            onClick={() => connections.company ? disconnect('company') : initiateAuth('company')}
           >
              <div className={`w-2 h-2 rounded-full ${connections.company ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`}></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Company Link</span>
              <span className={`text-[8px] font-bold px-1.5 rounded ${connections.company ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'}`}>{connections.company ? 'SYNCED' : 'OFFLINE'}</span>
           </div>
        </div>
      </nav>

      <section className="text-center mb-16 max-w-4xl mx-auto">
        <p className="text-indigo-400 font-black uppercase tracking-[0.4em] text-[10px] mb-4">Neural Buffer Ready: Addressing as {profile.callsign}</p>
        <h2 className="text-4xl lg:text-7xl font-outfit font-black text-white mb-6 uppercase tracking-tighter">Choose Your <span className="quantum-gradient-text italic underline decoration-indigo-500/50 decoration-8 underline-offset-8">SuperAgent</span></h2>
        <p className="text-slate-500 text-sm font-black uppercase tracking-[0.4em] leading-relaxed">Specialized neural cores tailored for your {track} imperatives.</p>
      </section>

      {/* NEURAL PERFORMANCE ANALYTICS SECTION */}
      <section className="mb-24 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-8 duration-1000">
        <div className="glass-card p-8 rounded-[3rem] border-slate-800/50">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-outfit font-black uppercase tracking-tighter text-white">SME Task Completion</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Efficiency Benchmarks per Core</p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-emerald-400 text-[10px] font-black uppercase tracking-widest">Live Flow</div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} 
                />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                  itemStyle={{ color: '#818cf8', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}
                />
                <Bar dataKey="completion" radius={[10, 10, 0, 0]}>
                  {performanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#a855f7'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-8 rounded-[3rem] border-slate-800/50">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-outfit font-black uppercase tracking-tighter text-white">Neural Sync Latency</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vocal & Logic Response Speed (ms)</p>
            </div>
            <div className="bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-indigo-400 text-[10px] font-black uppercase tracking-widest">Optimized</div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} 
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px' }}
                />
                <Area type="monotone" dataKey="latency" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorLatency)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="mb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {currentAgents.map((agent) => (
            <SuperAgentCard 
              key={agent.name} 
              {...agent} 
              activeSkills={customConfigs[agent.name]?.skills || ['search']}
              onVoice={() => setVoiceConfig({ 
                active: true, 
                agentName: agent.name, 
                prompt: customConfigs[agent.name]?.prompt || agent.desc,
                skills: customConfigs[agent.name]?.skills || ['search']
              })} 
              onConfigure={() => handleOpenConfigure(agent, false)} 
            />
          ))}
          {customAgents.map((agent) => (
            <SuperAgentCard 
              key={agent.name} 
              {...agent} 
              isCustom
              activeSkills={customConfigs[agent.name]?.skills || ['search']}
              onVoice={() => setVoiceConfig({ 
                active: true, 
                agentName: agent.name, 
                prompt: customConfigs[agent.name]?.prompt || agent.desc,
                skills: customConfigs[agent.name]?.skills || ['search']
              })} 
              onConfigure={() => handleOpenConfigure(agent, true)} 
            />
          ))}
          <div 
            onClick={() => setConfigModal({ active: true, agentName: '', prompt: '', skills: ['search'], isCustom: true })}
            className="glass-card p-12 rounded-[3rem] border-2 border-dashed border-slate-800 hover:border-indigo-500/50 transition-all flex flex-col items-center justify-center text-center cursor-pointer group"
          >
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 group-hover:text-indigo-400 group-hover:scale-110 transition-all mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
            <h3 className="text-xl font-outfit font-black text-white mb-2 uppercase tracking-tighter">Forge Custom SME</h3>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Construct niche neural logic</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
