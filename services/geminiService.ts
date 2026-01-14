
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { SourceNode, ChatMessage, ReflectionResult, ComputeProvider } from "../types";
import { syncMemoryToSupabase, logReflection, archiveAndActivatePrompt, fetchMemoriesFromSupabase } from "./supabaseService";
import { chatWithOpenAICompatible } from "./groqService";
import { deductCloudCredits, checkHasCredits } from "./creditService";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

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

/**
 * SOURCE GROUNDING SERVICE
 * Implementation of NotebookLM-style RAG.
 */
export const performSourceGrounding = async (query: string, agentName: string): Promise<{ context: string, citations: any[] }> => {
  try {
    const memories = await fetchMemoriesFromSupabase({ agentName });
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
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
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
    });

    const result = JSON.parse(response.text || '{"context":"", "citations":[]}');
    return result;
  } catch (e) {
    console.error("Source Grounding Error:", e);
    return { context: "", citations: [] };
  }
};

export const getSMEContext = async (agentName: string, profile?: { name: string, callsign: string, personality: string }, query?: string) => {
  let groundingData = { context: "", citations: [] };
  
  if (query) {
    groundingData = await performSourceGrounding(query, agentName);
  }

  const personalityMap: Record<string, string> = {
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
    fullHeader: `--- SOURCE KNOWLEDGE (GROUNDED) ---\n${groundingData.context || "(No relevant knowledge found.)"}\n\n--- OPERATOR PROFILE ---\n${userIdentity}`
  };
};

export const chatWithSME = async (
  message: string, 
  history: {role: string, content: string}[], 
  agentName: string = "Aetheris",
  customPrompt?: string,
  enabledSkills: string[] = ['search'],
  profile?: { name: string, callsign: string, personality: string },
  provider: ComputeProvider = 'gemini'
) => {
  if (!checkHasCredits('cloud')) {
    throw new Error("Neural Energy Depleted: Refill Cloud Intelligence tokens to continue.");
  }

  const ctx = await getSMEContext(agentName, profile, message);
  const systemBase = customPrompt || `You are ${agentName}, a Subject Matter Expert (SME). Ground all answers in provided source knowledge. ${ctx.identityContext}`;
  
  const fullSystemInstruction = `${systemBase}\n\n${ctx.fullHeader}`;

  if (provider === 'groq' || provider === 'local') {
    const response = await chatWithOpenAICompatible(message, history, fullSystemInstruction, provider);
    deductCloudCredits(12);
    return { ...response, citations: ctx.citations };
  }

  const ai = getAI();
  const tools: any[] = [];
  if (enabledSkills.includes('search')) tools.push({ googleSearch: {} });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
      { role: 'user', parts: [{ text: message }] }
    ],
    config: {
      tools: tools.length > 0 ? tools : undefined,
      systemInstruction: fullSystemInstruction
    }
  });

  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.filter(chunk => chunk.web)
    ?.map(chunk => ({
      uri: chunk.web?.uri || '',
      title: chunk.web?.title || 'Source'
    })) || [];

  deductCloudCredits(10);

  return {
    text: response.text || "",
    sources,
    citations: ctx.citations,
    usage: response.candidates?.[0]?.content 
  };
};

export const reflectAndRefine = async (history: ChatMessage[], currentPrompt: string, agentName: string): Promise<ReflectionResult> => {
  const ai = getAI();
  const context = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n---\n');
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Evaluate the SME Agent: ${agentName}.\n\nPROMPT: ${currentPrompt}\n\nHISTORY: ${context}`,
    config: { responseMimeType: "application/json" }
  });
  try { return JSON.parse(response.text || "{}"); } catch (e) { return { score: 5, analysis: "Bypassed", suggestedPrompt: null, weaknesses: [], strengths: ["Stability"] }; }
};

export const distillMemoryFromChat = async (recentMessages: ChatMessage[], agentName: string): Promise<SourceNode | null> => {
  const ai = getAI();
  const chatContext = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Distill critical knowledge as Source Node: \n${chatContext}`,
    config: { responseMimeType: 'application/json' }
  });
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
      await syncMemoryToSupabase(memory);
      return memory;
    }
  } catch (e) {}
  return null;
};

export const optimizePrompt = async (rawInput: string, agentName: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Optimize context budget for ${agentName}: "${rawInput}"`,
    config: { responseMimeType: 'application/json' }
  });
  try { return JSON.parse(response.text || "{}"); } catch (e) { return { optimizedPrompt: rawInput, improvements: [], traceScore: 0.5, compressionRatio: 1, intelligenceDensity: 0.5 }; }
};

export const generateImage = async (prompt: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] }
  });
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return '';
};

export const optimizeTasks = async (tasks: string[]) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Optimize tasks: ${tasks.join(', ')}`,
    config: { responseMimeType: "application/json" }
  });
  try { return JSON.parse(response.text || '{"suggestions":[]}').suggestions; } catch (e) { return []; }
};

export const recallRelevantMemories = async (query: string, agentName: string): Promise<string> => {
    const res = await performSourceGrounding(query, agentName);
    return res.context;
};
