
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { MemoryBlock, ChatMessage, ReflectionResult } from "../types";
import { syncMemoryToSupabase, logReflection, archiveAndActivatePrompt } from "./supabaseService";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Reusable context builder that pulls from the Sovereign Knowledge Base (LocalStorage + Supabase)
export const getSMEContext = (agentName: string, profile?: { name: string, callsign: string, personality: string }) => {
  let knowledgeContext = "";
  try {
    const savedMemories = localStorage.getItem('quanta_notebook');
    if (savedMemories) {
      const memories: MemoryBlock[] = JSON.parse(savedMemories);
      // Retrieve memories assigned to this specific agent OR "All Agents" (cross-pollination)
      const relevantMemories = memories.filter(m => 
        !m.assignedAgents || 
        m.assignedAgents.length === 0 || 
        m.assignedAgents.includes(agentName) || 
        m.assignedAgents.includes("All Agents")
      );
      knowledgeContext = relevantMemories.map(m => `[SME KNOWLEDGE: ${m.title} (${m.source || 'manual'})] ${m.content}`).join('\n\n');
    }
  } catch (e) {
    console.error("Memory retrieval error:", e);
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
    fullHeader: `--- SOVEREIGN KNOWLEDGE BASE ---\n${knowledgeContext || "(Knowledge buffer empty.)"}\n\n--- OPERATOR PROFILE ---\n${userIdentity}`
  };
};

export const chatWithGemini = async (
  message: string, 
  history: {role: string, content: string}[], 
  agentName: string = "Aetheris",
  customPrompt?: string,
  enabledSkills: string[] = ['search'],
  profile?: { name: string, callsign: string, personality: string }
) => {
  const ai = getAI();
  
  const tools: any[] = [];
  // Fix: When using googleSearch, it must be the only tool provided.
  if (enabledSkills.includes('search')) {
    tools.push({ googleSearch: {} });
  }

  const ctx = getSMEContext(agentName, profile);
  const systemBase = customPrompt || `You are ${agentName}, a Subject Matter Expert (SME) core. You prioritize polymath reasoning and first-principles analysis. ${ctx.identityContext}`;
  const fullSystemInstruction = `${systemBase}\n\n${ctx.fullHeader}`;
  
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
    functionCalls: response.functionCalls
  };
};

/**
 * Blueprint Logic: Judge/Reflective Agent evaluation.
 * Evaluates the performance of the SME agent and evolves its system prompt.
 */
export const reflectAndRefine = async (
  history: ChatMessage[],
  currentPrompt: string,
  agentName: string
): Promise<ReflectionResult> => {
  const ai = getAI();
  const context = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n---\n');

  // Blueprint: Fast evaluation using Gemini 3 Pro
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `You are the Quanta Judge (Model: Gemini 3 Pro). Evaluate the SME Agent: ${agentName}.
    
    CURRENT SYSTEM PROMPT:
    "${currentPrompt}"
    
    CONVERSATION HISTORY:
    ${context}
    
    RUBRIC EVALUATION (Score 1-5):
    1. Completeness: Did the agent address all user intents and unspoken context?
    2. Depth: Was the reasoning deconstructed into atomic truths (FPT) or was it analogical?
    3. Tone: Did it maintain the precise ${agentName} archetype?
    4. Scope: Did it stay within its technical boundaries or drift into generic AI patterns?
    
    DECISION LOGIC:
    If Score < 4: Decision = UPDATE. Generate a SUPERIOR system prompt that explicitly patches these weaknesses.
    If Score >= 4: Decision = MAINTAIN.
    
    Return as JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER, description: "Average score across rubric (1-5)." },
          analysis: { type: Type.STRING, description: "Detailed breakdown of agent performance." },
          decision: { type: Type.STRING, enum: ["UPDATE", "MAINTAIN"] },
          suggestedPrompt: { type: Type.STRING, nullable: true, description: "The revised system prompt if UPDATE is chosen." },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          reasoningForUpdate: { type: Type.STRING, description: "Why the prompt was updated (for DB versioning)." }
        },
        required: ["score", "analysis", "decision", "weaknesses", "strengths", "reasoningForUpdate"]
      }
    }
  });

  try {
    const result = JSON.parse(response.text || "{}");
    
    // Blueprint Persistence
    await logReflection(agentName, history.slice(-6), result);
    
    if (result.decision === 'UPDATE' && result.suggestedPrompt) {
      // Simulate version incrementing (real implementation would fetch current max version from DB)
      const newVersion = Math.floor(Date.now() / 100000); 
      await archiveAndActivatePrompt(agentName, result.suggestedPrompt, result.reasoningForUpdate, newVersion);
    }

    return result;
  } catch (e) {
    console.error("Reflection parsing failed", e);
    return {
      score: 5,
      analysis: "Reflection bypass due to kernel processing error.",
      suggestedPrompt: null,
      weaknesses: [],
      strengths: ["Stability"]
    };
  }
};

export const distillMemoryFromChat = async (recentMessages: ChatMessage[], agentName: string): Promise<MemoryBlock | null> => {
  const ai = getAI();
  const chatContext = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze this conversation snippet between a user and the SME ${agentName}. 
    Identify if there is any permanent knowledge, user preference, first-principles logic, or project detail that should be remembered for future sessions across ALL agents.
    
    CONVERSATION:
    ${chatContext}
    
    If nothing significant is found, return empty JSON with hasKnowledge: false. 
    If something is found, provide a JSON Memory Block with hasKnowledge: true.`,
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
        assignedAgents: ["All Agents"], 
        timestamp: Date.now(),
        source: 'distilled'
      };
      
      const existing = JSON.parse(localStorage.getItem('quanta_notebook') || "[]");
      const updated = [memory, ...existing];
      localStorage.setItem('quanta_notebook', JSON.stringify(updated));
      await syncMemoryToSupabase(memory);
      return memory;
    }
  } catch (e) {
    console.error("Distillation failure:", e);
  }
  return null;
};

export const optimizePrompt = async (rawInput: string, agentName: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are an expert Context Optimizer. Your goal is to transform the user's raw input into a high-performance "First Principles" prompt for an AI agent named ${agentName}.
    
    User Input: "${rawInput}"
    
    Provide the optimized prompt and 3 specific reasons why it's better.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          optimizedPrompt: { type: Type.STRING },
          improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
          traceScore: { type: Type.NUMBER, description: "A simulated Langfuse-style score from 0-1" }
        },
        required: ['optimizedPrompt', 'improvements', 'traceScore']
      }
    }
  });
  
  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { 
      optimizedPrompt: rawInput, 
      improvements: ["Failed to generate improvements"],
      traceScore: 0.5 
    };
  }
};

export const generateImage = async (prompt: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });

  let imageUrl = '';
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
  }
  return imageUrl;
};

export const optimizeTasks = async (tasks: string[]) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Use first-principles analysis to optimize these SME tasks for maximum polymath efficiency: ${tasks.join(', ')}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['suggestions']
      }
    }
  });
  try {
    const data = JSON.parse(response.text || '{"suggestions":[]}');
    return data.suggestions as string[];
  } catch (e) {
    return ["Optimize your SME activities using first principles."];
  }
};
