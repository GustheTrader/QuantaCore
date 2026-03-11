
import React from 'react';
import { IngestedFile } from '../hooks/useFileIngestion';

interface FileIngestionZoneProps {
  isDragging: boolean;
  ingestedFiles: IngestedFile[];
  onRemoveFile: (index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  children: React.ReactNode;
}

export const FileIngestionZone: React.FC<FileIngestionZoneProps> = ({
  isDragging,
  ingestedFiles,
  onRemoveFile,
  onDragOver,
  onDragLeave,
  onDrop,
  children
}) => {
  return (
    <div 
      className="relative min-h-screen"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-emerald-500/20 backdrop-blur-sm border-4 border-dashed border-emerald-500 flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-slate-950 p-12 rounded-[3rem] border border-emerald-500/30 shadow-2xl text-center">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-emerald-400">
              <svg className="w-10 h-10 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-2xl font-outfit font-black text-white uppercase tracking-tighter italic">Drop to Ingest</h3>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-2">Neural Link Ready for Data Stream</p>
          </div>
        </div>
      )}

      {/* Ingested Files Preview (Floating) */}
      {ingestedFiles.length > 0 && (
        <div className="fixed bottom-8 right-8 z-[90] flex flex-col gap-3 max-w-xs w-full animate-in slide-in-from-right-8">
          <div className="bg-slate-950/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Ingested Context</h4>
              <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-full">{ingestedFiles.length}</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
              {ingestedFiles.map((file, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-800 rounded-xl group hover:border-emerald-500/30 transition-all">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      {file.type === 'image' ? (
                        <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      ) : (
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-300 truncate">{file.name}</span>
                  </div>
                  <button 
                    onClick={() => onRemoveFile(i)}
                    className="text-slate-600 hover:text-rose-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {children}
    </div>
  );
};
