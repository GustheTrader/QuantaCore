
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

const docsTool: FunctionDeclaration = {
  name: "interact_with_docs",
  parameters: {
    type: Type.OBJECT,
    description: "Create or read Google Docs for structured knowledge architecting.",
    properties: {
      action: { type: Type.STRING, enum: ["read", "create", "append"], description: "The action to perform." },
      title: { type: Type.STRING, description: "The title of the document." },
      content: { type: Type.STRING, description: "The content to write or append." }
    },
    required: ["action"]
  }
};

const driveTool: FunctionDeclaration = {
  name: "interact_with_drive",
  parameters: {
    type: Type.OBJECT,
    description: "Manage files and directory structure in the Drive vault.",
    properties: {
      action: { type: Type.STRING, enum: ["list", "search", "delete"], description: "The action to perform." },
      query: { type: Type.STRING, description: "Filename or search parameters." }
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
  const [sessionLog, setSessionLog] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');
  
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
  const logEndRef = useRef<HTMLDivElement>(null);
  const storageKey = `quanta_chat_history_${agentName.replace(/\s+/g, '_').toLowerCase()}`;

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionLog, currentInput, currentOutput]);

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
      
      setSessionLog(prev => [
        ...prev, 
        ...(input ? [{role: 'user', text: input}] as const : []),
        ...(output ? [{role: 'model', text: output}] as const : [])
      ]);

      window.dispatchEvent(new Event('storage'));

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
      setSessionLog([]);
      setCurrentInput('');
      setCurrentOutput('');
      
      try {
        // Safe API Key Retrieval
        const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || 
                       ((window as any).process?.env?.API_KEY);
        
        if (!apiKey) {
          throw new Error("API Key not detected. Please verify Neural Link credentials.");
        }

        const ai = new GoogleGenAI({ apiKey });
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = outputCtx;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const ctx = await getSMEContext(agentName, profile);
        const fullSystemInstruction = `${systemInstruction}\n\n${ctx.fullHeader}\n\nMaintain conversational flow. Prioritize clear, concise, and logical SME advice. Use available tools to assist the operator.`;
        
        const tools: any[] = [];
        const functionDeclarations: FunctionDeclaration[] = [];
        if (enabledSkills.includes('search')) {
          tools.push({ googleSearch: {} });
        }
        
        if (enabledSkills.includes('gmail')) functionDeclarations.push(gmailTool);
        if (enabledSkills.includes('calendar')) functionDeclarations.push(calendarTool);
        if (enabledSkills.includes('docs')) functionDeclarations.push(docsTool);
        if (enabledSkills.includes('drive')) functionDeclarations.push(driveTool);
        
        if (functionDeclarations.length > 0) {
          tools.push({ functionDeclarations });
        }

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          config: { 
            responseModalities: [Modality.AUDIO], 
            inputAudioTranscription: inputTranscription ? {} : undefined, 
            outputAudioTranscription: outputTranscription ? {} : undefined, 
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } }, 
            systemInstruction: fullSystemInstruction, 
            tools: tools.length > 0 ? tools : undefined 
          },
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
              if (msg.serverContent?.inputTranscription) {
                const text = msg.serverContent.inputTranscription.text;
                setCurrentInput(prev => prev + text);
              }
              if (msg.serverContent?.outputTranscription) {
                const text = msg.serverContent.outputTranscription.text;
                setCurrentOutput(prev => prev + text);
              }
              if (msg.serverContent?.turnComplete) { 
                persistTurn(currentInput, currentOutput); 
                setCurrentInput(''); 
                setCurrentOutput(''); 
              }

              if (msg.toolCall) {
                for (const fc of msg.toolCall.functionCalls) {
                  console.debug('SME Tool Call:', fc);
                  const result = "Task acknowledged. Processing logic...";
                  sessionPromise.then((session) => {
                    session.sendToolResponse({
                      functionResponses: {
                        id : fc.id,
                        name: fc.name,
                        response: { result: result },
                      }
                    })
                  });
                }
              }
              
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
                source.onended = () => { 
                  sourcesRef.current.delete(source); 
                  if (sourcesRef.current.size === 0) setIsSpeaking(false); 
                };
              }
            },
            onclose: () => onClose(),
            onerror: (e) => {
              console.error('Voice error:', e);
              setConnectionError("Neural bridge synchronization failed. Check API key permissions.");
              setIsConnecting(false);
            },
          }
        });
        sessionRef.current = await sessionPromise;
      } catch (e: any) {
        console.error("Connection failed", e);
        setConnectionError(e.message || "Microphone access denied or API Error.");
        setIsConnecting(false);
      }
    };
    startSession();
    return () => {
      if (sessionRef.current) { try { sessionRef.current.close(); } catch (e) {} }
      if (audioContextRef.current) { try { audioContextRef.current.close(); } catch (e) {} }
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/98 backdrop-blur-3xl animate-in fade-in duration-300">
      <NeuralOptimizationWindow isOpen={isNeuralLinkActive} onClose={() => setIsNeuralLinkActive(false)} agentName={agentName} telemetry={telemetry} />
      
      <div className={`w-full max-w-4xl h-[85vh] flex flex-col items-center p-12 relative transition-all duration-500 ${isNeuralLinkActive ? 'lg:-translate-x-48 scale-90 opacity-60' : 'scale-100'}`}>
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors z-[110]">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        
        <div className="mb-10 relative flex flex-col items-center shrink-0">
          <div className={`w-32 h-32 rounded-full border-2 border-indigo-500/50 flex items-center justify-center transition-all duration-500 ${isSpeaking ? 'animate-glow shadow-[0_0_80px_rgba(99,102,241,0.5)] border-indigo-400' : 'border-slate-800'}`}>
             <div className={`w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-orange-500 flex items-center justify-center shadow-2xl transition-transform duration-500 ${isSpeaking ? 'scale-110 rotate-180' : 'scale-100'}`}>
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
          </div>
          <h2 className="text-4xl font-outfit font-black mt-8 uppercase tracking-tighter text-white italic">
            {isConnecting ? 'Syncing...' : connectionError ? 'Sync Failed' : `${agentName}`}
          </h2>
          {connectionError && (
            <p className="text-rose-500 font-bold text-[10px] uppercase tracking-widest mt-2">{connectionError}</p>
          )}
          {!connectionError && (
            <div className="flex items-center space-x-2 mt-2">
              <div className={`w-2 h-2 rounded-full ${isConnecting ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_10px_#10b981]'}`}></div>
              <span className="text-emerald-400 font-black text-[10px] uppercase tracking-[0.4em]">{profile.personality} Active</span>
            </div>
          )}
        </div>

        <div className="flex-1 w-full max-w-2xl overflow-y-auto custom-scrollbar space-y-6 my-10 px-6 py-4 bg-slate-900/20 rounded-[2.5rem] border border-slate-800/50 shadow-inner">
           {sessionLog.map((entry, idx) => (
             <div key={idx} className={`flex flex-col ${entry.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2`}>
               <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${entry.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                 {entry.role === 'user' ? 'You' : agentName}
               </p>
               <div className={`p-5 rounded-2xl max-w-[90%] text-sm font-medium leading-relaxed ${entry.role === 'user' ? 'bg-indigo-600/20 text-indigo-100 rounded-tr-none' : 'bg-emerald-600/10 text-emerald-50 rounded-tl-none'}`}>
                 {entry.text}
               </div>
             </div>
           ))}
           
           {currentInput && (
             <div className="flex flex-col items-end animate-in fade-in">
               <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-indigo-400/50 italic">Speaking...</p>
               <div className="p-5 rounded-2xl max-w-[90%] text-sm font-medium italic bg-indigo-600/10 text-indigo-200/70 border border-indigo-500/20 rounded-tr-none">
                 {currentInput}
               </div>
             </div>
           )}
           
           {currentOutput && (
             <div className="flex flex-col items-start animate-in fade-in">
               <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-emerald-400/50 italic">Transmitting...</p>
               <div className="p-5 rounded-2xl max-w-[90%] text-sm font-medium bg-emerald-600/5 text-emerald-100/70 border border-emerald-500/10 rounded-tl-none">
                 {currentOutput}
               </div>
             </div>
           )}
           <div ref={logEndRef} />
        </div>

        <div className="w-full max-w-2xl grid grid-cols-2 gap-6 shrink-0">
          <button 
            onClick={() => setIsNeuralLinkActive(!isNeuralLinkActive)} 
            className={`py-6 rounded-[2rem] font-black uppercase tracking-[0.3em] text-[11px] flex items-center justify-center space-x-3 transition-all border ${isNeuralLinkActive ? 'bg-indigo-600 border-indigo-400 text-white shadow-2xl' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-indigo-400'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944" /></svg>
            <span>Neural Telemetry</span>
          </button>
          <button 
            onClick={onClose} 
            className="py-6 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/30 rounded-[2rem] font-black uppercase tracking-[0.3em] text-[11px] transition-all shadow-xl hover:shadow-rose-500/30"
          >
            Terminate Bridge
          </button>
        </div>
      </div>
    </div>
  );
};
