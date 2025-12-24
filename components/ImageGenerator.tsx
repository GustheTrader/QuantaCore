
import React, { useState } from 'react';
import { generateImage } from '../services/geminiService';
import { GeneratedImage } from '../types';

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GeneratedImage[]>([]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const url = await generateImage(prompt);
      const newImage: GeneratedImage = {
        id: Math.random().toString(36).substr(2, 9),
        url,
        prompt,
        timestamp: Date.now()
      };
      setHistory([newImage, ...history]);
      setPrompt('');
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
          <h1 className="text-3xl font-outfit font-bold">Image Studio</h1>
          <p className="text-gray-400 mt-2">Create high-quality visual assets using Gemini 2.5 Flash Image.</p>
        </div>
        <div className="bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-xl text-indigo-400 text-sm font-medium">
          Available Credits: 850
        </div>
      </header>

      <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl shadow-xl">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-300 ml-1">Visual Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A futuristic glass city at sunset with neon reflections and holographic advertisements..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-2xl p-5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-gray-500 transition-all text-lg resize-none shadow-inner"
            />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['1:1', '4:3', '16:9', '9:16'].map(ratio => (
              <button key={ratio} className={`py-2 px-4 rounded-xl border text-sm font-medium transition-all ${ratio === '1:1' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                {ratio} Ratio
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-2xl text-xl font-bold transition-all shadow-xl flex items-center justify-center space-x-3"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Synthesizing Vision...</span>
              </>
            ) : (
              <span>Generate Art Piece</span>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold flex items-center space-x-2">
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Generation Gallery</span>
        </h2>
        
        {history.length === 0 ? (
          <div className="h-64 border-2 border-dashed border-gray-800 rounded-3xl flex flex-col items-center justify-center text-gray-500 bg-gray-900/50">
            <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>Your generated masterpieces will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {history.map((img) => (
              <div key={img.id} className="group relative bg-gray-900 rounded-3xl overflow-hidden border border-gray-800 transition-all hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1">
                <img src={img.url} alt={img.prompt} className="w-full aspect-square object-cover" />
                <div className="p-4 bg-gray-900/90 backdrop-blur-md absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                  <p className="text-xs text-gray-200 line-clamp-2 italic mb-2">"{img.prompt}"</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-500">{new Date(img.timestamp).toLocaleTimeString()}</span>
                    <button className="text-indigo-400 hover:text-indigo-300 text-xs font-bold uppercase tracking-widest">Download</button>
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
