/**
 * QuantaCore Tool Registry
 *
 * Central registry for all tools available to agents across different providers
 * (Gemini, NotebookLM, MCP, internal tools, etc.)
 */

import { ToolDefinition, ToolCategory, ToolProvider, AgentContext, ToolExecutionResult } from '../types';

// ==================== TOOL REGISTRY ====================

export class ToolRegistry {
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

  /**
   * Register a tool in the registry
   */
  register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
    console.log(`✅ Registered tool: ${tool.name} (${tool.provider})`);
  }

  /**
   * Unregister a tool
   */
  unregister(toolId: string): void {
    this.tools.delete(toolId);
  }

  /**
   * Get a tool by ID
   */
  get(toolId: string): ToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get all tools
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): ToolDefinition[] {
    return this.getAll().filter(tool => tool.category === category);
  }

  /**
   * Get tools by provider
   */
  getByProvider(provider: ToolProvider): ToolDefinition[] {
    return this.getAll().filter(tool => tool.provider === provider);
  }

  /**
   * Get tools available for a specific agent
   */
  getForAgent(agentName: string, enabledSkills: string[] = []): ToolDefinition[] {
    return this.getAll().filter(tool => {
      // Check if tool is restricted to specific agents
      if (tool.requiredAgents && tool.requiredAgents.length > 0) {
        if (!tool.requiredAgents.includes(agentName)) {
          return false;
        }
      }

      // Check if tool requires specific skills
      if (tool.id.includes('notebook') && !enabledSkills.includes('notebooklm')) {
        return false;
      }

      return true;
    });
  }

  /**
   * Register default built-in tools
   */
  private registerDefaultTools(): void {
    // Google Search Tool
    this.register({
      id: 'google_search',
      name: 'Google Search',
      description: 'Search the web using Google Search for current information and facts',
      category: 'search',
      provider: 'gemini',
      schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          }
        },
        required: ['query']
      },
      enabledByDefault: true,
      cost: 5
    });

    // Code Execution Tool
    this.register({
      id: 'code_execution',
      name: 'Code Execution',
      description: 'Execute Python code in a sandboxed environment',
      category: 'internal',
      provider: 'gemini',
      schema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Python code to execute'
          }
        },
        required: ['code']
      },
      enabledByDefault: false,
      cost: 10
    });
  }

  /**
   * Register all NotebookLM tools
   */
  registerNotebookLMTools(): void {
    const notebookLMTools: ToolDefinition[] = [
      {
        id: 'notebooklm_create_notebook',
        name: 'Create NotebookLM Notebook',
        description: 'Create a new NotebookLM notebook for organizing and analyzing sources',
        category: 'notebook',
        provider: 'notebooklm',
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Notebook title' },
            initialSources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional initial sources'
            }
          },
          required: ['title']
        },
        enabledByDefault: false,
        cost: 15
      },
      {
        id: 'notebooklm_list_notebooks',
        name: 'List NotebookLM Notebooks',
        description: 'List all available NotebookLM notebooks',
        category: 'notebook',
        provider: 'notebooklm',
        schema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Maximum number to return', default: 50 }
          }
        },
        enabledByDefault: false,
        cost: 5
      },
      {
        id: 'notebooklm_add_source',
        name: 'Add Source to Notebook',
        description: 'Add a source (URL, file, YouTube, or text) to a NotebookLM notebook',
        category: 'notebook',
        provider: 'notebooklm',
        schema: {
          type: 'object',
          properties: {
            notebookId: { type: 'string', description: 'Notebook ID' },
            sourceType: {
              type: 'string',
              enum: ['url', 'file', 'youtube', 'text'],
              description: 'Type of source'
            },
            content: { type: 'string', description: 'Source content' },
            title: { type: 'string', description: 'Optional title' }
          },
          required: ['sourceType', 'content']
        },
        enabledByDefault: false,
        cost: 10
      },
      {
        id: 'notebooklm_chat',
        name: 'Chat with Notebook',
        description: 'Ask questions and get cited answers from NotebookLM sources',
        category: 'analysis',
        provider: 'notebooklm',
        schema: {
          type: 'object',
          properties: {
            notebookId: { type: 'string', description: 'Notebook ID' },
            question: { type: 'string', description: 'Question to ask' },
            includeAllNotebooks: {
              type: 'boolean',
              description: 'Include all notebooks',
              default: false
            }
          },
          required: ['question']
        },
        enabledByDefault: false,
        cost: 25
      },
      {
        id: 'notebooklm_generate_briefing',
        name: 'Generate Briefing',
        description: 'Generate structured outputs (summary, briefing, study guide, FAQ, table) from sources',
        category: 'synthesis',
        provider: 'notebooklm',
        schema: {
          type: 'object',
          properties: {
            notebookId: { type: 'string', description: 'Notebook ID' },
            format: {
              type: 'string',
              enum: ['summary', 'briefing', 'study-guide', 'faq', 'table'],
              description: 'Briefing format'
            },
            customPrompt: { type: 'string', description: 'Custom generation prompt' }
          },
          required: ['format']
        },
        enabledByDefault: false,
        cost: 40
      },
      {
        id: 'notebooklm_generate_flashcards',
        name: 'Generate Flashcards',
        description: 'Generate study flashcards from NotebookLM sources',
        category: 'synthesis',
        provider: 'notebooklm',
        schema: {
          type: 'object',
          properties: {
            notebookId: { type: 'string', description: 'Notebook ID' },
            count: { type: 'number', description: 'Number of flashcards', default: 20 },
            difficulty: {
              type: 'string',
              enum: ['basic', 'intermediate', 'advanced'],
              description: 'Difficulty level',
              default: 'intermediate'
            }
          }
        },
        enabledByDefault: false,
        cost: 30
      },
      {
        id: 'notebooklm_generate_quiz',
        name: 'Generate Quiz',
        description: 'Generate quiz questions from NotebookLM sources',
        category: 'synthesis',
        provider: 'notebooklm',
        schema: {
          type: 'object',
          properties: {
            notebookId: { type: 'string', description: 'Notebook ID' },
            questionCount: { type: 'number', description: 'Number of questions', default: 10 },
            questionType: {
              type: 'string',
              enum: ['multiple-choice', 'short-answer', 'mixed'],
              description: 'Question type',
              default: 'mixed'
            }
          }
        },
        enabledByDefault: false,
        cost: 35
      },
      {
        id: 'notebooklm_generate_podcast',
        name: 'Generate Podcast',
        description: 'Generate audio overview/podcast from NotebookLM sources',
        category: 'synthesis',
        provider: 'notebooklm',
        schema: {
          type: 'object',
          properties: {
            notebookId: { type: 'string', description: 'Notebook ID' },
            focusTopics: {
              type: 'array',
              items: { type: 'string' },
              description: 'Topics to focus on'
            },
            tone: {
              type: 'string',
              enum: ['conversational', 'educational', 'professional'],
              description: 'Podcast tone',
              default: 'conversational'
            }
          }
        },
        enabledByDefault: false,
        cost: 50
      },
      {
        id: 'notebooklm_list_sources',
        name: 'List Notebook Sources',
        description: 'List all sources in a NotebookLM notebook',
        category: 'notebook',
        provider: 'notebooklm',
        schema: {
          type: 'object',
          properties: {
            notebookId: { type: 'string', description: 'Notebook ID' }
          }
        },
        enabledByDefault: false,
        cost: 5
      },
      {
        id: 'notebooklm_get_metadata',
        name: 'Get Notebook Metadata',
        description: 'Get metadata about a NotebookLM notebook',
        category: 'notebook',
        provider: 'notebooklm',
        schema: {
          type: 'object',
          properties: {
            notebookId: { type: 'string', description: 'Notebook ID' }
          }
        },
        enabledByDefault: false,
        cost: 5
      }
    ];

    notebookLMTools.forEach(tool => this.register(tool));
  }

  /**
   * Check if a tool is enabled for an agent based on skills
   */
  isToolEnabled(toolId: string, enabledSkills: string[]): boolean {
    const tool = this.get(toolId);
    if (!tool) return false;

    if (tool.enabledByDefault) return true;

    // NotebookLM tools require 'notebooklm' skill
    if (tool.provider === 'notebooklm') {
      return enabledSkills.includes('notebooklm');
    }

    // Search tools require 'search' skill
    if (tool.id === 'google_search') {
      return enabledSkills.includes('search');
    }

    return false;
  }

  /**
   * Get tool schemas for AI model (Gemini format)
   */
  getToolSchemasForAI(enabledSkills: string[]): any[] {
    const enabledTools = this.getAll().filter(tool =>
      this.isToolEnabled(tool.id, enabledSkills)
    );

    return enabledTools.map(tool => ({
      name: tool.id,
      description: tool.description,
      parameters: tool.schema
    }));
  }

  /**
   * Estimate token cost for a tool execution
   */
  estimateCost(toolId: string): number {
    const tool = this.get(toolId);
    return tool?.cost || 10;
  }
}

// ==================== SINGLETON EXPORT ====================
export const toolRegistry = ToolRegistry.getInstance();

// ==================== HELPER FUNCTIONS ====================

/**
 * Get tools for a specific agent context
 */
export function getToolsForAgent(context: AgentContext): ToolDefinition[] {
  return toolRegistry.getForAgent(context.agentName, context.enabledSkills);
}

/**
 * Check if an agent can use a specific tool
 */
export function canAgentUseTool(agentName: string, toolId: string, enabledSkills: string[]): boolean {
  const tool = toolRegistry.get(toolId);
  if (!tool) return false;

  // Check agent restrictions
  if (tool.requiredAgents && tool.requiredAgents.length > 0) {
    if (!tool.requiredAgents.includes(agentName)) {
      return false;
    }
  }

  // Check if tool is enabled
  return toolRegistry.isToolEnabled(toolId, enabledSkills);
}

/**
 * Format tools for display in UI
 */
export function formatToolsForUI(tools: ToolDefinition[]): Array<{
  id: string;
  name: string;
  description: string;
  provider: string;
  category: string;
  cost: number;
}> {
  return tools.map(tool => ({
    id: tool.id,
    name: tool.name,
    description: tool.description,
    provider: tool.provider,
    category: tool.category,
    cost: tool.cost || 0
  }));
}

// ==================== INITIALIZE ====================

// Auto-register NotebookLM tools on import
if (typeof window !== 'undefined') {
  // Browser environment - check if NotebookLM is enabled in settings
  const settings = localStorage.getItem('quanta_api_settings');
  if (settings) {
    try {
      const parsed = JSON.parse(settings);
      if (parsed.notebooklmEnabled) {
        toolRegistry.registerNotebookLMTools();
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
}
