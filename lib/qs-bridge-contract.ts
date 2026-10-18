// Authoritative normalized contract shared by the local bridge and its UI.
export const QS_READ_PATHS = ['/openapi.json', '/api/health', '/api/markets'] as const;
export const QS_BRIDGE_POLICY = {
  version: 1, methods: ['GET'], paths: QS_READ_PATHS, maxBodyBytes: 2_000_000,
  requestTimeoutMs: 3000, totalTimeoutMs: 8500, maxMarkets: 200,
  maxSourceAgeMs: 5000, inspectionLifetimeMs: 60000,
  automaticPolling: false, credentialsForwarded: false, executionEnabled: false,
} as const;
export interface QsEndpointPin {
  version: 1; revision: string; baseUrl: string; openapiHash: string;
  serviceTitle: string; serviceVersion: string; reviewedAt: string;
}
export interface QsMarketEvidence {
  key: string; conditionId: string | null; question: string | null;
  upTokenId: string | null; downTokenId: string | null;
  reportedUpPercent: number | null; reportedDownPercent: number | null;
  sourceAtMs: number | null; ageMs: number | null; live: boolean | null;
  disposition: 'abstain'; reasons: string[];
}
export interface QsReadSnapshot {
  version: 1; id: string; correlationId: string; capturedAt: string; expiresAt: string;
  baseUrl: string; openapiHash: string; serviceTitle: string; serviceVersion: string;
  health: { status: string; liveData: boolean | null; booksReady: boolean | null; streamReady: boolean | null };
  markets: QsMarketEvidence[]; sourceMarketCount: number; truncated: boolean;
  contentHash: string; latencyMs: number; executionEnabled: false;
}
export interface QsBridgeStatus {
  version: 1; policy: typeof QS_BRIDGE_POLICY; pin: QsEndpointPin | null;
  lastObservation: { id: string; at: string; status: string; latencyMs: number | null; correlationId: string } | null;
  connectionState: 'unconfigured' | 'unverified';
}
export interface QsInspection { inspectionId: string; pin: QsEndpointPin; snapshot: QsReadSnapshot; expiresAt: string; expectedRevision: string | null }

const text = (value: unknown, limit: number): string | null => typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null;
const number = (value: unknown, label: string, max = Number.MAX_SAFE_INTEGER): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) throw Error(`Invalid QS ${label}.`);
  return value;
};
const boolean = (value: unknown): boolean | null => typeof value === 'boolean' ? value : null;
export function normalizeQsRead(health: any, payload: any, now = Date.now()) {
  if (!health || typeof health.status !== 'string' || !payload || !Array.isArray(payload.markets) || typeof payload.live !== 'boolean') throw Error('The QS response does not match the reviewed read contract.');
  if (payload.markets.length > 2000) throw Error('QS market inventory exceeds the bounded contract.');
  const keys = new Set<string>();
  const markets: QsMarketEvidence[] = payload.markets.slice(0, QS_BRIDGE_POLICY.maxMarkets).map((m: any) => {
    const key = text(m?.key, 160); if (!key || keys.has(key)) throw Error('Missing or duplicate QS market identity.'); keys.add(key);
    const sourceAtMs = number(m.last_update_ms, 'source timestamp');
    if (sourceAtMs !== null && !Number.isSafeInteger(sourceAtMs)) throw Error('QS source timestamp must be integer milliseconds.');
    const ageMs = sourceAtMs && sourceAtMs <= now ? now - sourceAtMs : null;
    const upTokenId = text(m.up_token_id, 200), downTokenId = text(m.down_token_id, 200);
    const reasons = ['This inventory has no independently verified executable YES and NO books, depth or settlement provenance.'];
    if (!sourceAtMs || sourceAtMs > now) reasons.push('Source time is missing or in the future.');
    else if (ageMs! > QS_BRIDGE_POLICY.maxSourceAgeMs) reasons.push('Source evidence is stale.');
    if (!upTokenId || !downTokenId || upTokenId === downTokenId) reasons.push('Separate outcome token identities are incomplete.');
    if (m.live !== true || payload.live !== true) reasons.push('The source does not report live market data.');
    return { key, conditionId: text(m.condition_id, 200), question: text(m.question, 500), upTokenId, downTokenId,
      reportedUpPercent: number(m.up_pct, 'UP percentage', 100), reportedDownPercent: number(m.down_pct, 'DOWN percentage', 100),
      sourceAtMs: sourceAtMs || null, ageMs, live: boolean(m.live), disposition: 'abstain', reasons };
  });
  return {health: { status: health.status.slice(0, 80), liveData: boolean(health.live_data), booksReady: boolean(health.books_ready), streamReady: boolean(health.clob_stream_ready) }, markets, sourceMarketCount: payload.markets.length, truncated: payload.markets.length > markets.length};
}
