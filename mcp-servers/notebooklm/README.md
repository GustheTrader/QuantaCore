# NotebookLM MCP Server for QuantaCore

A comprehensive Model Context Protocol (MCP) server that exposes Google NotebookLM's capabilities to QuantaCore's multi-agent AI platform.

## Features

### Notebook Management
- `create_notebook` - Create new notebooks for organizing research
- `list_notebooks` - List all available notebooks
- `navigate_to_notebook` - Switch between notebooks
- `get_notebook_metadata` - Get notebook details (title, source count, dates)

### Source Management
- `add_source` - Add URLs, files, YouTube videos, or text to notebooks
- `list_sources` - View all sources in a notebook
- `remove_source` - Remove sources from notebooks

### Analysis & Chat
- `chat_with_notebook` - Ask questions and get cited answers from sources
- Support for single-notebook or cross-notebook queries

### Content Generation
- `generate_briefing` - Create summaries, briefing docs, study guides, FAQs, or comparison tables
- `generate_flashcards` - Generate study flashcards at various difficulty levels
- `generate_quiz` - Create quizzes with multiple-choice or short-answer questions
- `generate_podcast` - Generate audio overviews/podcasts from sources

## Installation

```bash
cd mcp-servers/notebooklm
npm install
npm run build
```

## Configuration

### Environment Variables

- `NOTEBOOKLM_COOKIE_FILE` - Path to save/load authentication cookies (default: `./notebooklm-cookies.json`)
- `NOTEBOOKLM_HEADLESS` - Run browser in headless mode (default: `true`, set to `false` for first-time login)

### First-Time Setup

1. Run the server with headless mode disabled:
   ```bash
   NOTEBOOKLM_HEADLESS=false npm start
   ```

2. A browser window will open - sign in to your Google account with NotebookLM access

3. The server will save your authentication cookies for future use

4. Subsequent runs can use headless mode

## Usage with QuantaCore

### As a Local MCP Connector

Add to QuantaCore's MCP Connectors:

```json
{
  "id": "nlm_01",
  "name": "NotebookLM Neural Bridge",
  "type": "local",
  "status": "active",
  "endpoint": "stdio://notebooklm-server",
  "assignedAgents": ["DeepAgent", "QResearch", "QAssistant"],
  "config": {
    "command": "node /home/user/QuantaCore/mcp-servers/notebooklm/dist/index.js",
    "sovereignShield": true,
    "env": {
      "NOTEBOOKLM_COOKIE_FILE": "./notebooklm-cookies.json"
    }
  }
}
```

### Integration Patterns

#### Research Pipeline
```javascript
// Create notebook for a trading strategy
const notebook = await callMCPTool('notebooklm', 'create_notebook', {
  title: 'ES Microstructure Analysis Q1 2026'
});

// Add sources
await callMCPTool('notebooklm', 'add_source', {
  notebookId: notebook.notebookId,
  sourceType: 'url',
  content: 'https://research.example.com/es-futures-report.pdf'
});

// Analyze
const analysis = await callMCPTool('notebooklm', 'chat_with_notebook', {
  notebookId: notebook.notebookId,
  question: 'What are the key microstructure patterns identified for ES futures?'
});

// Generate briefing
const brief = await callMCPTool('notebooklm', 'generate_briefing', {
  notebookId: notebook.notebookId,
  format: 'briefing'
});
```

#### Multi-Source Synthesis
```javascript
// Chat across all notebooks
const crossNotebookInsights = await callMCPTool('notebooklm', 'chat_with_notebook', {
  question: 'Compare risk management approaches across all strategy notebooks',
  includeAllNotebooks: true
});
```

#### Study Materials Generation
```javascript
// Generate flashcards for learning
const flashcards = await callMCPTool('notebooklm', 'generate_flashcards', {
  notebookId: notebook.notebookId,
  count: 30,
  difficulty: 'advanced'
});

// Generate quiz
const quiz = await callMCPTool('notebooklm', 'generate_quiz', {
  notebookId: notebook.notebookId,
  questionCount: 15,
  questionType: 'mixed'
});
```

#### Audio Summaries
```javascript
// Generate podcast overview
const podcast = await callMCPTool('notebooklm', 'generate_podcast', {
  notebookId: notebook.notebookId,
  focusTopics: ['Risk metrics', 'Volatility regimes', 'Position sizing'],
  tone: 'professional'
});
```

## Tool Schema Reference

### create_notebook
```typescript
{
  title: string;              // Required: Notebook title
  initialSources?: string[];  // Optional: URLs or text to add immediately
}
```

### add_source
```typescript
{
  notebookId?: string;        // Optional: Uses current if not specified
  sourceType: 'url' | 'file' | 'youtube' | 'text';
  content: string;            // URL, file path, or text content
  title?: string;             // Optional: Custom title
}
```

### chat_with_notebook
```typescript
{
  notebookId?: string;        // Optional: Uses current if not specified
  question: string;           // Question to ask
  includeAllNotebooks?: boolean;  // Optional: Cross-notebook query
}
```

### generate_briefing
```typescript
{
  notebookId?: string;        // Optional: Uses current if not specified
  format: 'summary' | 'briefing' | 'study-guide' | 'faq' | 'table';
  customPrompt?: string;      // Optional: Custom generation instructions
}
```

### generate_podcast
```typescript
{
  notebookId?: string;        // Optional: Uses current if not specified
  focusTopics?: string[];     // Optional: Specific topics to emphasize
  tone?: 'conversational' | 'educational' | 'professional';
}
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   QuantaCore                        │
│  ┌──────────────────────────────────────────────┐  │
│  │    Agent Orchestrator (DeepAgent, etc.)     │  │
│  │                                              │  │
│  │  ┌────────────────────────────────────────┐ │  │
│  │  │  NotebookLM MCP Bridge                 │ │  │
│  │  │  (notebookLMMCPBridge.ts)              │ │  │
│  │  └────────────┬───────────────────────────┘ │  │
│  └───────────────┼─────────────────────────────┘  │
└──────────────────┼────────────────────────────────┘
                   │ MCP Protocol (stdio/HTTP)
                   ▼
┌─────────────────────────────────────────────────────┐
│     NotebookLM MCP Server (This Package)            │
│  ┌──────────────────────────────────────────────┐  │
│  │  MCP Server (SDK)                            │  │
│  │  - Tool Registration                         │  │
│  │  - Request Handling                          │  │
│  │  - Response Formatting                       │  │
│  └────────────┬─────────────────────────────────┘  │
│               │                                      │
│  ┌────────────▼─────────────────────────────────┐  │
│  │  NotebookLMManager                           │  │
│  │  - Browser Automation (Playwright)           │  │
│  │  - Session Management                        │  │
│  │  - Cookie Persistence                        │  │
│  └────────────┬─────────────────────────────────┘  │
└───────────────┼──────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│     Google NotebookLM Web Interface                 │
│     (notebooklm.google.com)                         │
└─────────────────────────────────────────────────────┘
```

## Security Considerations

- **Authentication**: Uses browser cookie persistence - keep `notebooklm-cookies.json` secure
- **Sovereign Shield**: Enable in QuantaCore to ensure all data stays local
- **Sandboxing**: Runs in isolated browser context with no access to host filesystem (except configured paths)
- **Rate Limiting**: Inherits NotebookLM's rate limits - add retry logic in QuantaCore bridge if needed

## Troubleshooting

### Authentication Failures
- Delete `notebooklm-cookies.json` and re-run with `NOTEBOOKLM_HEADLESS=false`
- Ensure your Google account has NotebookLM access enabled

### Selector Timeouts
- NotebookLM UI may change - update selectors in `src/index.ts`
- Increase `DEFAULT_TIMEOUT` if on slow connection

### Browser Launch Failures
- Install Playwright browsers: `npx playwright install chromium`
- Check sandbox permissions: May need `--no-sandbox` flag (already included)

## Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run dev
```

### Testing
```bash
# Manual test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

## License

MIT - See LICENSE file in QuantaCore root

## Credits

Based on community MCP implementations:
- khengyun/notebooklm-mcp
- PleasePrompto/notebooklm-mcp-server

Adapted for QuantaCore's multi-agent orchestration architecture.
