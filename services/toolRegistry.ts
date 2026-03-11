/**
 * Tool Registry - Centralized tool management for QuantaCore
 * Manages tools from multiple providers (Gemini, NotebookLM, MCP, internal)
 */

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: 'search' | 'analysis' | 'synthesis' | 'notebook' | 'mcp';
  provider: 'gemini' | 'notebooklm' | 'mcp' | 'internal';
  schema: any;
  enabledByDefault: boolean;
  cost?: number;
}

class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private static instance: ToolRegistry;

  private constructor() {
    this.registerDefaultTools();
  }

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  get(toolId: string): ToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getByProvider(provider: string): ToolDefinition[] {
    return this.getAll().filter(t => t.provider === provider);
  }

  isToolEnabled(toolId: string, enabledSkills: string[]): boolean {
    const tool = this.get(toolId);
    if (!tool) return false;
    if (tool.enabledByDefault) return true;
    if (tool.provider === 'notebooklm') {
      return enabledSkills.includes('notebooklm');
    }
    return false;
  }

  private registerDefaultTools(): void {
    // Register NotebookLM tools
    const notebookLMTools: ToolDefinition[] = [
      {
        id: 'notebooklm_list_notebooks',
        name: 'List NotebookLM Notebooks',
        description: 'List all available NotebookLM notebooks',
        category: 'notebook',
        provider: 'notebooklm',
        schema: { type: 'object', properties: { limit: { type: 'number' } } },
        enabledByDefault: false,
        cost: 5
      },
      {
        id: 'notebooklm_create_notebook',
        name: 'Create Notebook',
        description: 'Create a new NotebookLM notebook',
        category: 'notebook',
        provider: 'notebooklm',
        schema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
        enabledByDefault: false,
        cost: 15
      },
      {
        id: 'notebooklm_chat',
        name: 'Chat with Notebook',
        description: 'Ask questions and get cited answers',
        category: 'analysis',
        provider: 'notebooklm',
        schema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] },
        enabledByDefault: false,
        cost: 25
      },
      {
        id: 'notebooklm_add_source',
        name: 'Add Source',
        description: 'Add source to notebook',
        category: 'notebook',
        provider: 'notebooklm',
        schema: { type: 'object', properties: { sourceType: { type: 'string' }, content: { type: 'string' } } },
        enabledByDefault: false,
        cost: 10
      },
      {
        id: 'notebooklm_generate_briefing',
        name: 'Generate Briefing',
        description: 'Generate structured output from sources',
        category: 'synthesis',
        provider: 'notebooklm',
        schema: { type: 'object', properties: { format: { type: 'string' } }, required: ['format'] },
        enabledByDefault: false,
        cost: 40
      }
    ];

    notebookLMTools.forEach(tool => this.register(tool));
  }
}

export const toolRegistry = ToolRegistry.getInstance();
