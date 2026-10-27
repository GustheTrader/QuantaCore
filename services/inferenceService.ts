import type { ComputeProvider } from '../types';
import type { CompatibleProvider, ProviderConnection, ProviderModel } from '../lib/inference-providers';
import { isSupabaseConfigured, supabase } from './supabaseService';

export interface ProviderConfigResponse {
  connections: ProviderConnection[];
  preferredProvider: ComputeProvider;
  gatewayKeyConfigured: boolean;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (import.meta.env.PROD && !['127.0.0.1', 'localhost', '[::1]', 'quanta-herb.zo.computer'].includes(window.location.hostname)) {
    if (!isSupabaseConfigured) throw new Error('Hosted inference is not configured. Add the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY build variables in Vercel.');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sign in with your email link to use hosted model services.');
    let payload: unknown;
    if (init.body !== undefined) {
      try { payload = JSON.parse(String(init.body)); }
      catch { throw new Error('The hosted inference request was invalid.'); }
    }
    const { data, error } = await supabase.functions.invoke('quanta-inference', {
      body: { path, method: init.method || 'GET', body: payload }
    });
    if (error) {
      let message = 'Hosted inference is temporarily unavailable.';
      const context = (error as { context?: unknown }).context;
      if (context instanceof Response) {
        try {
          const result = await context.json();
          if (typeof result?.error?.message === 'string') message = result.error.message;
        } catch { /* Keep the generic message for non-JSON upstream errors. */ }
      }
      throw new Error(message);
    }
    return data as T;
  }
  const response = await fetch(`/api/inference${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui', ...init.headers }
  });
  let data: any;
  try { data = await response.json(); } catch { throw new Error('The local inference server is unavailable. Restart Quanta OS.'); }
  if (!response.ok) throw new Error(data.error?.message || `Request failed (${response.status}).`);
  return data;
}

export const loadProviderConnections = (signal?: AbortSignal) => request<ProviderConfigResponse>('/providers', { signal });
export interface LocalRuntime { checkedAt: string; server: string; services: { id: string; label: string; status: string; latencyMs: number; httpStatus?: number }[] }
export const loadLocalRuntime = (signal?: AbortSignal) => request<LocalRuntime>('/runtime', { signal });
export const saveProviderConnection = (id: CompatibleProvider, connection: { baseUrl: string; model: string; apiKey?: string; clearKey?: boolean }) =>
  request<ProviderConfigResponse>(`/providers/${id}`, { method: 'PUT', body: JSON.stringify(connection) });
export const loadProviderModels = async (id: CompatibleProvider) => (await request<{ data: ProviderModel[] }>(`/providers/${id}/models`)).data;
export const copyLocalGatewayKey = async () => {
  const { key } = await request<{ key: string }>('/gateway-key', { method: 'POST' });
  await navigator.clipboard.writeText(key);
};
export const setPreferredInferenceProvider = async (provider: ComputeProvider) => {
  await request('/preferred', { method: 'PUT', body: JSON.stringify({ provider }) });
  localStorage.setItem('quanta_preferred_provider', provider);
  window.dispatchEvent(new Event('quanta_provider_changed'));
};
export const completeWithProvider = (provider: CompatibleProvider, body: Record<string, unknown>, signal?: AbortSignal, correlationId?: string) =>
  request<any>('/chat/completions', { method: 'POST', body: JSON.stringify({ ...body, provider }), signal, ...(correlationId ? { headers: { 'X-Quanta-Correlation-ID': correlationId } } : {}) });

export interface SubscriptionModel { agent: string; model: string; label: string }
async function subscriptionRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/hermes/work/coding/${path}`, {
    method: body === undefined ? 'GET' : 'POST', signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Quanta-Client': 'local-ui' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Subscription request failed.');
  return data;
}
export const loadSubscriptionModels = () => subscriptionRequest<{ models: SubscriptionModel[] }>('subscription-models');
export const chatWithSubscription = (agent: string, model: string, prompt: string, signal?: AbortSignal) =>
  subscriptionRequest<{ reply: string }>('chat', { agent, model, prompt }, signal);

export function saveVerifiedSubscription(model: SubscriptionModel) {
  const provider = ({ codex: 'openai-compatible', claude: 'claude', 'grok-native': 'grok', gemini: 'gemini' } as Record<string, string>)[model.agent];
  if (!provider) throw new Error('Unsupported subscription provider.');
  localStorage.setItem('quanta_subscription_model', JSON.stringify({ ...model, verifiedAt: new Date().toISOString() }));
  localStorage.setItem('quanta_preferred_provider', provider);
  window.dispatchEvent(new Event('quanta_provider_changed'));
}
