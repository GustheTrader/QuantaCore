
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, FunctionDeclaration, Type } from '@google/genai';
import { NeuralOptimizationWindow } from './NeuralOptimizationWindow';
import { OptimizationTelemetry, ChatMessage } from '../types';
import { getSMEContext, distillMemoryFromChat } from '../services/geminiService';

interface VoiceAgentProps {
  agentName: string;
  systemInstruction: string;
  isActive: boolean;
  enabledSkills?: string[];
  voiceName?: string;
  inputTranscription?: boolean;
  outputTranscription?: boolean;
  onClose: () => void;
  profile: { name: string, callsign: string, personality: string };
}

const gmailTool: FunctionDeclaration = {
  name: "interact_with_gmail",
  parameters: {
    type: Type.OBJECT,
    description: "Search, read, or send emails via SME neural bridge.",
    properties: {
      action: { type: Type.STRING, enum: ["search", "read", "send"], description: "The action to perform." },
      query: { type: Type.STRING, description: "Search query or email recipient." },
      body: { type: Type.STRING, description: "The content of the email to send." }
    },
    required: ["action"]
  }
};

const calendarTool: FunctionDeclaration = {
  name: "interact_with_calendar",
  parameters: {
    type: Type.OBJECT,
    description: "Manage schedules and meetings using polymath scheduling logic.",
    properties: {
      action: { type: Type.STRING, enum: ["list_events", "create_event", "delete_event"], description: "The action to perform." },
      title: { type: Type.STRING, description: "Event title." },
      time: { type: Type.STRING, description: "ISO timestamp or natural language time." }
    },
    required: ["action"]
  }
};

export const VoiceAgent: React.FC<VoiceAgentProps> = ({ 
  agentName, 
  systemInstruction, 
  isActive, 
  enabledSkills = ['search'], 
  voiceName = 'Zephyr',
  inputTranscription = true,
  outputTranscription = true,
  onClose, 
  profile 
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isNeuralLinkActive, setIsNeuralLinkActive] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
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
  const currentInputTranscription = useRef<string>('');
  const currentOutputTranscription = useRef<string>('');
  const storageKey = `quanta_chat_history_${agentName.replace(/\s+/g, '_').toLowerCase()}`;

  const persistTurn = (input: string, output: string) => {
    if (!input && !output) return;
    try {
      const saved = localStorage.getItem(storageKey);
      const history: ChatMessage[] = saved ? JSON.parse(saved) : [];
      const newMessages: ChatMessage[] = [];
      if (input) newMessages.push({ role: 'user', content: input.trim(), timestamp: Date.now() });
      if (output) newMessages.push({ role: 'model', content: output.trim(), timestamp: Date.now() });
      const updatedHistory = [...history, ...newMessages];
      localStorage.setItem(storageKey, JSON.stringify(updatedHistory));
      distillMemoryFromChat(newMessages, agentName).then(newMemory => {
        if (newMemory) {
          setTelemetry(prev => ({ ...prev, optimizations: [...prev.optimizations, `Neural Growth: "${newMemory.title}" archived.`] }));
        }
      });
    } catch (e) {
      console.error("Failed to persist voice turn", e);
    }
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) { channelData[i] = dataInt16[i * numChannels + channel] / 32768.0; }
    }
    return buffer;
  };

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); }
    return btoa(binary);
  };

  useEffect(() => {
    if (!isActive) return;
    const startSession = async () => {
      setConnectionError(null);
      setIsConnecting(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = outputCtx;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = getSMEContext(agentName, profile);
        const fullSystemInstruction = `${systemInstruction}\n\n${ctx.fullHeader}\n\nGround voice reasoning in Sovereign Knowledge.`;
        const tools: any[] = [];
        const functionDeclarations: FunctionDeclaration[] = [];
        if (enabledSkills.includes('search')) {
          tools.push({ googleSearch: {} });
        } else {
          if (enabledSkills.includes('gmail')) functionDeclarations.push(gmailTool);
          if (enabledSkills.includes('calendar')) functionDeclarations.push(calendarTool);
          if (functionDeclarations.length > 0) tools.push({ functionDeclarations });
        }
        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: inputTranscription ? {} : undefined, outputAudioTranscription: outputTranscription ? {} : undefined, speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } }, systemInstruction: fullSystemInstruction, tools: tools.length > 0 ? tools : undefined },
          callbacks: {
            onopen: () => {
              setIsConnecting(false);
              const source = inputCtx.createMediaStreamSource(stream);
              const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const l = inputData.length;
                const int16 = new Int16Array(l);
                for (let i = 0; i < l; i++) { int16[i] = inputData[i] * 32768; }
                const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                sessionPromise.then(session => { session.sendRealtimeInput({ media: pcmBlob }); });
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputCtx.destination);
            },
            onmessage: async (msg: LiveServerMessage) => {
              if (msg.serverContent?.inputTranscription) currentInputTranscription.current += msg.serverContent.inputTranscription.text;
              if (msg.serverContent?.outputTranscription) currentOutputTranscription.current += msg.serverContent.outputTranscription.text;
              if (msg.serverContent?.turnComplete) { persistTurn(currentInputTranscription.current, currentOutputTranscription.current); currentInputTranscription.current = ''; currentOutputTranscription.current = ''; }
              if (msg.toolCall) { for (const fc of msg.toolCall.functionCalls) { sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "Action archived." } } })); } }
              const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64Audio) {
                setIsSpeaking(true);
                const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputCtx.destination);
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
                source.onended = () => { sourcesRef.current.delete(source); if (sourcesRef.current.size === 0) setIsSpeaking(false); };
              }
              if (msg.serverContent?.interrupted) { sourcesRef.current.forEach(s => s.stop()); sourcesRef.current.clear(); nextStartTimeRef.current = 0; setIsSpeaking(false); }
            },
            onclose: () => onClose(),
            onerror: (e) => {
              console.error('Voice error:', e);
              setConnectionError("Neural bridge synchronization failed. Check API configuration.");
              setIsConnecting(false);
            },
          }
        });
        sessionRef.current = await sessionPromise;
      } catch (e) {
        console.error("Initialization error:", e);
        setConnectionError("Access to neural bridge denied. Verify microphone permissions.");
        setIsConnecting(false);
      }
    };
    startSession();
    return () => {
      if (sessionRef.current) { try { sessionRef.current.close(); } catch (e) {} }
      if (audioContextRef.current) { try { audioContextRef.current.close(); } catch (e) {} }
    };
  }, [isActive, agentName, systemInstruction, voiceName, inputTranscription, outputTranscription, enabledSkills]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/95 backdrop-blur-3xl animate-in fade-in duration-300">
      <NeuralOptimizationWindow isOpen={isNeuralLinkActive} onClose={() => setIsNeuralLinkActive(false)} agentName={agentName} telemetry={telemetry} />
      <div className={`glass-card p-12 rounded-[3rem] w-full max-w-lg text-center relative border-indigo-500/30 transition-all duration-500 ${isNeuralLinkActive ? 'lg:-translate-x-48 scale-90 opacity-60' : 'scale-100'}`}>
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="mb-10 relative inline-block">
          <div className={`w-32 h-32 rounded-full border-2 border-indigo-500/50 flex items-center justify-center ${isSpeaking ? 'animate-pulse shadow-[0_0_60px_rgba(99,102,241,0.3)]' : ''}`}>
             <div className={`w-24 h-24 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center shadow-2xl transition-transform duration-500 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
             </div>
          </div>
        </div>
        <h2 className="text-3xl font-outfit font-black mb-2 uppercase tracking-tighter">
          {isConnecting ? 'Quantum Syncing...' : connectionError ? 'Sync Failed' : `${agentName}`}
        </h2>
        {connectionError ? (
           <p className="text-rose-400 font-bold text-[10px] uppercase tracking-widest mb-8 px-4">{connectionError}</p>
        ) : (
          <div className="flex items-center justify-center space-x-2 mb-8">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-emerald-400 font-bold text-[10px] uppercase tracking-widest">{profile.personality} Active</span>
          </div>
        )}
        <div className="space-y-4">
           <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 text-xs text-slate-400 leading-relaxed italic">
             {connectionError ? "Bridge integrity compromised. Retrying sequence required." : "Vocal core operational. Sovereign knowledge buffer linked."}
           </div>
           <div className="grid grid-cols-2 gap-3">
             <button disabled={!!connectionError} onClick={() => setIsNeuralLinkActive(!isNeuralLinkActive)} className={`py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center space-x-2 border ${isNeuralLinkActive ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944" /></svg>
               <span>Neural Link</span>
             </button>
             <button onClick={onClose} className="py-4 bg-slate-800 hover:bg-rose-900/20 hover:text-rose-400 hover:border-rose-900/50 border border-slate-700 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all">
               Terminate
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};
