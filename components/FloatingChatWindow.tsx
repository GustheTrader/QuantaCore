
import React, { useState, useRef, useEffect } from 'react';
import { ChatWindowSession, ChatMessage } from '../types';
import { chatWithSME } from '../services/geminiService';
import { X, Minus, Maximize2, Send, Terminal, Cpu, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FloatingChatWindowProps {
  session: ChatWindowSession;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onFocus: (id: string) => void;
  onAddMessage: (id: string, message: ChatMessage) => void;
  profile: { name: string, callsign: string, personality: string };
}

export const FloatingChatWindow: React.FC<FloatingChatWindowProps> = ({
  session,
  onClose,
  onMinimize,
  onFocus,
  onAddMessage,
  profile
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [session.messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    onAddMessage(session.id, userMessage);
    setInput('');
    setIsLoading(true);

    try {
      const history = session.messages.map(m => ({ role: m.role, content: m.content }));
      const response = await chatWithSME(
        input,
        history,
        session.agentName,
        undefined,
        ['search'],
        profile
      );

      const modelMessage: ChatMessage = {
        role: 'model',
        content: response.text,
        timestamp: Date.now(),
        sources: response.sources
      };

      onAddMessage(session.id, modelMessage);
    } catch (error: any) {
      console.error("Chat Error:", error);
      const errorMessage: ChatMessage = {
        role: 'model',
        content: "Neural link error. Please retry synchronization.",
        timestamp: Date.now()
      };
      onAddMessage(session.id, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (session.isMinimized) {
    return (
      <motion.div 
        layoutId={session.id}
        onClick={() => onMinimize(session.id)}
        className="fixed bottom-4 right-4 w-64 h-12 bg-slate-950 border border-slate-800 rounded-xl flex items-center px-4 cursor-pointer hover:border-indigo-500/50 transition-all z-[9999] shadow-2xl"
        style={{ zIndex: session.zIndex }}
      >
        <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 animate-pulse"></div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">{session.agentName}</span>
        <div className="flex-1"></div>
        <button onClick={(e) => { e.stopPropagation(); onClose(session.id); }} className="p-1 hover:text-rose-500">
          <X size={14} />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      layoutId={session.id}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      onMouseDown={() => onFocus(session.id)}
      className="fixed bottom-20 right-4 w-[400px] h-[550px] bg-slate-950 border border-slate-800 rounded-[2rem] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] z-[9999] overflow-hidden"
      style={{ zIndex: session.zIndex }}
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/30 rounded-lg flex items-center justify-center text-indigo-400">
            <Cpu size={16} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white">{session.agentName}</h3>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Neural Link Active</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => onMinimize(session.id)} className="p-2 text-slate-500 hover:text-white transition-colors">
            <Minus size={16} />
          </button>
          <button onClick={() => onClose(session.id)} className="p-2 text-slate-500 hover:text-rose-500 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-950/50">
        {session.messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] leading-relaxed ${
              m.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
            }`}>
              {m.content}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap gap-2">
                  {m.sources.map((s, i) => (
                    <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[9px] bg-slate-950 px-2 py-1 rounded-md text-slate-500 hover:text-indigo-400 truncate max-w-[150px]">
                      {s.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl rounded-tl-none flex space-x-2">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 border-t border-slate-800 bg-slate-900/30">
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Inject command..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-4 pr-10 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all placeholder-slate-700"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-700">
              <Terminal size={14} />
            </div>
          </div>
          <button 
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-indigo-500/20"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </motion.div>
  );
};
