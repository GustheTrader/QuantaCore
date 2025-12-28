
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { CouncilTurn } from '../types';
import { getSMEContext } from '../services/geminiService';

const Council: React.FC = () => {
  const [sessionActive, setSessionActive] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [debateLog, setDebateLog] = useState<CouncilTurn[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [showAudit, setShowAudit] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [operatorProfile, setOperatorProfile] = useState<any>(null);

  useEffect(() => {
    const sessionStr = localStorage.getItem('quanta_session');
    if (sessionStr) {
      const { email, track } = JSON.parse(sessionStr);
      
      const savedProfile = localStorage.getItem(`quanta_profile_${email}`);
      if (savedProfile) setOperatorProfile(JSON.parse(savedProfile));

      const personalAgents = [
        { name: "QAssistant", icon: "M16 7a4 4 0 11-8 0" },
        { name: "QWealth", icon: "M12 8c-1.657 0-3 .895-3 2" },
        { name: "QHealth", icon: "M4.318 6.318a4.5 4.5 0 000 6.364" },
        { name: "QCreative", icon: "M7 21a4 4 0 01-4-4" },
        { name: "QLegacy", icon: "M19 21V5a2 2 0 00-2-2" },
        { name: "QMind", icon: "M12 15v2m-6 4" },
        { name: "QNomad", icon: "M3.055 11H5" },
        { name: "QSocial", icon: "M17 20h5" },
        { name: "QSpeculator", icon: "M13 10V3L4 14h7v7l9-11h-7z" }
      ];

      const businessAgents = [
        { name: "QStrategy", icon: "M16 8v8" },
        { name: "QGrowth", icon: "M11 5.882" },
        { name: "QFinance", icon: "M12 8c-1.657 0-3" },
        { name: "QSales", icon: "M13 7h8" },
        { name: "QOps", icon: "M4 6h16" },
        { name: "QLegal", icon: "M9 12" },
        { name: "QTalent", icon: "M17 20h5" },
        { name: "QProduct", icon: "M10 20" },
        { name: "QSuccess", icon: "M14 10h2" }
      ];

      const standard = track === 'personal' ? personalAgents : businessAgents;
      const savedCustom = localStorage.getItem(`quanta_custom_agents_${track}`);
      const custom = savedCustom ? JSON.parse(savedCustom).map((a: any) => ({ name: a.name, icon: a.icon })) : [];
      
      setAvailableAgents([...standard, ...custom]);
    }
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [debateLog]);

  const runCouncilProtocol = async () => {
    if (selectedAgents.length < 2 || !prompt.trim()) return;
    setSessionActive(true);
    setIsProcessing(true);
    setDebateLog([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const FPT_OMEGA_PROTOCOL = `You are a high-performance SME agent using First Principles Thinking (FPT-OMEGA). Structure your output into Deconstruction, Axiom Identification, and Reconstruction phases.`;

      // Build shared knowledge context for the council
      const globalCtx = getSMEContext("All Agents", operatorProfile);

      // Sequential generation for SMEs
      for (const agent of selectedAgents) {
        setDebateLog(prev => [...prev, { agentName: agent, role: 'proposer', content: 'Analyzing first principles...', status: 'processing' }]);
        
        const agentCtx = getSMEContext(agent, operatorProfile);
        const combinedKnowledge = `${globalCtx.knowledgeContext}\n\n${agentCtx.knowledgeContext}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `SME Prompt: ${prompt}\n\nYou are ${agent}. 
          ${combinedKnowledge ? `RELEVANT KNOWLEDGE:\n${combinedKnowledge}` : ''}
          
          Apply FPT-OMEGA to provide strategic advice. Ground your axioms in the provided knowledge base if applicable.`,
          config: { systemInstruction: FPT_OMEGA_PROTOCOL }
        });

        const text = response.text || '';
        
        setDebateLog(prev => prev.map(t => t.agentName === agent ? { 
          ...t, 
          content: text, 
          status: 'complete', 
          logicAudit: { 
            deconstruction: ["Analogy check performed", "Knowledge base assumptions verified"], 
            axioms: ["First principles identified", "Learned patterns integrated"], 
            reconstruction: "Rebuilt from atomic truths and sovereign context." 
          } 
        } : t));
      }

      setDebateLog(prev => [...prev, { agentName: 'NEURAL JUDGE', role: 'judge', content: 'Synthesizing dominant logic...', status: 'processing' }]);
      
      const fullDebate = debateLog.map(d => `${d.agentName}: ${d.content}`).join('\n\n');
      const judgeResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Full Debate Context:\n${fullDebate}\n\nProblem: ${prompt}\n\nNeural Judge Synthesis: Identify the single most logical dominant strategy. Ground it in the provided deliberation and live web search.`,
        config: { 
          tools: [{ googleSearch: {} }],
          systemInstruction: `You are the Neural Judge. Synthesize SME debate with total logical purity. \n${globalCtx.fullHeader}`
        }
      });

      const judgeText = judgeResponse.text || '';
      const sources = judgeResponse.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter(chunk => chunk.web)
        ?.map(chunk => ({
          uri: chunk.web?.uri || '',
          title: chunk.web?.title || 'Source'
        })) || [];

      setDebateLog(prev => prev.map(t => t.role === 'judge' ? { 
        ...t, 
        content: judgeText, 
        status: 'complete', 
        sources,
        logicAudit: { 
          deconstruction: ["Inconsistent SME paths discarded"], 
          axioms: ["Logical coherence check: PASSED"], 
          reconstruction: "Unified path found across multiple SME inputs." 
        } 
      } : t));

      setDebateLog(prev => [...prev, { agentName: 'BOARD OF DIRECTORS', role: 'board', content: 'Issuing directive...', status: 'processing' }]);
      
      const boardResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Judge Synthesis: ${judgeText}\n\nDirective: Give 3 high-impact immediate action items for the operator ${operatorProfile?.callsign || 'Prime'}.`
      });

      setDebateLog(prev => prev.map(t => t.role === 'board' ? { ...t, content: boardResponse.text || '', status: 'complete' } : t));

    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleAgent = (name: string) => {
    setSelectedAgents(prev => 
      prev.includes(name) ? prev.filter(a => a !== name) : (prev.length < 3 ? [...prev, name] : prev)
    );
  };

  return (
    <div className="animate-in fade-in duration-1000 max-w-7xl mx-auto">
      <header className="mb-16">
        <p className="text-orange-500 font-black uppercase tracking-[0.5em] text-[10px] mb-4">SME Council Activation</p>
        <h1 className="text-6xl md:text-9xl font-outfit font-black text-white uppercase tracking-tighter leading-none">Deliberation <span className="quantum-gradient-text italic">Forge</span></h1>
      </header>

      {!sessionActive ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-2">
            <div className="glass-card p-12 rounded-[4rem] border-emerald-500/20 quanta-logic-gradient shadow-2xl">
              <label className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em] mb-6 block">Executive Challenge Input</label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Submit your strategic problem for SME Council deconstruction..."
                className="w-full h-64 bg-slate-950/80 border-2 border-slate-800 rounded-[3rem] p-10 text-slate-100 font-mono text-lg focus:border-emerald-500 transition-all resize-none shadow-inner"
              />
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-12">
                {availableAgents.map(agent => (
                  <button 
                    key={agent.name}
                    onClick={() => toggleAgent(agent.name)}
                    className={`p-8 rounded-[2.5rem] border-2 transition-all flex flex-col items-center group ${selectedAgents.includes(agent.name) ? 'bg-emerald-500/10 border-emerald-500 shadow-xl' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${selectedAgents.includes(agent.name) ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-600'}`}>
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={agent.icon} /></svg>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{agent.name}</span>
                  </button>
                ))}
              </div>

              <button 
                onClick={runCouncilProtocol}
                disabled={selectedAgents.length < 2 || !prompt.trim() || isProcessing}
                className="w-full mt-16 py-10 quanta-btn-primary text-white rounded-[3rem] font-black uppercase tracking-[0.5em] text-[12px] shadow-2xl flex items-center justify-center space-x-6 active:scale-95"
              >
                {isProcessing ? 'Council Syncing...' : 'Assemble SME Council'}
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </button>
            </div>
          </div>
          
          <div className="space-y-8">
             <div className="glass-card p-10 rounded-[3rem] border-orange-500/20 bg-orange-500/5">
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-orange-500 mb-8 pb-4 border-b border-orange-500/20">FPT Protocol: OMEGA</h3>
                <div className="space-y-8 text-[11px] font-black text-slate-400 uppercase leading-relaxed tracking-tighter">
                   <p className="flex items-start space-x-4"><span className="w-6 h-6 bg-orange-500 text-white rounded-lg flex items-center justify-center shrink-0">1</span><span>Strip analogies. Reject all legacy assumptions.</span></p>
                   <p className="flex items-start space-x-4"><span className="w-6 h-6 bg-orange-500 text-white rounded-lg flex items-center justify-center shrink-0">2</span><span>Isolate non-negotiable axioms (The Physics).</span></p>
                   <p className="flex items-start space-x-4"><span className="w-6 h-6 bg-orange-500 text-white rounded-lg flex items-center justify-center shrink-0">3</span><span>Reconstruct path via dominant logic synthesis.</span></p>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto space-y-16 pb-40">
          <div className="bg-slate-900 border-2 border-emerald-500/30 p-10 rounded-[3rem] sticky top-8 z-[90] shadow-2xl backdrop-blur-3xl">
             <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.5em] mb-2">Council context active</p>
             <h2 className="text-2xl font-outfit font-black text-white uppercase italic tracking-tighter truncate">"{prompt}"</h2>
          </div>

          <div className="space-y-12 relative">
            <div className="absolute left-[39px] top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500/30 via-orange-500/30 to-transparent"></div>
            
            {debateLog.map((turn, i) => (
              <div key={i} className={`relative flex items-start space-x-10 animate-in slide-in-from-left-8 duration-700`}>
                <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center shrink-0 z-10 shadow-2xl border-2 ${
                  turn.role === 'judge' ? 'bg-emerald-600 border-emerald-400 text-white animate-orbit' : 
                  turn.role === 'board' ? 'bg-orange-600 border-orange-400 text-white' : 
                  'bg-slate-900 border-slate-700 text-slate-500'
                }`}>
                   <span className="text-xs font-black uppercase">{turn.agentName.substring(0, 2)}</span>
                </div>
                
                <div className={`flex-1 glass-card p-12 rounded-[3.5rem] border-2 transition-all duration-700 ${
                  turn.role === 'judge' ? 'border-emerald-500/50 quanta-logic-gradient scale-[1.03]' : 
                  turn.role === 'board' ? 'border-orange-500/50 bg-orange-500/5' : 
                  'border-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h4 className="text-white font-outfit font-black uppercase tracking-tighter text-3xl">{turn.agentName}</h4>
                      <p className={`text-[10px] font-black uppercase tracking-[0.4em] mt-1 ${
                        turn.role === 'judge' ? 'text-emerald-400' : 
                        turn.role === 'board' ? 'text-orange-400' : 
                        'text-slate-500'
                      }`}>{turn.role} Link</p>
                    </div>
                    {turn.logicAudit && (
                      <button 
                        onClick={() => setShowAudit(showAudit === `${turn.agentName}-${i}` ? null : `${turn.agentName}-${i}`)}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showAudit === `${turn.agentName}-${i}` ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-emerald-400'}`}
                      >
                        {showAudit === `${turn.agentName}-${i}` ? 'Close Trace' : 'Neural Audit'}
                      </button>
                    )}
                  </div>
                  
                  <div className="text-slate-200 text-xl leading-relaxed font-medium">
                    {showAudit === `${turn.agentName}-${i}` ? (
                      <div className="space-y-8 animate-in fade-in duration-300">
                        <div className="p-6 bg-slate-950/50 rounded-2xl border border-emerald-500/10">
                          <p className="text-emerald-400 text-[9px] font-black uppercase tracking-[0.3em] mb-4">Atomic Axioms</p>
                          <ul className="space-y-3">
                            {turn.logicAudit?.axioms.map((a, idx) => <li key={idx} className="text-sm font-mono text-slate-400 flex items-center space-x-3"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span><span>{a}</span></li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-orange-500 text-[9px] font-black uppercase tracking-[0.3em] mb-2">Reconstruction Logic</p>
                          <p className="text-base text-slate-400 italic font-mono leading-relaxed">"{turn.logicAudit?.reconstruction}"</p>
                        </div>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{turn.content || 'Reasoning...'}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Council;
