# NotebookLM MCP Integration for QuantaCore

**Complete Integration Guide**

## Overview

This integration exposes **all** of Google NotebookLM's capabilities to QuantaCore's multi-agent AI platform through the Model Context Protocol (MCP). Agents can now:

- 📚 Create and manage research notebooks
- 📄 Add sources (PDFs, URLs, YouTube, text)  from LTM
- 💬 Ask questions with cited answers
- 📊 Generate briefings, study guides, FAQs, comparison tables
- 🎴 Create flashcards and quizzes
- 🎙️ Generate audio podcasts/overviews
- 🔗 Cross-reference insights across multiple notebooks

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                   QuantaCore Frontend                  │
│  ┌──────────────────────────────────────────────────┐ │
│  │  NotebookLMPanel Component                       │ │
│  │  - UI for notebooks, chat, generation            │ │
│  └────────────┬─────────────────────────────────────┘ │
│               │                                         │
│  ┌────────────▼─────────────────────────────────────┐ │
│  │  Agent Orchestration (DeepAgent, Council, etc.)  │ │
│  │  - Tool discovery via toolRegistry               │ │
│  │  - Skill-based activation ('notebooklm' skill)   │ │
│  └────────────┬─────────────────────────────────────┘ │
│               │                                         │
│  ┌────────────▼─────────────────────────────────────┐ │
│  │  notebookLMMCPBridge.ts                          │ │
│  │  - Client-side bridge to MCP server              │ │
│  │  - Session management & caching                  │ │
│  │  - LTM integration (SourceNode → NotebookLM)     │ │
│  └────────────┬─────────────────────────────────────┘ │
└───────────────┼──────────────────────────────────────┘
                │ MCP Protocol (stdio)
                │
┌───────────────▼──────────────────────────────────────┐
│   NotebookLM MCP Server (Node.js)                    │
│   Location: ./mcp-servers/notebooklm/               │
│  ┌──────────────────────────────────────────────┐   │
│  │  MCP Server (@modelcontextprotocol/sdk)      │   │
│  │  - 12 tools registered                       │   │
│  │  - Request/response handling                 │   │
│  └────────────┬─────────────────────────────────┘   │
│               │                                       │
│  ┌────────────▼─────────────────────────────────┐   │
│  │  NotebookLMManager (Playwright automation)   │   │
│  │  - Browser session management                │   │
│  │  - Cookie persistence                        │   │
│  │  - Tool implementations                      │   │
│  └────────────┬─────────────────────────────────┘   │
└───────────────┼───────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│     Google NotebookLM (notebooklm.google.com)       │
└─────────────────────────────────────────────────────┘
```

## Components Created

### 1. MCP Server (`/mcp-servers/notebooklm/`)
- **`src/index.ts`**: Full MCP server implementation with Playwright automation
- **`package.json`**: Dependencies (@modelcontextprotocol/sdk, playwright, zod)
- **`tsconfig.json`**: TypeScript configuration
- **`README.md`**: Server-specific documentation

**Tools Exposed (12 total)**:
- Notebook: `create_notebook`, `list_notebooks`, `navigate_to_notebook`, `get_notebook_metadata`
- Sources: `add_source`, `list_sources`, `remove_source`
- Analysis: `chat_with_notebook`
- Generation: `generate_briefing`, `generate_flashcards`, `generate_quiz`, `generate_podcast`

### 2. QuantaCore Integration

#### Services
- **`services/toolRegistry.ts`**: Unified tool registry system for all providers
  - Manages tool discovery, registration, and routing
  - Handles NotebookLM-specific tools + cost estimation

- **`services/notebookLMMCPBridge.ts`**: Client-side MCP bridge
  - Communicates with MCP server via stdio
  - Session management & caching
  - LTM integration (converts SourceNode → NotebookLM sources)
  - Helper functions for agents

#### UI Components
- **`components/NotebookLMPanel.tsx`**: Full-featured UI
  - 4 views: Notebooks, Chat, Generate, Sources
  - Notebook creation & selection
  - Q&A with citations
  - Multi-format content generation
  - Audio playback for podcasts

#### Configuration
- **`components/MCPConnectors.tsx`**: Updated with default NotebookLM connector
  - Pre-configured for local deployment
  - Assigned to DeepAgent, QResearch, QAssistant, Council
  - Sovereign Shield enabled by default

#### Types & Documentation
- **`types.ts`**: Extended with 10+ NotebookLM-specific interfaces
- **`skills/NotebookLMSynthesis.md`**: Complete skill protocol documentation
- **`NOTEBOOKLM_INTEGRATION.md`**: This file

## Installation & Setup

### Step 1: Install MCP Server Dependencies

```bash
cd mcp-servers/notebooklm
npm install
```

### Step 2: Build the MCP Server

```bash
npm run build
```

This compiles TypeScript to `dist/index.js`.

### Step 3: Authenticate with Google NotebookLM

**First-time setup requires interactive authentication:**

```bash
# Run with browser visible
NOTEBOOKLM_HEADLESS=false npm start
```

1. A Chrome window will open
2. Sign in to your Google account with NotebookLM access
3. Navigate to notebooklm.google.com
4. Server will save cookies to `notebooklm-cookies.json`
5. Close the browser (Ctrl+C)

**Subsequent runs can be headless:**

```bash
npm start
# or
node dist/index.js
```

### Step 4: Enable in QuantaCore

1. Open QuantaCore
2. Navigate to **MCP Connectors**
3. Find **"NotebookLM Neural Bridge"** connector
4. Toggle status to **"Active"**
5. Verify endpoint: `stdio://notebooklm-server`
6. Assigned agents should include: `DeepAgent`, `QResearch`, `QAssistant`, `Council`

### Step 5: Enable Skill for Agents

Agents need the `notebooklm` skill to access tools:

1. Go to **Settings** → **Agent Configuration**
2. For each agent (DeepAgent, QAssistant, etc.):
   - Add `'notebooklm'` to enabled skills array
   - Save configuration

**Example (localStorage):**
```javascript
const agentConfigs = JSON.parse(localStorage.getItem('quanta_agent_configs') || '{}');
agentConfigs['DeepAgent'] = {
  prompt: null,
  skills: ['search', 'notebooklm']
};
localStorage.setItem('quanta_agent_configs', JSON.stringify(agentConfigs));
```

### Step 6: Initialize Tool Registry

The tool registry auto-initializes on import, but you can manually register tools:

```typescript
import { toolRegistry } from './services/toolRegistry';

// Register all NotebookLM tools
toolRegistry.registerNotebookLMTools();
```

## Usage Examples

### For Users: NotebookLMPanel

Users can interact with NotebookLM directly through the panel:

```typescript
import { NotebookLMPanel } from './components/NotebookLMPanel';

// In your component
<NotebookLMPanel
  sources={currentSources} // Optional: Auto-create notebook from LTM sources
  initialQuery="Summarize risk factors"
  agentName="DeepAgent"
  onClose={() => setShowPanel(false)}
/>
```

**Panel Features:**
- **Notebooks Tab**: Create, list, select notebooks
- **Chat Tab**: Ask questions, get cited answers
- **Generate Tab**: Create briefings, flashcards, quizzes, podcasts
- **Sources Tab**: View and manage notebook sources

### For Agents: Bridge Functions

Agents can use the bridge service directly:

```typescript
import {
  getNotebookLMBridge,
  createAgentNotebook,
  synthesizeInsights,
  generateTradingBrief
} from './services/notebookLMMCPBridge';

// Example: Deep Agent creates research notebook
const bridge = getNotebookLMBridge();
if (bridge) {
  // Create notebook
  const notebook = await bridge.createNotebook(
    "ES Microstructure Q1 2026"
  );

  // Add sources from LTM
  await bridge.addSourcesFromLTM(relevantSources, notebook.id);

  // Ask question
  const response = await bridge.chatWithNotebook(
    "What are the key microstructure patterns?",
    { notebookId: notebook.id }
  );

  console.log(response.answer);
  console.log(response.citations);
}
```

### Example: Trading Strategy Analysis

```typescript
// 1. Gather sources from LTM
const sources = await fetchMemoriesFromSupabase({
  agentName: "QFinance",
  category: "ES Futures"
});

// 2. Create trading brief
const brief = await generateTradingBrief(
  sources,
  "Generate a comprehensive trading briefing with risk factors, entry/exit signals, and regime analysis."
);

// 3. Archive to LTM
await archiveToSovereignMemory(
  "Trading Brief - ES Futures",
  brief.content,
  "QFinance"
);
```

### Example: Multi-Notebook Cross-Analysis

```typescript
// Query across all notebooks
const response = await bridge.chatWithNotebook(
  "Compare risk-adjusted returns across all strategies",
  { includeAllNotebooks: true }
);

// Returns cited analysis from all research collections
```

### Example: Generate Study Materials

```typescript
// For a specific notebook
const flashcards = await bridge.generateFlashcards(20, {
  notebookId: notebook.id,
  difficulty: "advanced"
});

const quiz = await bridge.generateQuiz(15, {
  notebookId: notebook.id,
  questionType: "mixed"
});

// Use for agent self-reflection or user education
```

### Example: Audio Podcast Generation

```typescript
const podcast = await bridge.generatePodcast({
  notebookId: notebook.id,
  focusTopics: ["Volatility regimes", "Risk management", "Trade execution"],
  tone: "professional"
});

console.log(podcast.audioUrl); // Direct link to MP3
// Can be embedded in UI with <audio> element
```

## Tool Registry Usage

The tool registry provides centralized tool management:

```typescript
import { toolRegistry } from './services/toolRegistry';

// Get all NotebookLM tools
const nlmTools = toolRegistry.getByProvider('notebooklm');

// Get tools for a specific agent
const agentTools = toolRegistry.getForAgent('DeepAgent', ['search', 'notebooklm']);

// Check if tool is enabled
const isEnabled = toolRegistry.isToolEnabled('notebooklm_chat', ['notebooklm']);

// Get tool schemas for AI model
const schemas = toolRegistry.getToolSchemasForAI(['search', 'notebooklm']);

// Estimate cost
const cost = toolRegistry.estimateCost('notebooklm_generate_briefing'); // Returns: 40 tokens
```

## Integration with Existing Agents

### DeepAgent

Add NotebookLM synthesis in the loop:

```typescript
// In deepAgentService.ts

// After RECALL phase
if (enabledSkills.includes('notebooklm')) {
  const notebook = await createAgentNotebook('Deep Agent', query, recalledMemories);

  // Add to synthesis phase
  const nlmSynthesis = await bridge.generateBriefing('briefing', {
    notebookId: notebook.id,
    customPrompt: 'Focus on actionable insights and quantitative metrics'
  });

  session.finalResult = nlmSynthesis.content;
}
```

### Council

Each agent queries notebook for domain-specific critique:

```typescript
// Proposer creates notebook
const notebook = await createAgentNotebook('Council', strategy, sources);

// Each critic queries
const riskCritique = await bridge.chatWithNotebook(
  "Identify all risk factors in this strategy",
  { notebookId: notebook.id }
);

const executionCritique = await bridge.chatWithNotebook(
  "Analyze execution complexity and operational risk",
  { notebookId: notebook.id }
);

// Judge generates comparison table
const comparison = await bridge.generateBriefing('table', {
  notebookId: notebook.id
});
```

### Projects

Auto-sync project files to NotebookLM:

```typescript
// When user adds files to Project
const projectNotebook = await bridge.createNotebook(project.title);

// Convert project files to SourceNodes
const sourceNodes = project.files.map(file => ({
  id: file.id,
  title: file.name,
  content: file.content,
  type: 'doc' as const,
  category: project.title,
  assignedAgents: [agentName],
  timestamp: Date.now()
}));

// Add to NotebookLM
await bridge.addSourcesFromLTM(sourceNodes, projectNotebook.id);
```

## Cost & Performance

### Token Usage (Estimates)

| Tool | Tokens | Latency |
|------|--------|---------|
| `list_notebooks` | ~5 | <1s |
| `create_notebook` | ~15 | 2-3s |
| `add_source` | ~10 | 2-5s |
| `chat_with_notebook` | ~25 | 3-8s |
| `generate_briefing` | ~40 | 10-30s |
| `generate_flashcards` | ~30 | 15-25s |
| `generate_quiz` | ~35 | 15-25s |
| `generate_podcast` | ~50 | 2-5min |

### Optimization Tips

1. **Batch operations**: Add multiple sources in sequence rather than one-at-a-time
2. **Cache notebook IDs**: Store in session to avoid repeated lookups
3. **Use focused queries**: Specific questions get better, faster results
4. **Archive generated content**: Save briefings to LTM for reuse
5. **Async podcast generation**: Don't block UI while podcast generates

## Troubleshooting

### "NotebookLM connector not active"
- Go to MCP Connectors UI
- Find "NotebookLM Neural Bridge"
- Toggle status to "Active"
- Refresh page

### "Authentication required"
- Stop MCP server
- Run with `NOTEBOOKLM_HEADLESS=false npm start`
- Sign in to Google when browser opens
- Cookies will be saved for future use

### "Tool not found"
- Ensure `toolRegistry.registerNotebookLMTools()` was called
- Check that agent has `'notebooklm'` in enabled skills
- Verify connector status is "active"

### "MCP server not responding"
- Check if server is running: `ps aux | grep notebooklm`
- Verify command in connector config: `node ./mcp-servers/notebooklm/dist/index.js`
- Check server logs for errors
- Restart server and re-authenticate if needed

### "Notebook not found"
- Use `listNotebooks()` to get valid IDs
- Ensure notebook wasn't deleted in NotebookLM web UI
- Try navigating to notebook explicitly with `navigateToNotebook()`

### Selector timeouts
- NotebookLM UI changes occasionally
- Update selectors in `mcp-servers/notebooklm/src/index.ts`
- Increase `DEFAULT_TIMEOUT` if on slow connection

## Security & Privacy

### Data Flow
```
User → QuantaCore → MCP Server (local) → NotebookLM (Google)
```

### Sovereign Shield Mode
- **Enabled by default** for NotebookLM connector
- All MCP communication stays local to user's machine
- No QuantaCore server involvement
- User's Google account controls all data

### Authentication
- Uses browser cookies stored locally
- No API keys sent to QuantaCore
- User can revoke access via Google account settings

### Data Ownership
- Notebooks remain in user's Google account
- Sources and analysis stay within user's workspace
- No training data extraction
- User can delete notebooks anytime via NotebookLM web UI

## Testing

### Manual Testing with MCP Inspector

```bash
cd mcp-servers/notebooklm
npm run build

# Run inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

Opens web UI to test all 12 tools interactively.

### Integration Testing

```typescript
// In browser console or test file
import { getNotebookLMBridge } from './services/notebookLMMCPBridge';

const bridge = getNotebookLMBridge();

// Test connection
const notebooks = await bridge.listNotebooks();
console.log(`Connected! Found ${notebooks.length} notebooks`);

// Test notebook creation
const testNotebook = await bridge.createNotebook('Test Notebook');
console.log('Created:', testNotebook);

// Test chat
const response = await bridge.chatWithNotebook(
  'What is in this notebook?',
  { notebookId: testNotebook.id }
);
console.log('Answer:', response.answer);
```

## Maintenance

### Updating the MCP Server

```bash
cd mcp-servers/notebooklm
npm run build
# Restart QuantaCore to pick up changes
```

### Re-authenticating

If authentication expires:

```bash
rm ./notebooklm-cookies.json
NOTEBOOKLM_HEADLESS=false npm start
# Sign in again
```

### Upgrading Dependencies

```bash
cd mcp-servers/notebooklm
npm update
npm audit fix
npm run build
```

## Extending the Integration

### Adding New Tools

1. Define tool schema in `mcp-servers/notebooklm/src/index.ts`:

```typescript
const TOOLS: Tool[] = [
  // ... existing tools
  {
    name: 'my_custom_tool',
    description: 'Does something custom',
    inputSchema: {
      type: 'object',
      properties: {
        param: { type: 'string' }
      },
      required: ['param']
    }
  }
];
```

2. Implement handler in `NotebookLMManager` class
3. Register in tool registry (`services/toolRegistry.ts`)
4. Update UI if needed

### Custom Briefing Formats

Extend `GenerateFormat` type in NotebookLMPanel:

```typescript
type GenerateFormat =
  | 'summary' | 'briefing' | 'study-guide' | 'faq' | 'table'
  | 'flashcards' | 'quiz' | 'podcast'
  | 'trading-brief' | 'risk-report'; // Add custom formats

// Implement handler
if (generateFormat === 'trading-brief') {
  const brief = await bridge.generateBriefing('briefing', {
    customPrompt: 'Generate a trading briefing with entry/exit signals...'
  });
}
```

## Roadmap

### Planned Features
- [ ] Direct file upload UI in NotebookLMPanel
- [ ] Streaming responses for long-form generation
- [ ] Batch notebook operations (bulk source addition)
- [ ] Notebook templates (trading, research, learning)
- [ ] Export notebooks to markdown/PDF
- [ ] Scheduled briefing generation (daily/weekly)
- [ ] Integration with Supabase for artifact storage
- [ ] Multi-user notebook sharing

### Future Integrations
- [ ] Auto-sync Notebook sources from:
  - QuantConnect research notebooks
  - Polymarket data exports
  - Bloomberg terminal reports
- [ ] Webhook triggers for new sources
- [ ] Slack/Discord notifications for generated content

## Contributing

When extending this integration:

1. **Types**: Update `types.ts` with new interfaces
2. **Server**: Add tools to MCP server (`mcp-servers/notebooklm/src/index.ts`)
3. **Bridge**: Add client methods to `notebookLMMCPBridge.ts`
4. **Registry**: Register tools in `toolRegistry.ts`
5. **UI**: Update `NotebookLMPanel.tsx` if adding user-facing features
6. **Docs**: Update this README and skill documentation

## Support

### Documentation
- MCP Server: `./mcp-servers/notebooklm/README.md`
- Skill Guide: `./skills/NotebookLMSynthesis.md`
- Integration Guide: This file

### Community
- GitHub Issues: Report bugs and request features
- Discord: #quanta-notebooklm channel (coming soon)

### Credits

Based on community MCP implementations:
- [khengyun/notebooklm-mcp](https://github.com/khengyun/notebooklm-mcp)
- [PleasePrompto/notebooklm-mcp-server](https://github.com/PleasePrompto/notebooklm-mcp-server)

Adapted for QuantaCore's multi-agent orchestration architecture.

---

**Version**: 1.0.0
**Last Updated**: 2026-01-14
**Author**: QuantaCore Team
**License**: MIT
