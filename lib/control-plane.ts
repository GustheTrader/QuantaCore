import type { ChatMessage, ComputeProvider, UserTrack } from '../types';
import { normalizeSystemSetup, type SystemSetupPlan } from './system-setup';
import type { AppliedSkill, SkillPolicy } from './skill-growth';

export type ControlMode = 'chat' | 'work';
export type RunStatus = 'idle' | 'planning' | 'drafting' | 'reviewing' | 'complete' | 'error' | 'cancelled';
export interface ControlFile { id: string; name: string; content: string }
export interface ControlThread {
  id: string;
  track: UserTrack;
  mode: ControlMode;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
  status: RunStatus;
  provider: ComputeProvider;
  model?: string;
  projectId?: string;
  files: ControlFile[];
  useMemory: boolean;
  includeMasterMemory?: boolean;
  plan?: string;
  review?: string;
  error?: string;
  setup?: SystemSetupPlan;
  skillRun?: { policy: SkillPolicy['mode']; skills: AppliedSkill[]; at: string };
  correlationId?: string;
}

export function createControlThread(track: UserTrack, mode: ControlMode, provider: ComputeProvider, setup?: SystemSetupPlan): ControlThread {
  const selected = setup ? normalizeSystemSetup(setup, track) : undefined;
  return { id: crypto.randomUUID(), track, mode, title: mode === 'work' ? 'New work task' : 'New conversation', messages: [], updatedAt: Date.now(), status: 'idle', provider: selected?.provider || provider, files: [], useMemory: false, ...(selected ? { setup: selected, ...(selected.model ? { model: selected.model } : {}) } : {}) };
}

export function readLocalList<T>(key: string): T[] {
  try { const saved = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(saved) ? saved : []; } catch { return []; }
}

export function restoreControlThreads(key: string): ControlThread[] {
  return readLocalList<ControlThread>(key).filter(thread => thread.id && Array.isArray(thread.messages) && Array.isArray(thread.files)).map(thread => {
    if (thread.setup) thread = { ...thread, setup: normalizeSystemSetup(thread.setup, thread.track) };
    if (thread.skillRun && (!Array.isArray(thread.skillRun.skills) || thread.skillRun.skills.length > 3 || thread.skillRun.skills.some(skill => !skill || typeof skill.skillId !== 'string' || typeof skill.versionId !== 'string' || typeof skill.name !== 'string'))) thread = { ...thread, skillRun: undefined };
    if (['planning', 'drafting', 'reviewing'].includes(thread.status)) return { ...thread, status: 'cancelled', error: 'This run was interrupted when the workspace closed. You can start another request.' };
    return thread;
  });
}

export const isRunning = (status: RunStatus) => ['planning', 'drafting', 'reviewing'].includes(status);
export const runLabel: Record<RunStatus, string> = { idle: 'Ready', planning: 'Planning', drafting: 'Drafting', reviewing: 'Reviewing', complete: 'Ready to review', error: 'Needs attention', cancelled: 'Stopped' };
