import { GoogleGenAI } from '@google/genai';
import { getLocalGeminiApiKey } from './browserCredentials';

// On this computer, Gemini requests go through the local QuantaCore server, which adds
// the protected API key. The browser never holds the key. A hosted site has no local
// server, so it falls back to the optional browser key from Settings.
export const usesServerGemini = () => typeof window !== 'undefined' && ['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname);

export function createGeminiClient(): GoogleGenAI {
  if (usesServerGemini()) {
    return new GoogleGenAI({ apiKey: 'held-by-local-server', httpOptions: { baseUrl: `${window.location.origin}/api/gemini`, headers: { 'X-Quanta-Client': 'local-ui' } } });
  }
  const apiKey = getLocalGeminiApiKey();
  if (!apiKey) throw new Error('Configure Gemini in Settings, or select a configured model connection.');
  return new GoogleGenAI({ apiKey });
}

// Gemini Live needs a browser WebSocket. On this computer the server issues a
// single-use token that expires in minutes; the real key stays on the server.
export async function createGeminiLiveClient(): Promise<GoogleGenAI> {
  if (usesServerGemini()) {
    const response = await fetch('/api/gemini/live-token', { method: 'POST', headers: { 'X-Quanta-Client': 'local-ui' } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.token !== 'string') throw new Error(result?.error?.message || 'Could not start a Gemini Live session.');
    return new GoogleGenAI({ apiKey: result.token, httpOptions: { apiVersion: 'v1alpha' } });
  }
  return createGeminiClient();
}

// Rewrites a Gemini file download link so it streams through the local server
// instead of carrying the API key in the URL.
export function geminiDownloadUrl(uri: string): string {
  if (!usesServerGemini()) {
    const apiKey = getLocalGeminiApiKey();
    return apiKey ? `${uri}${uri.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}` : uri;
  }
  const url = new URL(uri);
  if (url.hostname !== 'generativelanguage.googleapis.com') throw new Error('Unexpected Gemini download host.');
  url.searchParams.delete('key');
  return `${window.location.origin}/api/gemini${url.pathname}${url.search}`;
}
