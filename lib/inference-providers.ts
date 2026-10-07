import type { ComputeProvider } from '../types';

export const COMPATIBLE_PROVIDERS = [
  { id: 'claude', label: 'Claude', baseUrl: 'https://api.anthropic.com/v1', requiresKey: true, editableEndpoint: false, description: 'Claude API key connection using the official text compatibility endpoint. Claude subscription sign-in is separate.', docs: 'https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk' },
  { id: 'grok', label: 'Grok · xAI', baseUrl: 'https://api.x.ai/v1', requiresKey: true, editableEndpoint: false, description: 'Connect Grok with an xAI API key. Grok app subscriptions do not configure this API route.', docs: 'https://docs.x.ai/developers/quickstart' },
  { id: 'google-api', label: 'Google · Gemini API', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', requiresKey: true, editableEndpoint: false, description: 'Gemini API key connection. Google API OAuth is available separately in this local panel.', docs: 'https://ai.google.dev/gemini-api/docs/openai' },
  { id: 'openai-compatible', label: 'OpenAI compatible', baseUrl: 'https://api.openai.com/v1', requiresKey: false, editableEndpoint: true, description: 'Connect OpenAI or another compatible server with its API URL and model ID.', docs: 'https://platform.openai.com/docs/api-reference/chat' },
  { id: 'local', label: 'Ollama Local', baseUrl: 'http://127.0.0.1:11434/v1', requiresKey: false, editableEndpoint: true, description: 'Use an installed local model. This connection stays on the local Ollama server.', docs: 'https://docs.ollama.com/api/openai-compatibility' },
  { id: 'ollama-cloud', label: 'Ollama Cloud', baseUrl: 'https://ollama.com/v1', requiresKey: true, editableEndpoint: false, description: 'Connect directly to Ollama Cloud with an Ollama API key.', docs: 'https://docs.ollama.com/api/openai-compatibility' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', requiresKey: true, editableEndpoint: false, description: 'Load the full current catalog and choose a provider/model slug.', docs: 'https://openrouter.ai/docs/quickstart' },
  { id: 'fireworks', label: 'Fireworks AI', baseUrl: 'https://api.fireworks.ai/inference/v1', requiresKey: true, editableEndpoint: false, description: 'Use a Fireworks model or deployment with your Fireworks API key.', docs: 'https://docs.fireworks.ai/tools-sdks/openai-compatibility' },
  { id: 'omniroute', label: 'OmniRoute', baseUrl: 'http://127.0.0.1:20128/v1', requiresKey: true, editableEndpoint: true, description: 'Connect your OmniRoute gateway. Its own routing rules determine the upstream provider.', docs: 'https://github.com/diegosouzapw/OmniRoute' },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', requiresKey: true, editableEndpoint: false, description: 'Connect Groq inference with your own API key.', docs: 'https://console.groq.com/docs/openai' },
  { id: 'novita', label: 'Novita', baseUrl: 'https://api.novita.ai/v3/openai', requiresKey: true, editableEndpoint: false, description: 'Connect Novita with an exact model ID from its catalog.', docs: 'https://novita.ai/docs/api-reference/model-apis-llm-create-chat-completion' }
] as const;

export type CompatibleProvider = typeof COMPATIBLE_PROVIDERS[number]['id'];

export const getProviderDefinition = (id: string) => COMPATIBLE_PROVIDERS.find(provider => provider.id === id);
export const isCompatibleProvider = (id: string): id is CompatibleProvider => Boolean(getProviderDefinition(id));

export const PROVIDER_CHOICES: { id: ComputeProvider; label: string }[] = [
  { id: 'gemini', label: 'Gemini' },
  ...COMPATIBLE_PROVIDERS.map(({ id, label }) => ({ id, label }))
];

export interface ProviderConnection {
  id: CompatibleProvider;
  baseUrl: string;
  model: string;
  hasKey: boolean;
}

export interface ProviderModel { id: string; name?: string }

export const getPreferredProvider = (): ComputeProvider => {
  if (typeof localStorage === 'undefined') return 'local';
  const saved = localStorage.getItem('quanta_preferred_provider');
  return PROVIDER_CHOICES.find(provider => provider.id === saved)?.id || 'local';
};
