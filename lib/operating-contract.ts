// Canonical v1 contract shared by the local API, UI, journal readers and runner.
export const READINESS_STAGES = [
  { id: 'configured', label: 'Configured' },
  { id: 'responding', label: 'Responding' },
  { id: 'task-completed', label: 'Bounded task completed' },
  { id: 'reviewed', label: 'Reviewed for a named use case' },
] as const;
export type ReadinessStage = typeof READINESS_STAGES[number]['id'];
export type EvidenceLevel = 'recorded-evaluation' | 'executed-benchmark' | 'production-observation';
export const ADAPTERS = ['inference', 'hermes', 'harness-router', 'research', 'rsi', 'hybrid', 'work-zone', 'memory', 'skills', 'starter', 'telemetry', 'qs-bridge'] as const;
export type AdapterId = typeof ADAPTERS[number];
export interface TraceIdentity { correlationId: string; spanId: string; parentSpanId?: string }
export interface ReadinessEvidence {
  moduleId: string; useCase: string; configurationHash: string; stage: ReadinessStage;
  outcome: 'pass' | 'fail'; at: string; expiresAt: string; reference: string;
  basis: 'observed' | 'operator-recorded';
}
export interface ReadinessCell {
  stage: ReadinessStage; state: 'unknown' | 'pass' | 'fail' | 'stale';
  reference?: string; at?: string; basis?: ReadinessEvidence['basis'];
}
export function readinessCells(moduleId: string, useCase: string, configurationHash: string, evidence: ReadinessEvidence[], now = Date.now()): ReadinessCell[] {
  const cells:ReadinessCell[]=READINESS_STAGES.map(({ id: stage }) => {
    const sameUse = evidence.filter(e => e.moduleId === moduleId && e.useCase === useCase && e.stage === stage).sort((a,b) => b.at.localeCompare(a.at));
    const current = sameUse.find(e => e.configurationHash === configurationHash && Date.parse(e.expiresAt) > now);
    const found = current || sameUse[0];
    return { stage, state: current ? current.outcome : found ? 'stale' : 'unknown', ...(found ? { reference: found.reference, at: found.at, basis: found.basis } : {}) };
  });
  for(let index=1;index<cells.length;index++)if(cells[index].state==='pass'&&cells.slice(0,index).some(c=>c.state!=='pass'))cells[index]={...cells[index],state:'stale'};
  return cells;
}
export interface JournalSummary {
  adapter: AdapterId; entityId: string; at: string; status: string; eventCount: number;
  correlationId: string | null; correlationBasis: 'captured' | 'derived-legacy' | 'unlinked';
  digest: string | null; integrity: 'verified' | 'unverified' | 'failed';
  costUsd: number | null; costBasis: 'metered' | 'estimated' | 'reservation' | 'unknown'; latencyMs: number | null;
}
export interface OperatingSnapshot {
  version:1; custody:{storage:string;exportPolicy:string;externalCollector:boolean;contentCapture:boolean;retention:string};
  modules:{moduleId:string;name:string;useCase:string;configurationHash:string;bindingNote:string;cells:ReadinessCell[]}[];
  sources:{adapter:string;state:string;note:string}[];journals:JournalSummary[];
  requests:{id:string;adapter:string;at:string;correlationId:string;spanId:string;parentSpanId?:string;operation:string;method:string;status:number;latencyMs:number;entityId:string|null}[];
  packages:StoredPackage[];reviews:ReleaseReview[];activeRelease:ReleaseReview|null;
  telemetry:any[];productionObservations:any[];benchmarks:any[];
}
export interface CaseMeasurement {
  caseId: string; quality: number; criticalFailures: number; latencyMs: number | null;
  costUsd: number | null; costBasis: 'metered' | 'estimated' | 'local-provider-zero' | 'unknown';
  inputTokens: number | null; outputTokens: number | null; outputHash: string;
}
export interface EvidencePackage {
  version: 1; id: string; correlationId: string; createdAt: string;
  moduleId: string; useCase: string; level: EvidenceLevel;
  scope: { provider: string; model: string; modelHash: string; routeHash: string; harnessHash: string } | null;
  artifact: { kind: 'skill' | 'harness' | 'workflow'; baselineVersion: string; baselineHash: string; candidateVersion: string | null; candidateHash: string | null; content: string | null };
  dataset: { hash: string; frozenAt: string; runnerHash: string | null; rubricHash: string | null; developmentIds: string[]; holdoutIds: string[]; unseen: boolean };
  baseline: CaseMeasurement[] | null; candidate: CaseMeasurement[] | null;
  recordedEvaluation?: { baselineCorrect:number; candidateCorrect:number; caseCount:number; criticalFailures:number; reportHash:string; costUsd:null; latencyMs:null };
  references: { adapter: AdapterId; entityId: string; digest: string }[];
  limitations: string[];
}
export interface StoredPackage { hash: string; origin: 'operator-import' | 'trusted-runner' | 'production-adapter'; declaredLevel: EvidenceLevel; package: EvidencePackage }
export interface ReleaseReview {
  id: string; packageHash: string; useCase: string; scope: NonNullable<EvidencePackage['scope']>; artifactHash: string;
  reviewer: string; note: string; at: string; expiresAt: string; previousId: string | null;
  limits: { minQuality: number; maxMeanCostUsd: number; maxP95LatencyMs: number };
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const HASH = /^[0-9a-f]{64}$/;
const str = (v: unknown, max: number) => typeof v === 'string' && !!v.trim() && v.length <= max;
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const nonnegative = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const nullable = (v: unknown) => v === null || nonnegative(v);
const unique = (xs: unknown, max: number): xs is string[] => Array.isArray(xs) && xs.length <= max && xs.every(x => str(x, 100)) && new Set(xs).size === xs.length;
export function validateEvidencePackage(value: unknown): EvidencePackage {
  const p = value as EvidencePackage;
  if (!p || p.version !== 1 || !UUID.test(p.id) || !UUID.test(p.correlationId) || !date(p.createdAt) || !str(p.moduleId, 100) || !str(p.useCase, 160) || !['recorded-evaluation','executed-benchmark','production-observation'].includes(p.level)) throw Error('Invalid evidence package identity.');
  const s=p.scope, a=p.artifact, d=p.dataset;
  if (s===null ? p.level!=='recorded-evaluation' : !s || !str(s.provider,80) || !str(s.model,240) || !HASH.test(s.modelHash) || !HASH.test(s.routeHash) || !HASH.test(s.harnessHash)) throw Error('A frozen model route, model digest and harness hash are required for measured evidence.');
  if (!a || !['skill','harness','workflow'].includes(a.kind) || !str(a.baselineVersion,100) || !HASH.test(a.baselineHash) || (a.candidateVersion !== null && !str(a.candidateVersion,100)) || (a.candidateHash !== null && !HASH.test(a.candidateHash)) || (a.content !== null && !str(a.content,p.level==='recorded-evaluation'?12000:8000)) || ((a.candidateVersion === null) !== (a.candidateHash === null)) || ((a.content === null) !== (a.candidateHash === null))) throw Error('Invalid versioned instruction artifact.');
  if (!d || !HASH.test(d.hash) || (d.runnerHash===null?p.level!=='recorded-evaluation':!HASH.test(d.runnerHash)) || (d.rubricHash===null?p.level!=='recorded-evaluation':!HASH.test(d.rubricHash)) || !date(d.frozenAt) || Date.parse(d.frozenAt)>Date.parse(p.createdAt) || !unique(d.developmentIds,500) || !unique(d.holdoutIds,500) || !d.holdoutIds.length || typeof d.unseen !== 'boolean' || d.holdoutIds.some(id=>d.developmentIds.includes(id))) throw Error('Invalid frozen development/holdout split.');
  for(const measurements of [p.baseline,p.candidate]) {
    if(measurements===null) continue;
    if(!Array.isArray(measurements) || measurements.length!==d.holdoutIds.length || new Set(measurements.map(m=>m.caseId)).size!==measurements.length || measurements.some(m=>!m || !d.holdoutIds.includes(m.caseId) || !nonnegative(m.quality) || m.quality>1 || !Number.isSafeInteger(m.criticalFailures) || m.criticalFailures<0 || !nullable(m.latencyMs) || !nullable(m.costUsd) || !['metered','estimated','local-provider-zero','unknown'].includes(m.costBasis) || (m.costBasis==='unknown' ? m.costUsd!==null : m.costUsd===null) || ![m.inputTokens,m.outputTokens].every(v=>v===null || (Number.isSafeInteger(v)&&v>=0)) || !HASH.test(m.outputHash))) throw Error('Invalid per-case quality, failure, cost or latency measurements.');
  }
  if (p.baseline===null ? p.level!=='recorded-evaluation'||!p.recordedEvaluation : !Array.isArray(p.baseline)||(p.candidate===null)!==(a.candidateHash===null)) throw Error('Per-case measurements are required for measured evidence; aggregate assertions must stay recorded.');
  const r=p.recordedEvaluation;if(r&&(![r.baselineCorrect,r.candidateCorrect,r.caseCount,r.criticalFailures].every(v=>Number.isSafeInteger(v)&&v>=0)||r.caseCount!==d.holdoutIds.length||Math.max(r.baselineCorrect,r.candidateCorrect)>r.caseCount||!HASH.test(r.reportHash)||r.costUsd!==null||r.latencyMs!==null||p.level!=='recorded-evaluation'))throw Error('Invalid recorded aggregate evaluation.');
  if (!Array.isArray(p.references) || p.references.length>100 || p.references.some(r=>!ADAPTERS.includes(r.adapter)||!str(r.entityId,160)||!HASH.test(r.digest)) || !Array.isArray(p.limitations) || p.limitations.length>20 || p.limitations.some(t=>!str(t,2000))) throw Error('Invalid evidence references or comparison.');
  return structuredClone(p);
}
export function summarizeMeasurements(values: CaseMeasurement[]) {
  const costs=values.map(v=>v.costUsd), times=values.map(v=>v.latencyMs).filter((v):v is number=>v!==null).sort((a,b)=>a-b);
  return { cases:values.length, quality:values.reduce((n,v)=>n+v.quality,0)/values.length, criticalFailures:values.reduce((n,v)=>n+v.criticalFailures,0), meanCostUsd:costs.some(v=>v===null)?null:costs.reduce((n,v)=>n+v!,0)/values.length, p95LatencyMs:times.length!==values.length?null:times[Math.ceil(times.length*.95)-1] };
}
export function releaseBlockers(record: StoredPackage, limits: ReleaseReview['limits']): string[] {
  const p=validateEvidencePackage(record.package), reasons:string[]=[];
  if(record.origin!=='trusted-runner' || p.level!=='executed-benchmark') reasons.push('A trusted local runner receipt is required; recorded or imported scores cannot authorize production.');
  if(!p.scope||!p.baseline)reasons.push('A frozen route and actual per-case measurements are required.');
  if(p.moduleId!=='starter-pilot' || p.useCase!=='starter-source-review-v1') reasons.push('This adapter accepts only the named Starter source-review use case.');
  if(!p.candidate || !p.artifact.content || !['skill','harness'].includes(p.artifact.kind)) reasons.push('A paired, versioned text instruction candidate is required.');
  if(!p.dataset.unseen || p.dataset.holdoutIds.length<6) reasons.push('At least six frozen unseen holdout cases are required.');
  if(!limits||!nonnegative(limits.minQuality)||limits.minQuality>1||!nonnegative(limits.maxMeanCostUsd)||!nonnegative(limits.maxP95LatencyMs)||!limits.maxP95LatencyMs) return [...reasons,'Explicit quality, cost and latency limits are required.'];
  if(p.candidate&&p.baseline){ const base=summarizeMeasurements(p.baseline), next=summarizeMeasurements(p.candidate);
    if(base.meanCostUsd===null||base.p95LatencyMs===null||p.baseline.some(c=>c.costBasis==='estimated'))reasons.push('The baseline also needs known provider cost and measured latency.');
    if(next.quality<=base.quality || next.quality<limits.minQuality) reasons.push('Candidate must improve measured benchmark quality and meet the minimum.');
    if(next.criticalFailures) reasons.push('Candidate has critical failures.');
    if(next.meanCostUsd===null || p.candidate.some(c=>c.costBasis==='estimated') || next.meanCostUsd>limits.maxMeanCostUsd) reasons.push('Known provider cost must satisfy the reviewed limit; estimates are insufficient.');
    if(next.p95LatencyMs===null || next.p95LatencyMs>limits.maxP95LatencyMs) reasons.push('Measured latency must satisfy the reviewed limit.');
  }
  return reasons;
}
