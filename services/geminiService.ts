
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { MemoryBlock } from "../types";

const getApiKey = () => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
    if (typeof window !== 'undefined' && (window as any).process?.env?.API_KEY) {
      return (window as any).process.env.API_KEY;
    }
  } catch (e) {}
  return '';
};

const getAI = () => new GoogleGenAI({ apiKey: getApiKey() });

// Google Workspace Tool Definitions
const gmailTool: FunctionDeclaration = {
  name: "interact_with_gmail",
  parameters: {
    type: Type.OBJECT,
    description: "Search, read, or send emails via Gmail neural bridge.",
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
    description: "Manage schedules, meetings, and events.",
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
    description: "Create, read, or summarize Google Docs content.",
    properties: {
      action: { type: Type.STRING, enum: ["create", "read", "summarize"], description: "The action to perform." },
      fileName: { type: Type.STRING, description: "The name or ID of the file." },
      content: { type: Type.STRING, description: "Text content for the document." }
    },
    required: ["action"]
  }
};

const driveTool: FunctionDeclaration = {
  name: "interact_with_drive",
  parameters: {
    type: Type.OBJECT,
    description: "Securely manage Google Drive files, folders and storage organization.",
    properties: {
      action: { type: Type.STRING, enum: ["search", "upload", "delete", "create_folder"], description: "The management action." },
      fileName: { type: Type.STRING, description: "The name of the file or folder." },
      query: { type: Type.STRING, description: "Search parameters for file location." },
      folderId: { type: Type.STRING, description: "The ID of the target folder." }
    },
    required: ["action"]
  }
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
  const functionDeclarations: FunctionDeclaration[] = [];

  if (enabledSkills.includes('search')) tools.push({ googleSearch: {} });
  if (enabledSkills.includes('gmail')) functionDeclarations.push(gmailTool);
  if (enabledSkills.includes('calendar')) functionDeclarations.push(calendarTool);
  if (enabledSkills.includes('docs')) functionDeclarations.push(docsTool);
  if (enabledSkills.includes('drive')) functionDeclarations.push(driveTool);

  if (functionDeclarations.length > 0) {
    tools.push({ functionDeclarations });
  }

  let knowledgeContext = "";
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
      knowledgeContext = relevantMemories.map(m => `[MEMORY BLOCK: ${m.title} (${m.category})] - ${m.content}`).join('\n\n');
    }
  } catch (e) {}

  const personalityMap: Record<string, string> = {
    'Analytic Prime': 'Be highly logical, precise, and data-driven.',
    'Aetheris Warmth': 'Be conversational, warm, and highly supportive.',
    'Minimalist Node': 'Be ultra-concise.',
    'Cyber-Tactician': 'Adopt a high-performance, futuristic tone.',
    'Zen Architect': 'Be calm, philosophical, and focused on balance.'
  };

  const userIdentity = profile ? `You are addressing the user as "${profile.callsign}". Their legal name is ${profile.name}.` : "";
  const personalityInstruction = profile ? personalityMap[profile.personality] || "" : "";

  const systemBase = customPrompt || `You are ${agentName}, a specialized SuperAgent part of the QuantaAI ecosystem. ${userIdentity} ${personalityInstruction}`;
  const fullSystemInstruction = `${systemBase}\n\n--- NEURAL KNOWLEDGE BASE ---\n${knowledgeContext || "(Notebook is empty.)"}`;
  
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

export const generateImage = async (prompt: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });

  let imageUrl = '';
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }
  return imageUrl;
};

export const optimizeTasks = async (tasks: string[]) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze these tasks for efficiency: ${tasks.join(', ')}`,
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
    return ["Optimize your SME activities first."];
  }
};
