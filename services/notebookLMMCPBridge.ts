/**
 * NotebookLM MCP Bridge - Client-side service for NotebookLM integration
 * Communicates with the NotebookLM MCP server
 */

import type { MCPConnector } from '../types';

export interface NotebookLMNotebook {
  id: string;
  title: string;
  sourceCount: number;
  lastModified: string;
}

export interface NotebookLMChatResponse {
  success: boolean;
  notebookId: string;
  question: string;
  answer: string;
  citations: Array<{
    sourceId: string;
    sourceTitle: string;
    excerpt: string;
  }>;
}

export interface NotebookLMBriefing {
  success: boolean;
  notebookId: string;
  format: string;
  content: string;
  length: number;
}

export class NotebookLMMCPBridge {
  private connector: MCPConnector | null = null;

  constructor() {
    this.loadConnector();
  }

  private loadConnector(): void {
    const connectorsJson = localStorage.getItem('quanta_mcp_connectors');
    if (!connectorsJson) return;

    try {
      const connectors: MCPConnector[] = JSON.parse(connectorsJson);
      const connector = connectors.find(c =>
        c.name.toLowerCase().includes('notebooklm') && c.status === 'active'
      );

      if (connector) {
        this.connector = connector;
        console.log('✅ NotebookLM connector loaded:', connector.name);
      }
    } catch (error) {
      console.error('❌ Failed to load NotebookLM connector:', error);
    }
  }

  isConnected(): boolean {
    return this.connector !== null && this.connector.status === 'active';
  }

  private async executeTool(toolName: string, args: any): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('NotebookLM MCP connector is not active');
    }

    console.log(`🔧 Executing NotebookLM tool: ${toolName}`, args);

    try {
      // In test mode, use HTTP endpoint
      const response = await fetch(`/api/mcp/tools/${toolName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });

      if (!response.ok) {
        throw new Error(`Tool ${toolName} failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error(`❌ Tool ${toolName} error:`, error);
      throw error;
    }
  }

  async listNotebooks(limit: number = 50): Promise<NotebookLMNotebook[]> {
    const result = await this.executeTool('list_notebooks', { limit });
    return result.notebooks || [];
  }

  async createNotebook(title: string): Promise<NotebookLMNotebook> {
    const result = await this.executeTool('create_notebook', { title });
    return {
      id: result.notebookId,
      title: result.title,
      sourceCount: result.sourceCount || 0,
      lastModified: new Date().toISOString()
    };
  }

  async chatWithNotebook(question: string, notebookId?: string): Promise<NotebookLMChatResponse> {
    const result = await this.executeTool('chat_with_notebook', {
      question,
      notebookId
    });
    return result;
  }

  async addSource(sourceType: string, content: string, notebookId?: string): Promise<void> {
    await this.executeTool('add_source', {
      sourceType,
      content,
      notebookId
    });
  }

  async generateBriefing(format: string, notebookId?: string): Promise<NotebookLMBriefing> {
    const result = await this.executeTool('generate_briefing', {
      format,
      notebookId
    });
    return result;
  }
}

let bridgeInstance: NotebookLMMCPBridge | null = null;

export function getNotebookLMBridge(): NotebookLMMCPBridge | null {
  if (!bridgeInstance) {
    bridgeInstance = new NotebookLMMCPBridge();
  }
  return bridgeInstance.isConnected() ? bridgeInstance : null;
}
