import type { HybridView } from '../lib/hybrid-contract';
export async function hybridRequest<T = HybridView>(endpoint: string, method = 'GET', body?: unknown, idempotencyKey?: string): Promise<T> {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname)) throw new Error('Hybrid Cloud credentials and jobs are available only from the local Quanta server.');
  const response = await fetch(`/api/hybrid${endpoint}`, { method, headers: { 'X-Quanta-Client': 'local-ui', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Quanta backend unavailable. Start the full local server to configure integrations and reviewed cloud jobs.');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Hybrid Cloud is unavailable. Open the local Quanta app.');
  return result;
}
