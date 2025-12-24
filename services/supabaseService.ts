
import { createClient } from '@supabase/supabase-js';
import { MemoryBlock } from '../types';

const SUPABASE_URL = 'https://ovugynuxvtvfkwjkyxby.supabase.co';

const getSupabaseKey = () => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.SUPABASE_KEY) {
      return process.env.SUPABASE_KEY;
    }
    if (typeof window !== 'undefined' && (window as any).process?.env?.SUPABASE_KEY) {
      return (window as any).process.env.SUPABASE_KEY;
    }
  } catch (e) {}
  // Return a syntactically valid anonymous key to prevent SDK constructor crash
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92dWd5bnV4dnR2Zmt3amt5eGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDcwMDAwMDAsImV4cCI6MjA0NTYwMDAwMH0.placeholder';
};

let supabaseInstance: any;
try {
  supabaseInstance = createClient(SUPABASE_URL, getSupabaseKey());
} catch (e) {
  console.error("Supabase client failed to initialize:", e);
  supabaseInstance = {
    auth: { 
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOtp: async () => ({ error: new Error("Supabase unavailable") }),
      signOut: async () => ({ error: null })
    },
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      upsert: () => Promise.resolve({ data: null, error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) })
    })
  };
}

export const supabase = supabaseInstance;

export const signInWithMagicLink = async (email: string, track?: 'personal' | 'business') => {
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: track ? { track } : undefined,
        emailRedirectTo: window.location.origin,
      }
    });
    if (error) throw error;
    return data;
  } catch (e) {
    console.error("Sign in failed", e);
    throw e;
  }
};

export const signOut = async () => {
  try {
    await supabase.auth.signOut();
  } catch (e) {}
};

export const getCurrentUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (e) {
    return null;
  }
};

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
    console.warn('Supabase sync bypassed', e);
    return null;
  }
};

export const fetchMemoriesFromSupabase = async (): Promise<MemoryBlock[] | null> => {
  try {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .order('timestamp', { ascending: false });
    
    if (error || !data) return null;

    return data.map((item: any) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      category: item.category,
      assignedAgents: item.assigned_agents || [],
      timestamp: new Date(item.timestamp).getTime()
    }));
  } catch (e) {
    return null;
  }
};

export const deleteMemoryFromSupabase = async (id: string) => {
  try {
    await supabase.from('memories').delete().eq('id', id);
  } catch (e) {}
};
