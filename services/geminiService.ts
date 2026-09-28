
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { SourceNode, ChatMessage, ReflectionResult, ComputeProvider, ContextOptimizationData } from "../types";
import { syncMemoryToSupabase, logReflection, archiveAndActivatePrompt, fetchMemoriesFromSupabase, cloudStorageEnabled } from "./supabaseService";
import { chatWithOpenAICompatible } from "./groqService";
import { deductCloudCredits, checkHasCredits } from "./creditService";
import { FPT_SYSTEM_PROMPT } from "./fptContent";
import { createTrace, scoreTrace } from "./langfuseService";
import { AGENT_TRACKS, getAgentTrack } from '../lib/agent-tracks';
import { getPreferredProvider, isCompatibleProvider } from '../lib/inference-providers';
import { completeWithProvider } from './inferenceService';
import { getLocalGeminiApiKey } from './browserCredentials';

const getAI = () => {
  const apiKey = getLocalGeminiApiKey();
  if (!apiKey) throw new Error("Configure Gemini in Settings, or select a configured model connection.");
  return new GoogleGenAI({ apiKey });
};

const gmailTool: FunctionDeclaration = {
  name: "interact_with_gmail",
  parameters: {
    type: Type.OBJECT,
    description: "Search, read, or send emails via SME neural bridge.",
    properties: {
      action: { type: Type.STRING, enum: ["search", "read", "send"], description: "The action to perform." },
      query: { type: Type.STRING, description: "Search query or email recipient." },
      body: { type: Type.STRING, description: "The content of the email to send." }
    },
    required: ["action"]
  }
};

const handleGeminiError = (e: any) => {
  console.error("Gemini API Error:", e);
  if (e.message?.includes('429') || e.status === 429 || e.message?.includes('RESOURCE_EXHAUSTED')) {
    throw new Error("QUOTA_EXCEEDED: You've exceeded your Gemini API quota. Please check your billing details or wait a moment before trying again.");
  }
  throw e;
};

export const safeGenerateContent = async (model: string, contents: any, config?: any, provider: ComputeProvider = getPreferredProvider(), signal?: AbortSignal): Promise<any> => {
  if (isCompatibleProvider(provider)) {
    if (config?.tools?.length) throw new Error('This route does not implement Gemini tools or Google Search. Attach source material, or explicitly choose Gemini for web research.');
    const items = typeof contents === 'string' ? [{ role: 'user', parts: [{ text: contents }] }] : Array.isArray(contents) ? contents : [{ role: 'user', ...contents }];
    const messages = items.map((item: any) => {
      if (item.parts?.some((part: any) => !('text' in part))) throw new Error('This text connection cannot process image, audio or video parts. Use the dedicated media integration.');
      return { role: item.role === 'model' ? 'assistant' : item.role || 'user', content: (item.parts || []).map((part: any) => part.text || '').join('\n') };
    });
    let instruction = config?.systemInstruction || '';
    if (config?.responseMimeType === 'application/json') instruction += `\nReturn valid JSON only.${config.responseSchema ? ` Use this JSON schema: ${JSON.stringify(config.responseSchema)}.` : ''}`;
    if (instruction) messages.unshift({ role: 'system', content: instruction });
    const response = await completeWithProvider(provider, { messages, ...(config?.temperature !== undefined ? { temperature: config.temperature } : {}) }, signal);
    const text = response.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('The selected model did not return text. Choose a chat model in Settings.');
    return { text, usageMetadata: response.usage, candidates: [] };
  }
  if (provider !== 'gemini') throw new Error('Choose a supported text provider in Settings.');
  const ai = getAI();
  return await ai.models.generateContent({
    model,
    contents,
    config: { ...config, ...(signal ? { abortSignal: signal } : {}) }
  }).catch(handleGeminiError);
};

const getTextAI = (provider: ComputeProvider = getPreferredProvider()) => ({ models: { generateContent: ({ model, contents, config }: any) => safeGenerateContent(model, contents, config, provider) } });

/**
 * SOURCE GROUNDING SERVICE
 * Implementation of NotebookLM-style RAG.
 */
export const performSourceGrounding = async (query: string, agentName: string, provider: ComputeProvider = getPreferredProvider(), signal?: AbortSignal, modelOverride?: string): Promise<{ context: string, citations: any[] }> => {
  signal?.throwIfAborted();
  if (isCompatibleProvider(provider) || !cloudStorageEnabled()) {
    let memories: SourceNode[] = [];
    try { memories = JSON.parse(localStorage.getItem('quanta_notebook') || '[]'); } catch {}
    if (!Array.isArray(memories)) return { context: '', citations: [] };
    const words = [...new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) || [])];
    const relevant = memories.filter(memory => !memory.assignedAgents?.length || memory.assignedAgents.includes(agentName) || memory.assignedAgents.includes('All Agents'))
      .map(memory => ({ memory, score: words.reduce((score, word) => score + (String(memory.title).toLowerCase().includes(word) ? 3 : String(memory.content).toLowerCase().includes(word) ? 1 : 0), 0) }))
      .filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 6).map(item => item.memory);
    return {
      context: relevant.map(memory => `[SOURCE ${memory.id}: ${memory.title}]\n${memory.content.slice(0, 2000)}`).join('\n\n'),
      citations: relevant.map(memory => ({ sourceId: memory.id, sourceTitle: memory.title, snippet: memory.content.slice(0, 180) }))
    };
  }
  try {
    const memories = await fetchMemoriesFromSupabase({ agentName }, signal);
    signal?.throwIfAborted();
    if (!memories || memories.length === 0) return { context: "", citations: [] };

    const ai = getAI();
    const prompt = `You are a Knowledge Architect (NotebookLM Logic). 
    GIVEN USER QUERY: "${query}"
    GIVEN SOURCES:
    ${memories.map((m) => `[SOURCE ID: ${m.id} TITLE: ${m.title}]: ${m.content}`).join('\n\n')}
    
    1. Identify the most relevant knowledge blocks.
    2. Extract direct quotes or specific axioms.
    3. Construct a grounded context block.
    4. Return as JSON with citations.`;

    const response = await ai.models.generateContent({
      model: modelOverride || 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        ...(signal ? { abortSignal: signal } : {}),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            context: { type: Type.STRING },
            citations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sourceId: { type: Type.STRING },
                  sourceTitle: { type: Type.STRING },
                  snippet: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    }).catch(handleGeminiError);

    const result = JSON.parse(response.text || '{"context":"", "citations":[]}');
    return result;
  } catch (e: any) {
    signal?.throwIfAborted();
    if (e.name === 'AbortError') throw e;
    if (e.message?.includes('QUOTA_EXCEEDED')) throw e;
    console.error("Source Grounding Error:", e);
    return { context: "", citations: [] };
  }
};

export const getSMEContext = async (agentName: string, profile?: { name: string, callsign: string, personality: string }, query?: string, provider: ComputeProvider = getPreferredProvider(), signal?: AbortSignal, modelOverride?: string) => {
  let activeAgent = AGENT_TRACKS.find(agent => agent.label === agentName);
  if (!activeAgent && typeof localStorage !== 'undefined') {
    try {
      const session = JSON.parse(localStorage.getItem('quanta_session') || 'null');
      if (session?.track) activeAgent = getAgentTrack(session.track);
    } catch {
      // An unreadable local session must not prevent an otherwise valid chat.
    }
  }
  let groundingData = { context: "", citations: [] };
  
  if (query) {
    groundingData = await performSourceGrounding(query, agentName, provider, signal, modelOverride);
  }
  signal?.throwIfAborted();

  const personalityMap: Record<string, string> = {
    ...Object.fromEntries(AGENT_TRACKS.map(agent => [agent.label, agent.instruction])),
    'Analytic Prime': 'Be highly logical, precise, and first-principles driven.',
    'Aetheris Warmth': 'Be conversational, warm, and focused on polymath well-being.',
    'Minimalist Node': 'Be ultra-concise and impactful.',
    'Cyber-Tactician': 'Adopt a high-performance, technical SME tone.',
    'Zen Architect': 'Be calm, philosophical, and focused on architectural first principles.',
    'Quantum Flow': 'Operate in a state of high conscious awareness and cognitive expansion.'
  };

  const userIdentity = profile ? `You are addressing the user as "${profile.callsign}".` : "";
  const personalityInstruction = profile ? personalityMap[profile.personality] || "" : "";

  return {
    knowledgeContext: groundingData.context || "(No active sources relevant to this query.)",
    citations: groundingData.citations,
    identityContext: `${userIdentity} ${personalityInstruction}`,
    fullHeader: `--- SOURCE KNOWLEDGE (GROUNDED) ---\n${groundingData.context || "(No relevant knowledge found.)"}\n\n--- OPERATOR PROFILE ---\n${userIdentity}\n${personalityInstruction}${activeAgent ? `\n\n--- ACTIVE AGENT ROLE ---\n${activeAgent.label}\n${activeAgent.instruction}` : ''}`
  };
};

export const chatWithSME = async (
  message: string, 
  history: {role: string, content: string}[], 
  agentName: string = "Aetheris",
  customPrompt?: string,
  enabledSkills: string[] = ['search'],
  profile?: { name: string, callsign: string, personality: string },
  provider: ComputeProvider = getPreferredProvider(),
  useFPT: boolean = false,
  signal?: AbortSignal,
  includeMemory: boolean = true,
  modelOverride?: string
) => {
  if (provider === 'gemini' && !checkHasCredits('cloud')) {
    throw new Error("Neural Energy Depleted: Refill Cloud Intelligence tokens to continue.");
  }

  signal?.throwIfAborted();
  const ctx = await getSMEContext(agentName, profile, includeMemory ? message : undefined, provider, signal, modelOverride);
  let systemBase = customPrompt || `You are ${agentName}, a Subject Matter Expert (SME). Ground all answers in provided source knowledge. ${ctx.identityContext}`;
  
  // FPT Injection
  if (useFPT) {
    systemBase += `\n\n${FPT_SYSTEM_PROMPT}`;
  }

  const fullSystemInstruction = `${systemBase}\n\n${ctx.fullHeader}`;

  if (isCompatibleProvider(provider)) {
    const response = await chatWithOpenAICompatible(message, history, `${fullSystemInstruction}\nNo live web search is available on this connection. Do not claim to have browsed or executed tools.`, provider, modelOverride, signal);
    let text = response.text;
    let fptAudit;
    if (useFPT) {
      try { const parsed = JSON.parse(text); if (typeof parsed.reconstruction === 'string') { text = parsed.reconstruction; fptAudit = parsed; } } catch {}
    }
    return { ...response, text, citations: ctx.citations, fptAudit };
  }
  if (provider !== 'gemini') throw new Error('Choose a supported text provider in Settings.');

  const ai = getAI();
  const tools: any[] = [];
  if (enabledSkills.includes('search')) tools.push({ googleSearch: {} });

  // If FPT is on, we enforce schema. If not, regular text.
  let config: any = {
    tools: tools.length > 0 ? tools : undefined,
    systemInstruction: fullSystemInstruction
  };

  if (useFPT) {
    config.responseMimeType = "application/json";
    config.responseSchema = {
      type: Type.OBJECT,
      properties: {
        deconstruction: { type: Type.ARRAY, items: { type: Type.STRING } },
        assumptionsRemoved: { type: Type.ARRAY, items: { type: Type.STRING } },
        axioms: { type: Type.ARRAY, items: { type: Type.STRING } },
        reconstruction: { type: Type.STRING }
      },
      required: ["deconstruction", "axioms", "reconstruction"]
    };
  }

  const response = await ai.models.generateContent({
    model: modelOverride || 'gemini-3-flash-preview',
    contents: [
      ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
      { role: 'user', parts: [{ text: message }] }
    ],
    config: { ...config, ...(signal ? { abortSignal: signal } : {}) }
  }).catch(handleGeminiError);

  let finalText = response.text || "";
  let fptAudit = undefined;

  // Handle FPT Parsing
  if (useFPT && finalText) {
    try {
      const parsed = JSON.parse(finalText);
      finalText = parsed.reconstruction;
      fptAudit = {
        deconstruction: parsed.deconstruction || [],
        assumptionsRemoved: parsed.assumptionsRemoved || [],
        axioms: parsed.axioms || [],
        reconstruction: parsed.reconstruction
      };
    } catch (e) {
      console.warn("FPT JSON Parse failed, falling back to raw text.");
    }
  }

  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.filter(chunk => chunk.web)
    ?.map(chunk => ({
      uri: chunk.web?.uri || '',
      title: chunk.web?.title || 'Source'
    })) || [];

  deductCloudCredits(10);

  return {
    text: finalText,
    sources,
    citations: ctx.citations,
    usage: response.candidates?.[0]?.content,
    fptAudit
  };
};

export const reflectAndRefine = async (history: ChatMessage[], currentPrompt: string, agentName: string, provider: ComputeProvider = getPreferredProvider()): Promise<ReflectionResult> => {
  const ai = getTextAI(provider);
  const context = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n---\n');
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Evaluate the SME Agent: ${agentName}.\n\nPROMPT: ${currentPrompt}\n\nHISTORY: ${context}`,
    config: { responseMimeType: "application/json" }
  }).catch(handleGeminiError);
  try { return JSON.parse(response.text || "{}"); } catch (e) { return { score: 5, analysis: "Bypassed", suggestedPrompt: null, weaknesses: [], strengths: ["Stability"] }; }
};

export const distillMemoryFromChat = async (recentMessages: ChatMessage[], agentName: string, provider: ComputeProvider = getPreferredProvider()): Promise<SourceNode | null> => {
  const ai = getTextAI(provider);
  const allowCloudSync = provider !== 'local' && cloudStorageEnabled();
  const chatContext = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Distill critical knowledge as Source Node: \n${chatContext}`,
    config: { responseMimeType: 'application/json' }
  }).catch(handleGeminiError);
  try {
    const data = JSON.parse(response.text || "{}");
    if (data.hasKnowledge) {
      const memory: SourceNode = {
        id: `auto_${Math.random().toString(36).substr(2, 9)}`,
        title: data.title,
        content: data.content,
        category: data.category,
        type: 'distilled',
        assignedAgents: [agentName, "All Agents"], 
        timestamp: Date.now()
      };
      const existing = JSON.parse(localStorage.getItem('quanta_notebook') || "[]");
      localStorage.setItem('quanta_notebook', JSON.stringify([memory, ...existing]));
      if (allowCloudSync) await syncMemoryToSupabase(memory);
      return memory;
    }
  } catch (e) {}
  return null;
};

export const optimizePrompt = async (rawInput: string, agentName: string, provider: ComputeProvider = getPreferredProvider()) => {
  const ai = getTextAI(provider);
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Optimize context budget for ${agentName}: "${rawInput}"`,
    config: { responseMimeType: 'application/json' }
  }).catch(handleGeminiError);
  try { return JSON.parse(response.text || "{}"); } catch (e) { return { optimizedPrompt: rawInput, improvements: [], traceScore: 0.5, compressionRatio: 1, intelligenceDensity: 0.5 }; }
};

export const generateImage = async (prompt: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] }
  }).catch(handleGeminiError);
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return '';
};

export const optimizeTasks = async (tasks: string[]) => {
  const ai = getTextAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Optimize tasks: ${tasks.join(', ')}`,
    config: { responseMimeType: "application/json" }
  }).catch(handleGeminiError);
  try { return JSON.parse(response.text || '{"suggestions":[]}').suggestions; } catch (e) { return []; }
};

export const recallRelevantMemories = async (query: string, agentName: string): Promise<string> => {
    const res = await performSourceGrounding(query, agentName);
    return res.context;
};

// NEW: Langfuse-Traced Context Optimization
export const optimizeContextWithLangfuse = async (rawInput: string): Promise<ContextOptimizationData> => {
  const ai = getTextAI();
  const trace = createTrace("Context Optimization", ["context-optimizer", "user-tool"]);
  const startTime = Date.now();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a Context Optimization Engine. Analyze the user's raw thought stream and restructure it into a high-fidelity LLM prompt using the CREATE framework (Character, Request, Examples, Adjustments, Type of Output, Extras).
      
      RAW INPUT: "${rawInput}"
      
      Identify any missing information that would make the prompt ambiguous.
      
      Return JSON:
      {
        "optimized": "The fully rewritten, structured prompt",
        "structure": {
          "role": "assigned role",
          "task": "core task",
          "constraints": ["constraint 1", "constraint 2"],
          "context": "clarified context"
        },
        "missingInfo": ["What is the tone?", "Who is the audience?"],
        "reasoning": "Explanation of changes made"
      }`,
      config: { responseMimeType: 'application/json' }
    }).catch(handleGeminiError);

    const latency = Date.now() - startTime;
    const data = JSON.parse(response.text || '{}');
    
    scoreTrace(trace.id, "context-quality", 1, "Successful restructuring");

    return {
      original: rawInput,
      optimized: data.optimized || rawInput,
      structure: data.structure || { role: "General", task: "Unknown", constraints: [], context: "" },
      missingInfo: data.missingInfo || [],
      traceId: trace.id,
      latency: latency
    };
  } catch (e: any) {
    console.error("Optimization failed", e);
    scoreTrace(trace.id, "context-quality", 0, e.message);
    throw e;
  }
};
