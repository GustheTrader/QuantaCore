
import { deductDeepAgentCredits, checkHasCredits } from './creditService';

/**
 * NOVITA.AI NEURAL BRIDGE - VERSION 10.0
 * Targeted Endpoint: https://api.novita.ai/openai/v1/chat/completions
 * Optimized for Moonshot AI / Kimi-K2 Thinking substrate.
 */

const NOVITA_BASE_URL = 'https://api.novita.ai/openai/v1/chat/completions';

const getNovitaConfig = () => {
  const saved = localStorage.getItem('quanta_api_settings');
  if (saved) {
    const settings = JSON.parse(saved);
    return {
      key: settings.novitaKey || 'sk_zWjgBxMtUYbDX9IzHXjv7GdMhm4CtTodN_bDFDpDI5M',
      model: settings.novitaModel || 'moonshotai/kimi-k2-thinking'
    };
  }
  return {
    key: 'sk_zWjgBxMtUYbDX9IzHXjv7GdMhm4CtTodN_bDFDpDI5M',
    model: 'moonshotai/kimi-k2-thinking'
  };
};

export const streamNovitaDeepDive = async (
  userMessage: string,
  onChunk: (chunk: { text: string; done: boolean }) => void
) => {
  if (!checkHasCredits('agent')) {
    throw new Error("Abyssal Pressure Limit Reached: Deep Agent units exhausted.");
  }

  const { key, model } = getNovitaConfig();
  
  try {
    const response = await fetch(NOVITA_BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful assistant. You use deep reasoning to deconstruct complex queries into atomic truths.' 
          },
          { role: 'user', content: userMessage }
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 262144 // High token limit for deep reasoning output
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const status = response.status;
      
      if (status === 404) {
        throw new Error(`Novita Model Registry Error: [${model}] not found at the specified endpoint. Check Novita settings.`);
      }
      if (status === 401 || status === 403) {
        throw new Error("Neural Key Rejected: Unauthorized access to Novita substrate.");
      }
      
      throw new Error(err.error?.message || `Novita Signal Terminated: Code ${status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('Neural bridge requires ReadableStream substrate.');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data: ')) {
          try {
            const jsonStr = trimmed.substring(6);
            const parsed = JSON.parse(jsonStr);
            
            const delta = parsed.choices[0]?.delta;
            // Reasoning models may send content in standard 'content' or 'reasoning_content'
            const content = delta?.content || delta?.reasoning_content || '';

            if (content) {
              onChunk({ text: content, done: false });
            }
          } catch (e) {
            // Silence heartbeat noise
          }
        }
      }
    }
    
    deductDeepAgentCredits(100);
    onChunk({ text: '', done: true });
  } catch (err: any) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error("Novita Neural Failure: Network connection blocked. Ensure your environment allows CORS requests to api.novita.ai.");
    }
    console.error('Novita Neural Failure:', err);
    throw err;
  }
};
