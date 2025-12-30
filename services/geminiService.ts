
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { MemoryBlock, ChatMessage, ReflectionResult, ComputeProvider } from "../types";
import { syncMemoryToSupabase, logReflection, archiveAndActivatePrompt, fetchMemoriesFromSupabase } from "./supabaseService";
import { chatWithOpenAICompatible } from "./groqService";

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

const calendarTool: FunctionDeclaration = {
  name: "interact_with_calendar",
  parameters: {
    type: Type.OBJECT,
    description: "Manage schedules and meetings using polymath scheduling logic.",
    properties: {
      action: { type: Type.STRING, enum: ["list_events", "create_event", "delete_event"], description: "The action to perform." },
      title: { type: Type.STRING, description: "Event title." },
      time: { type: Type.STRING, description: "ISO timestamp or natural language time." }
    },
    required: ["action"]
  }
};

const docsTool: FunctionDeclaration = {
  name: "interact_with_docs",
  parameters: {
    type: Type.OBJECT,
    description: "Create or read Google Docs for structured knowledge architecting.",
    properties: {
      action: { type: Type.STRING, enum: ["read", "create", "append"], description: "The action to perform." },
      title: { type: Type.STRING, description: "The title of the document." },
      content: { type: Type.STRING, description: "The content to write or append." }
    },
    required: ["action"]
  }
};

const driveTool: FunctionDeclaration = {
  name: "interact_with_drive",
  parameters: {
    type: Type.OBJECT,
    description: "Manage files and directory structure in the Drive vault.",
    properties: {
      action: { type: Type.STRING, enum: ["list", "search", "delete"], description: "The action to perform." },
      query: { type: Type.STRING, description: "Filename or search parameters." }
    },
    required: ["action"]
  }
};

/**
 * RECALL SERVICE: Queries LTM for relevant SME blocks
 */
export const recallRelevantMemories = async (query: string, agentName: string): Promise<string> => {
  try {
    const memories = await fetchMemoriesFromSupabase({ agentName });
    if (!memories || memories.length === 0) return "";

    const ai = getAI();
    const prompt = `You are a Cognitive Retrieval Engine. Given the user query and a list of memories, return ONLY the content of the top 3 most relevant memories that provide critical context or past lessons.
    
    USER QUERY: "${query}"
    
    MEMORY LIST:
    ${memories.map((m, i) => `[ID ${i}]: ${m.title} - ${m.content}`).join('\n')}
    
    Return the relevant content blocks separated by dashes. If none are relevant, return "NO_RELEVANT_MEMORY".`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });

    const result = response.text || "";
    return result.includes("NO_RELEVANT_MEMORY") ? "" : result;
  } catch (e) {
    console.error("LTM Recall Error:", e);
    return "";
  }
};

export const getSMEContext = async (agentName: string, profile?: { name: string, callsign: string, personality: string }, query?: string) => {
  let knowledgeContext = "";
  
  if (query) {
    knowledgeContext = await recallRelevantMemories(query, agentName);
  }

  if (!knowledgeContext) {
    try {
      const savedMemories = localStorage.getItem('quanta_notebook');
      if (savedMemories) {
        const memories: MemoryBlock[] = JSON.parse(savedMemories);
        const relevantMemories = memories.filter(m => 
          !m.assignedAgents || 
          m.assignedAgents.length === 0 || 
          m.assignedAgents.includes(agentName) || 
          m.assignedAgents.includes("All Agents")
        );
        knowledgeContext = relevantMemories.map(m => `[SME KNOWLEDGE: ${m.title} (${m.source || 'manual'})] ${m.content}`).join('\n\n');
      }
    } catch (e) {}
  }

  const personalityMap: Record<string, string> = {
    'Analytic Prime': 'Be highly logical, precise, and first-principles driven.',
    'Aetheris Warmth': 'Be conversational, warm, and focused on polymath well-being.',
    'Minimalist Node': 'Be ultra-concise and impactful.',
    'Cyber-Tactician': 'Adopt a high-performance, technical SME tone.',
    'Zen Architect': 'Be calm, philosophical, and focused on architectural first principles.',
    'Quantum Flow': 'Operate in a state of high conscious awareness and cognitive expansion. Prioritize breakthrough insights and rapid flow-state synthesis.'
  };

  const userIdentity = profile ? `You are addressing the user as "${profile.callsign}".` : "";
  const personalityInstruction = profile ? personalityMap[profile.personality] || "" : "";

  return {
    knowledgeContext: knowledgeContext || "(No prior sovereign memories synced yet.)",
    identityContext: `${userIdentity} ${personalityInstruction}`,
    fullHeader: `--- LONG TERM MEMORY / SOVEREIGN KNOWLEDGE ---\n${knowledgeContext || "(Knowledge buffer empty.)"}\n\n--- OPERATOR PROFILE ---\n${userIdentity}`
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
  const ctx = await getSMEContext(agentName, profile, message);
  const systemBase = customPrompt || `You are ${agentName}, a Subject Matter Expert (SME) core. You prioritize polymath reasoning and first-principles analysis. ${ctx.identityContext}`;
  
  let groundingText = "";
  let groundingSources: {uri: string, title: string}[] = [];

  if (enabledSkills.includes('search') && provider !== 'gemini') {
    try {
      const ai = getAI();
      const groundingResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: `Retrieve current information and search grounding for: ${message}` }] }],
        config: { tools: [{ googleSearch: {} }] }
      });
      
      groundingSources = groundingResponse.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter(chunk => chunk.web)
        ?.map(chunk => ({
          uri: chunk.web?.uri || '',
          title: chunk.web?.title || 'Source'
        })) || [];
        
      if (groundingSources.length > 0) {
        groundingText = `\n\n--- LIVE SEARCH GROUNDING ---\nThe following real-time data was retrieved to assist your reasoning:\n${groundingResponse.text}`;
      }
    } catch (e) {}
  }

  const fullSystemInstruction = `${systemBase}\n\n${ctx.fullHeader}${groundingText}`;

  if (provider === 'groq' || provider === 'local') {
    const response = await chatWithOpenAICompatible(message, history, fullSystemInstruction, provider);
    return { ...response, sources: groundingSources };
  }

  const ai = getAI();
  const tools: any[] = [];
  const functionDeclarations: FunctionDeclaration[] = [];
  
  if (enabledSkills.includes('search')) {
    tools.push({ googleSearch: {} });
  }

  if (enabledSkills.includes('gmail')) functionDeclarations.push(gmailTool);
  if (enabledSkills.includes('calendar')) functionDeclarations.push(calendarTool);
  if (enabledSkills.includes('docs')) functionDeclarations.push(docsTool);
  if (enabledSkills.includes('drive')) functionDeclarations.push(driveTool);

  if (functionDeclarations.length > 0) {
    tools.push({ functionDeclarations });
  }

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

  return {
    text: response.text || "",
    sources,
    usage: response.candidates?.[0]?.content 
  };
};

export const reflectAndRefine = async (
  history: ChatMessage[],
  currentPrompt: string,
  agentName: string
): Promise<ReflectionResult> => {
  const ai = getAI();
  const context = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n---\n');

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `You are the Quanta Judge (Model: Gemini 3 Pro). Evaluate the SME Agent: ${agentName}.
    
    CURRENT SYSTEM PROMPT:
    "${currentPrompt}"
    
    CONVERSATION HISTORY:
    ${context}
    
    Return as JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          analysis: { type: Type.STRING },
          decision: { type: Type.STRING, enum: ["UPDATE", "MAINTAIN"] },
          suggestedPrompt: { type: Type.STRING, nullable: true },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          reasoningForUpdate: { type: Type.STRING }
        },
        required: ["score", "analysis", "decision", "weaknesses", "strengths", "reasoningForUpdate"]
      }
    }
  });

  try {
    const result = JSON.parse(response.text || "{}");
    await logReflection(agentName, history.slice(-6), result);
    if (result.decision === 'UPDATE' && result.suggestedPrompt) {
      const newVersion = Math.floor(Date.now() / 100000); 
      await archiveAndActivatePrompt(agentName, result.suggestedPrompt, result.reasoningForUpdate, newVersion);
    }
    return result;
  } catch (e) {
    return { score: 5, analysis: "Bypassed", suggestedPrompt: null, weaknesses: [], strengths: ["Stability"] };
  }
};

export const distillMemoryFromChat = async (recentMessages: ChatMessage[], agentName: string): Promise<MemoryBlock | null> => {
  const ai = getAI();
  const chatContext = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Identify permanent knowledge or critical lessons in this conversation: \n${chatContext}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hasKnowledge: { type: Type.BOOLEAN },
          title: { type: Type.STRING },
          content: { type: Type.STRING },
          category: { type: Type.STRING, enum: ["Strategic", "Technical", "Personal", "Preference", "Financial"] }
        },
        required: ["hasKnowledge"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || "{}");
    if (data.hasKnowledge) {
      const memory: MemoryBlock = {
        id: `auto_${Math.random().toString(36).substr(2, 9)}`,
        title: data.title,
        content: data.content,
        category: data.category,
        assignedAgents: [agentName, "All Agents"], 
        timestamp: Date.now(),
        source: 'distilled'
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
    contents: `You are a Context Budget Optimizer. Rewrite: "${rawInput}" for ${agentName}.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          optimizedPrompt: { type: Type.STRING },
          improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
          traceScore: { type: Type.NUMBER },
          compressionRatio: { type: Type.NUMBER },
          intelligenceDensity: { type: Type.NUMBER }
        },
        required: ['optimizedPrompt', 'improvements', 'traceScore', 'compressionRatio', 'intelligenceDensity']
      }
    }
  });
  try { return JSON.parse(response.text || "{}"); } catch (e) { return { optimizedPrompt: rawInput, improvements: [], traceScore: 0.5, compressionRatio: 1, intelligenceDensity: 0.5 }; }
};

export const generateImage = async (prompt: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] }
  });
  let imageUrl = '';
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) { imageUrl = `data:image/png;base64,${part.inlineData.data}`; break; }
    }
  }
  return imageUrl;
};

export const optimizeTasks = async (tasks: string[]) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Optimize these tasks: ${tasks.join(', ')}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { suggestions: { type: Type.ARRAY, items: { type: Type.STRING } } },
        required: ['suggestions']
      }
    }
  });
  try { return JSON.parse(response.text || '{"suggestions":[]}').suggestions; } catch (e) { return []; }
};
