
/**
 * Downloadable product whitepaper, updated for the Hindsight–Gnoesis memory
 * architecture and the proposed conditional FPT-Omega routing design.
 */
export const WHITEPAPER_TEXT = `
THE SOVEREIGN INTELLIGENCE REVOLUTION
BUILDING A PRIVATE, AUDITABLE AI COUNCIL
A White Paper on Data Sovereignty, Persistent Memory, and First-Principles Reasoning

Version 1.3 | September 2026
Author: Quanta-OS Research Initiative

ABSTRACT
Quanta-OS is designed to combine operator-controlled data, persistent agent memory, and specialized reasoning. This revision defines the Hindsight–Gnoesis Neural Core: an architecture that can connect an Obsidian vault to a local memory service, retrieve source-linked context, and refresh synthesized knowledge. It summarizes Hindsight Memory Defense as an opt-in, per-bank safeguard for future writes. It also defines a conditional FPT-Omega route for deep research, novel problem solving, and cross-domain SME collaboration in engineering, physics, quantum physics, and metaphysics. The automatic route is an explicit design target; it must not be presented as operational until its runtime adapter, evidence checks, and deployment are validated.

1. EXECUTIVE SUMMARY
Sovereign intelligence is a property of the whole system: where source data resides, which services receive it, how claims are derived, and who can review changes. A local interface alone does not make a system private if an external model provider receives vault content. Quanta-OS therefore treats provider selection and data egress as explicit deployment choices.

The memory architecture has four responsibilities:
• Preserve the operator's source of truth and provenance.
• Retrieve relevant memories through semantic, keyword, and entity relationships.
• Keep supported facts distinct from time-varying observations, assumptions, and hypotheses.
• Invoke expensive first-principles and expert collaboration only when a versioned router gate says the task warrants it.

2. SOVEREIGNTY AND DATA FLOW
The intended local deployment uses Obsidian as the canonical note store, a one-way sync process to send selected note changes to Hindsight, and a persistent Hindsight data volume for agent memory. The vault remains the source of truth. The sync process should mount the vault read-only and exclude application metadata and trash folders.

The Hindsight–Gnoesis flow is:
1. Retain: ingest source material and extract candidate memories with source identifiers.
2. Index: make retained context available through semantic vectors, full-text search, and entity relationships.
3. Recall: retrieve relevant passages and return their provenance to the requesting agent.
4. Consolidate: reconcile new evidence with existing facts and observations while preserving change history.
5. Refresh: update synthesized mental models and knowledge pages from reviewed memory.

Local storage does not, by itself, guarantee local inference. Before any vault text is sent to an external model provider, the provider, data path, and intended use must be explicit. A local model is the preferred path for private vault content when available. If no approved provider is configured, memory operations that require model inference should fail clearly rather than silently fall back to a cloud service.

2.1 PER-BANK MEMORY DEFENSE
Memory Defense is a bank-level policy, not an automatic global scrubber. It remains off for a bank until a policy enables the sensitive-data rule. When enabled, each future retain item is scanned before persistence. A configured action can replace a recognized match with a marker such as [REDACTED:github_token], or reject the affected item when blocking is supported by the deployed version.

The stored memory and document body contain the scrubbed text, so later recall, export, and reflect operations use the redacted version. The scanner covers known patterns for credentials, API keys, database connection strings, private keys, tokens, and common PII formats; pattern coverage is not exhaustive and should not be treated as a guarantee that every secret will be found.

A policy change affects only future retain calls for that bank. It does not rescan existing memories. Existing content that may contain a secret needs a separately planned rescan or re-ingestion workflow. Redaction or blocking decisions can appear in an audit log when audit logging is enabled; webhook alerts require a bank webhook subscribed to the relevant event. These logging and notification controls are not implied by enabling the screening rule alone.

3. CONDITIONAL FPT-OMEGA ROUTER
FPT-Omega is a reasoning method, not a source of truth. It should be inserted at the Facts and Observations processing boundary as an optional route behind a smart gate. It should not run merely because a query contains a domain word.

The router should require both:
• A relevant domain: engineering, physics, quantum physics, or metaphysics; and
• A task class that benefits from deeper work: deep research, a genuinely novel solution, or cross-domain SME collaboration.

Ordinary factual questions, simple recall, and routine note updates remain on the normal Hindsight path. The gate should record its version, decision, and concise reason. Its eligibility threshold should be calibrated on representative tasks before production use rather than chosen as an unvalidated magic number.

When selected, FPT-Omega should:
1. State the problem boundary and define ambiguous terms.
2. Separate retrieved evidence from assumptions, constraints, and open questions.
3. Reduce the problem to explicit primitives and domain constraints.
4. Derive candidate explanations or designs with an auditable chain of support.
5. Identify contradictions, dimensional or mathematical errors, failure modes, and tests that could falsify the result.
6. Send cross-domain work to named SME roles for critique and evidence review before memory is refreshed.

Metaphysical or philosophical claims must be labeled as conceptual or interpretive unless they have independent empirical support. A first-principles derivation can expose assumptions and improve reasoning; it cannot turn an unsupported premise into an established fact.

4. FACTS, OBSERVATIONS, AND DERIVATIONS
Facts should contain claims supported by identifiable source material or verified measurements. Each fact should retain source references, timestamps, and enough context to re-check the claim.

Observations should represent time-aware beliefs, changes, reconciliations, and derived interpretations. Every observation should carry an evidence class such as supported, derived, assumption, hypothesis, or unresolved. A derived claim must link to its premises and source IDs. Contradictions should be recorded as changes or unresolved conflicts, not silently overwritten.

FPT-Omega output should first be staged as a derivation or hypothesis. It may update an Observation with its provenance and review status. It must not be promoted to a source-backed Fact solely because the reasoning trace is coherent. Novel or cross-domain conclusions require relevant SME review and supporting evidence before promotion.

5. SME COLLABORATION AND VALIDATION
For eligible research, use explicit roles: a domain proposer, a cross-domain critic when needed, and an evidence verifier. Each role should receive the same scoped question and cited context, while recording its domain and method. The verifier checks whether claims follow from the cited material; it does not treat majority agreement as proof.

Before a result refreshes durable knowledge, validate source relevance, assumptions, units and dimensions where applicable, mathematical consistency, alternative explanations, and the proposed falsification checks. If evidence is weak or experts disagree, preserve the disagreement and mark the result unresolved. The system should abstain from asserting a settled answer when the evidence does not support one.

6. PRODUCTION CONTROLS
The router and FPT-Omega adapter should be versioned and observable. Keep an audit record containing the route decision and reason, source IDs, engine and prompt versions, model/provider identifier, evidence classes, SME decisions, timestamps, and resulting memory IDs. Avoid storing unnecessary sensitive note text in operational logs.

Bound each routed run by time, token or compute budget, concurrency, and retry limits. Make updates idempotent so retries cannot duplicate memories. On timeout, provider failure, or failed validation, preserve the original source and return to the normal recall path or mark the candidate unresolved. Never let a failing FPT route block ordinary memory access.

Evaluate the gate separately from the reasoning engine: measure unnecessary routes, missed eligible tasks, provenance retention, contradiction handling, reviewer agreement, and latency/cost. Keep the threshold and policy under version control and compare changes against a held-out set of representative tasks.

7. IMPLEMENTATION STATUS AND OPERATING BOUNDARY
The landing-page map and this paper define the target architecture. They do not certify that automatic FPT-Omega routing has been wired into Hindsight's runtime. The existing manual FPT capability is a separate control path until a production adapter and its checks are connected and verified. Similarly, an Obsidian sync container is not proof that note ingestion or model-backed consolidation is healthy.

The deployment should expose local services only on loopback by default, persist memory in a named volume, and show clear health and provider status. Configure Memory Defense per bank when its policy is wanted; do not imply that screening is enabled simply because the extension is present. External inference must remain disabled until an explicit provider is configured for the intended data flow. This preserves operator control while the production route is evaluated.

8. BRAIN, HANDS AND NERVOUS SYSTEMS
The product is organized around a practical operating model. Brain contains model and inference connections. Hands contains the agents that use those models to carry out reasoning tasks. Nervous Systems contains the Gnoesis Neural Core, orchestration, connectors, memory paths and telemetry. Sovereign Trust contains the operator's knowledge, projects, privacy controls and output ownership workflows. The product banner reads "Sovereign SI / Brain - Hands - Nervous Systems / -4 Agents and Agentic Systems." on three lines; operational role selection currently offers eight agents.

The eight roles are Personal Agent, Consumer Agent, Business Agent, Trading Agent, Education Agent, Guest Agent, Investing Agent and Personal Growth Agent. Activating a role opens its full control plane. Chat supports conversation; Work uses bounded planning, drafting and review stages. Each run freezes its chosen provider and model, exposes progress and stop controls, preserves completed stages and allows a Markdown export. A model's review is a second reasoning pass, not independent empirical verification. Work produces proposed deliverables; this control plane does not execute shell commands, change project source files, place trades or take external actions.

9. OPEN MODEL CONNECTIONS AND LOCAL API
Text agents can connect through OpenAI-compatible endpoints, local Ollama, Ollama Cloud, OpenRouter, Fireworks AI and OmniRoute, alongside the existing Gemini, Groq and Novita integrations. Model catalogs are loaded from the selected provider rather than represented as a fixed list. Provider-specific tools, modalities and availability vary; a model listing does not imply every model supports chat, web search, JSON output or the same context length. Dedicated realtime voice, image and video integrations retain their existing Gemini path.

The local server exposes a scoped OpenAI-compatible API at /v1: model discovery and chat completions, including upstream streaming. It requires a separate local Bearer key and is bound to loopback by default. This is a supported subset, not a claim of implementing the full OpenAI API. Configured model aliases select the provider explicitly. Requests do not silently fall back to a different provider.

New connector keys are stored by the local server, encrypted with Windows CurrentUser credential protection on Windows. Public settings responses return key-presence indicators, not secrets. Other platforms use a local encryption key protected by filesystem permissions. This does not establish that legacy integrations, environment variables, browser storage or third-party gateways have equivalent protections. Endpoint validation allows plain HTTP only on loopback; hosted connections use HTTPS.

10. DATA AND OUTPUT CONTROL
Control-plane conversations, attached text files, task records and exports remain in browser-local storage unless the operator submits their context to a selected inference provider. Files and project context are scoped and bounded; notebook retrieval is explicitly selected for the control-plane run. Local Ollama stays on a loopback inference endpoint. Cloud inference receives the submitted prompt and selected context, while OmniRoute follows its own upstream routing configuration. Data locality therefore depends on the route actually used, not only the location of the user interface.

The Neural Core console reports local HTTP availability separately from provider configuration. Neither is proof of model inference readiness, a healthy Obsidian ingestion pipeline or an enabled Memory Defense policy. Hindsight inference and vault synchronization must be configured for their own deployment. The conditional FPT-Omega memory route remains the target architecture described above until a runtime adapter and evidence checks are implemented and validated.

CONCLUSION
The Hindsight–Gnoesis Neural Core makes memory traceable; per-bank Memory Defense screens new writes when enabled; and the conditional FPT-Omega route makes deeper reasoning available when the problem merits it. Keeping facts, observations, hypotheses, provenance, and expert review distinct gives the system room to explore novel ideas without confusing a plausible derivation with verified knowledge.

---
End of Document
`;
