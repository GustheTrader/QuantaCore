/**
 * NotebookLM MCP Bridge Service
 *
 * Communicates with the NotebookLM MCP server to execute tools and manage sessions.
 * This is the QuantaCore-side client that talks to the MCP server.
 */

import {
  NotebookLMNotebook,
  NotebookLMSource,
  NotebookLMChatResponse,
  NotebookLMBriefing,
  NotebookLMPodcast,
  NotebookLMToolResult,
  NotebookLMSession,
  SourceNode,
  MCPConnector
} from '../types';

// ==================== CONFIGURATION ====================

interface NotebookLMMCPConfig {
  connectorId: string;
  serverCommand?: string;
  defaultNotebookId?: string;
  autoSync?: boolean;
}

// ==================== MCP BRIDGE ====================

export class NotebookLMMCPBridge {
  private config: NotebookLMMCPConfig;
  private connector: MCPConnector | null = null;
  private session: NotebookLMSession | null = null;

  constructor(config: NotebookLMMCPConfig) {
    this.config = config;
    this.loadConnector();
    this.loadSession();
  }

  /**
   * Load connector configuration from localStorage
   */
  private loadConnector(): void {
    const connectorsJson = localStorage.getItem('quanta_mcp_connectors');
    if (!connectorsJson) return;

    try {
      const connectors: MCPConnector[] = JSON.parse(connectorsJson);
      const connector = connectors.find(c => c.id === this.config.connectorId);

      if (connector && connector.status === 'active') {
        this.connector = connector;
        console.log('✅ NotebookLM connector loaded:', connector.name);
      } else {
        console.warn('⚠️  NotebookLM connector not found or inactive');
      }
    } catch (error) {
      console.error('❌ Failed to load NotebookLM connector:', error);
    }
  }

  /**
   * Load session from localStorage
   */
  private loadSession(): void {
    const sessionJson = localStorage.getItem('quanta_notebooklm_session');
    if (!sessionJson) return;

    try {
      this.session = JSON.parse(sessionJson);
    } catch (error) {
      console.error('❌ Failed to load NotebookLM session:', error);
    }
  }

  /**
   * Save session to localStorage
   */
  private saveSession(): void {
    if (!this.session) return;

    try {
      localStorage.setItem('quanta_notebooklm_session', JSON.stringify(this.session));
    } catch (error) {
      console.error('❌ Failed to save NotebookLM session:', error);
    }
  }

  /**
   * Check if NotebookLM is connected and available
   */
  isConnected(): boolean {
    return this.connector !== null && this.connector.status === 'active';
  }

  /**
   * Execute an MCP tool
   *
   * NOTE: In a real implementation, this would use the MCP SDK client to communicate
   * with the server via stdio. For now, we simulate the communication pattern.
   */
  private async executeMCPTool(toolName: string, args: any): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('NotebookLM MCP connector is not active');
    }

    console.log(`🔧 Executing NotebookLM tool: ${toolName}`, args);

    // TODO: Replace with actual MCP client implementation
    // Example using MCP SDK:
    // const client = new MCPClient();
    // await client.connect(this.connector.endpoint);
    // const result = await client.callTool(toolName, args);
    // return result;

    // For now, return a simulated response
    return {
      success: true,
      message: `Tool ${toolName} would be executed with MCP client`,
      args
    };
  }

  // ==================== NOTEBOOK MANAGEMENT ====================

  /**
   * Create a new NotebookLM notebook
   */
  async createNotebook(title: string, initialSources?: string[]): Promise<NotebookLMNotebook> {
    const result = await this.executeMCPTool('create_notebook', {
      title,
      initialSources
    });

    const notebook: NotebookLMNotebook = {
      id: result.notebookId,
      title: result.title,
      sourceCount: result.sourceCount || 0,
      lastModified: new Date().toISOString()
    };

    // Update session
    if (!this.session) {
      this.session = {
        currentNotebookId: notebook.id,
        notebooks: [notebook],
        lastSync: Date.now()
      };
    } else {
      this.session.notebooks.push(notebook);
      this.session.currentNotebookId = notebook.id;
      this.session.lastSync = Date.now();
    }

    this.saveSession();
    return notebook;
  }

  /**
   * List all NotebookLM notebooks
   */
  async listNotebooks(limit: number = 50): Promise<NotebookLMNotebook[]> {
    const result = await this.executeMCPTool('list_notebooks', { limit });

    const notebooks: NotebookLMNotebook[] = result.notebooks || [];

    // Update session
    if (this.session) {
      this.session.notebooks = notebooks;
      this.session.lastSync = Date.now();
      this.saveSession();
    }

    return notebooks;
  }

  /**
   * Navigate to a specific notebook
   */
  async navigateToNotebook(notebookId: string): Promise<void> {
    await this.executeMCPTool('navigate_to_notebook', { notebookId });

    if (this.session) {
      this.session.currentNotebookId = notebookId;
      this.saveSession();
    }
  }

  /**
   * Get notebook metadata
   */
  async getNotebookMetadata(notebookId?: string): Promise<NotebookLMNotebook> {
    const result = await this.executeMCPTool('get_notebook_metadata', {
      notebookId: notebookId || this.session?.currentNotebookId
    });

    return {
      id: result.notebookId,
      title: result.title,
      sourceCount: result.sourceCount,
      lastModified: result.lastModified,
      createdDate: result.createdDate
    };
  }

  // ==================== SOURCE MANAGEMENT ====================

  /**
   * Add a source to a notebook
   */
  async addSource(
    sourceType: 'url' | 'file' | 'youtube' | 'text',
    content: string,
    options?: {
      notebookId?: string;
      title?: string;
    }
  ): Promise<void> {
    await this.executeMCPTool('add_source', {
      notebookId: options?.notebookId || this.session?.currentNotebookId,
      sourceType,
      content,
      title: options?.title
    });

    // Update source count in session
    if (this.session && this.session.currentNotebookId) {
      const notebook = this.session.notebooks.find(
        n => n.id === this.session!.currentNotebookId
      );
      if (notebook) {
        notebook.sourceCount++;
        this.saveSession();
      }
    }
  }

  /**
   * Add sources from QuantaCore's LTM (SourceNode) to NotebookLM
   */
  async addSourcesFromLTM(sources: SourceNode[], notebookId?: string): Promise<void> {
    for (const source of sources) {
      let sourceType: 'url' | 'file' | 'youtube' | 'text' = 'text';
      let content = source.content;

      // Determine source type
      if (source.type === 'url' || source.metadata?.url) {
        sourceType = 'url';
        content = source.metadata?.url || source.content;
      } else if (source.type === 'pdf') {
        sourceType = 'file';
        content = source.content; // Assume content is file path or base64
      } else {
        sourceType = 'text';
      }

      await this.addSource(sourceType, content, {
        notebookId,
        title: source.title
      });
    }
  }

  /**
   * List sources in a notebook
   */
  async listSources(notebookId?: string): Promise<NotebookLMSource[]> {
    const result = await this.executeMCPTool('list_sources', {
      notebookId: notebookId || this.session?.currentNotebookId
    });

    return result.sources || [];
  }

  /**
   * Remove a source from a notebook
   */
  async removeSource(sourceId: string, notebookId?: string): Promise<void> {
    await this.executeMCPTool('remove_source', {
      notebookId: notebookId || this.session?.currentNotebookId,
      sourceId
    });

    // Update source count in session
    if (this.session && this.session.currentNotebookId) {
      const notebook = this.session.notebooks.find(
        n => n.id === this.session!.currentNotebookId
      );
      if (notebook && notebook.sourceCount > 0) {
        notebook.sourceCount--;
        this.saveSession();
      }
    }
  }

  // ==================== ANALYSIS & CHAT ====================

  /**
   * Ask a question and get an answer with citations
   */
  async chatWithNotebook(
    question: string,
    options?: {
      notebookId?: string;
      includeAllNotebooks?: boolean;
    }
  ): Promise<NotebookLMChatResponse> {
    const result = await this.executeMCPTool('chat_with_notebook', {
      notebookId: options?.notebookId || this.session?.currentNotebookId,
      question,
      includeAllNotebooks: options?.includeAllNotebooks || false
    });

    return {
      success: result.success,
      notebookId: result.notebookId,
      question: result.question,
      answer: result.answer,
      citations: result.citations || []
    };
  }

  // ==================== CONTENT GENERATION ====================

  /**
   * Generate a briefing document
   */
  async generateBriefing(
    format: 'summary' | 'briefing' | 'study-guide' | 'faq' | 'table',
    options?: {
      notebookId?: string;
      customPrompt?: string;
    }
  ): Promise<NotebookLMBriefing> {
    const result = await this.executeMCPTool('generate_briefing', {
      notebookId: options?.notebookId || this.session?.currentNotebookId,
      format,
      customPrompt: options?.customPrompt
    });

    return {
      success: result.success,
      notebookId: result.notebookId,
      format,
      content: result.content,
      length: result.length,
      generatedAt: Date.now()
    };
  }

  /**
   * Generate flashcards
   */
  async generateFlashcards(
    count: number = 20,
    options?: {
      notebookId?: string;
      difficulty?: 'basic' | 'intermediate' | 'advanced';
    }
  ): Promise<NotebookLMChatResponse> {
    const result = await this.executeMCPTool('generate_flashcards', {
      notebookId: options?.notebookId || this.session?.currentNotebookId,
      count,
      difficulty: options?.difficulty || 'intermediate'
    });

    return {
      success: result.success,
      notebookId: result.notebookId,
      question: `Generate ${count} flashcards`,
      answer: result.answer,
      citations: result.citations || []
    };
  }

  /**
   * Generate a quiz
   */
  async generateQuiz(
    questionCount: number = 10,
    options?: {
      notebookId?: string;
      questionType?: 'multiple-choice' | 'short-answer' | 'mixed';
    }
  ): Promise<NotebookLMChatResponse> {
    const result = await this.executeMCPTool('generate_quiz', {
      notebookId: options?.notebookId || this.session?.currentNotebookId,
      questionCount,
      questionType: options?.questionType || 'mixed'
    });

    return {
      success: result.success,
      notebookId: result.notebookId,
      question: `Generate ${questionCount} quiz questions`,
      answer: result.answer,
      citations: result.citations || []
    };
  }

  /**
   * Generate a podcast/audio overview
   */
  async generatePodcast(options?: {
    notebookId?: string;
    focusTopics?: string[];
    tone?: 'conversational' | 'educational' | 'professional';
  }): Promise<NotebookLMPodcast> {
    const result = await this.executeMCPTool('generate_podcast', {
      notebookId: options?.notebookId || this.session?.currentNotebookId,
      focusTopics: options?.focusTopics,
      tone: options?.tone || 'conversational'
    });

    return {
      success: result.success,
      notebookId: result.notebookId,
      audioUrl: result.audioUrl,
      transcriptUrl: result.transcriptUrl,
      duration: result.duration,
      tone: options?.tone || 'conversational',
      generatedAt: Date.now()
    };
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get current notebook ID
   */
  getCurrentNotebookId(): string | null {
    return this.session?.currentNotebookId || null;
  }

  /**
   * Get current notebook
   */
  getCurrentNotebook(): NotebookLMNotebook | null {
    if (!this.session || !this.session.currentNotebookId) return null;

    return this.session.notebooks.find(
      n => n.id === this.session!.currentNotebookId
    ) || null;
  }

  /**
   * Get all notebooks from session cache
   */
  getCachedNotebooks(): NotebookLMNotebook[] {
    return this.session?.notebooks || [];
  }

  /**
   * Clear session cache
   */
  clearSession(): void {
    this.session = null;
    localStorage.removeItem('quanta_notebooklm_session');
  }
}

// ==================== SINGLETON EXPORT ====================

let bridgeInstance: NotebookLMMCPBridge | null = null;

/**
 * Get or create the NotebookLM MCP bridge instance
 */
export function getNotebookLMBridge(): NotebookLMMCPBridge | null {
  if (!bridgeInstance) {
    // Check if NotebookLM connector exists
    const connectorsJson = localStorage.getItem('quanta_mcp_connectors');
    if (!connectorsJson) return null;

    try {
      const connectors: MCPConnector[] = JSON.parse(connectorsJson);
      const nlmConnector = connectors.find(c =>
        c.name.toLowerCase().includes('notebooklm') && c.status === 'active'
      );

      if (nlmConnector) {
        bridgeInstance = new NotebookLMMCPBridge({
          connectorId: nlmConnector.id,
          autoSync: true
        });
      }
    } catch (error) {
      console.error('❌ Failed to initialize NotebookLM bridge:', error);
    }
  }

  return bridgeInstance;
}

/**
 * Reset the bridge instance (useful for testing or reconnecting)
 */
export function resetNotebookLMBridge(): void {
  bridgeInstance = null;
}

// ==================== HELPER FUNCTIONS FOR AGENTS ====================

/**
 * Create a notebook for a specific agent/strategy
 */
export async function createAgentNotebook(
  agentName: string,
  strategy: string,
  sources?: SourceNode[]
): Promise<NotebookLMNotebook | null> {
  const bridge = getNotebookLMBridge();
  if (!bridge) return null;

  const title = `${agentName} - ${strategy} - ${new Date().toISOString().split('T')[0]}`;
  const notebook = await bridge.createNotebook(title);

  if (sources && sources.length > 0) {
    await bridge.addSourcesFromLTM(sources, notebook.id);
  }

  return notebook;
}

/**
 * Synthesize insights from sources using NotebookLM
 */
export async function synthesizeInsights(
  sources: SourceNode[],
  question: string,
  notebookId?: string
): Promise<NotebookLMChatResponse | null> {
  const bridge = getNotebookLMBridge();
  if (!bridge) return null;

  // If no notebook specified, create a temporary one
  if (!notebookId) {
    const tempNotebook = await bridge.createNotebook(
      `Temp Analysis - ${Date.now()}`
    );
    notebookId = tempNotebook.id;
  }

  // Add sources
  await bridge.addSourcesFromLTM(sources, notebookId);

  // Get answer
  return await bridge.chatWithNotebook(question, { notebookId });
}

/**
 * Generate a trading brief from sources
 */
export async function generateTradingBrief(
  sources: SourceNode[],
  customPrompt?: string
): Promise<NotebookLMBriefing | null> {
  const bridge = getNotebookLMBridge();
  if (!bridge) return null;

  // Create notebook for this brief
  const notebook = await bridge.createNotebook(
    `Trading Brief - ${new Date().toISOString()}`
  );

  // Add sources
  await bridge.addSourcesFromLTM(sources, notebook.id);

  // Generate briefing
  return await bridge.generateBriefing('briefing', {
    notebookId: notebook.id,
    customPrompt: customPrompt || 'Generate a comprehensive trading briefing with key insights, risk factors, and actionable recommendations.'
  });
}
