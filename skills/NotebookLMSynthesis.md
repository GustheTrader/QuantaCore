# NEURAL SKILL: NOTEBOOKLM SYNTHESIS PROTOCOL (V1.0)

## ACTIVATION COMMAND
`skill: notebooklm`

## CORE CAPABILITY
Access Google NotebookLM's advanced document analysis, citation-backed answers, and multi-format content generation directly through QuantaCore's MCP integration.

---

## WHAT NOTEBOOKLM PROVIDES

### 1. SOURCE-GROUNDED INTELLIGENCE
- Analyze multiple documents (PDFs, URLs, text, YouTube) simultaneously
- Get answers with precise citations to source material
- Cross-reference insights across research collections
- Maintain full source traceability

### 2. STRUCTURED SYNTHESIS FORMATS
- **Briefing Documents**: Executive summaries with key takeaways
- **Study Guides**: Organized learning materials with hierarchies
- **FAQ Generation**: Common questions extracted from sources
- **Comparison Tables**: Side-by-side analysis of concepts
- **Flashcards**: Q&A format for knowledge retention
- **Quizzes**: Test questions with answer keys
- **Audio Podcasts**: Conversational overviews of material

### 3. MULTI-NOTEBOOK ORCHESTRATION
- Create notebooks per strategy, asset class, or research domain
- Query across notebooks for cross-domain insights
- Organize trading research, market analysis, and risk studies separately
- Auto-sync sources from QuantaCore's LTM to NotebookLM

---

## WHEN TO USE NOTEBOOKLM VS NATIVE SME

### USE NOTEBOOKLM FOR:
- **Deep document analysis** requiring citation precision
- **Multi-source synthesis** (5+ documents) with cross-referencing
- **Structured output generation** (briefings, study materials, audio)
- **Long-term research organization** across multiple sessions
- **Trading strategy documentation** requiring source traceability
- **Regulatory/compliance research** needing audit trails

### USE NATIVE SME FOR:
- **Quick queries** not requiring source verification
- **Real-time reasoning** without document dependency
- **Code generation** and technical implementation
- **Conversational exploration** of ideas
- **Rapid iteration** on concepts

---

## TOOL CATALOG

### Notebook Management
```
notebooklm_create_notebook
  → title: "ES Microstructure Q1 2026"
  → initialSources: ["https://research.example.com/report.pdf"]

notebooklm_list_notebooks
  → Returns: All notebooks with metadata

notebooklm_get_metadata
  → notebookId: "nb_abc123"
  → Returns: Title, source count, dates
```

### Source Control
```
notebooklm_add_source
  → notebookId: "nb_abc123"
  → sourceType: "url" | "file" | "youtube" | "text"
  → content: <URL or text>
  → title: "Optional descriptive title"

notebooklm_list_sources
  → notebookId: "nb_abc123"
  → Returns: All sources with metadata
```

### Analysis & Chat
```
notebooklm_chat
  → notebookId: "nb_abc123"
  → question: "What are the key risk factors?"
  → includeAllNotebooks: false
  → Returns: Answer + citations
```

### Content Generation
```
notebooklm_generate_briefing
  → notebookId: "nb_abc123"
  → format: "summary" | "briefing" | "study-guide" | "faq" | "table"
  → customPrompt: "Focus on quantitative metrics"

notebooklm_generate_flashcards
  → notebookId: "nb_abc123"
  → count: 30
  → difficulty: "basic" | "intermediate" | "advanced"

notebooklm_generate_quiz
  → notebookId: "nb_abc123"
  → questionCount: 15
  → questionType: "multiple-choice" | "short-answer" | "mixed"

notebooklm_generate_podcast
  → notebookId: "nb_abc123"
  → focusTopics: ["Volatility", "Regime shifts"]
  → tone: "conversational" | "educational" | "professional"
```

---

## INTEGRATION PATTERNS FOR AGENTS

### Pattern 1: Research Pipeline Automation
```typescript
// Deep Agent creates notebook during research phase
const notebook = await createNotebook("Deep Dive: NFP Impact on ES Futures");

// Add all discovered sources
for (const source of discoveredSources) {
  await addSource(notebook.id, "url", source.url);
}

// Generate briefing for user
const brief = await generateBriefing(notebook.id, "briefing",
  "Summarize NFP's historical impact on ES with quantitative metrics");
```

### Pattern 2: Cross-Strategy Insights
```typescript
// Council queries all strategy notebooks
const insights = await chatWithNotebook({
  question: "Compare risk-adjusted returns across all strategies",
  includeAllNotebooks: true
});

// Returns cited analysis from all research collections
```

### Pattern 3: Study Material Generation
```typescript
// Generate learning materials from strategy research
const flashcards = await generateFlashcards(notebookId, 50, "advanced");
const quiz = await generateQuiz(notebookId, 20, "mixed");

// Agents can use these for self-reflection or user education
```

### Pattern 4: Audio Summaries for User
```typescript
// Generate podcast overview of weekly research
const podcast = await generatePodcast(notebookId, {
  focusTopics: ["Top trades", "Risk events", "Market regime"],
  tone: "professional"
});

// User gets audio summary of week's analysis
```

---

## COST & PERFORMANCE

### Token Usage
- **List operations**: ~5 tokens
- **Add source**: ~10 tokens
- **Chat query**: ~25 tokens
- **Briefing generation**: ~40 tokens
- **Flashcards/Quiz**: ~30-35 tokens
- **Podcast generation**: ~50 tokens (+ processing time)

### Latency
- **Chat queries**: 3-8 seconds
- **Briefing generation**: 10-30 seconds
- **Podcast generation**: 2-5 minutes (async recommended)

### Best Practices
- **Batch source additions** instead of one-at-a-time
- **Cache notebook IDs** to avoid repeated lookups
- **Use focused queries** rather than open-ended exploration
- **Archive generated content** to LTM for long-term storage

---

## AGENT WORKFLOW EXAMPLES

### DeepAgent Integration
```
1. RECALL PHASE → Check if notebook exists for this query domain
2. PLANNING PHASE → Determine if NotebookLM synthesis is needed
3. SEARCH PHASE → Add discovered sources to NotebookLM notebook
4. ANALYSIS PHASE → Query NotebookLM for cross-source insights
5. SYNTHESIS PHASE → Generate briefing + archive to LTM
```

### Council Integration
```
1. Proposer → Creates research notebook with strategy sources
2. Critics → Each queries notebook for weaknesses in their domain
3. Judge → Generates comparison table across all critiques
4. Board → Produces final briefing for user with citations
```

### Projects Integration
```
1. User uploads documents to Project workspace
2. Agent creates NotebookLM notebook for Project
3. Auto-syncs Project files as NotebookLM sources
4. Provides Project-scoped Q&A with citations
5. Generates study guides for onboarding new Project members
```

---

## ACTIVATION CHECKLIST

### Prerequisites
- [ ] NotebookLM MCP connector enabled in Settings
- [ ] MCP server running (`node mcp-servers/notebooklm/dist/index.js`)
- [ ] Google account authenticated (cookies saved)
- [ ] Agent has `notebooklm` skill enabled

### Verification
```bash
# Check connector status
localStorage.getItem('quanta_mcp_connectors')
# Should show NotebookLM connector with status: 'active'

# Test connection
await getNotebookLMBridge()?.listNotebooks()
# Should return array of notebooks or empty array (no error)
```

### Troubleshooting
- **"NotebookLM connector not active"** → Enable in MCP Connectors UI
- **"Authentication required"** → Run MCP server with NOTEBOOKLM_HEADLESS=false
- **"Tool not found"** → Ensure toolRegistry.registerNotebookLMTools() was called
- **"Notebook not found"** → Verify notebook ID or use listNotebooks() first

---

## SECURITY & SOVEREIGNTY

### Data Flow
```
QuantaCore Agent → MCP Bridge (local) → MCP Server (local) → NotebookLM (Google)
```

### Sovereign Shield Mode
- When enabled, NotebookLM requests go through local MCP server only
- No data stored on QuantaCore servers
- Google authentication handled via browser cookies (user-controlled)
- Sources remain in user's Google account under their control

### Privacy Considerations
- NotebookLM sources are **user's Google data**, not QuantaCore's
- Citations and analysis stay within user's NotebookLM workspace
- Agent only accesses what user explicitly adds to notebooks
- No training data extraction from user's research

---

## NEURAL SKILL TERMINATION

To disable NotebookLM for an agent:
```
Settings → Agent Configuration → Remove 'notebooklm' skill
```

To disconnect MCP server:
```
MCP Connectors → NotebookLM Neural Bridge → Disconnect
```

---

**PROTOCOL VERSION**: 1.0
**LAST UPDATED**: 2026-01-14
**COMPATIBLE AGENTS**: All SME agents, DeepAgent, Council, Projects
**SKILL CATEGORY**: Synthesis, Research, Documentation
