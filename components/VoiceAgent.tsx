
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { NeuralOptimizationWindow } from './NeuralOptimizationWindow';
import { OptimizationTelemetry, ChatMessage } from '../types';

interface VoiceAgentProps {
  agentName: string;
  systemInstruction: string;
  isActive: boolean;
  enabledSkills?: string[];
  onClose: () => void;
}

export const VoiceAgent: React.FC<VoiceAgentProps> = ({ agentName, systemInstruction, isActive, enabledSkills = ['search'], onClose }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isNeuralLinkActive, setIsNeuralLinkActive] = useState(false);
  const [telemetry, setTelemetry] = useState<OptimizationTelemetry>({
    reasoningDepth: 0,
    neuralSync: 0,
    contextPurity: 0,
    optimizations: []
  });

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Transcription Persistence Refs
  const currentInputTranscription = useRef<string>('');
  const currentOutputTranscription = useRef<string>('');
  const storageKey = `quanta_chat_history_${agentName.replace(/\s+/g, '_').toLowerCase()}`;

  // Helper to load history for context injection
  const getRecentHistory = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: ChatMessage[] = JSON.parse(saved);
        // Get last 5 messages for context
        return parsed.slice(-5).map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`).join('\n');
      }
    } catch (e) {}
    return '';
  };

  const persistTurn = (input: string, output: string) => {
    if (!input && !output) return;
    try {
      const saved = localStorage.getItem(storageKey);
      const history: ChatMessage[] = saved ? JSON.parse(saved) : [];
      
      const newMessages: ChatMessage[] = [];
      if (input) newMessages.push({ role: 'user', content: input.trim(), timestamp: Date.now() });
      if (output) newMessages.push({ role: 'model', content: output.trim(), timestamp: Date.now() });
      
      localStorage.setItem(storageKey, JSON.stringify([...history, ...newMessages]));
    } catch (e) {
      console.error("Failed to persist voice turn", e);
    }
  };

  // Utility Functions
  const decodeBase64 = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext) => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  const encodePCM = (data: Float32Array) => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  useEffect(() => {
    if (!isActive) return;

    const startSession = async () => {
      setIsConnecting(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recentContext = getRecentHistory();
      
      const fullSystemInstruction = `${systemInstruction || `You are ${agentName}, a specialized SuperAgent.`} 
      NEURAL MEMORY ACCESS: Below is the context of recent interactions with the user. Use this to maintain continuity:
      ${recentContext ? `\n--- RECENT HISTORY ---\n${recentContext}\n------------------` : '\n(No recent history found in neural buffer.)'}`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: fullSystemInstruction,
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const base64Data = encodePCM(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' } });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Transcriptions
            if (msg.serverContent?.inputTranscription) {
              currentInputTranscription.current += msg.serverContent.inputTranscription.text;
            }
            if (msg.serverContent?.outputTranscription) {
              currentOutputTranscription.current += msg.serverContent.outputTranscription.text;
            }
            if (msg.serverContent?.turnComplete) {
              persistTurn(currentInputTranscription.current, currentOutputTranscription.current);
              currentInputTranscription.current = '';
              currentOutputTranscription.current = '';
            }

            // Handle Audio
            const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsSpeaking(true);
              
              setTelemetry(prev => ({
                reasoningDepth: Math.floor(Math.random() * 20) + 75,
                neuralSync: Math.floor(Math.random() * 10) + 90,
                contextPurity: Math.floor(Math.random() * 5) + 95,
                optimizations: [
                  "Neural memory blocks successfully synchronized.",
                  `Historical context successfully injected into ${agentName} core.`,
                  "Real-time vocal-to-memory persistence active."
                ]
              }));

              const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), outputCtx);
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              
              sourcesRef.current.add(source);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              };
            }
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onclose: () => onClose(),
          onerror: (e) => console.error('Voice error:', e),
        }
      });

      sessionRef.current = await sessionPromise;
    };

    startSession();

    return () => {
      if (sessionRef.current) sessionRef.current.close();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [isActive, agentName, systemInstruction]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/95 backdrop-blur-3xl animate-in fade-in duration-300">
      <NeuralOptimizationWindow 
        isOpen={isNeuralLinkActive} 
        onClose={() => setIsNeuralLinkActive(false)} 
        agentName={agentName}
        telemetry={telemetry}
      />

      <div className={`glass-card p-12 rounded-[3rem] w-full max-w-lg text-center relative border-indigo-500/30 transition-all duration-500 ${isNeuralLinkActive ? 'lg:-translate-x-48 scale-90 opacity-60' : 'scale-100'}`}>
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="mb-10 relative inline-block">
          <div className={`w-32 h-32 rounded-full border-2 border-indigo-500/50 flex items-center justify-center ${isSpeaking ? 'animate-pulse' : ''}`}>
             <div className={`w-24 h-24 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center shadow-2xl shadow-indigo-500/40 transition-transform duration-500 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
             </div>
          </div>
          {isSpeaking && (
            <>
              <div className="absolute inset-0 rounded-full border border-indigo-500 animate-ping opacity-20"></div>
              <div className="absolute inset-[-10px] rounded-full border border-purple-500 animate-ping opacity-10 [animation-delay:0.5s]"></div>
            </>
          )}
        </div>

        <h2 className="text-3xl font-outfit font-black mb-2 uppercase tracking-tighter">
          {isConnecting ? 'Quantum Syncing...' : `${agentName}`}
        </h2>
        
        <div className="flex items-center justify-center space-x-2 mb-8">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-emerald-400 font-bold text-[10px] uppercase tracking-widest">Neural Memory Persistent</span>
        </div>

        <div className="space-y-4">
           <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-xs text-slate-400 leading-relaxed">
             <div className="flex items-center justify-center space-x-4 mb-4">
                {enabledSkills.map(skill => (
                  <div key={skill} className="flex items-center space-x-1 opacity-60">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                    <span className="uppercase text-[9px] font-black tracking-tighter">{skill}</span>
                  </div>
                ))}
             </div>
             "Historical neural patterns loaded. Session persistence active via Edge memory vault."
           </div>
           
           <div className="grid grid-cols-2 gap-3">
             <button 
                onClick={() => setIsNeuralLinkActive(!isNeuralLinkActive)}
                className={`py-4 rounded-2xl font-bold transition-all uppercase tracking-widest text-[10px] flex items-center justify-center space-x-2 border ${isNeuralLinkActive ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
             >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944" /></svg>
               <span>Neural Link</span>
             </button>
             <button 
              onClick={onClose}
              className="py-4 bg-slate-800 hover:bg-red-900/20 hover:text-red-400 hover:border-red-900/50 border border-slate-700 rounded-2xl font-bold transition-all uppercase tracking-widest text-[10px]"
             >
               Terminate
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};
