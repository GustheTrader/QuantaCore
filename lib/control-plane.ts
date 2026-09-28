import type { ChatMessage, ComputeProvider, UserTrack } from '../types';

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
  plan?: string;
  review?: string;
  error?: string;
}

export function createControlThread(track: UserTrack, mode: ControlMode, provider: ComputeProvider): ControlThread {
  return { id: crypto.randomUUID(), track, mode, title: mode === 'work' ? 'New work task' : 'New conversation', messages: [], updatedAt: Date.now(), status: 'idle', provider, files: [], useMemory: false };
}

export function readLocalList<T>(key: string): T[] {
  try { const saved = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(saved) ? saved : []; } catch { return []; }
}

export function restoreControlThreads(key: string): ControlThread[] {
  return readLocalList<ControlThread>(key).filter(thread => thread.id && Array.isArray(thread.messages) && Array.isArray(thread.files)).map(thread => {
    if (['planning', 'drafting', 'reviewing'].includes(thread.status)) return { ...thread, status: 'cancelled', error: 'This run was interrupted when the workspace closed. You can start another request.' };
    return thread;
  });
}

export const isRunning = (status: RunStatus) => ['planning', 'drafting', 'reviewing'].includes(status);
export const runLabel: Record<RunStatus, string> = { idle: 'Ready', planning: 'Planning', drafting: 'Drafting', reviewing: 'Reviewing', complete: 'Ready to review', error: 'Needs attention', cancelled: 'Stopped' };
