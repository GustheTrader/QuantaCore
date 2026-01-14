
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GeneratedImage, UserCredits } from '../types';
import { getCredits, deductVisualEnergy } from '../services/creditService';

const VIDEO_COST = 200;
const LOADING_MESSAGES = [
  "Synchronizing neural frame-buffer...",
  "Calibrating cinematic vectors...",
  "Synthesizing motion axioms...",
  "Aligning temporal consistency...",
  "Rendering sovereign visuals...",
  "Finalizing MPC bitstream..."
];

const VideoGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [credits, setCredits] = useState<UserCredits>(getCredits());

  useEffect(() => {
    const updateCredits = () => setCredits(getCredits());
    window.addEventListener('quanta_credits_updated', updateCredits);
    return () => window.removeEventListener('quanta_credits_updated', updateCredits);
  }, []);

  useEffect(() => {
    let interval: any;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 5000);
    } else {
      setLoadingMsgIdx(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    if (credits.visualEnergy < VIDEO_COST) {
      alert("Visual Energy Depleted. Please re-calibrate credits.");
      return;
    }

    // Veo Mandatory Key Protocol
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      alert("Sovereign Video generation requires a paid GCP project key for Veo.");
      await (window as any).aistudio.openSelectKey();
      return;
    }

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: '1080p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await (ai as any).operations.getVideosOperation({ operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const finalUrl = `${downloadLink}&key=${process.env.API_KEY}`;
        const newVideo: GeneratedImage = {
          id: Math.random().toString(36).substr(2, 9),
          url: finalUrl,
          prompt,
          timestamp: Date.now(),
          type: 'video'
        };
        setHistory([newVideo, ...history]);
        setPrompt('');
        deductVisualEnergy(VIDEO_COST);
      }
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes("Requested entity was not found")) {
        await (window as any).aistudio.openSelectKey();
      } else {
        alert("Cinematic synthesis failed. Please verify API configuration.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-outfit font-black uppercase tracking-tighter italic">Cinematic <span className="text-orange-500">Forge</span></h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px] mt-2">Motion synthesis via Google Veo 3.1 Substrate</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 px-6 py-3 rounded-2xl flex items-center space-x-4">
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest">Visual Energy</span>
            <span className="text-xl font-outfit font-black text-white">{credits.visualEnergy.toLocaleString()}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 flex items-center justify-center text-orange-400 border border-orange-500/30">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </div>
        </div>
      </header>

      <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent"></div>
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between px-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Cinematic Objective</label>
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Cost: {VIDEO_COST} Energy</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A neon hologram of a cybernetic cat driving a high-speed vehicle through a crystalline city..."
              rows={4}
              className="w-full bg-slate-950 border-2 border-slate-800 text-white rounded-3xl p-8 focus:outline-none focus:border-orange-500 placeholder-slate-800 transition-all text-lg italic font-medium resize-none shadow-inner"
            />
          </div>
          
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-8 bg-orange-600 hover:bg-orange-500 text-white rounded-[2.5rem] text-sm font-black uppercase tracking-[0.5em] transition-all shadow-2xl flex items-center justify-center space-x-4 disabled:opacity-30 active:scale-95 animate-glow-orange"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                <span>{LOADING_MESSAGES[loadingMsgIdx]}</span>
              </>
            ) : (
              <>
                <span>Commence Film Synthesis</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center space-x-3 px-4">
          <div className="w-1.5 h-1.5 bg-orange-500 rounded-full shadow-[0_0_8px_#f97316]"></div>
          <span>Archived Media</span>
        </h2>
        
        {history.length === 0 ? (
          <div className="py-32 border-2 border-dashed border-slate-800 rounded-[3rem] flex flex-col items-center justify-center text-slate-600 bg-slate-900/20">
            <svg className="w-16 h-16 mb-6 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14" />
            </svg>
            <p className="text-[10px] font-black uppercase tracking-widest">Media archive empty. Launch synthesis above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {history.map((vid) => (
              <div key={vid.id} className="group relative bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-800 transition-all hover:border-orange-500/30 duration-500 shadow-xl">
                <video src={vid.url} controls className="w-full aspect-video object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="p-8 bg-[#020617]/95 backdrop-blur-xl border-t border-orange-500/20">
                  <p className="text-[11px] text-slate-300 font-medium italic mb-6 leading-relaxed">"{vid.prompt}"</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{new Date(vid.timestamp).toLocaleTimeString()}</span>
                    <a href={vid.url} target="_blank" rel="noreferrer" className="text-orange-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors flex items-center space-x-2">
                       <span>Source Link</span>
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoGenerator;
