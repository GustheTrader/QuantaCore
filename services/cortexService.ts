
import { GoogleGenAI } from "@google/genai";
import { memoryService } from "./memoryService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

class CortexService {
  async processIntent(intent: string) {
    // 1. Retrieve relevant memory (Intuition/Push Trigger)
    const memories = memoryService.getMemory();
    const context = memories.map(m => m.content).join('\n');

    // 2. Reasoning Engine (Hybrid LLM + Graph)
    // We simulate the "logical shell" by providing strict system instructions
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Context: ${context}\n\nIntent: ${intent}`,
      config: {
        systemInstruction: "You are a hybrid reasoning engine. Use the provided context (memory) to inform your response. Think in discrete, logical steps (the logical shell) while maintaining semantic fluidity (the intuitive core).",
      }
    });

    // 3. Update Memory (Feedback Loop)
    memoryService.addMemory(intent, [response.text || '']);
    
    return response.text;
  }
}

export const cortexService = new CortexService();
