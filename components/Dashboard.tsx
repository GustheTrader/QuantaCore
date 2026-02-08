import React, { useState, useEffect, useMemo } from 'react';
import { 
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, 
  BarChart, XAxis, YAxis, Bar, Cell, AreaChart, CartesianGrid, Tooltip, Area 
} from 'recharts';
import { VoiceAgent } from './VoiceAgent';

interface DashboardProps {
  track: 'personal' | 'business' | 'trading';
  profile: { name: string, callsign: string, personality: string };
}

interface AgentProps {
  name: string;
  subhead: string;
  icon: string;
  systemPrompt: string;
}

interface VoiceSettings {
  voiceName: string;
  inputTranscription: boolean;
  outputTranscription: boolean;
  systemPromptOverride?: string;
  enabledSkills: string[];
}

// Placeholder Modal Components
const VoiceConfigModal = ({ agent, settings, onSave, onClose }: any) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <h3 className="text-white mb-4">Voice Config: {agent.name}</h3>
        <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-white rounded">Close</button>
      </div>
    </div>
  );
};

const SMEForgeModal = ({ onClose, onForge }: any) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <h3 className="text-white mb-4">Forge New Agent</h3>
        <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-white rounded">Close</button>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ track, profile }) => {
  const [selectedMetricAgent, setSelectedMetricAgent] = useState<string>('QAssistant');
  const [customAgents, setCustomAgents] = useState<AgentProps[]>([]);
  const [isForgeModalOpen, setIsForgeModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentProps | null>(null);
  const [allVoiceSettings, setAllVoiceSettings] = useState<Record<string, VoiceSettings>>({});
  
  const [voiceConfig, setVoiceConfig] = useState<{
    active: boolean;
    agentName: string;
    prompt: string;
    skills: string[];
    voiceName?: string;
    inputTranscription?: boolean;
    outputTranscription?: boolean;
  }>({ active: false, agentName: '', prompt: '', skills: [] });

  const allAgentsList: AgentProps[] = [
    { name: 'QAssistant', subhead: 'Personal Aide', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', systemPrompt: 'You are a helpful assistant.' },
    { name: 'QStrategy', subhead: 'Strategic Ops', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', systemPrompt: 'You are a strategic advisor.' },
    { name: 'QCreative', subhead: 'Idea Engine', icon: 'M7 21a4 4 0 01-4-4c0-1.473 1.333-2.656 4-2.656 2.667 0 4 1.183 4 2.656a4 4 0 01-4 4zm0-10a4 4 0 100-8 4 4 0 000 8z', systemPrompt: 'You are a creative muse.' },
    ...customAgents
  ];

  const performanceData = [
    { name: 'QAssistant', val: 92, lat: 120, sat: 98, comp: 95, learn: 88 },
    { name: 'QStrategy', val: 89, lat: 180, sat: 94, comp: 92, learn: 85 },
    { name: 'QCreative', val: 95, lat: 150, sat: 96, comp: 88, learn: 92 },
  ];

  const saveVoiceSettings = (agentName: string, settings: VoiceSettings) => {
    setAllVoiceSettings(prev => ({ ...prev, [agentName]: settings }));
    setEditingAgent(null);
  };

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

  const telemetryData = useMemo(() => [
    { time: 'T-60', efficiency: 65, load: 40 },
    { time: 'T-50', efficiency: 72, load: 45 },
    { time: 'T-40', efficiency: 68, load: 55 },
    { time: 'T-30', efficiency: 85, load: 70 },
    { time: 'T-20', efficiency: 82, load: 65 },
    { time: 'T-10', efficiency: 90, load: 50 },
    { time: 'Now', efficiency: 94, load: 45 },
  ], []);

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
      {editingAgent && <VoiceConfigModal agent={editingAgent} settings={getVoiceSettings(editingAgent)} onSave={(s: VoiceSettings) => saveVoiceSettings(editingAgent.name, s)} onClose={() => setEditingAgent(null)} />}
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
          <div className="lg:col-span-8 flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

            <div className="glass-card p-10 rounded-[3rem] border-slate-800/50 relative overflow-hidden">
               <div className="flex items-center justify-between mb-6">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Real-time Cognitive Load vs Efficiency</h4>
                 <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span><span className="text-[9px] font-bold text-slate-500 uppercase">Efficiency</span></div>
                    <div className="flex items-center space-x-2"><span className="w-2 h-2 rounded-full bg-orange-500"></span><span className="text-[9px] font-bold text-slate-500 uppercase">Load</span></div>
                 </div>
               </div>
               <div className="h-48 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={telemetryData}>
                     <defs>
                       <linearGradient id="colorEff" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                         <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                       </linearGradient>
                       <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                         <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                     <XAxis dataKey="time" tick={{fill: '#64748b', fontSize: 10}} axisLine={false} tickLine={false} />
                     <YAxis hide />
                     <Tooltip 
                       contentStyle={{backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px'}}
                       itemStyle={{fontSize: '11px', fontWeight: 'bold'}}
                     />
                     <Area type="monotone" dataKey="efficiency" stroke="#10b981" fillOpacity={1} fill="url(#colorEff)" strokeWidth={3} />
                     <Area type="monotone" dataKey="load" stroke="#f97316" fillOpacity={1} fill="url(#colorLoad)" strokeWidth={3} />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Operational Kanban Core Section */}
      <section className="mb-32">
        <h3 className="text-3xl font-outfit font-black text-white uppercase tracking-tighter italic mb-8">Operational <span className="text-orange-500">Core</span></h3>
        <div className="p-10 border-2 border-dashed border-slate-800 rounded-[3rem] text-center bg-slate-900/20">
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Neural Threads: 0</p>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;