#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { z } from 'zod';

// ==================== CONFIGURATION ====================
const NOTEBOOKLM_URL = 'https://notebooklm.google.com';
const COOKIE_FILE = process.env.NOTEBOOKLM_COOKIE_FILE || './notebooklm-cookies.json';
const HEADLESS = process.env.NOTEBOOKLM_HEADLESS !== 'false';
const DEFAULT_TIMEOUT = 30000;

// ==================== TYPES ====================
interface NotebookLMSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  currentNotebookId: string | null;
}

interface NotebookInfo {
  id: string;
  title: string;
  sourceCount: number;
  lastModified: string;
}

interface SourceInfo {
  id: string;
  title: string;
  type: 'pdf' | 'url' | 'doc' | 'text' | 'youtube';
  url?: string;
}

interface ChatResponse {
  answer: string;
  citations: Array<{
    sourceId: string;
    sourceTitle: string;
    excerpt: string;
  }>;
}

// ==================== TOOL SCHEMAS ====================
const CreateNotebookSchema = z.object({
  title: z.string().describe('Title for the new notebook'),
  initialSources: z.array(z.string()).optional().describe('Optional initial source URLs or file paths'),
});

const ListNotebooksSchema = z.object({
  limit: z.number().optional().default(50).describe('Maximum number of notebooks to return'),
});

const NavigateToNotebookSchema = z.object({
  notebookId: z.string().describe('ID of the notebook to navigate to'),
});

const AddSourceSchema = z.object({
  notebookId: z.string().optional().describe('Notebook ID (uses current if not specified)'),
  sourceType: z.enum(['url', 'file', 'youtube', 'text']).describe('Type of source to add'),
  content: z.string().describe('URL, file path, or text content'),
  title: z.string().optional().describe('Optional title for the source'),
});

const ListSourcesSchema = z.object({
  notebookId: z.string().optional().describe('Notebook ID (uses current if not specified)'),
});

const RemoveSourceSchema = z.object({
  notebookId: z.string().optional().describe('Notebook ID (uses current if not specified)'),
  sourceId: z.string().describe('ID of the source to remove'),
});

const ChatWithNotebookSchema = z.object({
  notebookId: z.string().optional().describe('Notebook ID (uses current if not specified)'),
  question: z.string().describe('Question to ask about the notebook sources'),
  includeAllNotebooks: z.boolean().optional().default(false).describe('Include all notebooks in context'),
});

const GenerateBriefingSchema = z.object({
  notebookId: z.string().optional().describe('Notebook ID (uses current if not specified)'),
  format: z.enum(['summary', 'briefing', 'study-guide', 'faq', 'table']).describe('Format of the briefing'),
  customPrompt: z.string().optional().describe('Custom prompt for generation'),
});

const GenerateFlashcardsSchema = z.object({
  notebookId: z.string().optional().describe('Notebook ID (uses current if not specified)'),
  count: z.number().optional().default(20).describe('Number of flashcards to generate'),
  difficulty: z.enum(['basic', 'intermediate', 'advanced']).optional().default('intermediate'),
});

const GenerateQuizSchema = z.object({
  notebookId: z.string().optional().describe('Notebook ID (uses current if not specified)'),
  questionCount: z.number().optional().default(10).describe('Number of quiz questions'),
  questionType: z.enum(['multiple-choice', 'short-answer', 'mixed']).optional().default('mixed'),
});

const GeneratePodcastSchema = z.object({
  notebookId: z.string().optional().describe('Notebook ID (uses current if not specified)'),
  focusTopics: z.array(z.string()).optional().describe('Specific topics to focus on'),
  tone: z.enum(['conversational', 'educational', 'professional']).optional().default('conversational'),
});

const GetNotebookMetadataSchema = z.object({
  notebookId: z.string().optional().describe('Notebook ID (uses current if not specified)'),
});

// ==================== MCP TOOL DEFINITIONS ====================
const TOOLS: Tool[] = [
  {
    name: 'create_notebook',
    description: 'Create a new NotebookLM notebook for organizing and analyzing sources',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the new notebook' },
        initialSources: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional initial source URLs or file paths'
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_notebooks',
    description: 'List all available NotebookLM notebooks',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of notebooks to return', default: 50 },
      },
    },
  },
  {
    name: 'navigate_to_notebook',
    description: 'Navigate to a specific notebook to set it as the current context',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string', description: 'ID of the notebook to navigate to' },
      },
      required: ['notebookId'],
    },
  },
  {
    name: 'add_source',
    description: 'Add a source (URL, file, YouTube video, or text) to a notebook',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string', description: 'Notebook ID (uses current if not specified)' },
        sourceType: {
          type: 'string',
          enum: ['url', 'file', 'youtube', 'text'],
          description: 'Type of source to add'
        },
        content: { type: 'string', description: 'URL, file path, or text content' },
        title: { type: 'string', description: 'Optional title for the source' },
      },
      required: ['sourceType', 'content'],
    },
  },
  {
    name: 'list_sources',
    description: 'List all sources in a notebook',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string', description: 'Notebook ID (uses current if not specified)' },
      },
    },
  },
  {
    name: 'remove_source',
    description: 'Remove a source from a notebook',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string', description: 'Notebook ID (uses current if not specified)' },
        sourceId: { type: 'string', description: 'ID of the source to remove' },
      },
      required: ['sourceId'],
    },
  },
  {
    name: 'chat_with_notebook',
    description: 'Ask a question and get an answer with citations from notebook sources',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string', description: 'Notebook ID (uses current if not specified)' },
        question: { type: 'string', description: 'Question to ask about the notebook sources' },
        includeAllNotebooks: {
          type: 'boolean',
          description: 'Include all notebooks in context',
          default: false
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'generate_briefing',
    description: 'Generate structured output (summary, briefing doc, study guide, FAQ, or comparison table)',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string', description: 'Notebook ID (uses current if not specified)' },
        format: {
          type: 'string',
          enum: ['summary', 'briefing', 'study-guide', 'faq', 'table'],
          description: 'Format of the briefing'
        },
        customPrompt: { type: 'string', description: 'Custom prompt for generation' },
      },
      required: ['format'],
    },
  },
  {
    name: 'generate_flashcards',
    description: 'Generate flashcards from notebook sources for study and memorization',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string', description: 'Notebook ID (uses current if not specified)' },
        count: { type: 'number', description: 'Number of flashcards to generate', default: 20 },
        difficulty: {
          type: 'string',
          enum: ['basic', 'intermediate', 'advanced'],
          description: 'Difficulty level',
          default: 'intermediate'
        },
      },
    },
  },
  {
    name: 'generate_quiz',
    description: 'Generate a quiz or test from notebook sources',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string', description: 'Notebook ID (uses current if not specified)' },
        questionCount: { type: 'number', description: 'Number of quiz questions', default: 10 },
        questionType: {
          type: 'string',
          enum: ['multiple-choice', 'short-answer', 'mixed'],
          description: 'Type of questions',
          default: 'mixed'
        },
      },
    },
  },
  {
    name: 'generate_podcast',
    description: 'Generate an audio overview/podcast from notebook sources',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string', description: 'Notebook ID (uses current if not specified)' },
        focusTopics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific topics to focus on'
        },
        tone: {
          type: 'string',
          enum: ['conversational', 'educational', 'professional'],
          description: 'Tone of the podcast',
          default: 'conversational'
        },
      },
    },
  },
  {
    name: 'get_notebook_metadata',
    description: 'Get metadata about a notebook (title, source count, last modified, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string', description: 'Notebook ID (uses current if not specified)' },
      },
    },
  },
];

// ==================== NOTEBOOKLM SESSION MANAGER ====================
class NotebookLMManager {
  private session: NotebookLMSession | null = null;

  async initialize(): Promise<void> {
    console.error('🚀 Initializing NotebookLM MCP Server...');

    // Launch browser
    const browser = await chromium.launch({
      headless: HEADLESS,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Load cookies if available
    try {
      const fs = await import('fs/promises');
      const cookiesJson = await fs.readFile(COOKIE_FILE, 'utf-8');
      const cookies = JSON.parse(cookiesJson);
      await context.addCookies(cookies);
      console.error('✅ Loaded saved cookies');
    } catch (err) {
      console.error('⚠️  No saved cookies found, will need to authenticate');
    }

    const page = await context.newPage();

    this.session = {
      browser,
      context,
      page,
      currentNotebookId: null,
    };

    // Navigate to NotebookLM
    await page.goto(NOTEBOOKLM_URL, { waitUntil: 'networkidle' });

    // Check if authentication is needed
    const isAuthenticated = await this.checkAuthentication();
    if (!isAuthenticated) {
      throw new Error('NotebookLM authentication required. Please run with NOTEBOOKLM_HEADLESS=false to login.');
    }

    console.error('✅ NotebookLM session initialized');
  }

  private async checkAuthentication(): Promise<boolean> {
    if (!this.session) return false;

    try {
      // Wait for either login prompt or notebooks page
      await this.session.page.waitForSelector('[data-testid="notebook-card"], .sign-in-button', {
        timeout: 5000
      });

      const hasNotebooks = await this.session.page.$('[data-testid="notebook-card"]');
      return !!hasNotebooks;
    } catch {
      return false;
    }
  }

  async saveCookies(): Promise<void> {
    if (!this.session) return;

    try {
      const fs = await import('fs/promises');
      const cookies = await this.session.context.cookies();
      await fs.writeFile(COOKIE_FILE, JSON.stringify(cookies, null, 2));
      console.error('✅ Cookies saved');
    } catch (err) {
      console.error('⚠️  Failed to save cookies:', err);
    }
  }

  // ==================== TOOL IMPLEMENTATIONS ====================

  async createNotebook(args: z.infer<typeof CreateNotebookSchema>): Promise<any> {
    if (!this.session) throw new Error('Session not initialized');

    const { page } = this.session;

    // Click "New Notebook" button
    await page.click('[aria-label="Create notebook"], button:has-text("New notebook")', { timeout: DEFAULT_TIMEOUT });

    // Enter title
    await page.fill('input[placeholder*="title"], input[aria-label*="title"]', args.title);

    // Confirm creation
    await page.click('button:has-text("Create")');

    // Wait for notebook to be created
    await page.waitForURL(/.*notebook.*/, { timeout: DEFAULT_TIMEOUT });

    // Extract notebook ID from URL
    const url = page.url();
    const notebookId = url.match(/notebook[\/=]([a-zA-Z0-9_-]+)/)?.[1] || '';
    this.session.currentNotebookId = notebookId;

    // Add initial sources if provided
    if (args.initialSources && args.initialSources.length > 0) {
      for (const source of args.initialSources) {
        await this.addSource({
          sourceType: source.startsWith('http') ? 'url' : 'text',
          content: source
        });
      }
    }

    return {
      success: true,
      notebookId,
      title: args.title,
      sourceCount: args.initialSources?.length || 0,
    };
  }

  async listNotebooks(args: z.infer<typeof ListNotebooksSchema>): Promise<any> {
    if (!this.session) throw new Error('Session not initialized');

    const { page } = this.session;

    // Navigate to notebooks list
    await page.goto(NOTEBOOKLM_URL, { waitUntil: 'networkidle' });

    // Wait for notebooks to load
    await page.waitForSelector('[data-testid="notebook-card"]', { timeout: DEFAULT_TIMEOUT });

    // Extract notebook information
    const notebooks = await page.$$eval('[data-testid="notebook-card"]', (cards, limit) => {
      return cards.slice(0, limit).map(card => {
        const titleEl = card.querySelector('[data-testid="notebook-title"]');
        const sourceEl = card.querySelector('[data-testid="source-count"]');
        const dateEl = card.querySelector('[data-testid="last-modified"]');
        const linkEl = card.querySelector('a[href*="notebook"]');

        return {
          id: linkEl?.getAttribute('href')?.match(/notebook[\/=]([a-zA-Z0-9_-]+)/)?.[1] || '',
          title: titleEl?.textContent || 'Untitled',
          sourceCount: parseInt(sourceEl?.textContent || '0'),
          lastModified: dateEl?.textContent || '',
        };
      });
    }, args.limit);

    return {
      success: true,
      notebooks,
      total: notebooks.length,
    };
  }

  async navigateToNotebook(args: z.infer<typeof NavigateToNotebookSchema>): Promise<any> {
    if (!this.session) throw new Error('Session not initialized');

    const { page } = this.session;

    // Navigate to notebook
    await page.goto(`${NOTEBOOKLM_URL}/notebook/${args.notebookId}`, { waitUntil: 'networkidle' });

    // Update current notebook
    this.session.currentNotebookId = args.notebookId;

    // Get notebook title
    const title = await page.textContent('[data-testid="notebook-title"]') || 'Untitled';

    return {
      success: true,
      notebookId: args.notebookId,
      title,
    };
  }

  async addSource(args: z.infer<typeof AddSourceSchema>): Promise<any> {
    if (!this.session) throw new Error('Session not initialized');

    const { page } = this.session;
    const notebookId = args.notebookId || this.session.currentNotebookId;

    if (!notebookId) {
      throw new Error('No notebook specified and no current notebook set');
    }

    // Ensure we're on the right notebook
    if (this.session.currentNotebookId !== notebookId) {
      await this.navigateToNotebook({ notebookId });
    }

    // Click "Add source" button
    await page.click('button:has-text("Add source"), [aria-label*="Add source"]', { timeout: DEFAULT_TIMEOUT });

    // Handle different source types
    switch (args.sourceType) {
      case 'url':
      case 'youtube':
        await page.click('button:has-text("Website"), [aria-label="Add website"]');
        await page.fill('input[placeholder*="URL"], input[placeholder*="url"]', args.content);
        break;

      case 'file':
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(args.content);
        }
        break;

      case 'text':
        await page.click('button:has-text("Copy and paste"), [aria-label="Copy and paste"]');
        await page.fill('textarea', args.content);
        if (args.title) {
          await page.fill('input[placeholder*="title"]', args.title);
        }
        break;
    }

    // Confirm addition
    await page.click('button:has-text("Add"), button:has-text("Insert")');

    // Wait for source to be processed
    await page.waitForTimeout(2000);

    return {
      success: true,
      notebookId,
      sourceType: args.sourceType,
      message: 'Source added successfully',
    };
  }

  async listSources(args: z.infer<typeof ListSourcesSchema>): Promise<any> {
    if (!this.session) throw new Error('Session not initialized');

    const { page } = this.session;
    const notebookId = args.notebookId || this.session.currentNotebookId;

    if (!notebookId) {
      throw new Error('No notebook specified and no current notebook set');
    }

    // Ensure we're on the right notebook
    if (this.session.currentNotebookId !== notebookId) {
      await this.navigateToNotebook({ notebookId });
    }

    // Extract source information
    const sources = await page.$$eval('[data-testid="source-item"]', (items) => {
      return items.map((item, index) => {
        const titleEl = item.querySelector('[data-testid="source-title"]');
        const typeEl = item.querySelector('[data-testid="source-type"]');
        const urlEl = item.querySelector('a[href]');

        return {
          id: `source_${index}`,
          title: titleEl?.textContent || 'Untitled',
          type: typeEl?.textContent?.toLowerCase() || 'unknown',
          url: urlEl?.getAttribute('href') || undefined,
        };
      });
    });

    return {
      success: true,
      notebookId,
      sources,
      total: sources.length,
    };
  }

  async removeSource(args: z.infer<typeof RemoveSourceSchema>): Promise<any> {
    if (!this.session) throw new Error('Session not initialized');

    const { page } = this.session;
    const notebookId = args.notebookId || this.session.currentNotebookId;

    if (!notebookId) {
      throw new Error('No notebook specified and no current notebook set');
    }

    // Ensure we're on the right notebook
    if (this.session.currentNotebookId !== notebookId) {
      await this.navigateToNotebook({ notebookId });
    }

    // Find and remove the source
    await page.click(`[data-source-id="${args.sourceId}"] button[aria-label*="Remove"], [data-source-id="${args.sourceId}"] button[aria-label*="Delete"]`);

    // Confirm deletion
    await page.click('button:has-text("Remove"), button:has-text("Delete")');

    return {
      success: true,
      notebookId,
      sourceId: args.sourceId,
      message: 'Source removed successfully',
    };
  }

  async chatWithNotebook(args: z.infer<typeof ChatWithNotebookSchema>): Promise<any> {
    if (!this.session) throw new Error('Session not initialized');

    const { page } = this.session;
    const notebookId = args.notebookId || this.session.currentNotebookId;

    if (!notebookId) {
      throw new Error('No notebook specified and no current notebook set');
    }

    // Ensure we're on the right notebook
    if (this.session.currentNotebookId !== notebookId) {
      await this.navigateToNotebook({ notebookId });
    }

    // Toggle "Include all notebooks" if needed
    if (args.includeAllNotebooks) {
      const toggleButton = await page.$('button[aria-label*="Include all notebooks"]');
      if (toggleButton) {
        await toggleButton.click();
      }
    }

    // Type question in chat input
    const chatInput = await page.waitForSelector('textarea[placeholder*="Ask"], input[placeholder*="Ask"]', { timeout: DEFAULT_TIMEOUT });
    await chatInput.fill(args.question);

    // Submit question
    await page.click('button[aria-label="Send"], button[type="submit"]');

    // Wait for response
    await page.waitForSelector('[data-testid="chat-response"]', { timeout: 60000 });

    // Extract response and citations
    const response = await page.evaluate(() => {
      const responseEl = document.querySelector('[data-testid="chat-response"]:last-child');
      const answerText = responseEl?.querySelector('[data-testid="response-text"]')?.textContent || '';

      const citationEls = responseEl?.querySelectorAll('[data-testid="citation"]') || [];
      const citations = Array.from(citationEls).map((cite) => ({
        sourceId: cite.getAttribute('data-source-id') || '',
        sourceTitle: cite.querySelector('[data-testid="source-title"]')?.textContent || '',
        excerpt: cite.querySelector('[data-testid="excerpt"]')?.textContent || '',
      }));

      return { answer: answerText, citations };
    });

    return {
      success: true,
      notebookId,
      question: args.question,
      ...response,
    };
  }

  async generateBriefing(args: z.infer<typeof GenerateBriefingSchema>): Promise<any> {
    if (!this.session) throw new Error('Session not initialized');

    const { page } = this.session;
    const notebookId = args.notebookId || this.session.currentNotebookId;

    if (!notebookId) {
      throw new Error('No notebook specified and no current notebook set');
    }

    // Ensure we're on the right notebook
    if (this.session.currentNotebookId !== notebookId) {
      await this.navigateToNotebook({ notebookId });
    }

    // Open "Notebook guide" or "Studio" section
    await page.click('button:has-text("Notebook guide"), button:has-text("Studio")');

    // Select format
    const formatMap: Record<string, string> = {
      'summary': 'Summary',
      'briefing': 'Briefing doc',
      'study-guide': 'Study guide',
      'faq': 'FAQ',
      'table': 'Table of contents',
    };

    await page.click(`button:has-text("${formatMap[args.format]}")`);

    // Add custom prompt if provided
    if (args.customPrompt) {
      const customPromptInput = await page.$('textarea[placeholder*="custom"], input[placeholder*="instructions"]');
      if (customPromptInput) {
        await customPromptInput.fill(args.customPrompt);
      }
    }

    // Generate
    await page.click('button:has-text("Generate"), button:has-text("Create")');

    // Wait for generation to complete
    await page.waitForSelector('[data-testid="generated-content"]', { timeout: 120000 });

    // Extract generated content
    const content = await page.textContent('[data-testid="generated-content"]') || '';

    return {
      success: true,
      notebookId,
      format: args.format,
      content,
      length: content.length,
    };
  }

  async generateFlashcards(args: z.infer<typeof GenerateFlashcardsSchema>): Promise<any> {
    if (!this.session) throw new Error('Session not initialized');

    // Use chat to generate flashcards
    const prompt = `Generate ${args.count} flashcards at ${args.difficulty} level from the sources. Format as:

Q: [Question]
A: [Answer]

Make them comprehensive and test key concepts.`;

    const response = await this.chatWithNotebook({
      notebookId: args.notebookId,
      question: prompt,
    });

    return {
      ...response,
      type: 'flashcards',
      count: args.count,
      difficulty: args.difficulty,
    };
  }

  async generateQuiz(args: z.infer<typeof GenerateQuizSchema>): Promise<any> {
    if (!this.session) throw new Error('Session not initialized');

    // Use chat to generate quiz
    const prompt = `Generate a ${args.questionCount}-question quiz with ${args.questionType} questions from the sources. Include an answer key.`;

    const response = await this.chatWithNotebook({
      notebookId: args.notebookId,
      question: prompt,
    });

    return {
      ...response,
      type: 'quiz',
      questionCount: args.questionCount,
      questionType: args.questionType,
    };
  }

  async generatePodcast(args: z.infer<typeof GeneratePodcastSchema>): Promise<any> {
    if (!this.session) throw new Error('Session not initialized');

    const { page } = this.session;
    const notebookId = args.notebookId || this.session.currentNotebookId;

    if (!notebookId) {
      throw new Error('No notebook specified and no current notebook set');
    }

    // Ensure we're on the right notebook
    if (this.session.currentNotebookId !== notebookId) {
      await this.navigateToNotebook({ notebookId });
    }

    // Open audio overview section
    await page.click('button:has-text("Audio overview"), button:has-text("Generate audio")');

    // Configure if options available
    if (args.focusTopics && args.focusTopics.length > 0) {
      const topicsInput = await page.$('textarea[placeholder*="topics"], input[placeholder*="focus"]');
      if (topicsInput) {
        await topicsInput.fill(args.focusTopics.join(', '));
      }
    }

    // Select tone if available
    const toneMap: Record<string, string> = {
      'conversational': 'Conversational',
      'educational': 'Educational',
      'professional': 'Professional',
    };
    const toneButton = await page.$(`button:has-text("${toneMap[args.tone || 'conversational']}")`);
    if (toneButton) await toneButton.click();

    // Generate podcast
    await page.click('button:has-text("Generate"), button:has-text("Create audio")');

    // Wait for generation (this can take several minutes)
    await page.waitForSelector('[data-testid="audio-player"], audio', { timeout: 300000 });

    // Extract audio URL
    const audioUrl = await page.getAttribute('[data-testid="audio-player"] source, audio source', 'src') || '';

    return {
      success: true,
      notebookId,
      type: 'podcast',
      audioUrl,
      tone: args.tone,
      message: 'Podcast generated successfully',
    };
  }

  async getNotebookMetadata(args: z.infer<typeof GetNotebookMetadataSchema>): Promise<any> {
    if (!this.session) throw new Error('Session not initialized');

    const { page } = this.session;
    const notebookId = args.notebookId || this.session.currentNotebookId;

    if (!notebookId) {
      throw new Error('No notebook specified and no current notebook set');
    }

    // Ensure we're on the right notebook
    if (this.session.currentNotebookId !== notebookId) {
      await this.navigateToNotebook({ notebookId });
    }

    // Extract metadata
    const metadata = await page.evaluate(() => {
      return {
        title: document.querySelector('[data-testid="notebook-title"]')?.textContent || 'Untitled',
        sourceCount: document.querySelectorAll('[data-testid="source-item"]').length,
        lastModified: document.querySelector('[data-testid="last-modified"]')?.textContent || '',
        createdDate: document.querySelector('[data-testid="created-date"]')?.textContent || '',
      };
    });

    return {
      success: true,
      notebookId,
      ...metadata,
    };
  }

  async cleanup(): Promise<void> {
    if (this.session) {
      await this.saveCookies();
      await this.session.browser.close();
      this.session = null;
    }
  }
}

// ==================== MCP SERVER ====================
const manager = new NotebookLMManager();

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

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'create_notebook':
        result = await manager.createNotebook(CreateNotebookSchema.parse(args));
        break;
      case 'list_notebooks':
        result = await manager.listNotebooks(ListNotebooksSchema.parse(args));
        break;
      case 'navigate_to_notebook':
        result = await manager.navigateToNotebook(NavigateToNotebookSchema.parse(args));
        break;
      case 'add_source':
        result = await manager.addSource(AddSourceSchema.parse(args));
        break;
      case 'list_sources':
        result = await manager.listSources(ListSourcesSchema.parse(args));
        break;
      case 'remove_source':
        result = await manager.removeSource(RemoveSourceSchema.parse(args));
        break;
      case 'chat_with_notebook':
        result = await manager.chatWithNotebook(ChatWithNotebookSchema.parse(args));
        break;
      case 'generate_briefing':
        result = await manager.generateBriefing(GenerateBriefingSchema.parse(args));
        break;
      case 'generate_flashcards':
        result = await manager.generateFlashcards(GenerateFlashcardsSchema.parse(args));
        break;
      case 'generate_quiz':
        result = await manager.generateQuiz(GenerateQuizSchema.parse(args));
        break;
      case 'generate_podcast':
        result = await manager.generatePodcast(GeneratePodcastSchema.parse(args));
        break;
      case 'get_notebook_metadata':
        result = await manager.getNotebookMetadata(GetNotebookMetadataSchema.parse(args));
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// ==================== MAIN ====================
async function main() {
  try {
    await manager.initialize();

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('✅ NotebookLM MCP Server running on stdio');

    // Handle shutdown
    process.on('SIGINT', async () => {
      console.error('\n🛑 Shutting down...');
      await manager.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('\n🛑 Shutting down...');
      await manager.cleanup();
      process.exit(0);
    });
  } catch (error: any) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

main();
