import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isDestructive = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-950 border-2 border-slate-800 rounded-[3rem] p-10 max-w-md w-full shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-full h-1 ${isDestructive ? 'bg-rose-600' : 'bg-emerald-600'}`}></div>
        
        <h3 className="text-2xl font-outfit font-black text-white uppercase tracking-tighter italic mb-4">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed mb-10">{message}</p>
        
        <div className="flex flex-col gap-4">
          <button 
            onClick={onConfirm}
            className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${
              isDestructive 
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_30px_rgba(225,29,72,0.3)]' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.3)]'
            }`}
          >
            {confirmLabel}
          </button>
          <button 
            onClick={onCancel}
            className="w-full py-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-white hover:border-slate-700 font-black uppercase tracking-widest text-xs transition-all"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
