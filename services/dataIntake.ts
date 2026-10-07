export type DataKind = 'trading' | 'business' | 'personal' | 'chat';
export interface Intake { id: string; name: string; kind: DataKind; original: string; hash: string; importedAt: string; rows: Record<string, unknown>[]; issues: string[]; agents: string[]; mapping: Record<string, string>; }
export function parseCsv(text: string): Record<string, unknown>[] {
  const lines: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; } else if (c === ',' && !quoted) { row.push(cell); cell = ''; } else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(v => v.trim())) lines.push(row); row = []; cell = ''; } else cell += c; }
  if (quoted) throw new Error('CSV has an unclosed quoted field.');
  row.push(cell); if (row.some(v => v.trim())) lines.push(row);
  const headers = lines.shift()?.map(h => h.trim().replace(/^\uFEFF/, '')) || [];
  if (!headers.length || headers.some(h => !h) || new Set(headers).size !== headers.length) throw new Error('CSV requires unique, nonempty column names.');
  return lines.map((values, i) => { if (values.length !== headers.length) throw new Error(`CSV row ${i + 2} has the wrong number of columns.`); return Object.fromEntries(headers.map((h, n) => [h, values[n]])); });
}
export function parseIntake(name: string, text: string): Record<string, unknown>[] {
  if (/\.csv$/i.test(name)) return parseCsv(text);
  if (/\.jsonl$/i.test(name)) return text.split(/\r?\n/).filter(s => s.trim()).map(s => ({ value: JSON.parse(s) }));
  if (/\.json$/i.test(name)) {
    const parsed = JSON.parse(text); const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.flatMap((entry: any) => {
      if (entry?.mapping && typeof entry.mapping === 'object') return Object.values(entry.mapping).flatMap((node: any) => node?.message ? [{ conversation: entry.title, role: node.message.author?.role, timestamp: node.message.create_time, content: node.message.content?.parts?.filter((p: unknown) => typeof p === 'string').join('\n') || '' }] : []);
      if (Array.isArray(entry?.messages)) return entry.messages.map((m: any) => ({ conversation: entry.title || entry.name || '', ...m }));
      return [entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : { value: entry }];
    });
  }
  if (/\.(txt|md)$/i.test(name)) return [{ content: text }];
  throw new Error('Use CSV, JSON, JSONL, TXT or Markdown. PDF, spreadsheets and archives need a later adapter.');
}
export function validateIntake(rows: Record<string, unknown>[], kind: DataKind, mapping: Record<string, string>): string[] {
  const issues: string[] = []; if (!rows.length) issues.push('No records found.');
  const fingerprints = rows.map(r => JSON.stringify(r)); const duplicates = fingerprints.length - new Set(fingerprints).size;
  if (duplicates) issues.push(`${duplicates} duplicate records retained for review.`);
  if (kind === 'trading') {
    for (const field of ['timestamp', 'instrument', 'price']) if (!mapping[field]) issues.push(`Map the ${field} column.`);
    let prior = -Infinity, badTime = 0, badPrice = 0, missing = 0, unordered = false;
    for (const row of rows) { const raw = row[mapping.timestamp]; const time = typeof raw === 'number' ? (raw < 1e12 ? raw * 1000 : raw) : Date.parse(String(raw)); if (!Number.isFinite(time)) badTime++; else { if (time < prior) unordered = true; prior = time; } const price = row[mapping.price]; if (price === '' || price == null || !Number.isFinite(Number(price))) badPrice++; if (!String(row[mapping.instrument] ?? '').trim()) missing++; }
    if (badTime) issues.push(`${badTime} invalid timestamps; use ISO timestamps with timezone or numeric Unix timestamps.`);
    if (badPrice) issues.push(`${badPrice} invalid prices.`); if (missing) issues.push(`${missing} missing instruments.`); if (unordered) issues.push('Records are not ordered by time.');
    issues.push('Research intake only: quote execution, gaps, costs and settlement truth are not certified.');
  }
  return issues;
}
async function db() { return new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('quanta_data_intake_v1', 1); r.onupgradeneeded = () => r.result.createObjectStore('imports', { keyPath: 'id' }); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
async function operation<T>(mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> { const d = await db(); return new Promise((resolve, reject) => { const tx = d.transaction('imports', mode); const request = action(tx.objectStore('imports')); tx.oncomplete = () => { d.close(); resolve(request.result); }; tx.onerror = tx.onabort = () => { d.close(); reject(tx.error || new Error('Local storage transaction failed.')); }; }); }
export const listIntakes = () => operation('readonly', s => s.getAll()) as Promise<Intake[]>;
export const saveIntake = (item: Intake) => operation('readwrite', s => s.put(item));
