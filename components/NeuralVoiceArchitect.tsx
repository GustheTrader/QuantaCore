
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";

interface NeuralVoiceArchitectProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (finalPrompt: string) => void;
  agentType: 'DeepAgent' | 'DeepDiver';
}

export const NeuralVoiceArchitect: React.FC<NeuralVoiceArchitectProps> = ({ isOpen, onClose, onResult, agentType }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech Recognition Error', event.error);
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      if (transcript) handleArchitectPrompt();
    } else {
      setTranscript('');
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleArchitectPrompt = async () => {
    if (!transcript) return;
    setIsProcessing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are the Neural Voice Architect. Transform this rough spoken instruction into a high-density, professional deep research query for a ${agentType === 'DeepAgent' ? 'Recursive Research Loop' : 'Deep Abyssal Retrieval'}. Use First Principles Thinking. 
        
        SPOKEN TEXT: "${transcript}"
        
        Return ONLY the refined query string. No conversational filler.`,
      });

      const refined = response.text?.trim() || transcript;
      onResult(refined);
      onClose();
    } catch (e) {
      console.error(e);
      onResult(transcript);
      onClose();
    } finally {
      setIsProcessing(false);
      setTranscript('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#020617]/95 backdrop-blur-2xl p-6 animate-in fade-in duration-300">
      <div className="glass-card w-full max-w-xl rounded-[4rem] border-orange-500/30 p-12 flex flex-col items-center text-center shadow-[0_0_100px_rgba(249,115,22,0.1)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent"></div>
        
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="mb-10 flex flex-col items-center">
          <div 
            onClick={toggleListening}
            className={`w-28 h-28 rounded-full flex items-center justify-center cursor-pointer transition-all duration-500 relative ${
              isListening ? 'bg-orange-600 animate-glow-orange scale-110' : 'bg-slate-900 border-2 border-slate-800 hover:border-orange-500/50'
            }`}
          >
            {isListening ? (
              <div className="flex items-center space-x-1">
                <div className="w-1.5 h-8 bg-white rounded-full animate-[voice-wave_0.5s_ease-in-out_infinite]"></div>
                <div className="w-1.5 h-12 bg-white rounded-full animate-[voice-wave_0.7s_ease-in-out_infinite]"></div>
                <div className="w-1.5 h-6 bg-white rounded-full animate-[voice-wave_0.4s_ease-in-out_infinite]"></div>
              </div>
            ) : (
              <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            )}
          </div>
          <h2 className="text-3xl font-outfit font-black text-white mt-8 uppercase tracking-tighter italic">
            {isListening ? 'Architecting...' : isProcessing ? 'Refining Logic...' : 'Vocal Architect'}
          </h2>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-2">
            Speak your rough research objective
          </p>
        </div>

        <div className="w-full min-h-[120px] bg-slate-950/50 border border-slate-800 rounded-[2.5rem] p-8 flex items-center justify-center italic text-slate-300 font-medium leading-relaxed">
          {transcript ? `"${transcript}"` : isProcessing ? 'Processing Neural Axioms...' : 'Awaiting audio signal...'}
        </div>

        <div className="mt-10 flex space-x-4 w-full">
           <button 
             onClick={toggleListening}
             className={`flex-1 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${
               isListening ? 'bg-slate-900 text-orange-500 border border-orange-500/30' : 'quanta-btn-orange text-white shadow-xl'
             }`}
           >
             {isListening ? 'Finish Transcription' : 'Begin Capture'}
           </button>
        </div>
      </div>
      
      <style>{`
        @keyframes voice-wave {
          0%, 100% { height: 10px; }
          50% { height: 30px; }
        }
      `}</style>
    </div>
  );
};
