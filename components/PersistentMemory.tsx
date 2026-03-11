
import React, { useState, useEffect } from 'react';
import { memoryService, MemoryNode } from '../services/memoryService';

const PersistentMemory: React.FC = () => {
  const [memories, setMemories] = useState<MemoryNode[]>([]);

  useEffect(() => {
    setMemories(memoryService.getMemory());
  }, []);

  const handleMaintenance = () => {
    memoryService.performCognitiveMaintenance();
    setMemories(memoryService.getMemory());
  };

  return (
    <div className="p-10 animate-in fade-in duration-1000">
      <header className="mb-16">
        <h1 className="text-6xl font-outfit font-black text-white uppercase tracking-tighter italic mb-4">Cognitive <span className="quantum-gradient-text">Database</span></h1>
        <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-xs">Active memory layer for persistent reasoning.</p>
      </header>
      
      <div className="flex justify-end mb-8">
        <button onClick={handleMaintenance} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px]">Perform Cognitive Maintenance</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {memories.map(memory => (
          <div key={memory.id} className="glass-card p-8 rounded-[2.5rem] border border-slate-800 bg-slate-950/50 flex flex-col">
            <p className="text-slate-300 text-sm mb-4 font-mono">{memory.content}</p>
            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-auto">Confidence: {memory.confidence.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PersistentMemory;
