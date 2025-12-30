
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
    exportToBrowser(`QuantaAI_${agentName}_${Date.now()}`, content);
  };

  return (
    <div className="mt-6 pt-4 border-t border-slate-800/50 flex items-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
      <button 
        onClick={handleCopy}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${copied ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white hover:border-slate-700'}`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        <span>{copied ? 'Copied' : 'Copy Pure'}</span>
      </button>

      <button 
        onClick={handleArchive}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${archived ? 'bg-orange-500/10 border-orange-500 text-orange-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white hover:border-slate-700'}`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5" /></svg>
        <span>{archived ? 'Synced' : 'Memory Sync'}</span>
      </button>

      <button 
        onClick={handleExport}
        className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-500 hover:text-white hover:border-slate-700 text-[9px] font-black uppercase tracking-widest transition-all"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        <span>Export TXT</span>
      </button>
    </div>
  );
};
