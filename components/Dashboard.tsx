
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
  Area,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { VoiceAgent } from './VoiceAgent';

interface AgentProps {
  name: string;
  subhead: string;
  desc: string;
  systemPrompt: string;
  icon: string;
  tags: string[];
  iconBg: string;
  iconColor: string;
}

interface VoiceSettings {
  voiceName: string;
  inputTranscription: boolean;
  outputTranscription: boolean;
  systemPromptOverride: string;
  enabledSkills: string[];
}

interface DashboardProps {
  track: 'personal' | 'business';
  profile: { name: string, callsign: string, personality: string };
}

const VOICE_OPTIONS = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
const SKILL_OPTIONS = [
  { id: 'search', name: 'Google Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { id: 'gmail', name: 'Gmail Link', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { id: 'calendar', name: 'Calendar Sync', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { id: 'docs', name: 'Docs Architect', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'drive', name: 'Drive Vault', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v10a2 2 0 00-2 2v10a2 2 0 002 2z' }
];

const VoiceConfigModal: React.FC<{
  agent: AgentProps;
  settings: VoiceSettings;
  onSave: (settings: VoiceSettings) => void;
  onClose: () => void;
}> = ({ agent, settings, onSave, onClose }) => {
  const [localSettings, setLocalSettings] = useState<VoiceSettings>(settings);

  const toggleSkill = (skillId: string) => {
    const skills = localSettings.enabledSkills.includes(skillId)
      ? localSettings.enabledSkills.filter(s => s !== skillId)
      : [...localSettings.enabledSkills, skillId];
    setLocalSettings({ ...localSettings, enabledSkills: skills });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6 animate-in fade-in duration-300">
      <div className="glass-card w-full max-w-3xl rounded-[3rem] border-emerald-500/30 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-10 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-outfit font-black text-white uppercase tracking-tighter italic">Voice <span className="text-emerald-400">Architecture</span></h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Configuring {agent.name} Vocal Core</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
          <section className="space-y-6">
            <label className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] block">Vocal Profile</label>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {VOICE_OPTIONS.map(v => (
                <button
                  key={v}
                  onClick={() => setLocalSettings({ ...localSettings, voiceName: v })}
                  className={`py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${localSettings.voiceName === v ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <label className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] block">Neural Capabilities</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {SKILL_OPTIONS.map(skill => (
                <button
                  key={skill.id}
                  onClick={() => toggleSkill(skill.id)}
                  className={`flex items-center space-x-3 p-4 rounded-2xl border transition-all text-left ${localSettings.enabledSkills.includes(skill.id) ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={skill.icon} /></svg>
                  <span className="text-[10px] font-black uppercase tracking-widest">{skill.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <label className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] block">Telemetry Settings</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center justify-between p-5 bg-slate-900/50 rounded-2xl border border-slate-800 cursor-pointer hover:bg-slate-800/50 transition-colors">
                <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Input Transcription</span>
                <input 
                  type="checkbox" 
                  className="w-6 h-6 accent-emerald-500"
                  checked={localSettings.inputTranscription}
                  onChange={(e) => setLocalSettings({ ...localSettings, inputTranscription: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between p-5 bg-slate-900/50 rounded-2xl border border-slate-800 cursor-pointer hover:bg-slate-800/50 transition-colors">
                <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Output Transcription</span>
                <input 
                  type="checkbox" 
                  className="w-6 h-6 accent-emerald-500"
                  checked={localSettings.outputTranscription}
                  onChange={(e) => setLocalSettings({ ...localSettings, outputTranscription: e.target.checked })}
                />
              </label>
            </div>
          </section>

          <section className="space-y-6">
            <label className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] block">Vocal System Prompt Override</label>
            <textarea 
              value={localSettings.systemPromptOverride}
              onChange={(e) => setLocalSettings({ ...localSettings, systemPromptOverride: e.target.value })}
              placeholder="Inject custom behavioral logic for voice interactions..."
              className="w-full bg-slate-950 border border-slate-800 rounded-3xl p-8 text-slate-300 font-medium text-sm focus:border-emerald-500 transition-all min-h-[150px] custom-scrollbar"
            />
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest italic">Grounds voice reasoning in specific SME logic overrides if provided.</p>
          </section>
        </div>

        <div className="p-10 border-t border-slate-800 flex space-x-6">
          <button onClick={onClose} className="flex-1 py-6 bg-slate-900 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all">Cancel</button>
          <button onClick={() => onSave(localSettings)} className="flex-1 py-6 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-emerald-500/30 hover:bg-emerald-500 transition-all">Save Architecture</button>
        </div>
      </div>
    </div>
  );
};

const SkeletonCard: React.FC = () => (
  <div className="glass-card p-8 rounded-[3rem] border border-emerald-500/10 flex flex-col h-full animate-pulse">
    <div className="mb-8 flex items-start justify-between">
      <div className="w-14 h-14 rounded-2xl bg-slate-800/50"></div>
      <div className="flex space-x-2">
        <div className="w-9 h-9 rounded-xl bg-slate-800/50"></div>
        <div className="w-9 h-9 rounded-xl bg-slate-800/50"></div>
      </div>
    </div>
    <div className="h-8 w-3/4 bg-slate-800/50 rounded-lg mb-4"></div>
    <div className="h-3 w-1/4 bg-emerald-500/10 rounded-lg mb-8"></div>
    <div className="space-y-3 flex-1 mb-8">
      <div className="h-4 w-full bg-slate-800/30 rounded-lg"></div>
      <div className="h-4 w-5/6 bg-slate-800/30 rounded-lg"></div>
      <div className="h-4 w-4/6 bg-slate-800/30 rounded-lg"></div>
    </div>
    <div className="flex gap-2 mb-8 pt-6 border-t border-slate-800/20">
      <div className="h-6 w-12 bg-slate-800/50 rounded-lg"></div>
      <div className="h-6 w-12 bg-slate-800/50 rounded-lg"></div>
    </div>
    <div className="h-14 w-full bg-emerald-500/10 rounded-2xl"></div>
  </div>
);

const SuperAgentCard: React.FC<AgentProps & { 
  onVoice: () => void, 
  onConfigureVoice: () => void, 
  isCustom?: boolean
}> = ({ name, subhead, desc, icon, tags, iconBg, iconColor, onVoice, onConfigureVoice, isCustom }) => {
  const navigate = useNavigate();
  
  return (
    <div className={`glass-card p-8 rounded-[3rem] flex flex-col h-full border transition-all duration-500 group hover:shadow-[0_0_50px_rgba(16,185,129,0.1)] ${isCustom ? 'border-dashed border-orange-500/40 bg-orange-500/5' : 'border-emerald-500/20 hover:border-emerald-500/50'}`}>
      <div className="mb-8 flex items-start justify-between">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border border-white/5 bg-slate-900 ${iconColor} transition-transform group-hover:scale-110`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={icon} /></svg>
        </div>
        <div className="flex space-x-2">
           <button 
             onClick={(e) => { e.stopPropagation(); onConfigureVoice(); }} 
             title="Configure Voice"
             className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 hover:text-emerald-400 hover:border-emerald-500 transition-all"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
           </button>
           <button 
             onClick={(e) => { e.stopPropagation(); onVoice(); }} 
             title="Activate Voice"
             className="w-9 h-9 rounded-xl bg-orange-600/10 border border-orange-500/30 flex items-center justify-center text-orange-400 hover:bg-orange-600 hover:text-white transition-all"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7" /></svg>
           </button>
        </div>
      </div>
      <h3 className="font-outfit font-black text-2xl text-white mb-1 truncate uppercase tracking-tighter">{name}</h3>
      <p className="text-emerald-400 font-black text-[10px] uppercase tracking-widest mb-6">{subhead}</p>
      
      <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-1 font-medium italic opacity-80 line-clamp-3">"{desc}"</p>
      
      <div className="flex flex-wrap gap-2 mb-8 pt-6 border-t border-slate-800/50">
        {tags.map((t) => (
          <span key={t} className="text-[9px] px-3 py-1.5 rounded-lg font-black uppercase tracking-widest bg-slate-900 border border-slate-800 text-slate-500 group-hover:border-emerald-500/30 group-hover:text-emerald-400 transition-colors">{t}</span>
        ))}
      </div>
      
      <button onClick={() => navigate('/chat', { state: { agent: name } })} className="w-full py-5 quanta-btn-primary text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-xl flex items-center justify-center space-x-3">
        <span>Engage SME Link</span>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
      </button>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ track, profile }) => {
  const navigate = useNavigate();
  const [voiceConfig, setVoiceConfig] = useState({ 
    active: false, 
    agentName: '', 
    prompt: '', 
    skills: ['search'],
    voiceName: 'Zephyr',
    inputTranscription: true,
    outputTranscription: true
  });
  
  const [customAgents, setCustomAgents] = useState<AgentProps[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [editingVoiceAgent, setEditingVoiceAgent] = useState<AgentProps | null>(null);
  const [selectedMetricAgent, setSelectedMetricAgent] = useState<string>('');
  
  const [allVoiceSettings, setAllVoiceSettings] = useState<Record<string, VoiceSettings>>({});

  useEffect(() => {
    setAgentsLoading(true);
    const timer = setTimeout(() => {
      const savedCustom = localStorage.getItem(`quanta_custom_agents_${track}`);
      if (savedCustom) setCustomAgents(JSON.parse(savedCustom));
      
      const savedVoiceSettings = localStorage.getItem(`quanta_voice_settings_${track}`);
      if (savedVoiceSettings) setAllVoiceSettings(JSON.parse(savedVoiceSettings));
      
      setAgentsLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [track]);

  const saveVoiceSettings = (agentName: string, settings: VoiceSettings) => {
    const updated = { ...allVoiceSettings, [agentName]: settings };
    setAllVoiceSettings(updated);
    localStorage.setItem(`quanta_voice_settings_${track}`, JSON.stringify(updated));
    setEditingVoiceAgent(null);
  };

  const performanceData = useMemo(() => [
    { name: 'SME 1', val: 92, lat: 110, sat: 94, comp: 88, learn: 76 },
    { name: 'SME 2', val: 88, lat: 140, sat: 85, comp: 92, learn: 82 },
    { name: 'SME 3', val: 95, lat: 95, sat: 98, comp: 96, learn: 90 },
    { name: 'SME 4', val: 91, lat: 125, sat: 88, comp: 85, learn: 88 },
    { name: 'SME 5', val: 89, lat: 130, sat: 90, comp: 89, learn: 85 },
  ], []);

  const agents: AgentProps[] = useMemo(() => track === 'personal' ? [
    { name: "QAssistant", subhead: "Operations", desc: "Holistic life management and strategic time optimization using FPT logic.", systemPrompt: "You are QAssistant, an operations expert.", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", iconBg: "bg-emerald-600/20", iconColor: "text-emerald-400", tags: ["Life", "Axioms"] },
    { name: "QWealth", subhead: "Capital", desc: "Wealth preservation and multi-generational alpha detection.", systemPrompt: "You are QWealth, a capital management expert.", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2", iconBg: "bg-orange-600/20", iconColor: "text-orange-400", tags: ["Alpha", "Capital"] },
    { name: "QHealth", subhead: "Biology", desc: "Biohacking and health optimization based on unit-economics of human biology.", systemPrompt: "You are QHealth, a biology and longevity expert.", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364", iconBg: "bg-lime-600/20", iconColor: "text-lime-400", tags: ["Bio", "Longevity"] },
    { name: "QCreative", subhead: "Ideation", desc: "Neural engine for divergent thinking and artistic deconstruction.", systemPrompt: "You are QCreative, an ideation and design expert.", icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4", iconBg: "bg-blue-600/20", iconColor: "text-blue-400", tags: ["Design", "Vision"] },
    { name: "QLegacy", subhead: "Planning", desc: "Strategic architect for multi-year goals and estate sovereign logic.", systemPrompt: "You are QLegacy, a legacy and planning expert.", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16", iconBg: "bg-purple-600/20", iconColor: "text-purple-400", tags: ["Estate", "Long-term"] },
    { name: "QMind", subhead: "Psychology", desc: "Cognitive therapy and mental fortress construction through FPT.", systemPrompt: "You are QMind, a psychology and logic expert.", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6", iconBg: "bg-cyan-600/20", iconColor: "text-cyan-400", tags: ["Mind", "Logic"] },
    { name: "QNomad", subhead: "Travel", desc: "Global logistics and adventure deconstruction for high-performance living.", systemPrompt: "You are QNomad, a global logistics expert.", icon: "M3.055 11H5a2 2 0 012 2v1", iconBg: "bg-emerald-600/20", iconColor: "text-emerald-400", tags: ["Global", "Logistics"] },
    { name: "QSocial", subhead: "Network", desc: "Interpersonal architecture and network alpha management.", systemPrompt: "You are QSocial, a social network expert.", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857", iconBg: "bg-orange-600/20", iconColor: "text-orange-400", tags: ["Social", "Alpha"] },
    { name: "QSpeculator", subhead: "Strategy", desc: "Market deconstruction and arbitrage discovery across all neural nodes.", systemPrompt: "You are QSpeculator, an arbitrage and strategy expert.", icon: "M13 10V3L4 14h7v7l9-11h-7z", iconBg: "bg-lime-600/20", iconColor: "text-lime-400", tags: ["Arbitrage", "Physics"] },
  ] : [
    { name: "QStrategy", subhead: "Executive", desc: "High-level CEO orchestration and strategic polymath analysis.", systemPrompt: "You are QStrategy, an executive strategy core.", icon: "M16 8v8m-4-5v5m-4-2v2", iconBg: "bg-emerald-600/20", iconColor: "text-emerald-400", tags: ["CEO", "Logic"] },
    { name: "QGrowth", subhead: "Marketing", desc: "Aggressive market deconstruction and growth arbitrage detection.", systemPrompt: "You are QGrowth, a growth marketing expert.", icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592", iconBg: "bg-orange-600/20", iconColor: "text-orange-400", tags: ["Ads", "Scale"] },
    { name: "QFinance", subhead: "Capital", desc: "CFO-level capital management and unit-economic deconstruction.", systemPrompt: "You are QFinance, a capital and finance expert.", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2", iconBg: "bg-lime-600/20", iconColor: "text-lime-400", tags: ["CFO", "Units"] },
    { name: "QSales", subhead: "Revenue", desc: "Revenue generation and psychological sales deconstruction.", systemPrompt: "You are QSales, a revenue generation expert.", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", iconBg: "bg-blue-600/20", iconColor: "text-blue-400", tags: ["CRM", "Alpha"] },
    { name: "QOps", subhead: "Efficiency", desc: "Systematic operations and SOP architecting through FPT.", systemPrompt: "You are QOps, an operations efficiency expert.", icon: "M4 6h16M4 10h16M4 14h16M4 18h16", iconBg: "bg-purple-600/20", iconColor: "text-purple-400", tags: ["Ops", "SOP"] },
    { name: "QLegal", subhead: "Risk", desc: "Corporate risk deconstruction and sovereign legal shielding.", systemPrompt: "You are QLegal, a risk management expert.", icon: "M9 12l2 2 4-4m5.618-4.016", iconBg: "bg-cyan-600/20", iconColor: "text-cyan-400", tags: ["Legal", "Risk"] },
    { name: "QTalent", subhead: "HR", desc: "High-performance team construction and human capital alpha.", systemPrompt: "You are QTalent, a human capital expert.", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857", iconBg: "bg-emerald-600/20", iconColor: "text-emerald-400", tags: ["HR", "Team"] },
    { name: "QProduct", subhead: "Dev", desc: "Product-led growth and technical architecture deconstruction.", systemPrompt: "You are QProduct, a technical product expert.", icon: "M10 20l4-16m4 4l4 4-4 4", iconBg: "bg-orange-600/20", iconColor: "text-orange-400", tags: ["Dev", "Agile"] },
    { name: "QSuccess", subhead: "Retention", desc: "Customer success loops and loyalty deconstruction logic.", systemPrompt: "You are QSuccess, a customer success expert.", icon: "M14 10h2m-2 4h2m7-4H3", iconBg: "bg-lime-600/20", iconColor: "text-lime-400", tags: ["CS", "LTV"] },
  ], [track]);

  const allAgentsList = useMemo(() => [...agents, ...customAgents], [agents, customAgents]);

  useEffect(() => {
    if (allAgentsList.length > 0 && !selectedMetricAgent) {
      setSelectedMetricAgent(allAgentsList[0].name);
    }
  }, [allAgentsList]);

  const selectedAgentMetrics = useMemo(() => {
    const base = performanceData[allAgentsList.findIndex(a => a.name === selectedMetricAgent) % performanceData.length];
    return [
      { subject: 'Satisfaction', A: base.sat, fullMark: 100 },
      { subject: 'Completion', A: base.comp, fullMark: 100 },
      { subject: 'Learning', A: base.learn, fullMark: 100 },
      { subject: 'Latency', A: Math.max(0, 100 - (base.lat / 2)), fullMark: 100 },
      { subject: 'Accuracy', A: base.val, fullMark: 100 },
    ];
  }, [selectedMetricAgent, allAgentsList, performanceData]);

  const handleAddCustom = () => {
    const name = prompt("Enter SME Designation Name:");
    if (!name) return;
    const newAgent: AgentProps = {
      name,
      subhead: "Custom Node",
      desc: "Specialized neural core configured for operator-specific logic requirements.",
      systemPrompt: `You are ${name}, a custom SME core specialized in ${name}.`,
      icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4",
      iconBg: "bg-slate-800",
      iconColor: "text-orange-400",
      tags: ["Custom", "Operator"]
    };
    const updated = [...customAgents, newAgent];
    setCustomAgents(updated);
    localStorage.setItem(`quanta_custom_agents_${track}`, JSON.stringify(updated));
  };

  const getVoiceSettings = (agent: AgentProps): VoiceSettings => {
    return allVoiceSettings[agent.name] || {
      voiceName: 'Zephyr',
      inputTranscription: true,
      outputTranscription: true,
      systemPromptOverride: agent.systemPrompt,
      enabledSkills: ['search']
    };
  };

  const handleTriggerVoice = (agent: AgentProps) => {
    const settings = getVoiceSettings(agent);
    setVoiceConfig({
      active: true,
      agentName: agent.name,
      prompt: settings.systemPromptOverride || agent.systemPrompt,
      skills: settings.enabledSkills,
      voiceName: settings.voiceName,
      inputTranscription: settings.inputTranscription,
      outputTranscription: settings.outputTranscription
    });
  };

  return (
    <div className="animate-in fade-in duration-1000 pb-32">
      <VoiceAgent 
        isActive={voiceConfig.active} 
        agentName={voiceConfig.agentName} 
        systemInstruction={voiceConfig.prompt} 
        enabledSkills={voiceConfig.skills}
        voiceName={voiceConfig.voiceName}
        inputTranscription={voiceConfig.inputTranscription}
        outputTranscription={voiceConfig.outputTranscription}
        onClose={() => setVoiceConfig({ ...voiceConfig, active: false })} 
        profile={profile}
      />

      {editingVoiceAgent && (
        <VoiceConfigModal 
          agent={editingVoiceAgent}
          settings={getVoiceSettings(editingVoiceAgent)}
          onSave={(s) => saveVoiceSettings(editingVoiceAgent.name, s)}
          onClose={() => setEditingVoiceAgent(null)}
        />
      )}

      <nav className="flex items-center justify-between mb-24">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 quanta-btn-primary rounded-2xl flex items-center justify-center shadow-2xl animate-glow">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span className="font-outfit font-black text-4xl tracking-tighter text-white uppercase italic">QUANTA <span className="text-emerald-400">{track.toUpperCase()}</span></span>
        </div>
        <div className="flex items-center space-x-4">
           <button onClick={handleAddCustom} className="px-6 py-3 rounded-2xl border border-orange-500/30 bg-orange-500/5 text-orange-400 text-[11px] font-black uppercase tracking-widest flex items-center space-x-2 hover:bg-orange-500 hover:text-white transition-all">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
             <span>Forge Custom SME</span>
           </button>
           <div className="px-6 py-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-[11px] font-black uppercase tracking-widest flex items-center space-x-3">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"></span>
              <span>Neural Link Secure</span>
           </div>
        </div>
      </nav>

      <section className="text-center mb-24">
        <p className="text-orange-500 font-black uppercase tracking-[0.6em] text-[11px] mb-6">Operator callsign: {profile.callsign}</p>
        <h2 className="text-6xl md:text-8xl font-outfit font-black text-white mb-10 uppercase tracking-tighter leading-none italic">Sovereign <span className="quantum-gradient-text">Neural Hub</span></h2>
        <div className="h-2 w-48 bg-gradient-to-r from-emerald-500 to-orange-500 mx-auto rounded-full"></div>
      </section>

      <section className="mb-32">
        <div className="flex items-center justify-between mb-16">
           <h3 className="text-3xl font-outfit font-black text-white uppercase tracking-tighter italic">Neural Performance <span className="text-emerald-400">Ledger</span></h3>
           <div className="h-1 flex-1 mx-12 bg-gradient-to-r from-emerald-500/20 to-transparent"></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-4">
            {allAgentsList.map((agent, i) => {
              const metrics = performanceData[i % performanceData.length];
              const isSelected = selectedMetricAgent === agent.name;
              return (
                <button 
                  key={agent.name}
                  onClick={() => setSelectedMetricAgent(agent.name)}
                  className={`w-full text-left p-6 rounded-[2rem] border transition-all duration-300 flex items-center justify-between group ${isSelected ? 'bg-emerald-500/10 border-emerald-500/50 shadow-xl shadow-emerald-500/5' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-white/5 bg-slate-950 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={agent.icon} /></svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{agent.subhead}</p>
                      <h4 className="text-sm font-black text-white uppercase tracking-tighter">{agent.name}</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-outfit font-black ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}>{metrics.val}%</p>
                    <div className="w-16 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full ${isSelected ? 'bg-emerald-500' : 'bg-slate-600'} transition-all duration-1000`} style={{ width: `${metrics.val}%` }}></div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-card p-10 rounded-[4rem] border-emerald-500/10 flex flex-col items-center justify-center relative overflow-hidden group">
               <div className="absolute top-8 left-10">
                 <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Axiom Balance</h4>
                 <p className="text-lg font-outfit font-black text-white uppercase tracking-tighter italic">{selectedMetricAgent}</p>
               </div>
               <div className="w-full h-80 mt-12">
                 <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={selectedAgentMetrics}>
                      <PolarGrid stroke="#1e293b" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar
                        name={selectedMetricAgent}
                        dataKey="A"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.3}
                        animationDuration={1500}
                      />
                    </RadarChart>
                 </ResponsiveContainer>
               </div>
            </div>

            <div className="space-y-8">
               <div className="glass-card p-10 rounded-[3.5rem] border-orange-500/10 h-1/2 flex flex-col justify-center">
                  <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em] mb-6">Comparative Response Latency</h4>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={performanceData}>
                        <XAxis hide dataKey="name" />
                        <YAxis hide />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#020617', border: '1px solid #f97316', borderRadius: '16px' }} />
                        <Bar dataKey="lat" radius={[8, 8, 8, 8]}>
                          {performanceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={allAgentsList[index % allAgentsList.length]?.name === selectedMetricAgent ? '#f97316' : '#1e293b'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-[9px] font-black text-slate-500 uppercase">Lower is faster (ms)</p>
                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Avg: {Math.floor(performanceData.reduce((acc, curr) => acc + curr.lat, 0) / performanceData.length)}ms</p>
                  </div>
               </div>

               <div className="glass-card p-10 rounded-[3.5rem] border-blue-500/10 h-1/2 flex flex-col justify-center">
                  <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-6">User Satisfaction Core</h4>
                  <div className="flex items-end justify-between">
                     {performanceData.map((d, i) => (
                       <div key={i} className="flex flex-col items-center space-y-2">
                          <div 
                            className={`w-3 rounded-full transition-all duration-1000 ${allAgentsList[i % allAgentsList.length]?.name === selectedMetricAgent ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-800'}`} 
                            style={{ height: `${d.sat * 0.8}px` }}
                          ></div>
                          <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">{d.name.split(' ')[1]}</span>
                       </div>
                     ))}
                  </div>
                  <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-800">
                    <p className="text-[9px] font-black text-slate-500 uppercase">Global Sentiment</p>
                    <p className="text-xl font-outfit font-black text-blue-400">91.4%</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-32">
        <div className="flex items-center justify-between mb-16">
           <h3 className="text-3xl font-outfit font-black text-white uppercase tracking-tighter italic">Logic <span className="text-emerald-400">Cores</span></h3>
           <div className="h-1 flex-1 mx-12 bg-gradient-to-r from-emerald-500/20 to-transparent"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {agentsLoading ? (
            Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              {agents.map((agent) => (
                <SuperAgentCard 
                  key={agent.name} 
                  {...agent} 
                  onVoice={() => handleTriggerVoice(agent)} 
                  onConfigureVoice={() => setEditingVoiceAgent(agent)} 
                />
              ))}
              {customAgents.map((agent) => (
                <SuperAgentCard 
                  key={agent.name} 
                  {...agent} 
                  isCustom
                  onVoice={() => handleTriggerVoice(agent)} 
                  onConfigureVoice={() => setEditingVoiceAgent(agent)} 
                />
              ))}
            </>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="glass-card p-12 rounded-[4rem] border-emerald-500/10">
          <div className="flex items-center justify-between mb-12">
            <h3 className="text-3xl font-outfit font-black uppercase tracking-tighter text-white italic">FPT Optimization</h3>
            <div className="w-4 h-4 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_15px_#10b981]"></div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 900 }} />
                <Tooltip cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }} contentStyle={{ backgroundColor: '#020617', border: '1px solid #10b981', borderRadius: '24px' }} />
                <Bar dataKey="val" radius={[12, 12, 0, 0]}>
                  {performanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10b981' : '#f97316'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-12 rounded-[4rem] border-orange-500/10">
          <div className="flex items-center justify-between mb-12">
            <h3 className="text-3xl font-outfit font-black uppercase tracking-tighter text-white italic">Neural Flow</h3>
            <div className="w-4 h-4 bg-orange-500 rounded-full animate-pulse shadow-[0_0_15px_#f97316]"></div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorLat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="lat" stroke="#f97316" strokeWidth={5} fillOpacity={1} fill="url(#colorLat)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
