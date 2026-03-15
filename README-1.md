# OpenNoesis 🧠⚡

> **OpenFang Agent OS × AgentOS Research Paper**  
> Upgrading a production-grade Rust Agent OS with a cognitive memory kernel backed by Redis + Memgraph graph knowledge

---

## What Is This?

OpenNoesis merges two systems:

| Source | What It Is | What We Take |
|--------|-----------|--------------|
| **[OpenFang](https://github.com/GustheTrader/Noesisopenfang)** | Open-source Agent OS in Rust. 14 crates, 137K LOC. Autonomous Hands, 40 channel adapters, 27 LLM providers, single binary. | The runtime, agent loop, tools, Hands system, channel adapters, security |
| **[AgentOS Paper](AgentOS.pdf)** | Research paper proposing an LLM-Centric OS kernel: S-MMU, Semantic Slicing, Cognitive Memory Hierarchy (L1/L2/L3), Reasoning Kernel | The cognitive architecture: semantic memory management, context abstraction, reasoning control blocks |

**Upgrade Layer** (what OpenNoesis adds):
- **Redis Stack** → L2 Semantic RAM (fast addressable semantic space + vector search)
- **Memgraph** → L3 Persistent Knowledge Graph (entity relationships, multi-hop GraphRAG)
- **Graph Video Coding** → Visual knowledge extraction pipeline (video → knowledge graph nodes)

---

## Architecture

```
╔══════════════════════════════════════════════════════════════════════════╗
║                        OPENNOESIS SYSTEM                                 ║
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────┐    ║
║  │                    OPENFANG RUNTIME (Rust)                       │    ║
║  │                                                                   │    ║
║  │  openfang-kernel   Orchestration, workflows, RBAC, scheduler     │    ║
║  │  openfang-runtime  Agent loop, 53 tools, WASM sandbox, MCP      │    ║
║  │  openfang-hands    7 autonomous Hands (Researcher, Lead, etc.)   │    ║
║  │  openfang-api      140+ REST/WS/SSE endpoints, OpenAI-compat     │    ║
║  │  openfang-channels 40 platform adapters (Telegram, Discord...)   │    ║
║  │  openfang-memory   SQLite persistence, vector embeddings ←──┐   │    ║
║  └──────────────────────────────────────────┬────────────────────│───┘    ║
║                                             │  (memory replaced)  │        ║
║  ┌──────────────────────────────────────────▼────────────────────┐│       ║
║  │              AGENTOS COGNITIVE KERNEL (Python)                  ││       ║
║  │                                                                  ││       ║
║  │  Context Abstraction Layer (CAL)                                 ││       ║
║  │    └─ Semantic Slicing: segment context into addressable units   ││       ║
║  │                                                                  ││       ║
║  │  Reasoning Control Block (RCB)                                   ││       ║
║  │    └─ Cognitive state, attention focus, tool-call registry       ││       ║
║  │                                                                  ││       ║
║  │  Cognitive Memory Hierarchy (CMH)         ◄───────────────────┘│       ║
║  │    ├─ L1: KV-Cache (in-context, fastest)                        │       ║
║  │    ├─ L2: Redis Stack (Semantic RAM, vector search) ←───────────│       ║
║  │    └─ L3: Memgraph (Persistent Knowledge Graph) ←───────────────┘       ║
║  │                                                                          ║
║  │  Conflict Resolution Engine (CRE)                                        ║
║  │    └─ Multi-agent cognitive drift detection & alignment (SKA)            ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                                                                              ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │              GRAPH VIDEO CODING PIPELINE                              │  ║
║  │                                                                        │  ║
║  │  Video/Media Input → Frame Extraction → Visual Entity Recognition     │  ║
║  │       → Knowledge Graph Updates → Memgraph Storage → GraphRAG         │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Project Structure

```
OpenNoesis-OS/
│
├── README.md                        # This file
├── AGENTS.md                        # 3-layer agent operating instructions
├── .env.example                     # Environment variables template
├── docker-compose.yml               # Redis Stack + Memgraph + Memory API
├── requirements.txt                 # Python dependencies
│
├── research/
│   ├── AgentOS_summary.md           # Summary of AgentOS paper architecture
│   ├── openfang_integration.md      # OpenFang ↔ AgentOS merge strategy
│   └── references.bib
│
├── cognitive_kernel/                # AgentOS cognitive architecture (Python)
│   ├── __init__.py
│   ├── context_abstraction.py       # CAL: Semantic Slicing + Semantic Anchors
│   ├── reasoning_control_block.py   # RCB: Per-agent cognitive state tracking
│   ├── memory_hierarchy.py          # CMH: L1/L2/L3 cognitive memory manager
│   ├── conflict_resolution.py       # CRE: Multi-agent alignment protocol
│   └── kernel_syscalls.py           # KSC: sys_run_tool / sys_read_mem / sys_write_context
│
├── memory/                          # L2/L3 memory backends
│   ├── __init__.py
│   ├── l2_redis.py                  # L2: Redis Semantic RAM (vector search, KV)
│   ├── l3_graph.py                  # L3: Memgraph knowledge graph (entities, edges)
│   └── memory_manager.py            # Unified CMH orchestrator (L1→L2→L3 promotion)
│
├── graph_knowledge/                 # Graph knowledge + GraphRAG
│   ├── __init__.py
│   ├── graph_engine.py              # Memgraph client, entity upsert, traversal
│   ├── graph_rag.py                 # GraphRAG: semantic → graph retrieval pipeline
│   └── schemas/
│       └── base_schema.cypher       # Base Cypher schema for entity/relationship types
│
├── graph_video_coding/             # Graph Video Coding pipeline
│   ├── __init__.py
│   ├── frame_extractor.py          # Extract frames from video at key intervals
│   ├── visual_entity_recognizer.py # Vision LLM → entity/relationship extraction
│   ├── video_to_graph.py           # Full pipeline: video → Memgraph knowledge nodes
│   └── codecs/
│       └── scene_graph_codec.py    # Encode/decode scene graph representations
│
├── openfang_bridge/                 # OpenFang ↔ AgentOS cognitive kernel bridge
│   ├── __init__.py
│   ├── memory_adapter.py            # Replace openfang-memory with CMH (L2/L3)
│   ├── hand_hooks.py                # Inject cognitive kernel into Hand lifecycle
│   ├── rcb_middleware.py            # Wrap agent loop with RCB state tracking
│   └── api_extensions.py           # New endpoints: /v1/memory, /v1/graph, /v1/rcb
│
├── directives/                      # Layer 1: SOPs
│   ├── cognitive_kernel.md          # How to use the AgentOS cognitive kernel
│   ├── memory_management.md         # How to use L1/L2/L3 memory hierarchy
│   ├── graph_knowledge.md           # How to build and query the knowledge graph
│   └── graph_video_coding.md        # How to extract knowledge from video
│
└── execution/                       # Layer 3: Deterministic scripts
    ├── run_agent.py                 # Run the OpenNoesis agent (full stack)
    ├── build_graph.py               # Build knowledge graph from documents
    ├── process_video.py             # Process video → graph knowledge pipeline
    ├── query_memory.py              # Query L2/L3 memory hierarchy
    └── check_stack.py               # Health check all services (Redis, Memgraph, API)
```

---

## The Key Upgrade: Replacing openfang-memory

OpenFang ships with `openfang-memory`: SQLite persistence + basic vector embeddings.

OpenNoesis replaces/augments this with the **AgentOS Cognitive Memory Hierarchy**:

```
AgentOS CMH                    OpenNoesis Backend
─────────────────              ──────────────────────────────────
L1: KV-Cache (in-context)  →  Native LLM context window (unchanged)
L2: Semantic RAM           →  Redis Stack (RedisJSON + RediSearch vectors)
L3: Persistent Store       →  Memgraph (entity graph + long-term knowledge)
```

### What This Unlocks

| Feature | OpenFang (before) | OpenNoesis (after) |
|---------|-------------------|-------------------|
| Memory scope | Session SQLite | Cross-session Redis vector search |
| Retrieval | Exact/recency | Semantic similarity (cosine) |
| Knowledge structure | Flat text | Entity-relationship graph |
| Multi-hop reasoning | ✗ | ✓ GraphRAG traversal |
| Video knowledge | ✗ | ✓ Graph Video Coding pipeline |
| Cognitive state | Implicit | RCB: explicit per-agent state tracking |
| Multi-agent alignment | ✗ | CRE: Conflict Resolution Engine |

---

## Graph Video Coding

A new pipeline not in either source project — extracting **structured knowledge from video**:

```
Video File / Stream
      ↓
Frame Extraction (key frames at scene boundaries)
      ↓
Vision LLM Analysis (GPT-4V / Gemini Vision)
      ↓  "Person A is talking to Person B about Topic C"
      ↓  "Object X appears in Location Y"
Entity + Relationship Extraction
      ↓
Memgraph Knowledge Graph Update
      ↓
Available for GraphRAG queries (next time agent is asked about the video)
```

---

## Quick Start

```bash
# 1. Start the Redis + Memgraph backend stack
docker compose up -d

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Copy and configure environment
cp .env.example .env
# Edit .env with your API keys

# 4. Health check
python execution/check_stack.py

# 5. Run the agent
python execution/run_agent.py
```

**OpenFang binary** (separate, get from upstream):
```powershell
irm https://openfang.sh/install.ps1 | iex
openfang init
openfang start
```

---

## Source Projects

| Project | Repo | License |
|---------|------|---------|
| OpenFang | [GustheTrader/Noesisopenfang](https://github.com/GustheTrader/Noesisopenfang) | MIT |
| AgentOS Paper | `AgentOS.pdf` | Research (cite as: *Architecting AgentOS*, 2025) |
| Redis Agent Memory | [redis/agent-memory-server](https://github.com/redis/agent-memory-server) | Apache 2.0 |
| OpenNoesis additions | This repo | MIT |

---

## Operating Principles

Follow the 3-layer architecture in `AGENTS.md`:
1. **Layer 1 (Directives)**: Read `/directives/` SOPs before acting
2. **Layer 2 (Orchestration)**: You are the decision-maker — route intelligently
3. **Layer 3 (Execution)**: Run scripts in `/execution/` — don't do manually what code can do deterministically

**Self-anneal**: Fix errors → update the script → test → update the directive.
