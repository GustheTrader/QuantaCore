import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SMEAgent {
  id: string;
  name: string;
  description: string;
  soul: string;
  skills: string[];
}

const SMEBuilder: React.FC = () => {
  const [agents, setAgents] = useState<SMEAgent[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [isAddingAgent, setIsAddingAgent] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('quanta_sme_agents');
    if (saved) setAgents(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('quanta_sme_agents', JSON.stringify(agents));
  }, [agents]);

  const createAgent = (name: string, description: string) => {
    const newAgent: SMEAgent = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      description,
      soul: '# Agent Soul\n\nDefine the agent\'s personality, purpose, and core values here.',
      skills: []
    };
    setAgents([...agents, newAgent]);
    setActiveAgentId(newAgent.id);
    setIsAddingAgent(false);
  };

  const updateAgent = (id: string, updates: Partial<SMEAgent>) => {
    setAgents(agents.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const activeAgent = agents.find(a => a.id === activeAgentId);

  return (
    <div className="min-h-screen p-10 animate-in fade-in duration-700">
      <header className="mb-16">
        <h1 className="text-6xl font-outfit font-black text-white uppercase tracking-tighter italic mb-4">SME <span className="quantum-gradient-text">Forge</span></h1>
        <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px]">Architect your custom agentic entities.</p>
      </header>

      {!activeAgent ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <button 
            onClick={() => setIsAddingAgent(true)}
            className="glass-card p-12 rounded-[2.5rem] border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/5 transition-all flex flex-col items-center justify-center text-center h-80"
          >
            <div className="w-16 h-16 rounded-2xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            </div>
            <h3 className="text-2xl font-outfit font-black text-white uppercase tracking-tighter italic">Forge New Agent</h3>
          </button>
          {agents.map(agent => (
            <button 
              key={agent.id}
              onClick={() => setActiveAgentId(agent.id)}
              className="glass-card p-10 rounded-[2.5rem] border-cyan-500/20 hover:border-cyan-500/50 transition-all text-left flex flex-col h-80"
            >
              <h3 className="text-2xl font-outfit font-black text-white uppercase tracking-tighter italic mb-2">{agent.name}</h3>
              <p className="text-slate-400 text-sm font-mono flex-1">{agent.description}</p>
              <div className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mt-4">{agent.skills.length} Skills Active</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          <button onClick={() => setActiveAgentId(null)} className="text-slate-500 hover:text-white mb-4">&larr; Back to Forge</button>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="glass-card p-8 rounded-[2.5rem] border-slate-800">
              <h2 className="text-2xl font-outfit font-black text-white uppercase tracking-tighter mb-6">Soul.md</h2>
              <textarea 
                value={activeAgent.soul}
                onChange={(e) => updateAgent(activeAgent.id, { soul: e.target.value })}
                className="w-full h-96 bg-slate-950 border border-slate-800 rounded-2xl p-6 text-slate-300 font-mono text-xs outline-none focus:border-cyan-500 transition-all"
              />
            </div>
            <div className="glass-card p-8 rounded-[2.5rem] border-slate-800">
              <h2 className="text-2xl font-outfit font-black text-white uppercase tracking-tighter mb-6">Skillz</h2>
              <div className="space-y-4">
                {activeAgent.skills.map((skill, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-900 rounded-xl">
                    <span className="text-sm text-white font-mono">{skill}</span>
                    <button onClick={() => updateAgent(activeAgent.id, { skills: activeAgent.skills.filter((_, i) => i !== index) })} className="text-rose-500">Remove</button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input id="new-skill" className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-4 text-white" placeholder="Add new skill..." />
                  <button 
                    onClick={() => {
                      const input = document.getElementById('new-skill') as HTMLInputElement;
                      if (input.value) {
                        updateAgent(activeAgent.id, { skills: [...activeAgent.skills, input.value] });
                        input.value = '';
                      }
                    }}
                    className="px-6 py-4 bg-cyan-600 text-white rounded-xl font-bold"
                  >Add</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddingAgent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
          <div className="glass-card w-full max-w-xl rounded-[3rem] border-cyan-500/30 p-10 space-y-6">
            <h2 className="text-3xl font-outfit font-black text-white uppercase tracking-tighter italic">Create Agent</h2>
            <input id="new-agent-name" placeholder="Agent Name" className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 px-6 text-white" />
            <textarea id="new-agent-desc" placeholder="Agent Description" className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 px-6 text-white min-h-[100px]" />
            <div className="flex gap-4">
              <button onClick={() => setIsAddingAgent(false)} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl">Cancel</button>
              <button 
                onClick={() => {
                  const n = (document.getElementById('new-agent-name') as HTMLInputElement).value;
                  const d = (document.getElementById('new-agent-desc') as HTMLTextAreaElement).value;
                  if (n) createAgent(n, d);
                }}
                className="flex-1 py-4 bg-cyan-600 text-white rounded-2xl"
              >Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SMEBuilder;
