# NotebookLM MCP Integration - Quick Start Guide

## What You Have Now

A **complete, production-ready integration** that exposes all of Google NotebookLM's advanced research capabilities to your QuantaCore agents.

---

## ⚡ Quick Setup (5 Minutes)

### 1. Install MCP Server Dependencies

```bash
cd mcp-servers/notebooklm
npm install
npm run build
```

### 2. Authenticate with Google NotebookLM

**First-time only (with browser visible):**

```bash
NOTEBOOKLM_HEADLESS=false npm start
```

1. Chrome window opens
2. Sign in to Google account with NotebookLM access
3. Server saves cookies → `notebooklm-cookies.json`
4. Press Ctrl+C after authentication

**Future runs (headless):**

```bash
npm start
```

Or leave it running in the background while using QuantaCore.

### 3. Enable in QuantaCore UI

1. Launch QuantaCore in your browser
2. Click **"MCP Connectors"** in the sidebar
3. Find **"NotebookLM Neural Bridge"**
4. Toggle status from `disconnected` → **`active`**

### 4. Access NotebookLM

Click **"NotebookLM"** in the sidebar (purple icon) → Start creating notebooks!

---

## 🎯 What You Can Do Now

### Create Research Notebooks
- Click "New Notebook" button
- Auto-creates from your LTM sources
- Organized by strategy, asset class, or project

### Ask Questions with Citations
```
Question: "What are the key microstructure patterns in ES futures?"
Answer: [Detailed response with citations to specific PDFs/URLs]
```

### Generate Content
- **Briefings**: Executive summaries for trading strategies
- **Study Guides**: Organized learning materials
- **FAQs**: Common questions extracted from docs
- **Comparison Tables**: Side-by-side analysis
- **Flashcards**: 20-50 cards at various difficulty levels
- **Quizzes**: 10-20 questions with answer keys
- **Podcasts**: 2-5 minute audio overviews (takes ~3 min to generate)

### Manage Sources
- Add PDFs, URLs, YouTube videos, or text
- Auto-sync from your LTM (Sovereign Memory)
- Remove or organize sources

---

## 🤖 For Agents (Optional Advanced Usage)

### Enable NotebookLM Skill for an Agent

**Example: DeepAgent**

1. Go to **Settings** → **Agent Configuration**
2. Find your agent's config
3. Add `'notebooklm'` to skills array:

```javascript
{
  "DeepAgent": {
    "prompt": null,
    "skills": ["search", "notebooklm"]  // Added 'notebooklm'
  }
}
```

4. Save

Now DeepAgent can use NotebookLM tools during its research loop!

### Agent Integration Example

```typescript
// Agents can call NotebookLM directly
import { getNotebookLMBridge } from './services/notebookLMMCPBridge';

const bridge = getNotebookLMBridge();
const notebook = await bridge.createNotebook("ES Strategy Analysis");
await bridge.addSourcesFromLTM(relevantSources, notebook.id);

const response = await bridge.chatWithNotebook(
  "Summarize risk factors with citations"
);

console.log(response.answer); // Cited answer
console.log(response.citations); // Source references
```

---

## 📊 Capabilities Overview

### 12 Tools Available

| Category | Tools |
|----------|-------|
| **Notebook Mgmt** | create_notebook, list_notebooks, navigate_to_notebook, get_notebook_metadata |
| **Source Control** | add_source, list_sources, remove_source |
| **Analysis** | chat_with_notebook |
| **Generation** | generate_briefing, generate_flashcards, generate_quiz, generate_podcast |

### Token Costs (Estimates)

| Operation | Tokens | Time |
|-----------|--------|------|
| List notebooks | ~5 | <1s |
| Create notebook | ~15 | 2-3s |
| Add source | ~10 | 2-5s |
| Chat query | ~25 | 3-8s |
| Generate briefing | ~40 | 10-30s |
| Generate podcast | ~50 | 2-5min |

---

## 🔧 Troubleshooting

### "NotebookLM connector not active"
→ Go to MCP Connectors, toggle to "Active"

### "Authentication required"
→ Run `NOTEBOOKLM_HEADLESS=false npm start` and sign in again

### MCP server not responding
```bash
# Check if running
ps aux | grep notebooklm

# Restart server
cd mcp-servers/notebooklm
npm start
```

### "Notebook not found"
→ Use `listNotebooks()` to get valid IDs first

---

## 📚 Documentation

- **Full Integration Guide**: `NOTEBOOKLM_INTEGRATION.md`
- **Skill Protocol**: `skills/NotebookLMSynthesis.md`
- **MCP Server Docs**: `mcp-servers/notebooklm/README.md`

---

## 🎨 UI Features

### NotebookLM Panel (4 Tabs)

1. **Notebooks Tab**
   - View all notebooks
   - Create new notebooks
   - Select notebook to work with

2. **Chat Tab**
   - Ask questions about sources
   - Get cited answers
   - Option: Include all notebooks in query

3. **Generate Tab**
   - Select format (summary, briefing, flashcards, etc.)
   - Add custom prompts
   - Download audio podcasts

4. **Sources Tab**
   - View all sources in current notebook
   - See source type (PDF, URL, YouTube, etc.)
   - Manage sources

---

## 🚀 Example Workflows

### Trading Strategy Analysis

1. Create notebook: "ES Microstructure Q1 2026"
2. Add sources: PDFs from research, URLs to reports
3. Ask: "What are the entry/exit signals identified?"
4. Generate: Briefing with actionable insights
5. Archive briefing to LTM for later reference

### Multi-Notebook Cross-Analysis

1. Create notebooks per strategy (ES, NQ, YM)
2. Chat with "Include all notebooks" enabled
3. Ask: "Compare risk-adjusted returns across all strategies"
4. Get comprehensive answer with citations from each notebook

### Study Materials for Learning

1. Create notebook with learning resources
2. Generate 30 flashcards (advanced difficulty)
3. Generate 15-question quiz
4. Generate podcast for audio review
5. Use for daily review sessions

---

## 🔒 Security & Privacy

- **All local**: MCP server runs on your machine
- **Your data**: Notebooks stored in your Google account
- **Sovereign Shield**: No QuantaCore server involvement
- **Cookies**: Stored locally in `notebooklm-cookies.json`
- **Revoke access**: Delete cookie file or via Google account settings

---

## ✨ Tips for Best Results

1. **Focused queries**: Specific questions get better answers
2. **Organize notebooks**: One per strategy/domain for clarity
3. **Batch sources**: Add all relevant docs upfront
4. **Cache notebook IDs**: Store in variables for repeated use
5. **Archive content**: Save generated briefings to LTM
6. **Async podcasts**: Don't wait - generate in background

---

## 📈 Next Steps

1. ✅ **Set up MCP server** (5 min)
2. ✅ **Create first notebook** (1 min)
3. ✅ **Try a chat query** (test citations)
4. ✅ **Generate a briefing** (test synthesis)
5. ✅ **Enable for agents** (optional)

---

**Ready to go!** 🎉

Your QuantaCore system now has NotebookLM's advanced research synthesis capabilities fully integrated and accessible from the sidebar.

**Branch**: `claude/notebooklm-mcp-integration-qmDZ1`
**Latest Commit**: `41cd960`
**Documentation**: See `NOTEBOOKLM_INTEGRATION.md` for comprehensive details
