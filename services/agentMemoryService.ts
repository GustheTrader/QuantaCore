import { invokeEdgeFunction, supabase } from './supabaseService';
import { memoryTarget, type MemoryTarget } from '../lib/memory-target';
import type { MemoryBank, MemoryRecord, MemoryEvent, MemoryPolicy } from '../supabase/functions/_shared/memory-governance';
export type { MemoryBank, MemoryRecord, MemoryPolicy };

export { memoryTarget };

export interface AgentMemoryStatus {
  checkedAt: string;
  persistence: MemoryTarget;
  // Where this browser actually sends memory, and why.
  target?: { target: MemoryTarget; reason: string };
  services: { id: 'ledger' | 'hindsight' | 'honcho'; status: 'responding' | 'configured' | 'unavailable' | 'authentication-required' | 'error'; latencyMs: number }[];
  admissionSchema?: string; patternCount?: number; legacyMigrationRequired?: boolean;
}

export interface AgentMemoryContext {
  hindsight: { source: string; id?: string; type?: string; text: string; provenance?: { source: string; confidence: number | null; contentSha256: string; bankId: string; reviewedAt?: string } }[];
  honcho: string;
  available: boolean;
  degraded: boolean;
}

async function request<T>(path: string, owner: string, body?: Record<string, unknown>, signal?: AbortSignal, correlationId?: string): Promise<T> {
  if (memoryTarget().target === 'hosted') {
    const action = path.slice(1);
    const data = await invokeEdgeFunction('quanta-memory', { action, ...(body || {}) });
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return data as T;
  }
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const response = await fetch(`/api/memory${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}), ...(correlationId ? { 'X-Quanta-Correlation-ID': correlationId } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal
  });
  let result: any;
  try { result = await response.json(); }
  catch { throw new Error('Local memory service is unavailable. Start the QuantaCore local server.'); }
  if (!response.ok) throw new Error(result.error?.message || `Memory request failed (${response.status}).`);
  return result as T;
}

export const loadAgentMemoryStatus = async (owner: string) => ({ ...await request<AgentMemoryStatus>('/status', owner), target: memoryTarget() });

export const retrieveAgentMemory = (input: { owner: string; threadId: string; agent: string; query: string; includeMaster?: boolean }, signal?: AbortSignal, correlationId?: string) =>
  request<AgentMemoryContext>('/context', input.owner, { threadId: input.threadId, agent: input.agent, query: input.query, includeMaster: input.includeMaster === true }, signal, correlationId);

export const retainAgentMemoryTurn = (input: { owner: string; threadId: string; agent: string; query: string; userMessage: string; assistantMessage: string }, signal?: AbortSignal, correlationId?: string) =>
  request<{ stored: boolean; recordId: string; services: { ledger: string; hindsight: string; honcho: string }; defense: { action: string; matchedTypes: string[] } }>('/turn', input.owner, {
    threadId: input.threadId,
    agent: input.agent,
    query: input.query,
    userMessage: input.userMessage,
    assistantMessage: input.assistantMessage
  }, signal, correlationId);

export const memoryGovernance = {
  records: (owner: string, agent: string, scope: 'private' | 'master' = 'private') => request<{ bank: MemoryBank; records: MemoryRecord[]; total: number; audit: MemoryEvent[]; pendingPurges?: { id: string; indexes: { hindsight: string; honcho: string }; status: string }[]; staleSourceIds?: string[] }>('/records', owner, { agent, scope }),
  policy: (owner: string, agent: string, scope: 'private' | 'master', policy: MemoryPolicy) => request<{ bank: MemoryBank }>('/policy', owner, { agent, scope, policy }),
  export: (owner: string, agent: string, scope: 'private' | 'master') => request<Record<string, unknown>>('/export', owner, { agent, scope }),
  promote: (owner: string, agent: string, input: { recordId: string; text: string; source: string; confidence: number; kind: 'observation' | 'fact'; reviewed: boolean }) => request('/promote', owner, { agent, ...input }),
  correct: (owner: string, agent: string, scope: 'private' | 'master', input: { recordId: string; text: string; source: string; confidence: number; kind: 'observation' | 'fact'; reviewed: boolean }) => request('/correct', owner, { agent, scope, ...input }),
  delete: (owner: string, agent: string, scope: 'private' | 'master', recordId: string) => request<{ deleted: boolean; indexes: { hindsight: string; honcho: string }; pendingProviderPurges: number }>('/delete', owner, { agent, scope, recordId, confirmed: true }),
  admit: (owner: string, agent: string, scope: 'private' | 'master', input: { text: string; source: string; confidence: number; kind: 'observation' | 'fact'; reviewed: boolean }) => request('/admit', owner, { agent, scope, ...input }),
  restore: (owner: string, agent: string, scope: 'private' | 'master', backup: unknown, reviewed: boolean) => request('/restore', owner, { agent, scope, backup, confirmed: true, reviewed }),
  purge: (owner: string, agent: string, scope: 'private' | 'master') => request<{ retried: number; pendingProviderPurges: number }>('/purge', owner, { agent, scope }),
};
