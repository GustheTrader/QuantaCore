
import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { chatWithGemini, optimizePrompt, distillMemoryFromChat } from '../services/geminiService';
import { ChatMessage, OptimizationTelemetry } from '../types';
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
  useEffect(scrollToBottom, [messages, activeToolCall]);

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

      // Background Learning (Neural Distillation)
      setIsLearning(true);
      distillMemoryFromChat(finalMessages.slice(-4), activeAgent).then(newMemory => {
        if (newMemory) {
          setTelemetry(prev => ({
            ...prev,
            optimizations: [...prev.optimizations, `Sovereign Link Updated: "${newMemory.title}" archived.`]
          }));
        }
        setIsLearning(false);
      });

      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const fc of response.functionCalls) {
          setActiveToolCall(fc);
          await new Promise(r => setTimeout(r, 2000)); 
          setActiveToolCall(null);
        }
      }

    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', content: "Neural bridge unstable. Synchronizing...", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getToolUI = (fc: any) => {
    const name = fc.name;
    const args = fc.args || {};
    let explanation = "Accessing neural bridge...";
    let toolIcon = "M13 10V3L4 14h7v7l9-11h-7z";
    let toolColor = "bg-indigo-500";
    let toolText = "Neural Bridge";

    if (name.includes('gmail')) {
      toolText = "Gmail Link";
      toolColor = "bg-red-500";
      toolIcon = "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z";
      if (args.action === 'search') explanation = `Searching your Gmail for "${args.query}"...`;
      if (args.action === 'read') explanation = `Opening specific email context...`;
      if (args.action === 'send') explanation = `Drafting and transmitting email to recipient...`;
    } else if (name.includes('calendar')) {
      toolText = "Calendar Sync";
      toolColor = "bg-blue-500";
      toolIcon = "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z";
      if (args.action === 'list_events') explanation = `Synchronizing upcoming schedule and availability...`;
      if (args.action === 'create_event') explanation = `Scheduling "${args.title}" to your calendar...`;
    } else if (name.includes('docs')) {
      toolText = "Docs Architect";
      toolColor = "bg-green-500";
      toolIcon = "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
      if (args.action === 'create') explanation = `Forging a new document: "${args.fileName}"...`;
      if (args.action === 'summarize') explanation = `Analyzing document content for neural summary...`;
    } else if (name.includes('drive')) {
      toolText = "Drive Vault";
      toolColor = "bg-amber-500";
      toolIcon = "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v10a2 2 0 00-2 2v10a2 2 0 002 2z";
      if (args.action === 'search') explanation = `Scanning Drive vault for files matching "${args.fileName || args.query}"...`;
    }

    return (
      <div className="flex justify-center my-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="bg-slate-900/60 border border-slate-800 px-8 py-4 rounded-[2rem] flex items-center space-x-6 shadow-2xl backdrop-blur-md">
          <div className={`w-12 h-12 rounded-2xl ${toolColor} flex items-center justify-center animate-pulse shadow-lg`}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={toolIcon} /></svg>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{toolText}</p>
            <p className="text-sm font-bold text-white uppercase tracking-tight">{explanation}</p>
          </div>
        </div>
      </div>
    );
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
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLearning ? 'bg-orange-500' : 'bg-emerald-500'}`}></span>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isLearning ? 'text-orange-400' : 'text-emerald-400'}`}>
                {isLearning ? 'Neural Growth Active...' : `Neural Link: ${profile.personality}`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => setIsNeuralLinkActive(!isNeuralLinkActive)}
            className={`px-4 py-2 border rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 ${
              isNeuralLinkActive 
              ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/40' 
              : 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            <span>Neural Link</span>
          </button>
          <button onClick={() => setIsVoiceActive(true)} className="px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest">Live Voice</button>
          <button onClick={handleReset} className="text-slate-600 hover:text-red-400 text-[10px] font-black uppercase tracking-widest flex items-center space-x-2"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg><span>Reset</span></button>
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
        {activeToolCall && getToolUI(activeToolCall)}
        {isLoading && !activeToolCall && (
          <div className="flex justify-start"><div className="glass-card p-6 rounded-2xl rounded-tl-none flex space-x-3 items-center"><div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" /><div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" /><div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter ml-2">Neural Link Active...</span></div></div>
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
              title="Optimize Context"
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
