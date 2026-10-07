export const CLOUD_PROVIDERS = ['zo', 'abacus', 'fireworks'] as const;
export type CloudProvider = typeof CLOUD_PROVIDERS[number];
export type CloudDomain = 'business' | 'trading';
export type CloudOperation = 'zo_report' | 'abacus_forecast' | 'fireworks_sft' | 'fireworks_infer';
export interface CloudConnection {
  enabled: boolean;
  accountId: string;
  deploymentId: string;
  model: string;
  hasKey: boolean;
  state: 'unconfigured' | 'configured' | 'authenticated' | 'tested' | 'degraded';
  checkedAt?: string;
  revision?: string;
}
export interface CloudPolicy { monthlyCapUsd: number; connections: Record<CloudProvider, CloudConnection> }
export interface CloudJobRequest {
  domain: CloudDomain;
  operation: CloudOperation;
  label: string;
  estimatedUpperBoundUsd: number;
  datasetHash: string;
  schemaVersion: string;
  labelDefinition: string;
  sourceAvailableAt: string;
  codeCommit: string;
  expiresAt?: string;
  payload: Record<string, unknown>;
}
export interface CloudEvaluation {
  metric: string;
  direction: 'higher' | 'lower';
  baselineScore: number;
  candidateScore: number;
  holdoutHash: string;
  evidence: string;
  evaluatorVersion: string;
}
export interface CloudJob extends CloudJobRequest {
  id: string;
  provider: CloudProvider;
  requestHash: string;
  payloadHash: string;
  idempotencyKey: string;
  createdAt: string;
  status: 'draft' | 'approved' | 'running' | 'submitted' | 'succeeded' | 'stale' | 'error' | 'uncertain' | 'cancelled';
  approvedAt?: string;
  completedAt?: string;
  remoteName?: string;
  result?: unknown;
  resultHash?: string;
  error?: string;
  evaluation?: CloudEvaluation;
  evaluationPassed?: boolean;
  route?: { accountId: string; deploymentId: string; model: string; revision?: string };
}
export interface CloudRegistryEntry { jobId: string; provider: CloudProvider; model: string; promotedAt: string; previousJobId?: string }
export interface HybridView {
  localOnly: true;
  executionMode: 'paper';
  policies: Record<CloudDomain, CloudPolicy>;
  reservedUsd: Record<CloudDomain, number>;
  jobs: CloudJob[];
  registry: Record<CloudDomain, Partial<Record<CloudProvider, CloudRegistryEntry>>>;
  registryHistory: Record<CloudDomain, CloudRegistryEntry[]>;
}
