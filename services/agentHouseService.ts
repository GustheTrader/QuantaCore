import { isSupabaseConfigured, supabase } from './supabaseService';
import { createAgentHouse, validateAgentHouse, type AgentHouse } from '../lib/agent-channel';

const storageKey = (owner: string) => `quanta_open_house_v1:${encodeURIComponent(owner)}`;
export function loadBrowserHouse(owner: string): AgentHouse {
  const raw = localStorage.getItem(storageKey(owner));
  return raw ? validateAgentHouse(JSON.parse(raw)) : createAgentHouse();
}
export function saveBrowserHouse(owner: string, house: AgentHouse) {
  localStorage.setItem(storageKey(owner), JSON.stringify(validateAgentHouse(house)));
}
async function cloudOwner() {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured. Your workspace is saved in this browser.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) throw new Error('Sign in before saving a cloud workspace.');
  return data.user.id as string;
}
export async function loadCloudHouse() {
  const owner = await cloudOwner();
  const { data, error } = await supabase.from('agent_house_workspaces').select('state,revision').eq('owner_id', owner).maybeSingle();
  if (error) throw new Error('Cloud workspace unavailable. Apply the Open House database migration first.');
  return data ? { house: validateAgentHouse(data.state), revision: data.revision as number } : null;
}
export async function saveCloudHouse(house: AgentHouse, revision: number | null) {
  const owner = await cloudOwner();
  const state = validateAgentHouse(house);
  const next = revision === null ? 1 : revision + 1;
  const operation = revision === null
    ? supabase.from('agent_house_workspaces').insert({ owner_id: owner, state, revision: next })
    : supabase.from('agent_house_workspaces').update({ state, revision: next, updated_at: new Date().toISOString() }).eq('owner_id', owner).eq('revision', revision);
  const { data, error } = await operation.select('revision');
  if (error || data?.length !== 1) throw new Error('Cloud save failed or a newer workspace exists. Load its latest version before saving again.');
  return next;
}
