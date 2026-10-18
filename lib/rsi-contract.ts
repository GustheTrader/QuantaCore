export interface RsiRequest {
  name: string;
  policyModel: string;
  searchModel: string;
  rounds: number;
  trials: number;
  maxParallel: number;
  budget: { maxCalls: number; maxTokens: number; maxOutputTokens: number; maxSeconds: number; maxCostUsd: number | null };
  rates: { model: string; inputPerMillion: number; outputPerMillion: number }[];
  systemPrompt: string;
}
export interface RsiRun {
  id: string; createdAt: string; updatedAt: string; name: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  configurationHash: string; request: RsiRequest; sourceCommit: string; suiteHash: string; adapterHash?: string;
  usage: { calls: number; tokens: number; costUsd: number | null; estimated: boolean };
  phase: string; result?: any; resultHash?: string; error?: string;
  review?: { decision: 'approve' | 'reject'; note: string; commit: string; profileHash: string; at: string };
}
export interface RsiReview { id: string; expiresAt: string; configurationHash: string; request: RsiRequest; routes: string[]; knownCost: boolean; sourceCommit: string; suiteHash: string; adapterHash: string; summary: string[] }
