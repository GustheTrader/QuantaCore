import type { MemoryBank, MemoryRecord, MemoryIndexes } from './memory-governance.ts';
import { memoryDigest } from './memory-governance.ts';

export function createMemoryIndexes(clients: { hindsight: () => Promise<any>; honcho: () => Promise<any>; hindsightHttp?: (method: 'GET' | 'DELETE', path: string, signal?: AbortSignal) => Promise<{ status: number; data?: any }> }): MemoryIndexes {
  const operationIdFrom = (value: string) => value.match(/^(?:pending|stored|failed):([a-f0-9-]{36})$/i)?.[1];
  async function operationState(bank: MemoryBank, id: string) {
    if (!clients.hindsightHttp) return 'unknown';
    const response = await clients.hindsightHttp('GET', `/v1/default/banks/${encodeURIComponent(bank.id)}/operations/${id}`, AbortSignal.timeout(5000));
    if (response.status === 404) return 'missing';
    if (response.status < 200 || response.status >= 300) throw new Error('Hindsight operation status unavailable');
    return String(response.data?.status || response.data?.state || 'unknown').toLowerCase();
  }
  async function configuredHindsight(bank: MemoryBank) {
    const client = await clients.hindsight();
    if (!client) throw new Error('Index unavailable');
    await client.createBank(bank.id, { name: `Quanta ${bank.scope} admitted sources`, retainExtractionMode: 'chunks' });
    await client.updateBankConfig(bank.id, { retainExtractionMode: 'chunks', enableObservations: false, enableAutoConsolidation: false, enableTemporalRetrieval: false, enableGraphRetrieval: false, auditLogEnabled: true, memoryDefense: { enabled: true, rules: [{ on: 'sensitive_data', action: bank.policy.sensitiveData }] } });
    const config = (await client.getBankConfig(bank.id)).config;
    if (!config || config.retain_extraction_mode !== 'chunks' || config.enable_observations !== false || config.enable_auto_consolidation !== false || config.memory_defense?.enabled !== true || !config.memory_defense.rules?.some((rule: any) => rule.on === 'sensitive_data' && rule.action === bank.policy.sensitiveData)) throw new Error('Index policy not verified');
    return client;
  }
  async function honchoIds(bank: MemoryBank, record: MemoryRecord) {
    const key = (await memoryDigest(`${bank.id}:${record.id}`)).slice(0, 40);
    return { session: `qm2-${key}`, user: `qm2-u-${key}`, assistant: `qm2-a-${key}` };
  }
  return {
    async put(bank, record, isCurrent = async () => true) {
      const statuses = { hindsight: 'disabled', honcho: 'disabled' };
      if (bank.policy.hindsightIndex) {
        try {
          const client = await configuredHindsight(bank);
          if (!await isCurrent()) { statuses.hindsight = 'purge-pending'; return statuses; }
          const result = await client.retain(bank.id, record.text, { documentId: record.id, async: true, operationId: record.id, context: `Admitted ${record.kind}; ${record.reviewStatus}`, metadata: { quanta_record_id: record.id, kind: record.kind, review_status: record.reviewStatus, source: record.source, content_sha256: record.contentSha256 }, tags: [`kind:${record.kind}`, `review:${record.reviewStatus}`], signal: AbortSignal.timeout(25000) });
          const operationId = result?.operation_id || result?.operationId || record.id;
          let state = 'pending';
          for (let attempt = 0; attempt < 6; attempt++) {
            if (!await isCurrent()) break;
            try { state = await operationState(bank, operationId); } catch { state = 'unknown'; }
            if (['completed', 'failed', 'cancelled', 'missing'].includes(state)) break;
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          statuses.hindsight = state === 'completed' ? `stored:${operationId}` : ['failed', 'cancelled', 'missing'].includes(state) ? `failed:${operationId}` : `pending:${operationId}`;
        } catch { statuses.hindsight = `pending:${record.id}`; }
      }
      if (bank.policy.honchoArchive) {
        try {
          const client = await clients.honcho(); if (!client) throw new Error('Archive unavailable');
          const ids = await honchoIds(bank, record);
          const peer = await client.peer(ids.user);
          const session = await client.session(ids.session);
          await session.setConfiguration({ reasoning: { enabled: false }, peerCard: { use: false, create: false }, summary: { enabled: false }, dream: { enabled: false } });
          await session.addPeers({ [ids.user]: { observeMe: false, observeOthers: false } });
          const config = await session.getConfiguration(); const peerConfig = await session.getPeerConfiguration(ids.user);
          if (config.reasoning?.enabled !== false || config.summary?.enabled !== false || config.dream?.enabled !== false || config.peerCard?.use !== false || config.peerCard?.create !== false || peerConfig.observeMe !== false || peerConfig.observeOthers !== false) throw new Error('Archive policy not verified');
          if (!await isCurrent()) { statuses.honcho = 'purge-pending'; return statuses; }
          await session.addMessages(peer.message(record.text, { metadata: { quanta_record_id: record.id, kind: record.kind, review_status: record.reviewStatus, content_sha256: record.contentSha256 }, configuration: { reasoning: { enabled: false } } }));
          statuses.honcho = await isCurrent() ? 'stored' : 'purge-pending';
        } catch { statuses.honcho = 'archive-not-qualified'; }
      }
      return statuses;
    },
    async remove(bank, record) {
      const statuses = { hindsight: 'disabled', honcho: 'disabled' };
      if (record.indexes.hindsight !== 'disabled') {
        try {
          const operationId = operationIdFrom(record.indexes.hindsight);
          if (operationId) {
            const state = await operationState(bank, operationId);
            if (!['completed', 'failed', 'cancelled', 'missing'].includes(state)) throw new Error('Hindsight retain operation has not reached a terminal state');
            if (state !== 'missing' && clients.hindsightHttp) {
              const operationDelete = await clients.hindsightHttp('DELETE', `/v1/default/banks/${encodeURIComponent(bank.id)}/operations/${operationId}/delete`, AbortSignal.timeout(5000));
              if (operationDelete.status !== 404 && (operationDelete.status < 200 || operationDelete.status >= 300)) throw new Error('Hindsight operation cleanup failed');
            }
          }
          if (clients.hindsightHttp) {
            const response = await clients.hindsightHttp('DELETE', `/v1/default/banks/${encodeURIComponent(bank.id)}/documents/${record.id}`, AbortSignal.timeout(10000));
            if (response.status !== 404 && (response.status < 200 || response.status >= 300)) throw new Error('Hindsight document cleanup failed');
          } else { const client = await clients.hindsight(); await client.deleteDocument(bank.id, record.id, { signal: AbortSignal.timeout(10000) }); }
          statuses.hindsight = 'purged';
        }
        catch { statuses.hindsight = 'purge-pending'; }
      }
      if (record.indexes.honcho !== 'disabled') {
        try {
          const client = await clients.honcho(); const ids = await honchoIds(bank, record);
          await (await client.session(ids.session)).delete();
          // New archive peers contain no source text or learned conclusions;
          // content lives only in the isolated, processing-disabled session.
          statuses.honcho = 'session-purged';
        } catch { statuses.honcho = 'purge-pending'; }
      }
      return statuses;
    },
    async search(bank, query) {
      const client = await configuredHindsight(bank);
      const results = await client.recall(bank.id, query, { maxTokens: 2400, signal: AbortSignal.timeout(10000) });
      return (results?.results || []).map((item: any) => item.metadata?.quanta_record_id || item.document_id).filter((id: unknown) => typeof id === 'string');
    },
  };
}
