
import React from 'react';

interface OutputPanelProps {
  output: string;
  onSave: () => void;
  onPrint: () => void;
  onDownload: () => void;
}

const OutputPanel: React.FC<OutputPanelProps> = ({ output, onSave, onPrint, onDownload }) => {
  return (
    <div className="w-full h-full flex flex-col bg-slate-950 border-l border-slate-800">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Output Stream</h3>
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
