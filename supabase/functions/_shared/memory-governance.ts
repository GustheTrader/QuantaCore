import { screenMemory } from './memory-defense.ts';

export type MemoryPolicy = { sensitiveData: 'redact' | 'block'; hindsightIndex: boolean; honchoArchive: boolean };
export type MemoryBank = { id: string; owner: string; agent: string; scope: 'private' | 'master'; policy: MemoryPolicy; version: number; updatedAt: string };
export type MemoryRecord = {
  id: string; owner: string; bankId: string; agent: string; threadId: string; text: string;
  kind: 'conversation' | 'observation' | 'fact'; reviewStatus: 'unreviewed' | 'human_reviewed';
  status: 'active' | 'deleted' | 'superseded'; source: string; confidence: number | null;
  contentSha256: string; previousId?: string; reviewedBy?: string; reviewedAt?: string;
  lineageRelation?: 'promotion' | 'correction';
  createdAt: string; updatedAt: string; version: number;
  indexes: { hindsight: string; honcho: string };
};
export type MemoryEvent = { id: string; owner: string; bankId: string; recordId?: string; action: string; matchedTypes: string[]; at: string; contentSha256?: string; previousId?: string };
export type MemoryChange = { bank?: MemoryBank; records?: MemoryRecord[]; events?: MemoryEvent[] };
export interface MemoryStore {
  bank(owner: string, id: string): Promise<MemoryBank | undefined>;
  record(owner: string, id: string): Promise<MemoryRecord | undefined>;
  records(owner: string, bankId: string, limit: number): Promise<MemoryRecord[]>;
  events(owner: string, bankId: string, limit: number): Promise<MemoryEvent[]>;
  children(owner: string, recordId: string): Promise<MemoryRecord[]>;
  commit(owner: string, change: MemoryChange): Promise<void>;
  checkpoint?(): Promise<void>;
}
export interface MemoryIndexes {
  put(bank: MemoryBank, record: MemoryRecord, isCurrent?: () => Promise<boolean>): Promise<MemoryRecord['indexes']>;
  remove(bank: MemoryBank, record: MemoryRecord): Promise<MemoryRecord['indexes']>;
  search?(bank: MemoryBank, query: string): Promise<string[]>;
}
export const DEFAULT_MEMORY_POLICY: MemoryPolicy = { sensitiveData: 'redact', hindsightIndex: false, honchoArchive: false };
export const memoryFailure = (message: string, status = 400) => Object.assign(new Error(message), { status });
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const required = (value: unknown, limit: number, label: string) => {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw memoryFailure(`${label} is required (up to ${limit} characters).`);
  return value.trim();
};
export async function memoryDigest(text: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function memoryBankIdentity(owner: string, agent: string, scope: 'private' | 'master' = 'private') {
  const ownerHash = (await memoryDigest(owner)).slice(0, 24);
  return scope === 'master' ? `qm-v2-${ownerHash}-master` : `qm-v2-${ownerHash}-a-${(await memoryDigest(agent.normalize('NFKC').toLowerCase())).slice(0, 20)}`;
}
const event = (owner: string, bank: MemoryBank, action: string, record?: MemoryRecord, matchedTypes: string[] = []): MemoryEvent => ({
  id: crypto.randomUUID(), owner, bankId: bank.id, action, recordId: record?.id, matchedTypes, at: new Date().toISOString(), contentSha256: record?.contentSha256, previousId: record?.previousId,
});

export async function handleMemoryAction(store: MemoryStore, indexes: MemoryIndexes, owner: string, action: string, body: Record<string, any>) {
  const agent = required(body.agent, 80, 'Agent').normalize('NFKC');
  if (screenMemory(agent, 'block').blocked) throw memoryFailure('Sensitive data cannot be used as a memory identity.');
  const scope = body.scope === 'master' ? 'master' : 'private';
  if (body.scope !== undefined && !['private', 'master'].includes(body.scope)) throw memoryFailure('Invalid memory bank scope.');
  const bankId = await memoryBankIdentity(owner, agent, scope);
  let bank = await store.bank(owner, bankId) || { id: bankId, owner, agent: scope === 'master' ? 'master' : agent, scope, policy: { ...DEFAULT_MEMORY_POLICY }, version: 0, updatedAt: new Date().toISOString() } as MemoryBank;
  const ensureBank = async () => {
    if (!bank.version) { bank = { ...bank, version: 1 }; await store.commit(owner, { bank, events: [event(owner, bank, 'bank.created')] }); }
  };
  const records = async (limit = 1001) => store.records(owner, bank.id, limit);
  const ownRecord = async () => {
    if (typeof body.recordId !== 'string' || !uuid.test(body.recordId)) throw memoryFailure('Select a memory record.');
    const record = await store.record(owner, body.recordId);
    if (!record || record.bankId !== bank.id) throw memoryFailure('Memory record is outside this agent bank.', 404);
    return record;
  };
  const admit = async (text: string, source: string, target = bank) => {
    const policy = target.policy;
    const contentScreen = screenMemory(text, policy.sensitiveData);
    const sourceScreen = screenMemory(source, policy.sensitiveData);
    const matchedTypes = [...new Set([...contentScreen.matchedTypes, ...sourceScreen.matchedTypes])];
    if (contentScreen.blocked || sourceScreen.blocked) {
      if (!target.version) { target = { ...target, version: 1 }; await store.commit(owner, { bank: target }); if (target.id === bank.id) bank = target; }
      await store.commit(owner, { events: [event(owner, target, 'memory.blocked', undefined, matchedTypes)] });
      throw memoryFailure('Memory Defense blocked this item. No content was stored or sent to a memory provider.', 422);
    }
    return { text: contentScreen.text, source: sourceScreen.text, matchedTypes };
  };
  const projectionState = (target: MemoryBank) => ({ hindsight: target.policy.hindsightIndex ? 'pending' : 'disabled', honcho: target.policy.honchoArchive ? 'pending' : 'disabled' });
  const needsPurge = (record: MemoryRecord, target?: MemoryBank) => {
    const pending = (provider: 'hindsight' | 'honcho') => {
      const value = record.indexes[provider]; if (['disabled', 'purged', 'session-purged'].includes(value)) return false;
      if (record.status === 'active' && target && target.policy[provider === 'hindsight' ? 'hindsightIndex' : 'honchoArchive']) return false;
      return true;
    };
    return pending('hindsight') || pending('honcho');
  };
  const validLineage = async (record: MemoryRecord) => {
    let child = record; const seen = new Set<string>();
    while (child.previousId) {
      if (seen.has(child.id) || seen.size >= 100) return false; seen.add(child.id);
      const parent = await store.record(owner, child.previousId);
      if (!parent || parent.status === 'deleted' || (child.lineageRelation === 'promotion' && parent.status !== 'active')) return false;
      child = parent;
    }
    return true;
  };
  const purge = async (target: MemoryBank, record: MemoryRecord, providers?: { hindsight?: boolean; honcho?: boolean }) => {
    const selected = providers || { hindsight: true, honcho: true };
    const removalRecord = { ...record, indexes: { hindsight: selected.hindsight ? record.indexes.hindsight : 'disabled', honcho: selected.honcho ? record.indexes.honcho : 'disabled' } };
    let removed: MemoryRecord['indexes'] = removalRecord.indexes;
    try { removed = await indexes.remove(target, removalRecord); } catch {}
    const statuses = { hindsight: selected.hindsight ? removed.hindsight : record.indexes.hindsight, honcho: selected.honcho ? removed.honcho : record.indexes.honcho };
    const latest = await store.record(owner, record.id);
    if (!latest) return record;
    const updated = { ...latest, indexes: statuses, version: latest.version + 1, updatedAt: new Date().toISOString() };
    await store.commit(owner, { records: [updated], events: [event(owner, target, latest.status === 'active' ? 'indexes.removed' : 'deletion.propagation', updated)] });
    return updated;
  };
  const mirror = async (target: MemoryBank, record: MemoryRecord) => {
    const isCurrent = async () => {
      const current = await store.record(owner, record.id), currentBank = await store.bank(owner, target.id);
      return current?.status === 'active' && !!currentBank && currentBank.policy.hindsightIndex === target.policy.hindsightIndex && currentBank.policy.honchoArchive === target.policy.honchoArchive;
    };
    if (!await isCurrent()) return record;
    let statuses: MemoryRecord['indexes'];
    try { statuses = await indexes.put(target, record, isCurrent); } catch { statuses = record.indexes; }
    const latest = await store.record(owner, record.id);
    if (!latest) return record;
    // A deletion in another worker may finish while a provider write is in flight.
    // Purge the late write, leaving a retryable receipt if the provider is unavailable.
    const latestBank = await store.bank(owner, target.id);
    if (latest.status !== 'active' || (!latestBank?.policy.hindsightIndex && statuses.hindsight !== 'disabled') || (!latestBank?.policy.honchoArchive && statuses.honcho !== 'disabled')) return purge(latestBank || target, { ...latest, indexes: statuses }, { hindsight: latest.status !== 'active' || !latestBank?.policy.hindsightIndex, honcho: latest.status !== 'active' || !latestBank?.policy.honchoArchive });
    const updated = { ...latest, indexes: statuses, version: latest.version + 1, updatedAt: new Date().toISOString() };
    await store.commit(owner, { records: [updated], events: [event(owner, target, 'indexes.observed', updated)] });
    return updated;
  };
  if (action === 'policy') {
    if (body.policy !== undefined) {
      const requested = body.policy;
      if (!requested || !['redact', 'block'].includes(requested.sensitiveData) || typeof requested.hindsightIndex !== 'boolean' || typeof requested.honchoArchive !== 'boolean') throw memoryFailure('Choose redact or block and explicit index settings.');
      if (scope === 'master' && requested.honchoArchive) throw memoryFailure('Master knowledge is not mirrored into an agent archive.');
      const previous = bank.policy;
      bank = { ...bank, policy: { sensitiveData: requested.sensitiveData, hindsightIndex: requested.hindsightIndex, honchoArchive: requested.honchoArchive }, version: bank.version + 1, updatedAt: new Date().toISOString() };
      await store.commit(owner, { bank, events: [event(owner, bank, 'policy.updated')] });
      if ((previous.hindsightIndex && !bank.policy.hindsightIndex) || (previous.honchoArchive && !bank.policy.honchoArchive)) {
        const selected = (await records(1001)).filter(record => record.status === 'active' && needsPurge(record, bank));
        for (const record of selected.slice(0, 5)) await purge(bank, record, { hindsight: previous.hindsightIndex && !bank.policy.hindsightIndex, honcho: previous.honchoArchive && !bank.policy.honchoArchive });
      }
    }
    const pendingProjections = (await records(1001)).filter(record => record.status === 'active' && needsPurge(record, bank)).length;
    return { bank, futureWritesOnly: true, pendingProjections, legacyMigrationRequired: true };
  }
  if (action === 'records' || action === 'export') {
    const all = await records();
    if (all.length > 1000) throw memoryFailure('Export this bank in pages before accessing more than 1,000 records.', 413);
    const visible: MemoryRecord[] = [], stale: string[] = [];
    for (const record of all.filter(record => record.status === 'active')) {
      visible.push(record); if (!await validLineage(record)) stale.push(record.id);
    }
    const audit = await store.events(owner, bank.id, 1000);
    return action === 'export' ? { schema: 'quanta-memory-v2', exportedAt: new Date().toISOString(), bank, records: visible.filter(record => !stale.includes(record.id)), lineage: all.filter(record => record.status !== 'active').map(({ text, source, ...record }) => record), staleSourceIds: stale, audit }
      : { bank, records: visible.slice(0, 100), total: visible.length, staleSourceIds: stale, pendingPurges: all.filter(record => needsPurge(record, bank)).map(record => ({ id: record.id, indexes: record.indexes, status: record.status })), audit: audit.slice(0, 100), legacyMigrationRequired: true };
  }
  if (action === 'context') {
    if (scope !== 'private') throw memoryFailure('Retrieve shared knowledge through a private agent context.');
    const screened = screenMemory(required(body.query, 12000, 'Query'), bank.policy.sensitiveData);
    if (screened.blocked) throw memoryFailure('Memory Defense blocked the query before retrieval.', 422);
    let candidates = (await records(500)).filter(record => record.status === 'active');
    if (body.includeMaster === true) {
      const sharedId = await memoryBankIdentity(owner, agent, 'master');
      candidates.push(...(await store.records(owner, sharedId, 500)).filter(record => record.status === 'active' && record.reviewStatus === 'human_reviewed'));
    }
    const qualified: MemoryRecord[] = []; for (const record of candidates) if (await validLineage(record)) qualified.push(record); candidates = qualified;
    let indexIds: string[] = [];
    if (bank.version && bank.policy.hindsightIndex && indexes.search) { try { indexIds = await indexes.search(bank, screened.text); } catch {} }
    const words = screened.text.toLowerCase().match(/[\p{L}\p{N}_]{2,}/gu)?.slice(0, 40) || [];
    const ranked = candidates.map(record => ({ record, score: (indexIds.includes(record.id) ? 50 : 0) + words.reduce((score, word) => score + Number(record.text.toLowerCase().includes(word)), 0) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
    return { hindsight: ranked.map(({ record }) => ({ source: 'Quanta admitted memory', id: record.id, type: `${record.kind} · ${record.reviewStatus}`, text: record.text.slice(0, 1800), provenance: { source: record.source, confidence: record.confidence, contentSha256: record.contentSha256, bankId: record.bankId, reviewedAt: record.reviewedAt } })), honcho: '', available: ranked.length > 0, degraded: false, custody: 'private-agent-and-explicit-reviewed-master' };
  }
  if (action === 'turn') {
    if (scope !== 'private') throw memoryFailure('Conversation turns belong to a private agent bank.');
    const threadId = required(body.threadId, 128, 'Thread');
    if (!/^[A-Za-z0-9_-]+$/.test(threadId) || screenMemory(threadId, 'block').blocked) throw memoryFailure('Invalid or sensitive thread identity.');
    const admitted = await admit(`User request: ${required(body.userMessage, 12000, 'User message')}\nAgent response: ${required(body.assistantMessage, 24000, 'Assistant message')}`, `Conversation ${threadId}; unreviewed source text`);
    await ensureBank();
    if ((await records()).length >= 1000) throw memoryFailure('Export and archive this bank before adding more than 1,000 records.', 413);
    const at = new Date().toISOString();
    const record: MemoryRecord = { id: crypto.randomUUID(), owner, bankId: bank.id, agent, threadId, text: admitted.text, kind: 'conversation', reviewStatus: 'unreviewed', status: 'active', source: admitted.source, confidence: null, contentSha256: await memoryDigest(admitted.text), createdAt: at, updatedAt: at, version: 1, indexes: projectionState(bank) };
    await store.commit(owner, { records: [record], events: [event(owner, bank, admitted.matchedTypes.length ? 'memory.redacted' : 'memory.admitted', record, admitted.matchedTypes)] });
    const mirrored = await mirror(bank, record);
    return { stored: true, recordId: record.id, services: { ledger: 'stored', ...mirrored.indexes }, defense: { action: admitted.matchedTypes.length ? 'redact' : 'allow', matchedTypes: admitted.matchedTypes }, reviewStatus: record.reviewStatus };
  }
  if (action === 'promote' || action === 'correct') {
    const current = await ownRecord();
    if (current.status !== 'active') throw memoryFailure('This record was already removed or replaced.', 409);
    if (action === 'promote' && scope !== 'private') throw memoryFailure('Only private records can be promoted.');
    const targetScope = action === 'promote' ? 'master' : scope;
    if (targetScope === 'master' && body.reviewed !== true) throw memoryFailure('Human review is required before sharing master knowledge.');
    const kind = body.kind === 'fact' ? 'fact' : 'observation';
    const source = required(body.source, 1000, 'Provenance source or evidence reference');
    if (typeof body.confidence !== 'number' || !Number.isFinite(body.confidence) || body.confidence < 0 || body.confidence > 1) throw memoryFailure('Enter an operator confidence assessment between 0 and 1.');
    if (kind === 'fact' && body.reviewed !== true) throw memoryFailure('A fact requires explicit human review of its source.');
    let target = bank;
    if (targetScope === 'master') {
      const id = await memoryBankIdentity(owner, agent, 'master');
      target = await store.bank(owner, id) || { ...bank, id, agent: 'master', scope: 'master', policy: { ...DEFAULT_MEMORY_POLICY }, version: 0 };
    }
    const admitted = await admit(required(body.text, 36000, 'Reviewed memory text'), source, target);
    if ((await store.records(owner, target.id, 1001)).length >= 1000) throw memoryFailure('This bank has reached its 1,000-record recovery boundary.', 413);
    const at = new Date().toISOString();
    const record: MemoryRecord = { ...current, id: crypto.randomUUID(), bankId: target.id, text: admitted.text, source: admitted.source, confidence: body.confidence, kind, contentSha256: await memoryDigest(admitted.text), previousId: current.id, lineageRelation: action === 'promote' ? 'promotion' : 'correction', reviewStatus: body.reviewed === true ? 'human_reviewed' : 'unreviewed', reviewedBy: body.reviewed === true ? owner : undefined, reviewedAt: body.reviewed === true ? at : undefined, createdAt: at, updatedAt: at, version: 1, indexes: projectionState(target) };
    const changes: MemoryChange = { records: [record], events: [event(owner, target, action === 'promote' ? 'memory.promoted' : 'memory.corrected', record, admitted.matchedTypes)] };
    if (!target.version) { target = { ...target, version: 1 }; changes.bank = target; }
    if (action === 'correct') changes.records!.push({ ...current, text: '', source: '', confidence: null, status: 'superseded', updatedAt: at, version: current.version + 1 });
    await store.commit(owner, changes);
    if (action === 'correct') { try { await store.checkpoint?.(); } catch {} await purge(bank, current); }
    return { record: await mirror(target, record), humanReviewed: record.reviewStatus === 'human_reviewed' };
  }
  if (action === 'delete') {
    if (body.confirmed !== true) throw memoryFailure('Confirm deletion of this specific memory record.');
    const current = await ownRecord();
    const related = [current], seen = new Set([current.id]);
    for (let i = 0; i < related.length; i++) {
      for (const child of await store.children(owner, related[i].id)) if (!seen.has(child.id)) { seen.add(child.id); related.push(child); }
      if (related.length > 1000) throw memoryFailure('This lineage exceeds the bounded deletion window. Export and review a staged deletion plan.', 413);
    }
    const selected = related.filter(record => record.status !== 'deleted');
    if (!selected.length) return { deleted: true, alreadyRemoved: true, indexes: current.indexes };
    const at = new Date().toISOString();
    const removed = selected.map(record => ({ ...record, text: '', source: '', confidence: null, status: 'deleted' as const, updatedAt: at, version: record.version + 1, indexes: { hindsight: record.indexes.hindsight === 'disabled' ? 'disabled' : 'purge-pending', honcho: record.indexes.honcho === 'disabled' ? 'disabled' : 'purge-pending' } }));
    await store.commit(owner, { records: removed, events: removed.map(record => ({ ...event(owner, bank, 'memory.deleted', record), bankId: record.bankId })) });
    try { await store.checkpoint?.(); } catch {}
    let statuses = removed[0]?.indexes || current.indexes;
    // Purge a bounded number synchronously. Larger deletions retain explicit
    // pending state; canonical recall/export already exclude all descendants.
    for (let i = 0; i < Math.min(selected.length, 5); i++) {
      const target = await store.bank(owner, selected[i].bankId); if (!target) continue;
      const result = await purge(target, removed[i]);
      if (selected[i].id === current.id) statuses = result.indexes;
    }
    let pendingProviderPurges = 0; for (const record of removed) { const latest = await store.record(owner, record.id); if (latest && needsPurge(latest)) pendingProviderPurges++; }
    return { deleted: true, deletedRecords: removed.length, excludedFromRecallAndExport: true, indexes: statuses, pendingProviderPurges };
  }
  if (action === 'purge') {
    const pending = (await records()).filter(record => needsPurge(record, bank));
    for (const record of pending.slice(0, 5)) await purge(bank, record, record.status === 'active' ? { hindsight: !bank.policy.hindsightIndex, honcho: !bank.policy.honchoArchive } : undefined);
    const remaining = (await records()).filter(record => needsPurge(record, bank)).length;
    return { retried: Math.min(pending.length, 5), pendingProviderPurges: remaining };
  }
  if (action === 'admit' || action === 'restore') {
    const recovering = action === 'restore';
    if (recovering && body.confirmed !== true) throw memoryFailure('Confirm screened recovery into this bank.');
    const backup = body.backup;
    if (recovering && (!backup || backup.schema !== 'quanta-memory-v2' || backup.bank?.id !== bank.id || backup.bank?.owner !== owner)) throw memoryFailure('Recovery must match your verified identity and selected agent bank.', 403);
    const entries = recovering ? backup.records : [body];
    if (!Array.isArray(entries) || !entries.length || entries.length > 25) throw memoryFailure('Recover 1–25 active records per request.');
    if ((await records()).length + entries.length > 1000) throw memoryFailure('This bank has reached its 1,000-record recovery boundary.', 413);
    if (scope === 'master' && body.reviewed !== true) throw memoryFailure('Review every imported source before recovering master knowledge.');
    const prepared: MemoryRecord[] = [], events: MemoryEvent[] = [], ids = new Set<string>();
    const at = new Date().toISOString();
    for (const entry of entries) {
      const id = recovering ? required(entry.id, 36, 'Recovery record ID') : crypto.randomUUID();
      if (!uuid.test(id) || ids.has(id)) throw memoryFailure('Invalid or duplicated recovery ID.'); ids.add(id);
      // A deleted or superseded ID is never overwritten by an old backup.
      if (await store.record(owner, id)) throw memoryFailure('Recovery cannot overwrite an existing record or resurrect a tombstone.', 409);
      if (recovering && (entry.owner !== owner || entry.bankId !== bank.id || entry.status !== 'active')) throw memoryFailure('Invalid recovery ownership or state.', 403);
      const reviewed = recovering ? body.reviewed === true : entry.reviewed === true;
      const kind = entry.kind === 'fact' ? 'fact' : 'observation';
      if (kind === 'fact' && !reviewed) throw memoryFailure('A recovered fact requires fresh human review.');
      const confidence = entry.confidence;
      if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw memoryFailure('Enter an operator confidence assessment between 0 and 1.');
      const admitted = await admit(required(entry.text, 36000, 'Memory text'), required(entry.source, 1000, 'Provenance source'), bank);
      const record: MemoryRecord = { id, owner, bankId: bank.id, agent, threadId: 'source', text: admitted.text, source: admitted.source, confidence, kind, reviewStatus: reviewed ? 'human_reviewed' : 'unreviewed', status: 'active', contentSha256: await memoryDigest(admitted.text), ...(reviewed ? { reviewedBy: owner, reviewedAt: at } : {}), createdAt: at, updatedAt: at, version: 1, indexes: projectionState(bank) };
      // Recovery starts a new admission lineage. Export metadata is reference
      // material, never authority to reinstate old reviews or provider state.
      prepared.push(record); events.push(event(owner, bank, recovering ? 'memory.recovered' : 'memory.admitted', record, admitted.matchedTypes));
    }
    await ensureBank();
    await store.commit(owner, { records: prepared, events });
    const results: MemoryRecord[] = []; for (const record of prepared) results.push(await mirror(bank, record));
    return { admitted: results.length, records: results, recoveryReviewRenewed: recovering };
  }
  throw memoryFailure('Unknown memory action.');
}
