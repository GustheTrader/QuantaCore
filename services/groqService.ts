import { completeWithProvider } from './inferenceService';
import type { CompatibleProvider } from '../lib/inference-providers';

export const chatWithOpenAICompatible = async (
  message: string,
  history: { role: string; content: string }[],
  systemInstruction: string,
  provider: CompatibleProvider = 'groq',
  model?: string,
  signal?: AbortSignal
) => {
  const data = await completeWithProvider(provider, {
    ...(model ? { model } : {}),
    messages: [
      { role: 'system', content: systemInstruction },
      ...history.map(item => ({ role: item.role === 'model' ? 'assistant' : item.role, content: item.content })),
      { role: 'user', content: message }
    ],
    temperature: 0.6
  }, signal);
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('This model did not return text. Choose a chat model in Settings.');
  return { text, model: data.model, usage: data.usage, sources: [] };
};
