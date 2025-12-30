
import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { chatWithSME, optimizePrompt, distillMemoryFromChat, reflectAndRefine } from '../services/geminiService';
import { ChatMessage, OptimizationTelemetry, ReflectionResult, ComputeProvider, MemoryBlock } from '../types';
import { VoiceAgent } from './VoiceAgent';
import { NeuralOptimizationWindow } from './NeuralOptimizationWindow';
import { ActionHub } from './ActionHub';
import { ContextOptimizerBar } from './ContextOptimizerBar';
import { syncChatHistoryToSupabase, fetchChatHistoryFromSupabase } from '../services/supabaseService';

interface ChatInterfaceProps {
  profile: { name: string, callsign: string, personality: string };
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ profile }) => {
  const location = useLocation();
  const activeAgent = (location.state as any)?.agent || "Quanta Core";
  const storageKey = `quanta_chat_history_${activeAgent.replace(/\s+/g, '_').toLowerCase()}`;
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isNeuralLinkActive, setIsNeuralLinkActive] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isLearning, setIsLearning] = useState(false);
  const [isReflecting, setIsReflecting] = useState(false);
  const [isReflectionEnabled, setIsReflectionEnabled] = useState(true);
  const [lastReflection, setLastReflection] = useState<ReflectionResult | null>(null);
  const [computeProvider, setComputeProvider] = useState<ComputeProvider>('gemini');
  const [activeContextCount, setActiveContextCount] = useState(0);
  const [isAmbientActive, setIsAmbientActive] = useState(false);
  
  const [agentConfig, setAgentConfig] = useState<{ prompt: string | null, skills: string[] }>({ prompt: null, skills: ['search'] });
  
  const [telemetry, setTelemetry] = useState<OptimizationTelemetry>({
    reasoningDepth: 0,
    neuralSync: 0,
    contextPurity: 0,
    optimizations: []
  });

  const [optimizationResult, setOptimizationResult] = useState<{
    optimizedPrompt: string;
    improvements: string[];
    traceScore: number;
    compressionRatio: number;
    intelligenceDensity: number;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ambientAudioCtx = useRef<AudioContext | null>(null);
  const ambientOscillators = useRef<OscillatorNode[]>([]);
  const ambientGain = useRef<GainNode | null>(null);

  const syncHistory = async () => {
    const savedLocal = localStorage.getItem(storageKey);
    if (savedLocal) {
      try { 
        setMessages(JSON.parse(savedLocal)); 
      } catch (e) { setDefaultMessage(); }
    } else {
      const remote = await fetchChatHistoryFromSupabase(activeAgent);
      if (remote) {
        setMessages(remote);
        localStorage.setItem(storageKey, JSON.stringify(remote));
      } else {
        setDefaultMessage();
      }
    }
  };

  useEffect(() => {
    syncHistory();
    const savedConfigs = JSON.parse(localStorage.getItem('quanta_agent_configs') || '{}');
    if (savedConfigs[activeAgent]) {
      setAgentConfig({ 
        prompt: savedConfigs[activeAgent].prompt, 
        skills: savedConfigs[activeAgent].skills || ['search'] 
      });
    }
    
    const savedProvider = localStorage.getItem('quanta_preferred_provider');
    if (savedProvider) setComputeProvider(savedProvider as ComputeProvider);

    const savedMemories = localStorage.getItem('quanta_notebook');
    if (savedMemories) {
      const memories: MemoryBlock[] = JSON.parse(savedMemories);
      const relevantCount = memories.filter(m => 
        !m.assignedAgents || 
        m.assignedAgents.length === 0 || 
        m.assignedAgents.includes(activeAgent) || 
        m.assignedAgents.includes("All Agents")
      ).length;
      setActiveContextCount(relevantCount);
    }

    window.addEventListener('storage', syncHistory);
    return () => {
      window.removeEventListener('storage', syncHistory);
      stopAmbient();
    };
  }, [activeAgent, storageKey]);

  const startAmbient = () => {
    if (!ambientAudioCtx.current) {
      ambientAudioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (ambientAudioCtx.current.state === 'suspended') {
      ambientAudioCtx.current.resume();
    }
    const ctx = ambientAudioCtx.current;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 2);
    gainNode.connect(ctx.destination);
    ambientGain.current = gainNode;

    const createOsc = (freq: number, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.connect(gainNode);
      osc.start();
      return osc;
    };

    ambientOscillators.current = [createOsc(60), createOsc(110), createOsc(44, 'sine')];
    setIsAmbientActive(true);
  };

  const stopAmbient = () => {
    if (ambientGain.current && ambientAudioCtx.current) {
      const ctx = ambientAudioCtx.current;
      ambientGain.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
      setTimeout(() => {
        ambientOscillators.current.forEach(osc => { try { osc.stop(); } catch(e) {} });
        ambientOscillators.current = [];
        setIsAmbientActive(false);
      }, 1100);
    } else {
      setIsAmbientActive(false);
    }
  };

  const toggleAmbient = () => isAmbientActive ? stopAmbient() : startAmbient();

  const setDefaultMessage = () => {
    setMessages([{ role: 'model', content: `Neural connection established. Welcome back, ${profile.callsign}. [${activeAgent}] online via ${computeProvider.toUpperCase()} compute.`, timestamp: Date.now() }]);
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages, isReflecting]);

  const handleOptimizeContext = async () => {
    if (!input.trim() || isOptimizing) return;
    setIsOptimizing(true);
    try {
      const result = await optimizePrompt(input, activeAgent);
      setOptimizationResult(result);
    } catch (e) { console.error(e); } finally { setIsOptimizing(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input, timestamp: Date.now(), provider: computeProvider };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setOptimizationResult(null);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await chatWithSME(userMessage.content, history, activeAgent, agentConfig.prompt || undefined, agentConfig.skills, profile, computeProvider);
      
      const modelMessage: ChatMessage = {
        role: 'model',
        content: response.text,
        timestamp: Date.now(),
        sources: response.sources,
        provider: computeProvider
      };
      
      const finalMessages = [...updatedMessages, modelMessage];
      setMessages(finalMessages);
      
      localStorage.setItem(storageKey, JSON.stringify(finalMessages));
      syncChatHistoryToSupabase(activeAgent, finalMessages);

      setIsLearning(true);
      distillMemoryFromChat(finalMessages.slice(-4), activeAgent).then(newMemory => {
        if (newMemory) setTelemetry(prev => ({ ...prev, optimizations: [...prev.optimizations, `Neural Growth: "${newMemory.title}" archived.`] }));
        setIsLearning(false);
      });

      if (isReflectionEnabled && finalMessages.length % 14 === 0) {
        await triggerJudgeLoop(finalMessages);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', content: "Neural bridge unstable. Synchronizing...", timestamp: Date.now() }]);
    } finally { setIsLoading(false); }
  };

  const triggerJudgeLoop = async (currentMessages: ChatMessage[]) => {
    setIsReflecting(true);
    try {
      const reflection = await reflectAndRefine(currentMessages.slice(-10), agentConfig.prompt || "Default SME Logic", activeAgent);
      setLastReflection(reflection);
      if (reflection.suggestedPrompt && reflection.score < 4) {
        const updatedPrompt = reflection.suggestedPrompt;
        setAgentConfig(prev => ({ ...prev, prompt: updatedPrompt }));
        const savedConfigs = JSON.parse(localStorage.getItem('quanta_agent_configs') || '{}');
        savedConfigs[activeAgent] = { ...savedConfigs[activeAgent], prompt: updatedPrompt };
        localStorage.setItem('quanta_agent_configs', JSON.stringify(savedConfigs));
      }
    } catch (e) { console.error(e); } finally { setIsReflecting(false); }
  };

  const switchProvider = (p: ComputeProvider) => {
    setComputeProvider(p);
    localStorage.setItem('quanta_preferred_provider', p);
  };

  const toggleSearchSkill = () => {
    const newSkills = agentConfig.skills.includes('search')
      ? agentConfig.skills.filter(s => s !== 'search')
      : [...agentConfig.skills, 'search'];
    
    setAgentConfig(prev => ({ ...prev, skills: newSkills }));
    
    // Persist skill update locally
    const savedConfigs = JSON.parse(localStorage.getItem('quanta_agent_configs') || '{}');
    savedConfigs[activeAgent] = { ...savedConfigs[activeAgent], skills: newSkills };
    localStorage.setItem('quanta_agent_configs', JSON.stringify(savedConfigs));
  };

  const handleApplyOptimization = () => {
    if (optimizationResult) {
      setInput(optimizationResult.optimizedPrompt);
      setOptimizationResult(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] glass-card rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-700 relative border-emerald-500/20">
      <VoiceAgent isActive={isVoiceActive} agentName={activeAgent} systemInstruction={agentConfig.prompt || `You are ${activeAgent}.`} onClose={() => setIsVoiceActive(false)} profile={profile} />
      
      <NeuralOptimizationWindow 
        isOpen={isNeuralLinkActive} 
        onClose={() => setIsNeuralLinkActive(false)} 
        agentName={activeAgent}
        telemetry={telemetry}
        optimizationResult={optimizationResult}
        isOptimizing={isOptimizing}
        onApply={handleApplyOptimization}
      />

      <div className="p-8 border-b border-slate-800 bg-[#020617]/90 flex items-center justify-between relative">
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
        <div className="flex items-center space-x-6">
          <div className="w-14 h-14 bg-emerald-600/10 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-transform hover:scale-105">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h2 className="font-outfit font-black text-2xl leading-tight uppercase tracking-tighter italic text-white">{activeAgent}</h2>
            <div className="flex items-center space-x-3 mt-1">
              <span className={`w-2 h-2 rounded-full animate-pulse ${isReflecting ? 'bg-orange-500 shadow-[0_0_8px_#f97316]' : isLearning ? 'bg-indigo-500 shadow-[0_0_8px_#6366f1]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`}></span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">
                {computeProvider} Logic Core
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-4 items-center">
          {/* SEARCH SKILL TOGGLE */}
          <button 
            onClick={toggleSearchSkill}
            title={agentConfig.skills.includes('search') ? "Search Grounding: ACTIVE" : "Search Grounding: DISABLED"}
            className={`px-5 py-3 rounded-2xl border flex items-center justify-center space-x-3 transition-all ${agentConfig.skills.includes('search') ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-700 hover:text-emerald-400'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest">{agentConfig.skills.includes('search') ? 'Live Search ON' : 'Live Search OFF'}</span>
          </button>

          <button 
            onClick={toggleAmbient}
            title={isAmbientActive ? "Neural Hum: ON" : "Neural Hum: OFF"}
            className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all ${isAmbientActive ? 'bg-orange-600/20 border-orange-500 text-orange-400 animate-glow' : 'bg-slate-950 border-slate-800 text-slate-700 hover:text-orange-400'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </button>
          <button 
            onClick={() => setIsVoiceActive(true)}
            className="w-12 h-12 rounded-xl bg-emerald-600/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          </button>
          <div className="bg-slate-950 p-1.5 rounded-2xl border border-slate-800 flex shadow-inner">
            {(['gemini', 'groq', 'local'] as ComputeProvider[]).map((p) => (
              <button 
                key={p}
                onClick={() => switchProvider(p)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${computeProvider === p ? 'bg-emerald-600 text-white shadow-xl' : 'text-slate-600 hover:text-slate-400'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setIsNeuralLinkActive(!isNeuralLinkActive)}
            className={`px-6 py-3 border rounded-2xl transition-all text-[11px] font-black uppercase tracking-widest flex items-center space-x-3 ${
              isNeuralLinkActive ? 'bg-orange-600 border-orange-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-orange-400'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4" /></svg>
            <span>Telemetry</span>
          </button>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto p-10 lg:p-14 space-y-12 bg-slate-950/20 transition-all duration-500 ${isNeuralLinkActive ? 'lg:mr-[450px]' : ''} custom-scrollbar relative`}>
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 group`}>
            <div className={`max-w-[85%] lg:max-w-[75%] p-8 rounded-[2.5rem] relative shadow-2xl transition-all duration-500 ${
              m.role === 'user' 
                ? 'bg-[#020617] border border-emerald-500/20 text-white rounded-tr-none hover:border-emerald-500/40' 
                : 'bg-slate-900/40 text-slate-100 rounded-tl-none border-orange-500/10 shadow-[0_0_30px_rgba(0,0,0,0.3)] hover:border-orange-500/30'
            }`}>
              <div className="whitespace-pre-wrap text-[15px] leading-relaxed font-medium italic font-outfit">"{m.content}"</div>
              
              {m.sources && m.sources.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-800/50 flex flex-wrap gap-3">
                  {m.sources.map((s, i) => (<a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-slate-950/80 border border-slate-800/50 px-4 py-2 rounded-xl text-slate-400 hover:text-orange-400 hover:border-orange-500/30 transition-all truncate max-w-[220px]">{s.title}</a>))}
                </div>
              )}

              {m.role === 'model' && <ActionHub content={m.content} agentName={activeAgent} />}
              
              <div className="absolute -bottom-6 right-4 flex items-center space-x-3 text-[9px] font-black uppercase text-slate-600 tracking-widest italic opacity-60">
                {m.provider && <span className="text-emerald-500/50">{m.provider} core</span>}
                {m.timestamp && <span>&bull; {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
            </div>
          </div>
        ))}
        {isLoading && !isReflecting && (
          <div className="flex justify-start"><div className="bg-[#020617] border border-emerald-500/20 p-8 rounded-[2rem] rounded-tl-none flex space-x-3 items-center"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce" /><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]" /><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]" /></div></div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={`p-10 border-t border-slate-800/50 bg-[#020617]/95 transition-all duration-500 ${isNeuralLinkActive ? 'lg:mr-[450px]' : ''}`}>
        <div className="max-w-5xl mx-auto flex flex-col">
          <ContextOptimizerBar 
            onOptimize={handleOptimizeContext}
            isOptimizing={isOptimizing}
            activeContextCount={activeContextCount}
            onClearContext={() => {
              setActiveContextCount(0);
              setMessages([]);
              localStorage.removeItem(storageKey);
              syncChatHistoryToSupabase(activeAgent, []);
              setDefaultMessage();
            }}
            optimizationResult={optimizationResult}
            onApply={handleApplyOptimization}
          />
          
          <form onSubmit={handleSubmit} className="flex items-center space-x-6">
            <div className="flex-1 bg-[#020617] border border-emerald-500/20 rounded-full py-2 px-10 shadow-inner group transition-all focus-within:border-emerald-500/40">
              <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder={`Submit high-density instruction via ${computeProvider.toUpperCase()}...`} 
                className="w-full bg-transparent text-white py-5 focus:outline-none font-outfit font-bold text-xl italic placeholder-slate-600" 
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()} 
              className="px-14 py-7 bg-slate-900/50 text-slate-500 hover:text-white hover:bg-orange-600 border border-slate-800 hover:border-orange-400 rounded-full font-black uppercase tracking-[0.4em] text-[13px] transition-all shadow-xl active:scale-95 disabled:opacity-30 disabled:grayscale"
            >
              Transmit
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
