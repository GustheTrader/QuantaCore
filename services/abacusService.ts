
import { AbacusStreamChunk } from '../types';

/**
 * ABACUS.AI NEURAL BRIDGE
 * Manages high-performance streaming connections to Abacus.AI Deep Agents.
 */

// Versioned path /v0 is required for dispatching AI Agent actions
const ABACUS_BASE_URL = 'https://api.abacus.ai/api/v0';

const getApiKey = () => process.env.API_KEY || '';

/**
 * Streams an AI Agent response using Abacus.AI's SSE implementation.
 * 'getAiAgentStreamingResponse' is the standard action for Agent logic on the v0 path.
 */
export const streamAbacusAgent = async (
  agentId: string,
  userMessage: string,
  onChunk: (chunk: AbacusStreamChunk) => void,
  sessionId?: string
) => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("Neural Key Missing: Please ensure process.env.API_KEY is configured.");
  }

  try {
    // Action name is getAiAgentStreamingResponse on the v0 path
    const response = await fetch(`${ABACUS_BASE_URL}/getAiAgentStreamingResponse`, {
      method: 'POST',
      headers: {
        'apiKey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        aiAgentId: agentId,
        inputs: {
          message: userMessage
        },
        sessionId: sessionId
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Abacus Signal Interrupted: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('Neural bridge requires ReadableStream support.');

    let fullText = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Process potential SSE formatting
        let rawData = trimmed;
        if (trimmed.startsWith('data: ')) {
          rawData = trimmed.replace('data: ', '').trim();
        }

        // Termination signal
        if (rawData === '[DONE]') return fullText;

        try {
          const parsed = JSON.parse(rawData);
          // Support multiple Abacus response schemas (text, delta, content)
          const delta = parsed.text || parsed.delta || parsed.content || '';
          const isFinished = parsed.is_complete || parsed.done || false;

          if (delta) {
            fullText += delta;
            onChunk({
              text: delta,
              is_complete: isFinished
            });
          }
          
          if (isFinished) return fullText;
        } catch (e) {
          // Heartbeats or malformed chunks are safely ignored
        }
      }
    }
    return fullText;
  } catch (err: any) {
    console.error('Abyssal Signal Error:', err);
    throw err;
  }
};
