
import React, { useState } from 'react';
import { stripMarkdown, archiveToSovereignMemory, exportToBrowser } from '../services/utils';

interface ActionHubProps {
  content: string;
  agentName: string;
  title?: string;
}

export const ActionHub: React.FC<ActionHubProps> = ({ content, agentName, title }) => {
  const [copied, setCopied] = useState(false);
  const [archived, setArchived] = useState(false);

  const handleCopy = () => {
    const plainText = stripMarkdown(content);
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleArchive = async () => {
    if (archived) return;
    await archiveToSovereignMemory(title || agentName, content, agentName);
    setArchived(true);
    setTimeout(() => setArchived(false), 3000);
  };

  const handleExport = () => {
    exportToBrowser(`QuantaAI_DataControl_${agentName.replace(/\s+/g, '_')}_${Date.now()}`, content, 'md');
  };

  return (
    <div className="mt-8 pt-6 border-t border-slate-800/50 flex flex-wrap items-center gap-4 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
      <div className="flex flex-col mr-4">
        <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] mb-1">Data Controller</span>
        <div className="h-0.5 w-12 bg-orange-500/30 rounded-full"></div>
      </div>

      <button 
        onClick={handleCopy}
        className={`flex items-center space-x-3 px-5 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${copied ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white hover:border-emerald-500/50'}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        <span>{copied ? 'Axioms Copied' : 'Copy Plaintext'}</span>
      </button>

      <button 
        onClick={handleArchive}
        className={`flex items-center space-x-3 px-5 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${archived ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white hover:border-orange-500/50'}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5" /></svg>
        <span>{archived ? 'Memory Committed' : 'Commit to LTM'}</span>
      </button>

      <button 
        onClick={handleExport}
        className="flex items-center space-x-3 px-5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-500 hover:text-white hover:border-indigo-500/50 text-[10px] font-black uppercase tracking-widest transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        <span>Export MD</span>
      </button>
    </div>
  );
};
