
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
  track: 'personal' | 'business' | 'trading';
  profile: { name: string, callsign: string, personality: string };
}

const VOICE_OPTIONS = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
const SKILL_OPTIONS = [
  { id: 'search', name: 'Google Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { id: 'gmail', name: 'Gmail Link', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { id: 'calendar', name: 'Calendar Sync', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { id: 'docs', name: 'Docs Architect', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'drive', name: 'Drive Vault', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v10a2 2 0 00-2 v10a2 2 0 002 2z' }
];

const SMEAgentSkeleton: React.FC = () => (
  <div className="sme-card-enhanced p-8 rounded-[3.5rem] flex flex-col h-full border border-slate-800 bg-slate-900/40 animate-pulse overflow-hidden">
    <div className="mb-10 flex items-start justify-between">
      <div className="w-16 h-16 rounded-[1.5rem] bg-slate-800 border border-slate-700 shadow-inner"></div>
      <div className="flex space-x-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700"></div>
        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700"></div>
      </div>
    </div>
    <div className="h-8 w-3/4 bg-slate-800 rounded-lg mb-2"></div>
    <div className="h-3 w-1/4 bg-emerald-500/20 rounded-full mb-8"></div>
    <div className="flex-1 space-y-3 mb-8">
      <div className="h-4 w-full bg-slate-800/60 rounded-lg"></div>
      <div className="h-4 w-5/6 bg-slate-800/60 rounded-lg"></div>
      <div className="h-4 w-4/6 bg-slate-800/60 rounded-lg"></div>
    </div>
    <div className="flex flex-wrap gap-2 mb-10 pt-8 border-t border-slate-800/50">
      <div className="h-5 w-12 bg-slate-800 rounded-full"></div>
      <div className="h-5 w-16 bg-slate-800 rounded-full"></div>
      <div className="h-5 w-14 bg-slate-800 rounded-full"></div>
    </div>
    <div className="space-y-4">
      <div className="w-full h-16 bg-slate-800 rounded-[2rem]"></div>
      <div className="w-full h-14 bg-slate-800/50 rounded-[2rem]"></div>
    </div>
  </div>
);

const SMEForgeModal: React.FC<{
  onClose: () => void;
  onForge: (agent: AgentProps) => void;
}> = ({ onClose, onForge }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [desc, setDesc] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !role) return;
    
    const newAgent: AgentProps = {
      name,
      subhead: role,
      desc: desc || `Specialized neural core for ${role} operations.`,
      systemPrompt: `You are ${name}, a custom SME core specialized in ${role}. Use First Principles thinking.`,
      icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4",
      iconBg: "bg-slate-800",
      iconColor: "text-emerald-400",
      tags: ["Custom", "Operator", role.split(' ')[0]]
    };
    onForge(newAgent);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-6 animate-in fade-in zoom-in duration-300">
      <div className="glass-card w-full max-w-2xl rounded-[3.5rem] border-emerald-500/30 overflow-hidden shadow-[0_0_100px_rgba(16,185,129,0.1)]">
        <div className="p-12 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-outfit font-black text-white uppercase tracking-tighter italic">SME <span className="text-emerald-400">Forge</span></h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Synthesizing New Neural Logic Node</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-12 space-y-8">
          <div className="space-y-4">
            <label className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] block ml-2">Core Designation (Name)</label>
            <input 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. QStrategic-X"
              className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-5 px-8 text-white font-bold focus:border-emerald-500 transition-all outline-none"
            />
          </div>
          <div className="space-y-4">
            <label className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] block ml-2">Archetype / Role</label>
            <input 
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Market Speculation, Bio-Tactician"
              className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-5 px-8 text-white font-bold focus:border-emerald-500 transition-all outline-none"
            />
          </div>
          <div className="space-y-4">
            <label className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] block ml-2">Logic Description</label>
            <textarea 
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Define the primary logic objective of this SME node..."
              className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-5 px-8 text-white font-medium text-sm focus:border-emerald-500 transition-all outline-none min-h-[120px]"
            />
          </div>
          <div className="pt-6 flex space-x-4">
            <button type="button" onClick={onClose} className="flex-1 py-6 bg-slate-900 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all">Abort Forge</button>
            <button type="submit" className="flex-[2] py-6 quanta-btn-primary text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:scale-[1.02] transition-all">Begin Synthesis</button>
          </div>
        </form>
      </div>
    </div>
  );
};

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
            <h2 className="text-3xl font-outfit font-black text-white uppercase tracking-tighter italic">SME <span className="text-emerald-400">Architecture</span></h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Configuring {agent.name} Logic Core</p>
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
                <button key={v} onClick={() => setLocalSettings({ ...localSettings, voiceName: v })} className={`py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${localSettings.voiceName === v ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                  {v}
                </button>
              ))}
            </div>
          </section>
          <section className="space-y-6">
            <label className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] block">Independent Capabilities (Skills)</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {SKILL_OPTIONS.map(skill => (
                <button key={skill.id} onClick={() => toggleSkill(skill.id)} className={`flex items-center space-x-3 p-4 rounded-2xl border transition-all text-left ${localSettings.enabledSkills.includes(skill.id) ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={skill.icon} /></svg>
                  <span className="text-[10px] font-black uppercase tracking-widest">{skill.name}</span>
                </button>
              ))}
            </div>
            <p className="text-[9px] text-slate-600 uppercase tracking-widest px-2 italic">Skills are enabled independently for this agent and persist across sessions.</p>
          </section>
          <section className="space-y-6">
            <label className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] block">Telemetry Settings</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center justify-between p-5 bg-slate-900/50 rounded-2xl border border-slate-800 cursor-pointer hover:bg-slate-800/50 transition-colors">
                <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Input Transcription</span>
                <input type="checkbox" className="w-6 h-6 accent-emerald-500" checked={localSettings.inputTranscription} onChange={(e) => setLocalSettings({ ...localSettings, inputTranscription: e.target.checked })} />
              </label>
              <label className="flex items-center justify-between p-5 bg-slate-900/50 rounded-2xl border border-slate-800 cursor-pointer hover:bg-slate-800/50 transition-colors">
                <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Output Transcription</span>
                <input type="checkbox" className="w-6 h-6 accent-emerald-500" checked={localSettings.outputTranscription} onChange={(e) => setLocalSettings({ ...localSettings, outputTranscription: e.target.checked })} />
              </label>
            </div>
          </section>
          <section className="space-y-6">
            <label className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] block">Custom Neural Objective Override</label>
            <textarea value={localSettings.systemPromptOverride} onChange={(e) => setLocalSettings({ ...localSettings, systemPromptOverride: e.target.value })} placeholder="Inject custom behavioral logic for this specific SME..." className="w-full bg-slate-950 border border-slate-800 rounded-3xl p-8 text-slate-300 font-medium text-sm focus:border-emerald-500 transition-all min-h-[150px] custom-scrollbar" />
          </section>
        </div>
        <div className="p-10 border-t border-slate-800 flex space-x-6">
          <button onClick={onClose} className="flex-1 py-6 bg-slate-900 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all">Cancel</button>
          <button onClick={() => onSave(localSettings)} className="flex-1 py-6 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-emerald-500/30 hover:bg-emerald-500 transition-all">Commit Architecture</button>
        </div>
      </div>
    </div>
  );
};

const SuperAgentCard: React.FC<AgentProps & { 
  onVoice: () => void, 
  onConfigure: () => void, 
  isCustom?: boolean,
  enabledSkills: string[]
}> = ({ name, subhead, desc, icon, tags, iconBg, iconColor, onVoice, onConfigure, isCustom, enabledSkills }) => {
  const navigate = useNavigate();
  return (
    <div className={`sme-card-enhanced p-8 rounded-[3.5rem] flex flex-col h-full border group ${isCustom ? 'border-orange-500/40' : ''}`}>
      <div className="mb-10 flex items-start justify-between">
        <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center border border-emerald-400/30 bg-[#020617]/80 ${iconColor} transition-transform group-hover:scale-110 shadow-lg`}>
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={icon} /></svg>
        </div>
        <div className="flex space-x-3 relative z-10">
           <button onClick={(e) => { e.stopPropagation(); onConfigure(); }} title="Configure Logic Core" className="w-10 h-10 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400 hover:text-white hover:bg-emerald-600 transition-all shadow-inner">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
           </button>
           <button onClick={(e) => { e.stopPropagation(); onVoice(); }} title="Activate Vocal Link" className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/50 flex items-center justify-center text-orange-400 hover:bg-orange-600 hover:text-white transition-all shadow-xl">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7" /></svg>
           </button>
        </div>
      </div>
      <h3 className="font-outfit font-black text-3xl text-white mb-1 truncate uppercase tracking-tighter leading-none italic group-hover:text-emerald-300 transition-colors">{name}</h3>
      <p className={`font-black text-[11px] uppercase tracking-[0.3em] mb-8 ${isCustom ? 'text-orange-400' : 'text-emerald-400'}`}>{subhead}</p>
      <div className="flex-1">
        <p className="text-slate-300 text-[15px] leading-relaxed mb-8 font-medium italic opacity-80 group-hover:opacity-100 transition-opacity line-clamp-4">"{desc}"</p>
      </div>
      
      {/* Skill Indicators */}
      <div className="flex space-x-2 mb-6">
        {SKILL_OPTIONS.map(s => (
          <div key={s.id} title={s.name} className={`w-6 h-6 rounded-md flex items-center justify-center border ${enabledSkills.includes(s.id) ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-slate-800 bg-slate-900 text-slate-700 opacity-40'}`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={s.icon} /></svg>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-10 pt-8 border-t border-emerald-500/10">
        {tags.map((t) => (
          <span key={t} className="text-[9px] px-3.5 py-2 rounded-xl font-black uppercase tracking-widest bg-slate-950/50 border border-emerald-500/20 text-emerald-400/70 group-hover:border-emerald-500/50 group-hover:text-emerald-300 transition-all">{t}</span>
        ))}
      </div>
      <div className="flex flex-col space-y-4">
        <button onClick={() => navigate('/chat', { state: { agent: name } })} className="w-full py-6 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-[12px] shadow-2xl flex items-center justify-center space-x-4 transition-all hover:scale-[1.02] quanta-btn-primary group-hover:shadow-emerald-500/30">
          <span>Engage SME Link</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onVoice(); }} className="w-full py-5 rounded-[2rem] font-black uppercase tracking-[0.3em] text-[10px] border transition-all flex items-center justify-center space-x-4 bg-slate-900 border-orange-500/30 text-orange-400 hover:bg-orange-600 hover:text-white shadow-xl">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          <span>Initialize Vocal Link</span>
        </button>
      </div>
    </div>
  );
};

const ForgePlaceholderCard: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} className="glass-card p-10 rounded-[3.5rem] flex flex-col items-center justify-center text-center border-2 border-dashed border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-500/5 transition-all duration-500 group min-h-[500px] shadow-2xl">
    <div className="w-24 h-24 rounded-full bg-slate-950 border-2 border-emerald-500/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shadow-[0_0_30px_rgba(16,185,129,0.1)]">
      <svg className="w-12 h-12 text-emerald-500 group-hover:rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
    </div>
    <h3 className="font-outfit font-black text-3xl text-white mb-2 uppercase tracking-tighter italic">Forge New Core</h3>
    <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mb-6">Initialize Custom Neural Logic</p>
  </button>
);

const Dashboard: React.FC<DashboardProps> = ({ track, profile }) => {
  const navigate = useNavigate();
  const [voiceConfig, setVoiceConfig] = useState({ active: false, agentName: '', prompt: '', skills: ['search'], voiceName: 'Zephyr', inputTranscription: true, outputTranscription: true });
  const [customAgents, setCustomAgents] = useState<AgentProps[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState<AgentProps | null>(null);
  const [isForgeModalOpen, setIsForgeModalOpen] = useState(false);
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
    setEditingAgent(null);
  };

  const performanceData = useMemo(() => [
    { name: 'SME 1', val: 92, lat: 110, sat: 94, comp: 88, learn: 76 },
    { name: 'SME 2', val: 88, lat: 140, sat: 85, comp: 92, learn: 82 },
    { name: 'SME 3', val: 95, lat: 95, sat: 98, comp: 96, learn: 90 },
    { name: 'SME 4', val: 91, lat: 125, sat: 88, comp: 85, learn: 88 },
    { name: 'SME 5', val: 89, lat: 130, sat: 90, comp: 89, learn: 85 },
  ], []);

  const agents: AgentProps[] = useMemo(() => {
    if (track === 'personal') {
      return [
        { name: "QAssistant", subhead: "Operations", desc: "Holistic life management and strategic time optimization using FPT logic.", systemPrompt: "You are QAssistant, an operations expert.", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", iconBg: "bg-emerald-600/20", iconColor: "text-emerald-400", tags: ["Life", "Axioms"] },
        { name: "QWealth", subhead: "Capital", desc: "Wealth preservation and multi-generational alpha detection.", systemPrompt: "You are QWealth, a capital management expert.", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2", iconBg: "bg-orange-600/20", iconColor: "text-orange-400", tags: ["Alpha", "Capital"] },
        { name: "QHealth", subhead: "Biology", desc: "Biohacking and health optimization based on unit-economics of human biology.", systemPrompt: "You are QHealth, a biology and longevity expert.", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364", iconBg: "bg-lime-600/20", iconColor: "text-lime-400", tags: ["Bio", "Longevity"] },
        { name: "QCreative", subhead: "Ideation", desc: "Neural engine for divergent thinking and artistic deconstruction.", systemPrompt: "You are QCreative, an ideation and design expert.", icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4", iconBg: "bg-blue-600/20", iconColor: "text-blue-400", tags: ["Design", "Vision"] },
        { name: "QLegacy", subhead: "Planning", desc: "Strategic architect for multi-year goals and estate sovereign logic.", systemPrompt: "You are QLegacy, a legacy and planning expert.", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16", iconBg: "bg-purple-600/20", iconColor: "text-purple-400", tags: ["Estate", "Long-term"] },
        { name: "QMind", subhead: "Psychology", desc: "Cognitive therapy and mental fortress construction through FPT.", systemPrompt: "You are QMind, a psychology and logic expert.", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6", iconBg: "bg-cyan-600/20", iconColor: "text-cyan-400", tags: ["Mind", "Logic"] },
        { name: "QNomad", subhead: "Travel", desc: "Global logistics and adventure deconstruction for high-performance living.", systemPrompt: "You are QNomad, a global logistics expert.", icon: "M3.055 11H5a2 2 0 012 2v1", iconBg: "bg-emerald-600/20", iconColor: "text-emerald-400", tags: ["Global", "Logistics"] },
        { name: "QSocial", subhead: "Network", desc: "Interpersonal architecture and network alpha management.", systemPrompt: "You are QSocial, a social network expert.", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857", iconBg: "bg-orange-600/20", iconColor: "text-orange-400", tags: ["Social", "Alpha"] },
        { name: "QSpeculator", subhead: "Strategy", desc: "Market deconstruction and arbitrage discovery across all neural nodes.", systemPrompt: "You are QSpeculator, an arbitrage and strategy expert.", icon: "M13 10V3L4 14h7v7l9-11h-7z", iconBg: "bg-lime-600/20", iconColor: "text-lime-400", tags: ["Arbitrage", "Physics"] },
      ];
    } else if (track === 'business') {
      return [
        { name: "QStrategy", subhead: "Executive", desc: "High-level CEO orchestration and strategic polymath analysis.", systemPrompt: "You are QStrategy, an executive strategy core.", icon: "M16 8v8m-4-5v5m-4-2v2", iconBg: "bg-emerald-600/20", iconColor: "text-emerald-400", tags: ["CEO", "Logic"] },
        { name: "QGrowth", subhead: "Marketing", desc: "Aggressive market deconstruction and growth arbitrage detection.", systemPrompt: "You are QGrowth, a growth marketing expert.", icon: "M11 5.882", iconBg: "bg-orange-600/20", iconColor: "text-orange-400", tags: ["Ads", "Scale"] },
        { name: "QFinance", subhead: "Capital", desc: "CFO-level capital management and unit-economic deconstruction.", systemPrompt: "You are QFinance, a capital and finance expert.", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2", iconBg: "bg-lime-600/20", iconColor: "text-lime-400", tags: ["CFO", "Units"] },
        { name: "QSales", subhead: "Revenue", desc: "Revenue generation and psychological sales deconstruction.", systemPrompt: "You are QSales, a revenue generation expert.", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", iconBg: "bg-blue-600/20", iconColor: "text-blue-400", tags: ["CRM", "Alpha"] },
        { name: "QOps", subhead: "Efficiency", desc: "Systematic operations and SOP architecting through FPT.", systemPrompt: "You are QOps, an operations efficiency expert.", icon: "M4 6h16M4 10h16M4 14h16M4 18h16", iconBg: "bg-purple-600/20", iconColor: "text-purple-400", tags: ["Ops", "SOP"] },
        { name: "QLegal", subhead: "Risk", desc: "Corporate risk deconstruction and sovereign legal shielding.", systemPrompt: "You are QLegal, a risk management expert.", icon: "M9 12l2 2 4-4m5.618-4.016", iconBg: "bg-cyan-600/20", iconColor: "text-cyan-400", tags: ["Legal", "Risk"] },
        { name: "QTalent", subhead: "HR", desc: "High-performance team construction and human capital alpha.", systemPrompt: "You are QTalent, a human capital expert.", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857", iconBg: "bg-emerald-600/20", iconColor: "text-emerald-400", tags: ["HR", "Team"] },
        { name: "QProduct", subhead: "Dev", desc: "Product-led growth and technical architecture deconstruction.", systemPrompt: "You are QProduct, a technical product expert.", icon: "M10 20l4-16m4 4l4 4-4 4", iconBg: "bg-orange-600/20", iconColor: "text-orange-400", tags: ["Dev", "Agile"] },
        { name: "QSuccess", subhead: "Retention", desc: "Customer success loops and loyalty deconstruction logic.", systemPrompt: "You are QSuccess, a customer success expert.", icon: "M14 10h2m-2 4h2m7-4H3", iconBg: "bg-lime-600/20", iconColor: "text-lime-400", tags: ["CS", "LTV"] },
      ];
    } else {
      return [
        { name: "QTradeAnalyst", subhead: "Technicals", desc: "Technical analysis and pattern recognition specialist. Deciphers price action and volume signals.", systemPrompt: "You are QTradeAnalyst, an expert in technical chart analysis and pattern recognition.", icon: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18v16H3V4z", iconBg: "bg-blue-600/20", iconColor: "text-blue-400", tags: ["Charts", "Patterns"] },
        { name: "QNewsSentry", subhead: "Fundamentals", desc: "Global news aggregator and impact analyst. Filters signal from noise in real-time headlines.", systemPrompt: "You are QNewsSentry, a global news analyst filtering market signals from noise.", icon: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2zM7 8h5m-5 4h5m-5 4h10", iconBg: "bg-slate-600/20", iconColor: "text-slate-400", tags: ["News", "Macro"] },
        { name: "QSentimentEngine", subhead: "Psychology", desc: "Market psychology and positioning expert. Gauges retail hype vs institutional flow.", systemPrompt: "You are QSentimentEngine, an expert in gauging retail and institutional market mood.", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z", iconBg: "bg-rose-600/20", iconColor: "text-rose-400", tags: ["Mood", "Psych"] },
        { name: "QRiskQuant", subhead: "Risk Management", desc: "Portfolio protection and mathematical risk architect. Calculates VaR and optimal sizing.", systemPrompt: "You are QRiskQuant, a risk management expert focused on mathematical protection.", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", iconBg: "bg-orange-600/20", iconColor: "text-orange-400", tags: ["VaR", "Sizing"] },
        { name: "QVolExpert", subhead: "Volatility", desc: "Volatility surface and IV/HV relationship specialist. Navigates the VIX and volatility regimes.", systemPrompt: "You are QVolExpert, specializing in volatility surfaces and VIX regimes.", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", iconBg: "bg-cyan-600/20", iconColor: "text-cyan-400", tags: ["VIX", "IV/HV"] },
        { name: "QOptionStrategist", subhead: "Derivatives", desc: "Complex derivatives architect. Designs spreads, straddles, and exotic hedges.", systemPrompt: "You are QOptionStrategist, a specialist in complex option structures and Greeks.", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", iconBg: "bg-indigo-600/20", iconColor: "text-indigo-400", tags: ["Greeks", "Spreads"] },
        { name: "QThetaBurn", subhead: "Yield", desc: "Time-decay and premium collection specialist. Maximizes yield through theta-positive logic.", systemPrompt: "You are QThetaBurn, an expert in theta decay and premium selling logic.", icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z", iconBg: "bg-emerald-600/20", iconColor: "text-emerald-400", tags: ["Decay", "Shorts"] },
        { name: "QYieldHunter", subhead: "ETFs", desc: "ETF/ETP and income specialist. Deconstructs expense ratios and underlying basket alpha.", systemPrompt: "You are QYieldHunter, an expert in analyzing ETFs, ETPs, and underlying baskets.", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", iconBg: "bg-lime-600/20", iconColor: "text-lime-400", tags: ["ETF", "Alpha"] },
        { name: "QMacroEdge", subhead: "Global Macro", desc: "Global macro strategist. Correlates interest rates, FX, and geopolitical shifts.", systemPrompt: "You are QMacroEdge, a global macro strategist focused on cross-asset correlation.", icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9", iconBg: "bg-purple-600/20", iconColor: "text-purple-400", tags: ["FX", "Macro"] },
      ];
    }
  }, [track]);

  const allAgentsList = useMemo(() => [...agents, ...customAgents], [agents, customAgents]);

  useEffect(() => {
    if (allAgentsList.length > 0 && !selectedMetricAgent) {
      setSelectedMetricAgent(allAgentsList[0].name);
    }
  }, [allAgentsList, selectedMetricAgent]);

  const selectedAgentMetrics = useMemo(() => {
    const index = allAgentsList.findIndex(a => a.name === selectedMetricAgent);
    const safeIndex = (index !== -1) ? index % performanceData.length : 0;
    const base = performanceData[safeIndex] || { val: 0, lat: 0, sat: 0, comp: 0, learn: 0 };
    return [
      { subject: 'Satisfaction', A: base.sat || 0, fullMark: 100 },
      { subject: 'Completion', A: base.comp || 0, fullMark: 100 },
      { subject: 'Learning', A: base.learn || 0, fullMark: 100 },
      { subject: 'Latency', A: Math.max(0, 100 - ((base.lat || 0) / 2)), fullMark: 100 },
      { subject: 'Accuracy', A: base.val || 0, fullMark: 100 },
    ];
  }, [selectedMetricAgent, allAgentsList, performanceData]);

  const handleForge = (newAgent: AgentProps) => {
    const updated = [...customAgents, newAgent];
    setCustomAgents(updated);
    localStorage.setItem(`quanta_custom_agents_${track}`, JSON.stringify(updated));
    setIsForgeModalOpen(false);
  };

  const getVoiceSettings = (agent: AgentProps): VoiceSettings => {
    return allVoiceSettings[agent.name] || { voiceName: 'Zephyr', inputTranscription: true, outputTranscription: true, systemPromptOverride: agent.systemPrompt, enabledSkills: ['search'] };
  };

  const handleTriggerVoice = (agent: AgentProps) => {
    const settings = getVoiceSettings(agent);
    setVoiceConfig({ active: true, agentName: agent.name, prompt: settings.systemPromptOverride || agent.systemPrompt, skills: settings.enabledSkills, voiceName: settings.voiceName, inputTranscription: settings.inputTranscription, outputTranscription: settings.outputTranscription });
  };

  return (
    <div className="animate-in fade-in duration-1000 pb-32">
      <VoiceAgent isActive={voiceConfig.active} agentName={voiceConfig.agentName} systemInstruction={voiceConfig.prompt} enabledSkills={voiceConfig.skills} voiceName={voiceConfig.voiceName} inputTranscription={voiceConfig.inputTranscription} outputTranscription={voiceConfig.outputTranscription} onClose={() => setVoiceConfig({ ...voiceConfig, active: false })} profile={profile} />
      {editingAgent && <VoiceConfigModal agent={editingAgent} settings={getVoiceSettings(editingAgent)} onSave={(s) => saveVoiceSettings(editingAgent.name, s)} onClose={() => setEditingAgent(null)} />}
      {isForgeModalOpen && <SMEForgeModal onClose={() => setIsForgeModalOpen(false)} onForge={handleForge} />}
      <nav className="flex items-center justify-between mb-24">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 quanta-btn-primary rounded-2xl flex items-center justify-center shadow-2xl animate-glow">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span className="font-outfit font-black text-4xl tracking-tighter text-white uppercase italic">QUANTA <span className="text-emerald-400">{track.toUpperCase()}</span></span>
        </div>
        <div className="flex items-center space-x-4">
           <button onClick={() => setIsForgeModalOpen(true)} className="px-6 py-3 rounded-2xl border border-orange-500/30 bg-orange-500/5 text-orange-400 text-[11px] font-black uppercase tracking-widest flex items-center space-x-2 hover:bg-orange-600 hover:text-white transition-all shadow-lg hover:shadow-orange-500/20">
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
        <p className="text-emerald-500 font-black uppercase tracking-[0.6em] text-[11px] mb-6">Operator callsign: {profile.callsign}</p>
        <h2 className="text-6xl md:text-8xl font-outfit font-black text-white mb-10 uppercase tracking-tighter leading-none italic">Sovereign <span className="quantum-gradient-text italic">Neural Hub</span></h2>
        <div className="h-1.5 w-48 bg-gradient-to-r from-emerald-500 via-teal-500 to-orange-500 mx-auto rounded-full"></div>
      </section>
      
      {/* Neural Ledger Section */}
      <section className="mb-32">
        <div className="flex items-center justify-between mb-16">
           <h3 className="text-3xl font-outfit font-black text-white uppercase tracking-tighter italic">Neural Performance <span className="text-emerald-400">Ledger</span></h3>
           <div className="h-px flex-1 mx-12 bg-gradient-to-r from-emerald-500/30 to-transparent"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-4">
            {allAgentsList.map((agent, i) => {
              const metrics = performanceData[i % performanceData.length] || { val: 0 };
              const isSelected = selectedMetricAgent === agent.name;
              return (
                <button key={agent.name} onClick={() => setSelectedMetricAgent(agent.name)} className={`w-full text-left p-6 rounded-[2rem] border transition-all duration-300 flex items-center justify-between group ${isSelected ? 'bg-emerald-600/10 border-emerald-500 shadow-xl' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>
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
                  </div>
                </button>
              );
            })}
          </div>
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-card p-10 rounded-[4rem] border-emerald-500/10 flex flex-col items-center justify-center relative overflow-hidden group shadow-2xl">
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
                      <Radar name={selectedMetricAgent} dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.3} animationDuration={1500} />
                    </RadarChart>
                 </ResponsiveContainer>
               </div>
            </div>
            <div className="space-y-8">
               <div className="glass-card p-10 rounded-[3.5rem] border-orange-500/10 h-1/2 flex flex-col justify-center">
                  <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em] mb-6">Response Latency</h4>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={performanceData}>
                        <XAxis hide dataKey="name" />
                        <YAxis hide />
                        <Bar dataKey="lat" radius={[8, 8, 8, 8]}>
                          {performanceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={allAgentsList[index % allAgentsList.length]?.name === selectedMetricAgent ? '#f97316' : '#1e293b'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>
               <div className="glass-card p-10 rounded-[3.5rem] border-emerald-500/10 h-1/2 flex flex-col justify-center">
                  <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-6">User Satisfaction</h4>
                  <div className="flex items-end justify-between px-2">
                     {performanceData.map((d, i) => (
                       <div key={i} className={`w-3 rounded-full transition-all duration-1000 ${allAgentsList[i % (allAgentsList.length || 1)]?.name === selectedMetricAgent ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-slate-800'}`} style={{ height: `${(d.sat || 0) * 0.8}px` }}></div>
                     ))}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logic Cores Section */}
      <section className="mb-32">
        <div className="flex items-center justify-between mb-16">
           <h3 className="text-3xl font-outfit font-black text-white uppercase tracking-tighter italic">Logic <span className="text-emerald-400">Cores</span></h3>
           <div className="h-px flex-1 mx-12 bg-gradient-to-r from-emerald-500/30 to-transparent"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {agentsLoading ? Array.from({ length: 6 }).map((_, i) => <SMEAgentSkeleton key={i} />) : (
            <>
              {agents.map((agent) => (
                <SuperAgentCard 
                  key={agent.name} 
                  {...agent} 
                  onVoice={() => handleTriggerVoice(agent)} 
                  onConfigure={() => setEditingAgent(agent)} 
                  enabledSkills={getVoiceSettings(agent).enabledSkills}
                />
              ))}
              {customAgents.map((agent) => (
                <SuperAgentCard 
                  key={agent.name} 
                  {...agent} 
                  isCustom 
                  onVoice={() => handleTriggerVoice(agent)} 
                  onConfigure={() => setEditingAgent(agent)} 
                  enabledSkills={getVoiceSettings(agent).enabledSkills}
                />
              ))}
              <ForgePlaceholderCard onClick={() => setIsForgeModalOpen(true)} />
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
