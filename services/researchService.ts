import type { BatchRequest, Event as ResearchEvent, Portfolio, Run, RunRequest } from '../lib/research-contract';

export type ResearchHealth = {
  name: string;
  sidecar: { status: 'ready' | 'unavailable' | 'starting'; message: string; port: number };
  engine: { version: string; commit: string };
  models: { id: string; label: string; input_rate: number | null; output_rate: number | null }[];
  research_only: true;
};

export type ResearchEstimate = {
  expected_calls: number;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_cost_usd: number | null;
  price_known: boolean;
  warnings: string[];
};

export type ResearchBatch = {
  id: string;
  runs: Run[];
  summary: {
    completed: number;
    failed: number;
    pending: number;
    review: number;
    by_rating: Record<string, number>;
    limitations: string[];
    [key: string]: unknown;
  };
};

export const isLocalResearchHost = (hostname = typeof window === 'undefined' ? '' : window.location.hostname) =>
  ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname.toLowerCase());

export const safeResearchUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const tickerPattern = /^[A-Z0-9][A-Z0-9.^=-]{0,23}$/;

export const parsePortfolio = (text: string): Portfolio | null => {
  if (!text.trim()) return null;
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Portfolio must contain valid JSON.'); }
  if (!isRecord(value) || Object.keys(value).some(key => !['cash', 'currency', 'positions'].includes(key)) ||
    !['cash', 'currency', 'positions'].every(key => key in value)) {
    throw new Error('Portfolio must contain only cash, currency and positions.');
  }
  if (value.cash !== null && (typeof value.cash !== 'number' || !Number.isFinite(value.cash))) throw new Error('Portfolio cash must be a finite number or null.');
  if (value.currency !== null && typeof value.currency !== 'string') throw new Error('Portfolio currency must be a string or null.');
  if (!Array.isArray(value.positions) || value.positions.length > 100) throw new Error('Portfolio positions must be an array with at most 100 positions.');
  for (const position of value.positions) {
    if (!isRecord(position) || Object.keys(position).some(key => !['ticker', 'quantity', 'average_price'].includes(key)) ||
      !['ticker', 'quantity', 'average_price'].every(key => key in position)) throw new Error('Each position requires ticker, quantity and average_price.');
    if (typeof position.ticker !== 'string' || !tickerPattern.test(position.ticker)) throw new Error('Each position ticker must be an uppercase stock symbol.');
    if (typeof position.quantity !== 'number' || !Number.isFinite(position.quantity)) throw new Error('Position quantity must be a finite number.');
    if (position.average_price !== null && (typeof position.average_price !== 'number' || !Number.isFinite(position.average_price) || position.average_price <= 0)) throw new Error('Position average_price must be positive and finite, or null.');
  }
  return value as Portfolio;
};

const requireLocal = () => {
  if (!isLocalResearchHost()) throw new Error('Gnoesis Agenic Research runs on your local computer. Open the local QuantaCore server to use research.');
};

const headers = (extra?: HeadersInit) => {
  const result = new Headers(extra);
  result.set('X-Quanta-Client', 'local-ui');
  return result;
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  requireLocal();
  const requestHeaders = headers(options.headers);
  if (options.body) requestHeaders.set('Content-Type', 'application/json');
  const response = await fetch(`/api/trading${path}`, { ...options, headers: requestHeaders, credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    let message = `Research request failed (${response.status}).`;
    try {
      const result = await response.json();
      message = typeof result.error === 'string' ? result.error : result.error?.message || result.message || message;
    } catch { /* Non-JSON failure remains visible without exposing server HTML. */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
};

const post = <T>(path: string, body?: unknown, extra?: HeadersInit) => request<T>(path, {
  method: 'POST', headers: extra, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const researchService = {
  health: () => request<ResearchHealth>('/health'),
  estimate: (run: RunRequest) => post<ResearchEstimate>('/estimate', run),
  runs: () => request<{ runs: Run[] }>('/runs'),
  run: (id: string) => request<Run>(`/runs/${encodeURIComponent(id)}`),
  start: (run: RunRequest, idempotencyKey: string) => post<{ run_id: string; run: Run }>('/runs', run, { 'Idempotency-Key': idempotencyKey }),
  cancel: (id: string) => post<Run>(`/runs/${encodeURIComponent(id)}/cancel`),
  resume: (id: string) => post<Run>(`/runs/${encodeURIComponent(id)}/resume`),
  settle: (id: string) => post<Run>(`/runs/${encodeURIComponent(id)}/settle`),
  decisions: (filter: { ticker?: string; rating?: string; date?: string }) => {
    const query = new URLSearchParams(Object.entries(filter).filter(([, value]) => !!value));
    return request<{ runs: Run[] }>(`/decisions?${query}`);
  },
  startBatch: (batch: BatchRequest, idempotencyKey: string) => post<{ batch_id: string; run_ids: string[] }>('/backtest', batch, { 'Idempotency-Key': idempotencyKey }),
  batch: (id: string) => request<ResearchBatch>(`/backtest/${encodeURIComponent(id)}`),
  resumeBatch: (id: string) => post<ResearchBatch>(`/backtest/${encodeURIComponent(id)}/resume`),
  artifact: async (id: string, format: 'md' | 'json'): Promise<string> => {
    requireLocal();
    const suffix = format === 'json' ? 'artifact.json' : 'artifacts';
    const response = await fetch(`/api/trading/runs/${encodeURIComponent(id)}/${suffix}`, { headers: headers(), credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`Artifact is unavailable (${response.status}).`);
    return response.text();
  },
};

type SseRecord = { id: string; data: string };

/** A streaming SSE decoder. CRLF can straddle network chunks; data may span lines. */
export class ResearchSseDecoder {
  private buffer = '';
  private id = '';
  private data: string[] = [];
  constructor(private readonly onRecord: (record: SseRecord) => void) {}
  push(chunk: string) {
    this.buffer += chunk;
    let index = 0;
    while (index < this.buffer.length) {
      let end = index;
      while (end < this.buffer.length && this.buffer[end] !== '\r' && this.buffer[end] !== '\n') end++;
      if (end === this.buffer.length || (this.buffer[end] === '\r' && end + 1 === this.buffer.length)) break;
      const line = this.buffer.slice(index, end);
      index = end + (this.buffer[end] === '\r' && this.buffer[end + 1] === '\n' ? 2 : 1);
      if (!line) {
        if (this.data.length) this.onRecord({ id: this.id, data: this.data.join('\n') });
        this.data = [];
      } else if (!line.startsWith(':')) {
        const separator = line.indexOf(':');
        const field = separator < 0 ? line : line.slice(0, separator);
        let value = separator < 0 ? '' : line.slice(separator + 1);
        if (value.startsWith(' ')) value = value.slice(1);
        if (field === 'data') this.data.push(value);
        if (field === 'id' && !value.includes('\0')) this.id = value;
      }
    }
    this.buffer = this.buffer.slice(index);
  }
}

const abortableDelay = (duration: number, signal: AbortSignal) => new Promise<void>(resolve => {
  if (signal.aborted) { resolve(); return; }
  const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
  const timer = setTimeout(done, duration);
  signal.addEventListener('abort', done, { once: true });
});

export type ResearchStreamState = 'connecting' | 'connected' | 'reconnecting' | 'closed';

/** Fetch streaming keeps the local-client header and replays from the last accepted seq. */
export const watchResearchEvents = async (
  runId: string,
  options: { signal: AbortSignal; onEvent: (event: ResearchEvent) => void; onState: (state: ResearchStreamState, message?: string) => void; shouldReconnect: () => boolean },
) => {
  requireLocal();
  let cursor = 0;
  let attempts = 0;
  let terminalEvent = false;
  while (!options.signal.aborted) {
    options.onState(attempts ? 'reconnecting' : 'connecting');
    try {
      const response = await fetch(`/api/trading/runs/${encodeURIComponent(runId)}/events`, {
        headers: headers({ Accept: 'text/event-stream', ...(cursor ? { 'Last-Event-ID': String(cursor) } : {}) }),
        signal: options.signal, credentials: 'same-origin', cache: 'no-store',
      });
      if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error(`Event stream is unavailable (${response.status}).`);
      options.onState('connected');
      const parser = new ResearchSseDecoder(record => {
        if (record.data === '[DONE]') return;
        const event: unknown = JSON.parse(record.data);
        if (!isRecord(event) || event.run_id !== runId || !Number.isInteger(event.seq) || Number(event.seq) < 1 ||
          typeof event.type !== 'string' || typeof event.at !== 'string' || !isRecord(event.payload)) throw new Error('The research event stream returned an invalid event.');
        if (Number(event.seq) <= cursor) return;
        if (record.id && Number(record.id) !== event.seq) throw new Error('Research event sequence does not match its replay ID.');
        options.onEvent(event as ResearchEvent);
        cursor = Number(event.seq);
        attempts = 0;
        if (['result', 'run.error', 'run.cancelled'].includes(event.type)) terminalEvent = true;
        if (['run.started', 'run.resumed'].includes(event.type)) terminalEvent = false;
      });
      const reader = response.body.getReader();
      const text = new TextDecoder();
      try {
        while (!options.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) { parser.push(text.decode()); break; }
          parser.push(text.decode(value, { stream: true }));
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      if (terminalEvent || !options.shouldReconnect()) break;
      throw new Error('Connection closed; replaying research events.');
    } catch (error) {
      if (options.signal.aborted) break;
      attempts++;
      options.onState('reconnecting', error instanceof Error ? error.message : 'Reconnecting to research events.');
      await abortableDelay(Math.min(15000, 1000 * 2 ** Math.min(attempts - 1, 4)), options.signal);
    }
  }
  if (!options.signal.aborted) options.onState('closed');
};
