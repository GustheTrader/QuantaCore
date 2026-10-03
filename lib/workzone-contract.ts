export type WorkZone = 'build' | 'trade';
export interface DigitalWorker {
  id: string; name: string; title: string; role: string; reportsTo: string | null;
  adapterType: string; status: string; budgetMonthlyCents: number; spentMonthlyCents: number;
}
export interface WorkTask { id: string; identifier: string; title: string; status: string; assigneeAgentId: string | null; updatedAt: string }
export interface TrainingReview { id: string; agentId: string; caseName: string; skillVersion: string; artifact: string; verdict: 'pass' | 'revise'; notes: string; reviewer: string; createdAt: string; adapterType: string }
export interface WorkerKnowledge { id: string; agentId: string | 'master'; title: string; text: string; source: string; createdAt: string }
export interface OperatorWorkZone {
  reachable: boolean; scope: 'local-operator' | 'verified-operator'; error?: string;
  company: { id: string; name: string; issuePrefix: string } | null;
  agents: DigitalWorker[]; tasks: WorkTask[]; reviews: TrainingReview[]; knowledge: WorkerKnowledge[]; watchlist: string[];
  consoleUrl: string; links: { org: string; tasks: string; training: string; agents: string };
}
export const WORKER_HARNESSES = ['http', 'codex_local', 'claude_local', 'opencode_local', 'hermes_local', 'gemini_local'] as const;
