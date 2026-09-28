import type { ComputeProvider } from '../types';
import type { CompatibleProvider, ProviderConnection, ProviderModel } from '../lib/inference-providers';

export interface ProviderConfigResponse {
  connections: ProviderConnection[];
  preferredProvider: ComputeProvider;
  gatewayKeyConfigured: boolean;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/inference${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui', ...init.headers }
  });
  let data: any;
  try { data = await response.json(); } catch { throw new Error('The local inference server is unavailable. Restart Quanta OS.'); }
  if (!response.ok) throw new Error(data.error?.message || `Request failed (${response.status}).`);
  return data;
}

export const loadProviderConnections = () => request<ProviderConfigResponse>('/providers');
export interface LocalRuntime { checkedAt: string; server: string; services: { id: string; label: string; status: string; latencyMs: number; httpStatus?: number }[] }
export const loadLocalRuntime = () => request<LocalRuntime>('/runtime');
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
export const completeWithProvider = (provider: CompatibleProvider, body: Record<string, unknown>, signal?: AbortSignal) =>
  request<any>('/chat/completions', { method: 'POST', body: JSON.stringify({ ...body, provider }), signal });
