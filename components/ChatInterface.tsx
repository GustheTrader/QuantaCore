
import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { chatWithGemini, optimizePrompt, distillMemoryFromChat, reflectAndRefine } from '../services/geminiService';
import { ChatMessage, OptimizationTelemetry, ReflectionResult } from '../types';
import { VoiceAgent } from './VoiceAgent';
import { NeuralOptimizationWindow } from './NeuralOptimizationWindow';

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
  
  const [agentConfig, setAgentConfig] = useState<{ prompt: string | null, skills: string[] }>({ prompt: null, skills: ['search'] });
  const [activeToolCall, setActiveToolCall] = useState<any>(null);
  
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
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncHistory = () => {
      const savedHistory = localStorage.getItem(storageKey);
      if (savedHistory) {
        try { 
          const parsed = JSON.parse(savedHistory);
          setMessages(parsed); 
        } catch (e) { setDefaultMessage(); }
      } else { setDefaultMessage(); }
    };

    syncHistory();
    window.addEventListener('focus', syncHistory);

    const savedConfigs = localStorage.getItem('quanta_agent_configs');
    if (savedConfigs) {
      try {
        const configs = JSON.parse(savedConfigs);
        if (configs[activeAgent]) setAgentConfig({ prompt: configs[activeAgent].prompt, skills: configs[activeAgent].skills || ['search'] });
      } catch (e) {}
    }

    return () => window.removeEventListener('focus', syncHistory);
  }, [activeAgent, storageKey]);

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  const setDefaultMessage = () => {
    setMessages([{ role: 'model', content: `Neural connection established. Welcome back, ${profile.callsign}. [${activeAgent}] online with Workspace connectors and ${profile.personality} logic.`, timestamp: Date.now() }]);
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages, activeToolCall, isReflecting, lastReflection]);

  const handleReset = () => {
    if (window.confirm(`Reset neural buffer for ${activeAgent}?`)) {
      localStorage.removeItem(storageKey);
      setDefaultMessage();
    }
  };

  const handleOptimizeContext = async () => {
    if (!input.trim() || isOptimizing) return;
    setIsOptimizing(true);
    setIsNeuralLinkActive(true); 
    try {
      const result = await optimizePrompt(input, activeAgent);
      setOptimizationResult(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsOptimizing(false);
    }
  };

  const applyOptimization = () => {
    if (optimizationResult) {
      setInput(optimizationResult.optimizedPrompt);
      setOptimizationResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input, timestamp: Date.now() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setOptimizationResult(null);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await chatWithGemini(userMessage.content, history, activeAgent, agentConfig.prompt || undefined, agentConfig.skills, profile);
      
      const modelMessage: ChatMessage = {
        role: 'model',
        content: response.text,
        timestamp: Date.now(),
        sources: response.sources
      };
      
      const finalMessages = [...updatedMessages, modelMessage];
      setMessages(finalMessages);

      // Blueprint Logic: Background Learning
      setIsLearning(true);
      distillMemoryFromChat(finalMessages.slice(-4), activeAgent).then(newMemory => {
        if (newMemory) {
          setTelemetry(prev => ({
            ...prev,
            optimizations: [...prev.optimizations, `Neural Growth: "${newMemory.title}" archived.`]
          }));
        }
        setIsLearning(false);
      });

      // Blueprint Logic: Reflection Loop (The "Judge" Agent)
      // Triggered every 7 exchanges (14 messages total) as per blueprint, or manually
      if (isReflectionEnabled && finalMessages.length > 0 && finalMessages.length % 14 === 0) {
        await triggerJudgeLoop(finalMessages);
      }

    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', content: "Neural bridge unstable. Synchronizing...", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerJudgeLoop = async (currentMessages: ChatMessage[]) => {
    setIsReflecting(true);
    try {
      const reflection = await reflectAndRefine(currentMessages.slice(-10), agentConfig.prompt || "Default SME Logic", activeAgent);
      setLastReflection(reflection);
      
      if (reflection.suggestedPrompt && reflection.score < 4) {
        const updatedPrompt = reflection.suggestedPrompt;
        setAgentConfig(prev => ({ ...prev, prompt: updatedPrompt }));
        
        // Persist local copy
        const savedConfigs = JSON.parse(localStorage.getItem('quanta_agent_configs') || '{}');
        savedConfigs[activeAgent] = { ...savedConfigs[activeAgent], prompt: updatedPrompt };
        localStorage.setItem('quanta_agent_configs', JSON.stringify(savedConfigs));

        setTelemetry(prev => ({
          ...prev,
          optimizations: [...prev.optimizations, `Evolved Protocol: Judge updated logic core to version ${Math.floor(Date.now()/100000)}.`]
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsReflecting(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] glass-card rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-700 relative">
      <VoiceAgent isActive={isVoiceActive} agentName={activeAgent} systemInstruction={agentConfig.prompt || `You are ${activeAgent}.`} onClose={() => setIsVoiceActive(false)} profile={profile} />
      
      <NeuralOptimizationWindow 
        isOpen={isNeuralLinkActive} 
        onClose={() => setIsNeuralLinkActive(false)} 
        agentName={activeAgent}
        telemetry={telemetry}
        optimizationResult={optimizationResult}
        isOptimizing={isOptimizing}
        onApply={applyOptimization}
      />

      <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-indigo-600/20 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h2 className="font-outfit font-black text-lg leading-tight uppercase tracking-tight">{activeAgent}</h2>
            <div className="flex items-center space-x-2">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isReflecting ? 'bg-orange-500' : isLearning ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isReflecting ? 'text-orange-400' : isLearning ? 'text-indigo-400' : 'text-emerald-400'}`}>
                {isReflecting ? 'Judge Reflection Loop...' : isLearning ? 'Learning Pulse...' : `Neural Secure: ${profile.personality}`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex space-x-3 items-center">
          <button 
            onClick={() => setIsReflectionEnabled(!isReflectionEnabled)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all flex items-center space-x-2 ${isReflectionEnabled ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900 border-slate-800 text-slate-600'}`}
            title="Toggle Meta-Cognitive Reflection Loop"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944" /></svg>
            <span>Judge Loop</span>
          </button>
          <button 
            onClick={() => triggerJudgeLoop(messages)}
            className="p-2 text-slate-500 hover:text-white transition-colors"
            title="Manual Reflection Trigger"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <div className="w-px h-6 bg-slate-800 mx-1"></div>
          <button 
            onClick={() => setIsNeuralLinkActive(!isNeuralLinkActive)}
            className={`px-4 py-2 border rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 ${
              isNeuralLinkActive 
              ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/40' 
              : 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944" /></svg>
            <span>Neural Link</span>
          </button>
          <button onClick={() => setIsVoiceActive(true)} className="px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest">Live Voice</button>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 bg-slate-950/20 transition-all duration-500 ${isNeuralLinkActive ? 'lg:mr-[450px]' : ''}`}>
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
            <div className={`max-w-[85%] lg:max-w-[75%] p-6 rounded-2xl relative ${m.role === 'user' ? 'bg-indigo-600/90 text-white rounded-tr-none shadow-xl border border-indigo-400/20' : 'glass-card text-slate-100 rounded-tl-none border-slate-800'}`}>
              <div className="whitespace-pre-wrap text-sm lg:text-[15px] leading-relaxed font-medium">{m.content}</div>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-800/50 flex flex-wrap gap-2">
                  {m.sources.map((s, i) => (<a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-slate-900/80 border border-slate-700/50 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white truncate max-w-[200px]">{s.title}</a>))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isReflecting && (
          <div className="flex justify-start">
            <div className="glass-card p-8 rounded-[2.5rem] rounded-tl-none border-orange-500/30 bg-orange-500/5 flex items-center space-x-6 animate-pulse shadow-2xl">
              <div className="w-14 h-14 bg-orange-600 border-2 border-orange-400 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944" /></svg>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.3em] mb-1">Judge Meta-Cognition Loop</p>
                <p className="text-sm font-bold text-white uppercase tracking-tight">Applying Rubric: Completeness, Depth, Tone, Scope...</p>
                <div className="w-full h-1 bg-slate-800 rounded-full mt-3 overflow-hidden">
                   <div className="h-full bg-orange-500 animate-[loading_2s_infinite]"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {lastReflection && !isReflecting && (
          <div className="flex justify-center my-10 px-4">
             <div className="w-full max-w-2xl glass-card p-10 rounded-[3rem] border-emerald-500/20 relative overflow-hidden group hover:border-emerald-500/50 transition-all duration-700">
                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/20 group-hover:bg-emerald-500 transition-all"></div>
                <div className="flex items-center justify-between mb-8">
                   <div>
                     <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em]">Judge Evaluation Trace</h4>
                     <p className="text-2xl font-outfit font-black text-white uppercase italic tracking-tighter">Neural Integrity: {lastReflection.score}/5</p>
                   </div>
                   <div className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${lastReflection.score >= 4 ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-orange-500/10 border-orange-500/50 text-orange-400'}`}>
                      {lastReflection.score >= 4 ? 'Optimal Protocol' : 'Evolving Logic'}
                   </div>
                </div>
                
                <p className="text-slate-400 text-xs leading-relaxed italic mb-8 border-l-2 border-slate-800 pl-6 group-hover:border-emerald-500 transition-all">"{lastReflection.analysis}"</p>
                
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-3">
                      <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Strengths</p>
                      {lastReflection.strengths.map((s, i) => (
                        <div key={i} className="flex items-center space-x-2 text-[10px] text-slate-300 font-bold uppercase tracking-tight">
                          <span className="w-1 h-1 bg-emerald-400 rounded-full"></span>
                          <span>{s}</span>
                        </div>
                      ))}
                   </div>
                   <div className="space-y-3">
                      <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Neural Weaknesses</p>
                      {lastReflection.weaknesses.map((w, i) => (
                        <div key={i} className="flex items-center space-x-2 text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                          <span className="w-1 h-1 bg-orange-400 rounded-full"></span>
                          <span>{w}</span>
                        </div>
                      ))}
                   </div>
                </div>
                
                <button 
                  onClick={() => setLastReflection(null)}
                  className="absolute bottom-6 right-8 text-[9px] font-black text-slate-600 uppercase hover:text-white transition-colors"
                >
                  Dismiss Trace
                </button>
             </div>
          </div>
        )}

        {isLoading && !activeToolCall && !isReflecting && (
          <div className="flex justify-start"><div className="glass-card p-6 rounded-2xl rounded-tl-none flex space-x-3 items-center"><div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" /><div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" /><div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter ml-2">Neural Ingesting...</span></div></div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={`p-6 border-t border-slate-800 bg-slate-900/30 transition-all duration-500 ${isNeuralLinkActive ? 'lg:mr-[450px]' : ''}`}>
        <form onSubmit={handleSubmit} className="relative max-w-5xl mx-auto flex items-center space-x-4">
          <div className="relative flex-1">
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder={`Instruct ${activeAgent}...`} 
              className="w-full bg-slate-900/80 border-2 border-slate-800 text-white rounded-2xl py-5 pl-8 pr-16 focus:outline-none focus:border-indigo-500 transition-all font-medium" 
            />
            <button 
              type="button"
              onClick={handleOptimizeContext}
              disabled={!input.trim() || isOptimizing}
              className={`absolute right-3 top-3 bottom-3 px-3 rounded-xl transition-all flex items-center justify-center ${isOptimizing ? 'animate-pulse bg-emerald-500/20' : 'hover:bg-slate-800 text-emerald-400'}`}
              title="Optimize Context (FPT)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </button>
          </div>
          <button type="submit" disabled={isLoading || !input.trim()} className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 rounded-2xl transition-all shadow-lg flex items-center justify-center font-black uppercase tracking-widest text-[10px] text-white">Transmit</button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
