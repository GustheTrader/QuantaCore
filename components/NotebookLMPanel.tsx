import React, { useState, useEffect } from 'react';
import { getNotebookLMBridge, NotebookLMNotebook, NotebookLMChatResponse } from '../services/notebookLMMCPBridge';
import { ActionHub } from './ActionHub';

interface NotebookLMPanelProps {
  agentName: string;
}

type ViewMode = 'notebooks' | 'chat' | 'generate';

export const NotebookLMPanel: React.FC<NotebookLMPanelProps> = ({ agentName }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('notebooks');
  const [notebooks, setNotebooks] = useState<NotebookLMNotebook[]>([]);
  const [currentNotebook, setCurrentNotebook] = useState<NotebookLMNotebook | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatResponse, setChatResponse] = useState<NotebookLMChatResponse | null>(null);

  // Generate state
  const [generateFormat, setGenerateFormat] = useState<'summary' | 'briefing' | 'study-guide' | 'faq'>('briefing');
  const [generatedContent, setGeneratedContent] = useState<any | null>(null);

  // New notebook state
  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [showNewNotebook, setShowNewNotebook] = useState(false);

  const bridge = getNotebookLMBridge();
  const isConnected = !!bridge;

  useEffect(() => {
    if (isConnected) {
      loadNotebooks();
    }
  }, [isConnected]);

  const loadNotebooks = async () => {
    if (!bridge) return;
    setLoading(true);
    try {
      const nbs = await bridge.listNotebooks();
      setNotebooks(nbs);
      if (nbs.length > 0 && !currentNotebook) {
        setCurrentNotebook(nbs[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNotebook = async () => {
    if (!bridge || !newNotebookTitle.trim()) return;
    setLoading(true);
    try {
      const notebook = await bridge.createNotebook(newNotebookTitle);
      setNotebooks([notebook, ...notebooks]);
      setCurrentNotebook(notebook);
      setNewNotebookTitle('');
      setShowNewNotebook(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    if (!bridge || !chatQuestion.trim()) return;
    setLoading(true);
    setChatResponse(null);
    try {
      const response = await bridge.chatWithNotebook(chatQuestion, currentNotebook?.id);
      setChatResponse(response);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!bridge) return;
    setLoading(true);
    setGeneratedContent(null);
    try {
      const content = await bridge.generateBriefing(generateFormat, currentNotebook?.id);
      setGeneratedContent(content);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="glass-card p-12 rounded-[3.5rem] text-center">
        <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-2xl font-black text-white uppercase mb-2">NotebookLM Offline</h3>
        <p className="text-slate-400 text-sm">Enable NotebookLM connector in MCP Connectors</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-1000">
      <div className="mb-8">
        <div className="inline-block px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 text-[9px] font-black uppercase tracking-[0.4em] mb-3">
          NotebookLM Neural Bridge (TEST MODE)
        </div>
        <h2 className="text-4xl md:text-5xl font-outfit font-black text-white uppercase tracking-tighter italic">
          <span className="quantum-gradient-text">Research Synthesis</span>
        </h2>
        {currentNotebook && (
          <p className="text-slate-400 text-sm mt-2 font-bold uppercase">
            {currentNotebook.title} • {currentNotebook.sourceCount} Sources
          </p>
        )}
      </div>

      {error && (
        <div className="mb-6 p-6 bg-red-500/10 border border-red-500/30 rounded-3xl">
          <p className="text-red-400 font-bold text-sm">{error}</p>
          <button onClick={() => setError(null)} className="mt-2 text-xs text-slate-500">Dismiss</button>
        </div>
      )}

      <div className="mb-8 bg-slate-900/50 p-2 rounded-[2.5rem] border border-slate-800 flex">
        {(['notebooks', 'chat', 'generate'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            disabled={mode !== 'notebooks' && !currentNotebook}
            className={`flex-1 px-6 py-3 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${
              viewMode === mode
                ? 'bg-purple-600 text-white'
                : mode !== 'notebooks' && !currentNotebook
                ? 'text-slate-700 cursor-not-allowed'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="glass-card p-12 rounded-[3.5rem]">
        {viewMode === 'notebooks' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-white uppercase">Notebooks</h3>
              <button
                onClick={() => setShowNewNotebook(!showNewNotebook)}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-[10px] font-black uppercase"
              >
                + New
              </button>
            </div>

            {showNewNotebook && (
              <div className="mb-8 p-8 bg-slate-900/50 border border-slate-800 rounded-3xl">
                <input
                  type="text"
                  value={newNotebookTitle}
                  onChange={(e) => setNewNotebookTitle(e.target.value)}
                  placeholder="Notebook title..."
                  className="w-full px-6 py-4 bg-slate-900 border border-slate-800 rounded-2xl text-white placeholder-slate-600 text-sm font-bold focus:outline-none focus:border-purple-500 mb-4"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateNotebook()}
                />
                <div className="flex space-x-3">
                  <button
                    onClick={handleCreateNotebook}
                    disabled={!newNotebookTitle.trim() || loading}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-[10px] font-black uppercase disabled:opacity-50"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setShowNewNotebook(false); setNewNotebookTitle(''); }}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl text-[10px] font-black uppercase"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {notebooks.map((notebook) => (
                <button
                  key={notebook.id}
                  onClick={() => { setCurrentNotebook(notebook); setViewMode('chat'); }}
                  className="w-full p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/50 rounded-3xl text-left transition-all"
                >
                  <h4 className="text-white font-black text-lg mb-2">{notebook.title}</h4>
                  <div className="flex items-center space-x-4 text-[10px] uppercase tracking-wider font-bold">
                    <span className="text-slate-500">{notebook.sourceCount} sources</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-500">{notebook.lastModified.split('T')[0]}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'chat' && currentNotebook && (
          <div>
            <h3 className="text-2xl font-black text-white uppercase mb-6">Ask Questions</h3>
            <textarea
              value={chatQuestion}
              onChange={(e) => setChatQuestion(e.target.value)}
              placeholder="Ask a question about your sources..."
              rows={4}
              className="w-full px-6 py-4 bg-slate-900 border border-slate-800 rounded-3xl text-white placeholder-slate-600 text-sm font-medium focus:outline-none focus:border-purple-500 mb-4 resize-none"
            />
            <button
              onClick={handleChat}
              disabled={!chatQuestion.trim() || loading}
              className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-[10px] font-black uppercase disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Ask NotebookLM'}
            </button>

            {chatResponse && (
              <div className="mt-8 p-8 bg-slate-900/50 border border-purple-500/30 rounded-3xl group">
                <div className="mb-4">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-purple-400">Answer</span>
                </div>
                <div className="text-slate-200 text-sm leading-relaxed mb-6 whitespace-pre-wrap">
                  {chatResponse.answer}
                </div>
                {chatResponse.citations && chatResponse.citations.length > 0 && (
                  <div className="pt-6 border-t border-slate-800">
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4">
                      Citations ({chatResponse.citations.length})
                    </div>
                    <div className="space-y-3">
                      {chatResponse.citations.map((citation, idx) => (
                        <div key={idx} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                          <div className="text-[10px] font-black text-purple-400 uppercase mb-2">
                            {citation.sourceTitle}
                          </div>
                          <div className="text-slate-400 text-xs italic">"{citation.excerpt}"</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <ActionHub content={chatResponse.answer} agentName={agentName} title="NotebookLM Analysis" />
              </div>
            )}
          </div>
        )}

        {viewMode === 'generate' && currentNotebook && (
          <div>
            <h3 className="text-2xl font-black text-white uppercase mb-6">Generate Content</h3>
            <div className="mb-6">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Format</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['summary', 'briefing', 'study-guide', 'faq'] as const).map((format) => (
                  <button
                    key={format}
                    onClick={() => setGenerateFormat(format)}
                    className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase ${
                      generateFormat === format
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-white'
                    }`}
                  >
                    {format}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-sm font-black uppercase disabled:opacity-50"
            >
              {loading ? 'Generating...' : `Generate ${generateFormat}`}
            </button>

            {generatedContent && (
              <div className="mt-8 p-8 bg-slate-900/50 border border-purple-500/30 rounded-3xl group">
                <div className="mb-4">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-purple-400">
                    Generated {generateFormat}
                  </span>
                </div>
                <div className="text-slate-200 text-sm leading-relaxed mb-6 whitespace-pre-wrap">
                  {generatedContent.content}
                </div>
                <ActionHub content={generatedContent.content} agentName={agentName} title={`NotebookLM ${generateFormat}`} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
