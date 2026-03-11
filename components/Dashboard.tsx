import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

interface AgentDetails {
  name: string;
  description: string;
  useCases: string[];
  optimization: string;
  icon: string;
  color: string;
  path: string;
}

const AGENTS: AgentDetails[] = [
  {
    name: 'Hermes Protocol',
    description: 'High-fidelity tool orchestration and execution engine.',
    useCases: ['Automating multi-step workflows', 'Web search & data extraction', 'File processing & synthesis'],
    optimization: 'Define clear, atomic tool inputs to reduce RIC protocol overhead.',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    color: 'text-orange-500',
    path: '/hermes'
  },
  {
    name: 'Deep Agent',
    description: 'Advanced reasoning, planning, and synthesis engine.',
    useCases: ['Complex problem solving', 'Long-form research', 'Strategic analysis'],
    optimization: 'Break down complex queries into explicit, sequential reasoning steps.',
    icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
    color: 'text-indigo-500',
    path: '/deep-agent'
  },
  {
    name: 'Deep Diver',
    description: 'Specialized deep-dive analysis for complex topics.',
    useCases: ['Technical documentation review', 'Codebase auditing', 'Scientific literature synthesis'],
    optimization: 'Provide specific context or source documents to focus the dive.',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    color: 'text-emerald-500',
    path: '/deep-diver'
  },
  {
    name: 'Agent Zero',
    description: 'Core execution environment with workspace management.',
    useCases: ['Code execution', 'Workspace scripting', 'System-level tasks'],
    optimization: 'Keep workspace paths clean and modular for faster execution.',
    icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
    color: 'text-rose-500',
    path: '/agent-zero'
  },
  {
    name: 'IronClaw',
    description: 'High-performance monitoring and security defense.',
    useCases: ['System monitoring', 'Threat detection', 'Performance optimization'],
    optimization: 'Set strict thresholds for alerts to minimize noise.',
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    color: 'text-red-500',
    path: '/iron-claw'
  },
  {
    name: 'SME Council',
    description: 'Collaborative multi-agent council for consensus.',
    useCases: ['Strategic decision making', 'Peer review', 'Complex project planning'],
    optimization: 'Clearly define roles (proposer, critic, judge) for balanced outcomes.',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    color: 'text-cyan-500',
    path: '/council'
  },
  {
    name: 'Data Analysis',
    description: 'Deep-dive statistical analysis and pattern recognition.',
    useCases: ['Trend identification', 'Anomaly detection', 'Data visualization'],
    optimization: 'Ensure data formats are normalized before ingestion.',
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    color: 'text-blue-500',
    path: '/chat'
  },
  {
    name: 'Predictive Modeling',
    description: 'Forecasting future outcomes based on historical data.',
    useCases: ['Market forecasting', 'Risk assessment', 'Resource planning'],
    optimization: 'Provide high-quality historical datasets for training.',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    color: 'text-purple-500',
    path: '/chat'
  },
  {
    name: 'Gateway Project',
    description: 'Unified gateway for cross-protocol communication and process orchestration.',
    useCases: ['Cross-protocol data routing', 'Process synchronization', 'System interoperability'],
    optimization: 'Ensure gateway endpoints are properly authenticated and rate-limited.',
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'text-yellow-500',
    path: '/gateway'
  }
];

const Dashboard: React.FC = () => {
  return (
    <div className="p-10 animate-in fade-in duration-1000">
      <header className="mb-16">
        <h1 className="text-6xl font-outfit font-black text-white uppercase tracking-tighter italic mb-4">Mission <span className="quantum-gradient-text">Control</span></h1>
        <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-xs">Orchestrate your neural network.</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {AGENTS.map((agent) => (
          <Link to={agent.path} key={agent.name}>
            <motion.div 
              whileHover={{ y: -10 }}
              className="glass-card p-8 rounded-[2.5rem] border border-slate-800 bg-slate-950/50 flex flex-col h-full"
            >
              <div className={`w-16 h-16 rounded-2xl ${agent.color} bg-slate-900 flex items-center justify-center mb-6`}>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={agent.icon} /></svg>
              </div>
              <h2 className="text-xl font-outfit font-black text-white uppercase tracking-tighter mb-2">{agent.name}</h2>
              <p className="text-slate-400 text-sm mb-6 font-mono">{agent.description}</p>
              
              <div className="space-y-4 flex-1">
                <div>
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Use Cases</h4>
                  <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                    {agent.useCases.map(uc => <li key={uc}>{uc}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Optimization</h4>
                  <p className="text-[11px] text-emerald-400 font-bold">{agent.optimization}</p>
                </div>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
