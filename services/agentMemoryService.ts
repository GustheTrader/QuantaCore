export interface AgentMemoryStatus {
  checkedAt: string;
  persistence: 'local';
  services: { id: 'hindsight' | 'honcho'; status: 'responding' | 'unavailable' | 'authentication-required' | 'error'; latencyMs: number }[];
}

export interface AgentMemoryContext {
  hindsight: { source: string; type?: string; text: string }[];
  honcho: string;
  available: boolean;
  degraded: boolean;
}

async function request<T>(path: string, owner: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/memory${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui' },
    ...(body ? { body: JSON.stringify({ ...body, owner }) } : {}),
    signal
  });
  let result: any;
  try { result = await response.json(); }
  catch { throw new Error('Local memory service is unavailable. Start the QuantaCore local server.'); }
  if (!response.ok) throw new Error(result.error?.message || `Memory request failed (${response.status}).`);
  return result as T;
}

export const loadAgentMemoryStatus = (owner: string) => request<AgentMemoryStatus>('/status', owner);

export const retrieveAgentMemory = (input: { owner: string; threadId: string; agent: string; query: string }, signal?: AbortSignal) =>
  request<AgentMemoryContext>('/context', input.owner, { threadId: input.threadId, agent: input.agent, query: input.query }, signal);

export const retainAgentMemoryTurn = (input: { owner: string; threadId: string; agent: string; query: string; userMessage: string; assistantMessage: string }, signal?: AbortSignal) =>
  request<{ stored: boolean; services: { hindsight: string; honcho: string } }>('/turn', input.owner, {
    threadId: input.threadId,
    agent: input.agent,
    query: input.query,
    userMessage: input.userMessage,
    assistantMessage: input.assistantMessage
  }, signal);
