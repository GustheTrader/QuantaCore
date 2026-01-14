
import React, { useState, useEffect } from 'react';
import { generateImage } from '../services/geminiService';
import { GeneratedImage, UserCredits } from '../types';
import { getCredits, deductVisualEnergy } from '../services/creditService';

const IMAGE_COST = 50;

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [credits, setCredits] = useState<UserCredits>(getCredits());

  useEffect(() => {
    const updateCredits = () => setCredits(getCredits());
    window.addEventListener('quanta_credits_updated', updateCredits);
    return () => window.removeEventListener('quanta_credits_updated', updateCredits);
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    if (credits.visualEnergy < IMAGE_COST) {
      alert("Visual Energy Depleted. Please re-calibrate credits.");
      return;
    }

    setIsGenerating(true);
    try {
      const url = await generateImage(prompt);
      const newImage: GeneratedImage = {
        id: Math.random().toString(36).substr(2, 9),
        url,
        prompt,
        timestamp: Date.now(),
        type: 'image'
      };
      setHistory([newImage, ...history]);
      setPrompt('');
      deductVisualEnergy(IMAGE_COST);
    } catch (error) {
      console.error(error);
      alert("Failed to generate image. Please check API key.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-outfit font-black uppercase tracking-tighter italic">Visual <span className="quantum-gradient-text">Forge</span></h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px] mt-2">Synthesizing high-fidelity assets via Gemini 2.5</p>
        </div>
        <div className="bg-indigo-500/10 border border-indigo-500/20 px-6 py-3 rounded-2xl flex items-center space-x-4">
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Visual Energy</span>
            <span className="text-xl font-outfit font-black text-white">{credits.visualEnergy.toLocaleString()}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16" /></svg>
          </div>
        </div>
      </header>

      <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between px-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Visual Prompt Substrate</label>
              <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Cost: {IMAGE_COST} Energy</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the neural aesthetic to forge..."
              rows={4}
              className="w-full bg-slate-950 border-2 border-slate-800 text-white rounded-3xl p-8 focus:outline-none focus:border-indigo-500 placeholder-slate-800 transition-all text-lg italic font-medium resize-none shadow-inner"
            />
          </div>
          
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-8 quanta-btn-primary text-white rounded-[2.5rem] text-sm font-black uppercase tracking-[0.5em] transition-all shadow-2xl flex items-center justify-center space-x-4 disabled:opacity-30 active:scale-95"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                <span>Synthesizing...</span>
              </>
            ) : (
              <>
                <span>Commence Forge</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center space-x-3 px-4">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></div>
          <span>Archived Generations</span>
        </h2>
        
        {history.length === 0 ? (
          <div className="py-32 border-2 border-dashed border-slate-800 rounded-[3rem] flex flex-col items-center justify-center text-slate-600 bg-slate-900/20">
            <svg className="w-16 h-16 mb-6 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
            </svg>
            <p className="text-[10px] font-black uppercase tracking-widest">Gallery empty. Forge your first asset above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {history.map((img) => (
              <div key={img.id} className="group relative bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-800 transition-all hover:border-indigo-500/30 hover:-translate-y-2 duration-500 shadow-xl">
                <img src={img.url} alt={img.prompt} className="w-full aspect-square object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="p-8 bg-[#020617]/95 backdrop-blur-xl absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 duration-500 border-t border-indigo-500/20">
                  <p className="text-[11px] text-slate-300 font-medium italic mb-6 leading-relaxed line-clamp-2">"{img.prompt}"</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{new Date(img.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <a href={img.url} download={`quanta_forge_${img.id}.png`} className="text-indigo-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors flex items-center space-x-2">
                       <span>Download</span>
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
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

export default ImageGenerator;
