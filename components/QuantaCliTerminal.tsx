"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, Maximize2, Minimize2, SquareTerminal, X } from 'lucide-react';

interface Props { standalone?: boolean; onClose?: () => void }
interface Line { id: number; kind: 'command' | 'output' | 'error'; text: string }

export default function QuantaCliTerminal({ standalone = false, onClose }: Props) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ id: 1, kind: 'output', text: 'QUANTA CLI · Local control console\nType help for commands. No system shell commands run here.' }]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [expanded, setExpanded] = useState(false);
  const nextId = useRef(2);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [standalone]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [lines.length, busy]);

  const append = (kind: Line['kind'], text: string) => setLines(previous => [...previous, { id: nextId.current++, kind, text }].slice(-160));
  const run = async (value = input) => {
    const command = value.trim();
    if (!command || busy) return;
    setInput(''); setHistoryIndex(-1); setHistory(previous => [command, ...previous.filter(item => item !== command)].slice(0, 40));
    if (command === 'clear') { setLines([]); return; }
    append('command', `quanta> ${command}`);
    setBusy(true);
    try {
      const response = await fetch('/api/cli/run', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui' }, body: JSON.stringify({ command }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Command returned HTTP ${response.status}.`);
      append('output', data.lines.join('\n') || 'Done.');
    } catch (error: any) { append('error', error.message || 'The local CLI server is unavailable.'); }
    finally { setBusy(false); inputRef.current?.focus(); }
  };
  const popOut = () => {
    const target = new URL(window.location.href); target.hash = '/terminal';
    const popup = window.open(target.toString(), 'quanta-cli', 'popup=yes,width=960,height=700,resizable=yes,scrollbars=yes');
    if (popup) { popup.focus(); onClose?.(); }
    else window.location.hash = '/terminal';
  };
  const close = () => {
    if (standalone) { window.close(); if (!window.closed) window.location.hash = '/'; }
    else onClose?.();
  };

  return <section aria-label="Quanta CLI terminal" className={standalone ? 'fixed inset-0 z-[100] flex flex-col bg-[#030b19] text-slate-100' : `fixed z-[100] flex flex-col overflow-hidden rounded-2xl border border-orange-400/35 bg-[#030b19] text-slate-100 shadow-[0_25px_90px_rgba(0,0,0,0.72)] ${expanded ? 'inset-4' : 'bottom-4 right-4 h-[min(70vh,620px)] w-[min(calc(100vw-2rem),760px)]'}`}>
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#08162a] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-400/35 bg-orange-400/10 text-orange-300"><SquareTerminal size={18} /></span><div className="min-w-0"><h1 className="truncate text-sm font-bold text-white">Quanta CLI</h1><p className="text-[10px] text-slate-400">Local control · coding harness guide</p></div></div>
      <div className="flex items-center gap-1">
        {!standalone && <><button type="button" onClick={() => setExpanded(value => !value)} aria-label={expanded ? 'Restore terminal size' : 'Expand terminal'} title={expanded ? 'Restore size' : 'Expand'} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button><button type="button" onClick={popOut} aria-label="Pop out Quanta CLI" title="Pop out to a separate window" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"><ExternalLink size={16} /></button></>}
        {standalone && <Link to="/" className="rounded-lg px-3 py-2 text-xs text-blue-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Mission Control</Link>}
        <button type="button" onClick={close} aria-label="Close Quanta CLI" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"><X size={17} /></button>
      </div>
    </header>
    <div role="log" aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5 font-mono text-xs leading-6 sm:text-sm">
      {lines.map(line => <pre key={line.id} className={`whitespace-pre-wrap break-words font-inherit ${line.kind === 'command' ? 'text-orange-300' : line.kind === 'error' ? 'text-rose-300' : 'text-slate-300'}`}>{line.text}</pre>)}
      {busy && <p className="text-blue-300">Running…</p>}<div ref={bottom} />
    </div>
    <div className="shrink-0 border-t border-white/10 bg-[#071429] px-4 py-3">
      <form onSubmit={event => { event.preventDefault(); run(); }} className="flex items-center gap-2 rounded-xl border border-blue-400/20 bg-[#030b19] px-3 py-2.5 focus-within:border-cyan-400/50">
        <span aria-hidden="true" className="font-mono text-xs text-orange-400">quanta&gt;</span>
        <label htmlFor="quanta-cli-command" className="sr-only">Quanta CLI command</label>
        <input id="quanta-cli-command" ref={inputRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'ArrowUp') { event.preventDefault(); const next = Math.min(historyIndex + 1, history.length - 1); setHistoryIndex(next); setInput(history[next] || ''); } if (event.key === 'ArrowDown') { event.preventDefault(); const next = historyIndex - 1; setHistoryIndex(next); setInput(next < 0 ? '' : history[next]); } }} disabled={busy} autoComplete="off" spellCheck={false} placeholder="help, status, providers, harness codex…" className="min-w-0 flex-1 bg-transparent font-mono text-xs text-white outline-none placeholder:text-slate-600 sm:text-sm" />
        <button type="submit" disabled={!input.trim() || busy} aria-label="Run Quanta CLI command" className="rounded-lg p-1.5 text-cyan-300 hover:bg-cyan-400/10 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"><ArrowRight size={17} /></button>
      </form>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500"><span>Scoped commands only · <code>ask</code> sends text to the provider you name.</span><button type="button" onClick={() => run('help')} disabled={busy} className="text-blue-300 hover:text-white">Show commands</button></div>
    </div>
  </section>;
}
