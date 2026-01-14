import React, { useState, useEffect } from 'react';
import {
  NotebookLMNotebook,
  NotebookLMSource,
  NotebookLMChatResponse,
  NotebookLMBriefing,
  NotebookLMPodcast,
  SourceNode
} from '../types';
import { getNotebookLMBridge } from '../services/notebookLMMCPBridge';
import { ActionHub } from './ActionHub';

interface NotebookLMPanelProps {
  sources?: SourceNode[];
  initialQuery?: string;
  agentName: string;
  onClose?: () => void;
}

type ViewMode = 'notebooks' | 'chat' | 'generate' | 'sources';
type GenerateFormat = 'summary' | 'briefing' | 'study-guide' | 'faq' | 'table' | 'flashcards' | 'quiz' | 'podcast';

export const NotebookLMPanel: React.FC<NotebookLMPanelProps> = ({
  sources,
  initialQuery,
  agentName,
  onClose
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('notebooks');
  const [notebooks, setNotebooks] = useState<NotebookLMNotebook[]>([]);
  const [currentNotebook, setCurrentNotebook] = useState<NotebookLMNotebook | null>(null);
  const [notebookSources, setNotebookSources] = useState<NotebookLMSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [chatQuestion, setChatQuestion] = useState(initialQuery || '');
  const [chatResponse, setChatResponse] = useState<NotebookLMChatResponse | null>(null);
  const [includeAllNotebooks, setIncludeAllNotebooks] = useState(false);

  // Generate state
  const [generateFormat, setGenerateFormat] = useState<GenerateFormat>('briefing');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState<NotebookLMBriefing | NotebookLMPodcast | null>(null);

  // New notebook state
  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [showNewNotebook, setShowNewNotebook] = useState(false);

  const bridge = getNotebookLMBridge();
  const isConnected = bridge?.isConnected() || false;

  // Load notebooks on mount
  useEffect(() => {
    if (isConnected) {
      loadNotebooks();
    }
  }, [isConnected]);

  // Auto-create notebook from sources if provided
  useEffect(() => {
    if (sources && sources.length > 0 && isConnected && !currentNotebook) {
      handleAutoCreateNotebook();
    }
  }, [sources, isConnected]);

  const loadNotebooks = async () => {
    if (!bridge) return;

    setLoading(true);
    setError(null);

    try {
      const notebooks = await bridge.listNotebooks();
      setNotebooks(notebooks);

      // Set current notebook if one exists
      const current = bridge.getCurrentNotebook();
      if (current) {
        setCurrentNotebook(current);
        await loadNotebookSources(current.id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadNotebookSources = async (notebookId: string) => {
    if (!bridge) return;

    try {
      const sources = await bridge.listSources(notebookId);
      setNotebookSources(sources);
    } catch (err: any) {
      console.error('Failed to load sources:', err);
    }
  };

  const handleAutoCreateNotebook = async () => {
    if (!bridge || !sources) return;

    setLoading(true);
    setError(null);

    try {
      const title = `${agentName} Analysis - ${new Date().toLocaleDateString()}`;
      const notebook = await bridge.createNotebook(title);

      // Add sources
      await bridge.addSourcesFromLTM(sources, notebook.id);

      setCurrentNotebook(notebook);
      await loadNotebooks();
      setViewMode('chat');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNotebook = async () => {
    if (!bridge || !newNotebookTitle.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const notebook = await bridge.createNotebook(newNotebookTitle);
      setCurrentNotebook(notebook);
      setNewNotebookTitle('');
      setShowNewNotebook(false);
      await loadNotebooks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectNotebook = async (notebook: NotebookLMNotebook) => {
    if (!bridge) return;

    setLoading(true);
    setError(null);

    try {
      await bridge.navigateToNotebook(notebook.id);
      setCurrentNotebook(notebook);
      await loadNotebookSources(notebook.id);
      setViewMode('chat');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    if (!bridge || !chatQuestion.trim() || !currentNotebook) return;

    setLoading(true);
    setError(null);
    setChatResponse(null);

    try {
      const response = await bridge.chatWithNotebook(chatQuestion, {
        notebookId: currentNotebook.id,
        includeAllNotebooks
      });

      setChatResponse(response);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!bridge || !currentNotebook) return;

    setLoading(true);
    setError(null);
    setGeneratedContent(null);

    try {
      if (generateFormat === 'podcast') {
        const podcast = await bridge.generatePodcast({
          notebookId: currentNotebook.id,
          tone: 'professional'
        });
        setGeneratedContent(podcast);
      } else if (generateFormat === 'flashcards') {
        const flashcards = await bridge.generateFlashcards(20, {
          notebookId: currentNotebook.id,
          difficulty: 'intermediate'
        });
        setGeneratedContent({
          success: true,
          notebookId: currentNotebook.id,
          format: 'study-guide',
          content: flashcards.answer,
          length: flashcards.answer.length,
          generatedAt: Date.now()
        });
      } else if (generateFormat === 'quiz') {
        const quiz = await bridge.generateQuiz(10, {
          notebookId: currentNotebook.id,
          questionType: 'mixed'
        });
        setGeneratedContent({
          success: true,
          notebookId: currentNotebook.id,
          format: 'study-guide',
          content: quiz.answer,
          length: quiz.answer.length,
          generatedAt: Date.now()
        });
      } else {
        const briefing = await bridge.generateBriefing(generateFormat, {
          notebookId: currentNotebook.id,
          customPrompt: customPrompt || undefined
        });
        setGeneratedContent(briefing);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="glass-card p-12 rounded-[3.5rem] text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">NotebookLM Offline</h3>
          <p className="text-slate-400 text-sm">NotebookLM MCP connector is not active. Enable it in MCP Connectors.</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-sm font-bold uppercase tracking-wider transition-all">
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-1000">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="inline-block px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 text-[9px] font-black uppercase tracking-[0.4em] mb-3">
            NotebookLM Neural Bridge
          </div>
          <h2 className="text-4xl md:text-5xl font-outfit font-black text-white uppercase tracking-tighter italic">
            <span className="quantum-gradient-text">Research Synthesis</span>
          </h2>
          {currentNotebook && (
            <p className="text-slate-400 text-sm mt-2 font-bold uppercase tracking-wider">
              {currentNotebook.title} • {currentNotebook.sourceCount} Sources
            </p>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl transition-all">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-6 bg-red-500/10 border border-red-500/30 rounded-3xl">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-red-400 font-bold text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-8 bg-slate-900/50 p-2 rounded-[2.5rem] border border-slate-800 flex shadow-inner">
        {(['notebooks', 'chat', 'generate', 'sources'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            disabled={mode !== 'notebooks' && !currentNotebook}
            className={`flex-1 px-6 py-3 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${
              viewMode === mode
                ? 'bg-purple-600 text-white shadow-2xl'
                : mode !== 'notebooks' && !currentNotebook
                ? 'text-slate-700 cursor-not-allowed'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="glass-card p-12 rounded-[3.5rem]">
        {/* Notebooks View */}
        {viewMode === 'notebooks' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Your Notebooks</h3>
              <button
                onClick={() => setShowNewNotebook(!showNewNotebook)}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all"
              >
                + New Notebook
              </button>
            </div>

            {showNewNotebook && (
              <div className="mb-8 p-8 bg-slate-900/50 border border-slate-800 rounded-3xl">
                <input
                  type="text"
                  value={newNotebookTitle}
                  onChange={(e) => setNewNotebookTitle(e.target.value)}
                  placeholder="Notebook title..."
                  className="w-full px-6 py-4 bg-slate-900 border border-slate-800 rounded-2xl text-white placeholder-slate-600 text-sm font-bold focus:outline-none focus:border-purple-500 transition-all mb-4"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateNotebook()}
                />
                <div className="flex space-x-3">
                  <button
                    onClick={handleCreateNotebook}
                    disabled={!newNotebookTitle.trim() || loading}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowNewNotebook(false);
                      setNewNotebookTitle('');
                    }}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {notebooks.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-sm">No notebooks yet</p>
                </div>
              ) : (
                notebooks.map((notebook) => (
                  <button
                    key={notebook.id}
                    onClick={() => handleSelectNotebook(notebook)}
                    className="w-full p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/50 rounded-3xl text-left transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-white font-black text-lg mb-2 group-hover:text-purple-400 transition-colors">
                          {notebook.title}
                        </h4>
                        <div className="flex items-center space-x-4 text-[10px] uppercase tracking-wider font-bold">
                          <span className="text-slate-500">
                            {notebook.sourceCount} sources
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-500">
                            {notebook.lastModified}
                          </span>
                        </div>
                      </div>
                      <svg className="w-6 h-6 text-slate-600 group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Chat View */}
        {viewMode === 'chat' && currentNotebook && (
          <div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-6">Ask Questions</h3>

            <div className="space-y-6">
              <div>
                <textarea
                  value={chatQuestion}
                  onChange={(e) => setChatQuestion(e.target.value)}
                  placeholder="Ask a question about your sources..."
                  rows={4}
                  className="w-full px-6 py-4 bg-slate-900 border border-slate-800 rounded-3xl text-white placeholder-slate-600 text-sm font-medium focus:outline-none focus:border-purple-500 transition-all resize-none"
                />

                <div className="flex items-center justify-between mt-4">
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={includeAllNotebooks}
                      onChange={(e) => setIncludeAllNotebooks(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                    />
                    <span className="text-slate-400 group-hover:text-slate-300 text-sm font-bold uppercase tracking-wider transition-colors">
                      Include all notebooks
                    </span>
                  </label>

                  <button
                    onClick={handleChat}
                    disabled={!chatQuestion.trim() || loading}
                    className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Analyzing...' : 'Ask NotebookLM'}
                  </button>
                </div>
              </div>

              {/* Chat Response */}
              {chatResponse && (
                <div className="mt-8 p-8 bg-slate-900/50 border border-purple-500/30 rounded-3xl group">
                  <div className="mb-4">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-purple-400">Answer with Citations</span>
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
                            <div className="text-[10px] font-black text-purple-400 uppercase tracking-wider mb-2">
                              {citation.sourceTitle}
                            </div>
                            <div className="text-slate-400 text-xs italic">
                              "{citation.excerpt}"
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <ActionHub content={chatResponse.answer} agentName={agentName} title="NotebookLM Analysis" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generate View */}
        {viewMode === 'generate' && currentNotebook && (
          <div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-6">Generate Content</h3>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">
                  Format
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(['summary', 'briefing', 'study-guide', 'faq', 'table', 'flashcards', 'quiz', 'podcast'] as GenerateFormat[]).map((format) => (
                    <button
                      key={format}
                      onClick={() => setGenerateFormat(format)}
                      className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all ${
                        generateFormat === format
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                          : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-white hover:border-purple-500/50'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>

              {!['flashcards', 'quiz', 'podcast'].includes(generateFormat) && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">
                    Custom Prompt (Optional)
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Add specific instructions for generation..."
                    rows={3}
                    className="w-full px-6 py-4 bg-slate-900 border border-slate-800 rounded-3xl text-white placeholder-slate-600 text-sm font-medium focus:outline-none focus:border-purple-500 transition-all resize-none"
                  />
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Generating...' : `Generate ${generateFormat}`}
              </button>

              {/* Generated Content */}
              {generatedContent && 'content' in generatedContent && (
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

              {/* Podcast Content */}
              {generatedContent && 'audioUrl' in generatedContent && (
                <div className="mt-8 p-8 bg-slate-900/50 border border-purple-500/30 rounded-3xl">
                  <div className="mb-6">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-purple-400">
                      Generated Podcast
                    </span>
                  </div>

                  <audio controls className="w-full mb-4">
                    <source src={generatedContent.audioUrl} type="audio/mpeg" />
                    Your browser does not support audio playback.
                  </audio>

                  <a
                    href={generatedContent.audioUrl}
                    download
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download Audio</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sources View */}
        {viewMode === 'sources' && currentNotebook && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Sources</h3>
              <button className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all">
                + Add Source
              </button>
            </div>

            <div className="space-y-4">
              {notebookSources.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-sm">No sources yet</p>
                </div>
              ) : (
                notebookSources.map((source) => (
                  <div
                    key={source.id}
                    className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="inline-block px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[8px] font-black uppercase tracking-wider mb-3">
                          {source.type}
                        </div>
                        <h4 className="text-white font-black text-base mb-2">
                          {source.title}
                        </h4>
                        {source.url && (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 text-xs font-medium underline"
                          >
                            {source.url}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
