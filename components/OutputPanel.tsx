
import React from 'react';

interface OutputPanelProps {
  output: string;
  onSave: () => void;
  onPrint: () => void;
  onDownload: () => void;
  onCollapse?: () => void;
}

const OutputPanel: React.FC<OutputPanelProps> = ({ output, onSave, onPrint, onDownload, onCollapse }) => {
  return (
    <div className="w-full h-full flex flex-col bg-slate-950 border-l border-slate-800">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {onCollapse && (
            <button 
              onClick={onCollapse}
              className="p-1 hover:bg-slate-900 rounded text-slate-500 hover:text-indigo-400 transition-colors mr-1"
              title="Hide Stream"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Output Stream</h3>
        </div>
        <div className="flex space-x-2">
          <button onClick={onSave} className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300">Save</button>
          <button onClick={onPrint} className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300">Print</button>
          <button onClick={onDownload} className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300">Download</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 font-mono text-xs text-slate-300 custom-scrollbar">
        <pre className="whitespace-pre-wrap">{output}</pre>
      </div>
    </div>
  );
};

export default OutputPanel;
