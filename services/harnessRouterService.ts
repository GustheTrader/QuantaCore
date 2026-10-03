import { isSupabaseConfigured, supabase } from './supabaseService';

export type HarnessRouterMode = 'local' | 'hosted';

export interface HarnessRouterStatus {
  reachable: boolean;
  version: string | null;
  apiKeyConfigured: boolean;
  executionEnabled?: boolean;
}

export interface HarnessRouterModel {
  backend: string;
  id: string;
  available: boolean;
  testAllowed?: boolean;
}

export interface HarnessRouterBase {
  id: string;
  label: string;
  backend: string;
  status: string;
  tools: string[];
  testAllowed?: boolean;
}

export interface HarnessRouterRunResult {
  responseId: string | null;
  status: string;
  harnessId: string;
  requestedModel: string;
  servedModel: string | null;
  modelFallback: boolean;
  outputText: string;
}

async function localRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/harness-router${path}`, {
    ...init,
    headers: {
      'X-Quanta-Client': 'local-ui',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers
    },
    cache: 'no-store'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || 'HarnessRouter request failed.');
  return payload as T;
}

async function hostedRequest<T>(payload: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured) throw new Error('Hosted HarnessRouter is not configured for this web app.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in with your email link before using hosted HarnessRouter.');
  const { data, error } = await supabase.functions.invoke('quanta-harness-router', { body: payload });
  if (error) {
    let message = 'Hosted HarnessRouter is temporarily unavailable.';
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const result = await context.json();
        if (typeof result?.error?.message === 'string') message = result.error.message;
      } catch { /* Keep the generic hosted error. */ }
    }
    throw new Error(message);
  }
  return data as T;
}

export const harnessRouterService = {
  status: (mode: HarnessRouterMode) => mode === 'local'
    ? localRequest<HarnessRouterStatus>('/status')
    : hostedRequest<HarnessRouterStatus>({ action: 'status' }),
  capabilities: (mode: HarnessRouterMode) => mode === 'local'
    ? localRequest<{ models: HarnessRouterModel[]; bases: HarnessRouterBase[] }>('/capabilities')
    : hostedRequest<{ models: HarnessRouterModel[]; bases: HarnessRouterBase[] }>({ action: 'catalog' }),
  saveKey: (apiKey: string) => localRequest<{ configured: boolean }>('/credential', {
    method: 'PUT', body: JSON.stringify({ apiKey })
  }),
  clearKey: () => localRequest<{ configured: boolean }>('/credential', { method: 'DELETE' }),
  run: (mode: HarnessRouterMode, input: { prompt: string; harnessId: string; modelId: string; requestId: string }) => mode === 'local'
    ? localRequest<HarnessRouterRunResult>('/run', { method: 'POST', body: JSON.stringify(input) })
    : hostedRequest<HarnessRouterRunResult>({ action: 'run', ...input })
};

export function isLocalQuantaHost() {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
}
