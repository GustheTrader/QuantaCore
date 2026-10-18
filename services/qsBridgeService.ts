export async function qsBridgeRequest<T>(route: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/qs-bridge${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Quanta-Client': 'local-ui', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: 'no-store', signal: AbortSignal.timeout(12000) });
  const data = await response.json(); if (!response.ok) throw Error(data?.error?.message || 'The local QS bridge is unavailable.'); return data;
}
