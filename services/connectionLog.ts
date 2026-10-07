export interface ConnectionEvent { at: string; source: string; status: string; detail: string }
const key = 'quanta_connection_log_v1';
export function readConnectionLog(): ConnectionEvent[] {
  try { const entries = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(entries) ? entries.filter(e => e && typeof e.at === 'string' && typeof e.source === 'string' && typeof e.status === 'string' && typeof e.detail === 'string').slice(-100) : []; } catch { return []; }
}
export function logConnection(source: string, status: string, detail: string) {
  const event = { at: new Date().toISOString(), source: source.slice(0,100), status: status.slice(0,60), detail: detail.slice(0,300) };
  try { localStorage.setItem(key, JSON.stringify([...readConnectionLog(), event].slice(-100))); } catch {}
  window.dispatchEvent(new Event('quanta_connection_log'));
}
