
import { ChatMessage } from "../types";

/**
 * GROQ / LOCAL INFERENCE SERVICE
 * Optimized for hyper-speed Llama-3/Mixtral/DeepSeek inference 
 * or local private compute nodes (Ollama/LM Studio).
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const LOCAL_API_URL = "http://localhost:11434/v1/chat/completions"; 

export const chatWithOpenAICompatible = async (
  message: string,
  history: { role: string, content: string }[],
  systemInstruction: string,
  provider: 'groq' | 'local' = 'groq',
  model?: string
) => {
  const url = provider === 'local' ? LOCAL_API_URL : GROQ_API_URL;
  // Use user-provided key or fallback to env
  const apiKey = provider === 'local' ? 'ollama' : (process.env.GROQ_API_KEY || "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");
  
  // Selection of premium inference models
  const activeModel = model || (provider === 'local' ? "llama3" : "llama-3.3-70b-versatile");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: "system", content: systemInstruction },
          ...history.map(h => ({ 
            role: h.role === 'model' ? 'assistant' : h.role, 
            content: h.content 
          })),
          { role: "user", content: message }
        ],
        temperature: 0.6,
        max_tokens: 4096,
        top_p: 0.95
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `Inference Engine [${provider.toUpperCase()}] Offline`);
    }

    const data = await response.json();
    return {
      text: data.choices[0].message.content,
      model: data.model,
      usage: data.usage,
      sources: [] // Groq/Local typically lacks built-in grounding metadata like Gemini
    };
  } catch (error) {
    console.error(`Compute Error [${provider}]:`, error);
    throw error;
  }
};
