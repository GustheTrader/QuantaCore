
import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { chatWithSME, optimizePrompt, distillMemoryFromChat, reflectAndRefine } from '../services/geminiService';
import { ChatMessage, OptimizationTelemetry, ReflectionResult, ComputeProvider, SourceNode } from '../types';
import { VoiceAgent } from './VoiceAgent';
import { NeuralOptimizationWindow } from './NeuralOptimizationWindow';
import { ActionHub } from './ActionHub';
import { ContextOptimizerBar } from './ContextOptimizerBar';
import { FPTOverlay } from './FPTOverlay';
import { ContextOptimizerModal } from './ContextOptimizerModal';
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
  const [useFPT, setUseFPT] = useState(false); // First Principles Toggle
  const [showFPTOverlay, setShowFPTOverlay] = useState(false);
  const [showOptimizerModal, setShowOptimizerModal] = useState(false);
  const [expandedAudits, setExpandedAudits] = useState<Record<number, boolean>>({});
  
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
        const parsed = JSON.parse(savedLocal);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      } catch (e) { 
        console.error("Local history corrupt:", e);
      }
    }
    
    const remote = await fetchChatHistoryFromSupabase(activeAgent);
    if (remote && Array.isArray(remote) && remote.length > 0) {
      setMessages(remote);
      localStorage.setItem(storageKey, JSON.stringify(remote));
    } else {
      setDefaultMessage();
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

    const savedSources = localStorage.getItem('quanta_notebook');
    if (savedSources) {
      const sources: SourceNode[] = JSON.parse(savedSources);
      const relevantCount = sources.filter(m => 
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
    if (!ambientAudioCtx.current) ambientAudioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ambientAudioCtx.current.state === 'suspended') ambientAudioCtx.current.resume();
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
    const initial = [{ role: 'model', content: `Neural connection established. Welcome back, ${profile.callsign}. [${activeAgent}] online via ${computeProvider.toUpperCase()} compute. Source grounding active.`, timestamp: Date.now() }] as ChatMessage[];
    setMessages(initial);
    localStorage.setItem(storageKey, JSON.stringify(initial));
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages, isReflecting, isLoading]);

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
    localStorage.setItem(storageKey, JSON.stringify(updatedMessages));
    
    setInput('');
    setOptimizationResult(null);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      
      // Pass useFPT to the service
      const response = await chatWithSME(
        userMessage.content, 
        history, 
        activeAgent, 
        agentConfig.prompt || undefined, 
        agentConfig.skills, 
        profile, 
        computeProvider,
        useFPT
      );
      
      const modelMessage: ChatMessage = {
        role: 'model',
        content: response.text,
        timestamp: Date.now(),
        sources: response.sources,
        citations: response.citations,
        provider: computeProvider,
        fptAudit: response.fptAudit // Store the audit if available
      };
      
      const finalMessages = [...updatedMessages, modelMessage];
      setMessages(finalMessages);
      
      localStorage.setItem(storageKey, JSON.stringify(finalMessages));
      syncChatHistoryToSupabase(activeAgent, finalMessages);

      setIsLearning(true);
      distillMemoryFromChat(finalMessages.slice(-4), activeAgent).then(newMemory => {
        if (newMemory) setTelemetry(prev => ({ ...prev, optimizations: [...prev.optimizations, `Knowledge Grounding: "${newMemory.title}" archived.`] }));
        setIsLearning(false);
      });

      if (isReflectionEnabled && finalMessages.length % 14 === 0) {
        await triggerJudgeLoop(finalMessages);
      }
    } catch (error) {
      const errorMessage: ChatMessage = { role: 'model', content: "Neural bridge unstable. Synchronizing with Knowledge Substrate...", timestamp: Date.now() };
      const failedMessages = [...updatedMessages, errorMessage];
      setMessages(failedMessages);
      localStorage.setItem(storageKey, JSON.stringify(failedMessages));
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

  const toggleAudit = (index: number) => {
    setExpandedAudits(prev => ({ ...prev, [index]: !prev[index] }));
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
      <FPTOverlay isOpen={showFPTOverlay} onClose={() => setShowFPTOverlay(false)} />
      <ContextOptimizerModal isOpen={showOptimizerModal} onClose={() => setShowOptimizerModal(false)} initialText={input} onInsert={setInput} />
      
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
          <div className="w-14 h-14 bg-emerald-600/10 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h2 className="font-outfit font-black text-2xl leading-tight uppercase tracking-tighter italic text-white">{activeAgent}</h2>
            <div className="flex items-center space-x-3 mt-1">
              <span className={`w-2 h-2 rounded-full animate-pulse ${isReflecting ? 'bg-orange-500 shadow-[0_0_8px_#f97316]' : isLearning ? 'bg-indigo-500 shadow-[0_0_8px_#6366f1]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`}></span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">
                {computeProvider} Logic Core &bull; RAG Enabled
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-4 items-center">
          <button 
            onClick={() => setUseFPT(!useFPT)}
            className={`px-5 py-3 rounded-2xl border flex items-center justify-center space-x-2 transition-all ${useFPT ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-emerald-500/50'}`}
            title="First Principles Thinking Protocol"
          >
            <span className="text-[10px] font-black uppercase tracking-widest">FPT-Omega</span>
            {useFPT && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>}
          </button>

          <button onClick={() => setShowFPTOverlay(true)} className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 hover:text-white transition-all" title="FPT Research & Audit">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5" /></svg>
          </button>

          <button onClick={toggleAmbient} className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all ${isAmbientActive ? 'bg-orange-600/20 border-orange-500 text-orange-400 animate-glow' : 'bg-slate-950 border-slate-800 text-slate-700 hover:text-orange-400'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
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
              {/* FPT Audit Trace Visualization */}
              {m.fptAudit && (
                <div className="mb-6">
                  <button 
                    onClick={() => toggleAudit(idx)}
                    className={`flex items-center space-x-2 text-[9px] font-black uppercase tracking-[0.2em] mb-4 transition-colors ${expandedAudits[idx] ? 'text-emerald-400' : 'text-emerald-500/50 hover:text-emerald-400'}`}
                  >
                    <svg className={`w-3 h-3 transition-transform ${expandedAudits[idx] ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    <span>First Principles Audit Trace</span>
                  </button>
                  
                  {expandedAudits[idx] && (
                    <div className="p-5 bg-slate-950/50 rounded-2xl border border-emerald-500/20 mb-6 animate-in slide-in-from-top-2">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">Assumption Deconstruction</p>
                          <ul className="list-disc list-inside text-[10px] text-slate-400 space-y-1">
                            {m.fptAudit.deconstruction.slice(0, 3).map((d, i) => <li key={i}>{d}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">Foundational Axioms</p>
                          <ul className="list-disc list-inside text-[10px] text-slate-400 space-y-1">
                            {m.fptAudit.axioms.map((a, i) => <li key={i}>{a}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="whitespace-pre-wrap text-[15px] leading-relaxed font-medium italic font-outfit">"{m.content}"</div>
              
              {/* Grounded Citations (NotebookLM Style) */}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-800/50 space-y-4">
                  <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Knowledge Citations</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {m.citations.map((c, i) => (
                      <div key={i} className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 bg-orange-600 text-white rounded text-[8px] font-black flex items-center justify-center">{i + 1}</span>
                          <span className="text-[9px] font-black text-white uppercase truncate">{c.sourceTitle}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 italic line-clamp-2">"{c.snippet}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {m.sources && m.sources.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-800/20 flex flex-wrap gap-3">
                  {m.sources.map((s, i) => (<a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-slate-950/80 border border-slate-800/50 px-4 py-2 rounded-xl text-slate-400 hover:text-orange-400 hover:border-orange-500/30 transition-all truncate max-w-[220px]">{s.title}</a>))}
                </div>
              )}

              {m.role === 'model' && <ActionHub content={m.content} agentName={activeAgent} />}
              
              <div className="absolute -bottom-6 right-4 flex items-center space-x-3 text-[9px] font-black uppercase text-slate-600 tracking-widest italic opacity-60">
                {m.fptAudit && <span className="text-emerald-500 font-black">FPT Verified</span>}
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
          
          <form onSubmit={handleSubmit} className="flex items-center space-x-6 relative">
            <button 
              type="button" 
              onClick={() => setShowOptimizerModal(true)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 hover:text-white hover:bg-indigo-500 hover:shadow-[0_0_15px_#6366f1] transition-all z-10"
              title="Open Context Refinery"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </button>

            <div className={`flex-1 bg-[#020617] border rounded-full py-2 pl-16 pr-10 shadow-inner group transition-all focus-within:border-emerald-500/40 ${useFPT ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-emerald-500/20'}`}>
              <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder={useFPT ? `Inject First Principles Query to ${activeAgent}...` : `Query ${activeAgent} via grounded knowledge...`} 
                className="w-full bg-transparent text-white py-5 focus:outline-none font-outfit font-bold text-xl italic placeholder-slate-600" 
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()} 
              className={`px-14 py-7 rounded-full font-black uppercase tracking-[0.4em] text-[13px] transition-all shadow-xl active:scale-95 disabled:opacity-30 ${useFPT ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-900/50 text-slate-500 hover:text-white hover:bg-orange-600 border border-slate-800 hover:border-orange-400'}`}
            >
              {useFPT ? 'FPT EXECUTE' : 'Ground & Transmit'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
