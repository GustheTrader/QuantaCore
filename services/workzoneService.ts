import { supabase } from './supabaseService';
import type { OperatorWorkZone, WorkZone } from '../lib/workzone-contract';

async function request<T>(zone: WorkZone, action: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Quanta-Client': 'local-ui' };
  const { data } = await supabase.auth.getSession();
  if (data?.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`/api/work-zone/${zone}/${action}`, { headers, method: body === undefined ? 'GET' : 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json().catch(() => ({ error: 'Work Zone service unavailable. Open the local QuantaCore server.' }));
  if (!response.ok) throw new Error(result.error || `Work Zone returned ${response.status}.`);
  return result as T;
}
export const workzoneService = {
  console: (zone: WorkZone) => request(zone, 'console', {}),
  state: (zone: WorkZone) => request<OperatorWorkZone>(zone, 'state'),
  provision: (zone: WorkZone) => request<OperatorWorkZone>(zone, 'provision', {}),
  onboard: (zone: WorkZone, body: unknown) => request(zone, 'workers', body),
  task: (zone: WorkZone, body: unknown) => request(zone, 'tasks', body),
  review: (zone: WorkZone, body: unknown) => request(zone, 'reviews', body),
  knowledge: (zone: WorkZone, body: unknown) => request(zone, 'knowledge', body),
  watchlist: (symbols: string[]) => request('trade', 'watchlist', { symbols }),
};
