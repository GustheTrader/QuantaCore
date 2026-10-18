import express from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { QS_BRIDGE_POLICY, QS_READ_PATHS, normalizeQsRead, type QsBridgeStatus, type QsEndpointPin, type QsInspection, type QsReadSnapshot } from '../lib/qs-bridge-contract';
import { OperatingEvidence, evidenceHash, currentTrace, bindCurrentEntity } from './operating-evidence';
import { boundedJson } from './bounded-json';

const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });
export function qsOrigin(input: unknown) {
  if (typeof input !== 'string' || input.length > 200) throw fail('Enter a literal loopback QS HTTP origin.');
  let url: URL; try { url = new URL(input); } catch { throw fail('Enter a valid QS HTTP origin.'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname) || !url.port || Number(url.port) < 1024 || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw fail('Use http://127.0.0.1:PORT or http://[::1]:PORT with no path, credentials or query.');
  return url.origin;
}
export class QsReadOnlyBridge {
  readonly file: string;
  private inspections = new Map<string, QsInspection>();
  private busy = false;
  constructor(root: string, readonly evidence: OperatingEvidence, readonly request: typeof fetch = fetch) { this.file = path.join(root, '.quanta', 'qs-readonly.json'); }
  pin(): QsEndpointPin | null {
    if (!existsSync(this.file)) return null;
    if (statSync(this.file).size > 64000) throw fail('Saved QS configuration exceeds the bounded metadata contract.');
    const p = JSON.parse(readFileSync(this.file, 'utf8'));
    if (p.version !== 1 || qsOrigin(p.baseUrl) !== p.baseUrl || !/^[a-f0-9]{64}$/.test(p.openapiHash) || typeof p.revision !== 'string' || p.serviceTitle !== 'Polymarket Terminal API' || p.serviceVersion !== '0.4.0') throw fail('Saved QS pin is invalid. Existing configuration was preserved.');
    return p;
  }
  status(): QsBridgeStatus {
    const pin = this.pin(), last = this.evidence.list<any>('qs-observation', 1)[0];
    return { version: 1, policy: QS_BRIDGE_POLICY, pin, connectionState: pin ? 'unverified' : 'unconfigured', lastObservation: last ? { id: last.id, at: last.at, status: last.status, latencyMs: last.latencyMs, correlationId: last.correlationId } : null };
  }
  private async read(baseUrl: string, expectedHash?: string): Promise<QsReadSnapshot> {
    if (this.busy) throw fail('One QS inspection is already in progress.', 409); this.busy = true;
    const started = performance.now(), signal = AbortSignal.timeout(QS_BRIDGE_POLICY.totalTimeoutMs), correlationId = currentTrace()?.correlationId || randomUUID(), id = randomUUID();
    const get = async (route: typeof QS_READ_PATHS[number]) => {
      const r = await this.request(baseUrl + route, { method: 'GET', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(QS_BRIDGE_POLICY.requestTimeoutMs)]), headers: { Accept: 'application/json', 'X-Quanta-Correlation-ID': correlationId } });
      if (!r.ok) { await r.body?.cancel(); throw fail('The QS read endpoint refused the bounded inspection.', 502); }
      return boundedJson(r, QS_BRIDGE_POLICY.maxBodyBytes);
    };
    try {
      const schema = await get('/openapi.json');
      if (schema?.info?.title !== 'Polymarket Terminal API' || schema.info.version !== '0.4.0' || !['/api/health', '/api/markets'].every(p => schema.paths?.[p]?.get)) throw fail('This endpoint is not the reviewed QS service contract. No inventory was requested.', 409);
      const openapiHash = evidenceHash(schema);
      if (expectedHash && openapiHash !== expectedHash) throw fail('The QS schema changed. Inspect and review a new endpoint pin before reading inventory.', 409);
      const health = await get('/api/health'), inventory = await get('/api/markets');
      const normalized = normalizeQsRead(health, inventory), capturedAt = new Date().toISOString();
      const snapshot: QsReadSnapshot = { version: 1, id, correlationId, capturedAt, expiresAt: new Date(Date.now() + 10000).toISOString(), baseUrl, openapiHash, serviceTitle: schema.info.title, serviceVersion: schema.info.version, ...normalized, contentHash: evidenceHash(normalized), latencyMs: Math.round(performance.now() - started), executionEnabled: false };
      this.evidence.append('qs-observation', { id, at: capturedAt, correlationId, status: 'read-completed', latencyMs: snapshot.latencyMs, digest: snapshot.contentHash, marketCount: snapshot.sourceMarketCount, endpointHash: evidenceHash(baseUrl), openapiHash, executionEnabled: false });
      bindCurrentEntity('qs-bridge', id);
      return snapshot;
    } catch (error) {
      this.evidence.append('qs-observation', { id, at: new Date().toISOString(), correlationId, status: 'read-failed', latencyMs: Math.round(performance.now() - started), digest: null, endpointHash: evidenceHash(baseUrl), executionEnabled: false });
      bindCurrentEntity('qs-bridge', id);
      if ((error as any).status) throw error;
      throw fail('The QS service is unavailable or its response exceeds the reviewed read contract. No source snapshot was accepted.', 503);
    } finally { this.busy = false; }
  }
  async inspect(input: any) {
    if (input?.approveReadOnlyRequests !== true) throw fail('Acknowledge the three bounded read-only QS requests.');
    const baseUrl = qsOrigin(input.baseUrl), expectedRevision = this.pin()?.revision || null, snapshot = await this.read(baseUrl);
    const inspectionId = randomUUID(), expiresAt = new Date(Date.now() + QS_BRIDGE_POLICY.inspectionLifetimeMs).toISOString();
    const inspection: QsInspection = { inspectionId, snapshot, expiresAt, expectedRevision, pin: { version: 1, revision: randomUUID(), baseUrl, openapiHash: snapshot.openapiHash, serviceTitle: snapshot.serviceTitle, serviceVersion: snapshot.serviceVersion, reviewedAt: snapshot.capturedAt } };
    for (const [key, old] of this.inspections) if (Date.parse(old.expiresAt) <= Date.now()) this.inspections.delete(key);
    if (this.inspections.size >= 10) this.inspections.delete(this.inspections.keys().next().value!);
    this.inspections.set(inspectionId, inspection); return inspection;
  }
  save(input: any) {
    const inspection = this.inspections.get(input?.inspectionId);
    if (input?.approveEndpointPin !== true || !inspection || Date.parse(inspection.expiresAt) <= Date.now() || inspection.pin.openapiHash !== input.openapiHash || (this.pin()?.revision || null) !== inspection.expectedRevision) throw fail('Review a current inspection and its exact endpoint/schema before pinning.', 409);
    mkdirSync(path.dirname(this.file), { recursive: true });
    this.evidence.append('qs-pin', { ...inspection.pin, id: randomUUID(), correlationId: currentTrace()?.correlationId || randomUUID() });
    writeFileSync(this.file + '.tmp', JSON.stringify(inspection.pin, null, 2), { mode: 0o600 }); renameSync(this.file + '.tmp', this.file);
    this.inspections.delete(inspection.inspectionId); return this.status();
  }
  async snapshot(input: any) {
    const pin = this.pin(); if (!pin || input?.revision !== pin.revision || input?.approveReadOnlyRequests !== true) throw fail('Review and pin a QS endpoint before requesting a bounded snapshot.', 409);
    const result = await this.read(pin.baseUrl, pin.openapiHash);
    if (this.pin()?.revision !== pin.revision) throw fail('The QS pin changed during inspection. Review the current endpoint.', 409);
    return result;
  }
}
export function createQsReadOnlyRouter(root: string, evidence: OperatingEvidence) {
  const router = express.Router(), bridge = new QsReadOnlyBridge(root, evidence);
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store'); const origin = req.get('origin');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(req.hostname) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') || req.get('X-Quanta-Client') !== 'local-ui' || (origin && origin !== `${req.protocol}://${req.get('host')}`)) return res.status(403).json({ error: { message: 'Local operator access required.' } }); next();
  });
  const route = (fn: (input: any) => any) => async (req: any, res: any) => { try { res.json(await fn(req.body)); } catch (e) { res.status((e as any).status || 400).json({ error: { message: (e as Error).message.slice(0, 500) } }); } };
  router.get('/status', route(() => bridge.status()));
  router.post('/inspect', route(input => bridge.inspect(input)));
  router.post('/pin', route(input => bridge.save(input)));
  router.post('/snapshot', route(input => bridge.snapshot(input)));
  return router;
}
