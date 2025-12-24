
import { createClient } from '@supabase/supabase-js';
import { MemoryBlock } from '../types';

const SUPABASE_URL = 'https://ovugynuxvtvfkwjkyxby.supabase.co';
const SUPABASE_ANON_KEY = (process as any).env?.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Authentication via Magic Link.
 * For a new user, 'track' metadata is stored.
 * For existing users, it just sends the link.
 */
export const signInWithMagicLink = async (email: string, track?: 'personal' | 'business') => {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      data: track ? { track } : undefined,
      emailRedirectTo: window.location.origin,
    }
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

/**
 * Persists a memory block to Supabase.
 */
export const syncMemoryToSupabase = async (memory: MemoryBlock) => {
  try {
    const { data, error } = await supabase
      .from('memories')
      .upsert({
        id: memory.id,
        title: memory.title,
        content: memory.content,
        category: memory.category,
        assigned_agents: memory.assignedAgents,
        timestamp: new Date(memory.timestamp).toISOString()
      });
    
    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Supabase Sync Failed', e);
    return null;
  }
};

export const fetchMemoriesFromSupabase = async (): Promise<MemoryBlock[] | null> => {
  try {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .order('timestamp', { ascending: false });
    
    if (error) throw error;

    return data.map((item: any) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      category: item.category,
      assignedAgents: item.assigned_agents || [],
      timestamp: new Date(item.timestamp).getTime()
    }));
  } catch (e) {
    console.warn('Could not fetch from Supabase');
    return null;
  }
};

export const deleteMemoryFromSupabase = async (id: string) => {
  try {
    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (e) {
    console.error('Supabase Delete Failed', e);
  }
};
