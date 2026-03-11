#!/usr/bin/env node
/**
 * NotebookLM MCP Server - Simplified for Local Testing
 * Exposes NotebookLM capabilities via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

console.error('🚀 NotebookLM MCP Server (Test Mode) starting...');

// For local testing, we'll return mock data
// In production, this would use Playwright to automate NotebookLM

const TOOLS: Tool[] = [
  {
    name: 'list_notebooks',
    description: 'List all NotebookLM notebooks',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max notebooks to return', default: 50 }
      }
    }
  },
  {
    name: 'create_notebook',
    description: 'Create a new NotebookLM notebook',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Notebook title' }
      },
      required: ['title']
    }
  },
  {
    name: 'chat_with_notebook',
    description: 'Ask questions and get cited answers from notebook sources',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string', description: 'Notebook ID' },
        question: { type: 'string', description: 'Question to ask' }
      },
      required: ['question']
    }
  },
  {
    name: 'add_source',
    description: 'Add a source to a notebook',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string' },
        sourceType: { type: 'string', enum: ['url', 'file', 'text'] },
        content: { type: 'string' }
      },
      required: ['sourceType', 'content']
    }
  },
  {
    name: 'generate_briefing',
    description: 'Generate structured output from sources',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string' },
        format: { type: 'string', enum: ['summary', 'briefing', 'study-guide', 'faq'] }
      },
      required: ['format']
    }
  }
];

// Mock implementations for local testing
function handleListNotebooks(args: any) {
  return {
    success: true,
    notebooks: [
      {
        id: 'nb_test_001',
        title: 'Test Notebook 1',
        sourceCount: 3,
        lastModified: new Date().toISOString()
      },
      {
        id: 'nb_test_002',
        title: 'Trading Strategy Research',
        sourceCount: 5,
        lastModified: new Date().toISOString()
      }
    ],
    total: 2
  };
}

function handleCreateNotebook(args: any) {
  return {
    success: true,
    notebookId: `nb_${Date.now()}`,
    title: args.title,
    sourceCount: 0,
    message: 'Notebook created successfully (TEST MODE)'
  };
}

function handleChatWithNotebook(args: any) {
  return {
    success: true,
    notebookId: args.notebookId || 'nb_test_001',
    question: args.question,
    answer: `This is a test response to: "${args.question}". In production, this would query actual NotebookLM sources and return cited answers.`,
    citations: [
      {
        sourceId: 'src_001',
        sourceTitle: 'Test Source Document',
        excerpt: 'Sample excerpt showing relevant information...'
      }
    ]
  };
}

function handleAddSource(args: any) {
  return {
    success: true,
    notebookId: args.notebookId || 'nb_test_001',
    sourceType: args.sourceType,
    message: `Source added successfully (TEST MODE): ${args.content.substring(0, 50)}...`
  };
}

function handleGenerateBriefing(args: any) {
  return {
    success: true,
    notebookId: args.notebookId || 'nb_test_001',
    format: args.format,
    content: `# Test ${args.format.toUpperCase()}

This is a sample ${args.format} generated in TEST MODE.

## Key Points
- Point 1: Sample insight from sources
- Point 2: Another important finding
- Point 3: Actionable recommendation

In production, this would be generated from actual NotebookLM sources with full citations.`,
    length: 250
  };
}

// Create MCP server
const server = new Server(
  {
    name: 'notebooklm-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'list_notebooks':
        result = handleListNotebooks(args);
        break;
      case 'create_notebook':
        result = handleCreateNotebook(args);
        break;
      case 'chat_with_notebook':
        result = handleChatWithNotebook(args);
        break;
      case 'add_source':
        result = handleAddSource(args);
        break;
      case 'generate_briefing':
        result = handleGenerateBriefing(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    console.error(`✅ Tool executed: ${name}`);

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: any) {
    console.error(`❌ Tool error: ${name} -`, error.message);
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('✅ NotebookLM MCP Server running in TEST MODE');
  console.error('   (Returns mock data - for production, this would connect to actual NotebookLM)');
}

main().catch((error) => {
  console.error('❌ Server failed to start:', error);
  process.exit(1);
});
