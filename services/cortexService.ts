
import { safeGenerateContent } from './geminiService';
import { memoryService } from "./memoryService";


class CortexService {
  async processIntent(intent: string) {
    // 1. Retrieve relevant memory (Intuition/Push Trigger)
    const memories = memoryService.getMemory();
    const context = memories.map(m => m.content).join('\n');

    // 2. Reasoning Engine (Hybrid LLM + Graph)
    // We simulate the "logical shell" by providing strict system instructions
    const response = await safeGenerateContent("gemini-3.1-pro-preview", `Context: ${context}\n\nIntent: ${intent}`, {
        systemInstruction: "You are a hybrid reasoning engine. Use the provided context (memory) to inform your response. Think in discrete, logical steps (the logical shell) while maintaining semantic fluidity (the intuitive core).",
    });

    // 3. Update Memory (Feedback Loop)
    memoryService.addMemory(intent, [response.text || '']);
    
    return response.text;
  }
}

export const cortexService = new CortexService();
