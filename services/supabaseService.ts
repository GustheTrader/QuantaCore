
import { createClient } from '@supabase/supabase-js';
import { MemoryBlock, ReflectionResult } from '../types';

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
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }), eq: () => Promise.resolve({ data: [], error: null }) }),
      upsert: () => Promise.resolve({ data: null, error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) })
    })
  };
}

export const supabase = supabaseInstance;

// Blueprint: System Prompt Versioning
export const getActiveSystemPrompt = async (agentName: string) => {
  try {
    const { data, error } = await supabase
      .from('system_prompts')
      .select('*')
      .eq('agent_name', agentName)
      .eq('is_active', true)
      .single();
    if (error) return null;
    return data;
  } catch (e) {
    return null;
  }
};

export const archiveAndActivatePrompt = async (agentName: string, promptText: string, reasoning: string, version: number) => {
  try {
    // 1. Deactivate old prompts
    await supabase.from('system_prompts').upsert({ agent_name: agentName, is_active: false });
    
    // 2. Insert new prompt
    const { data, error } = await supabase.from('system_prompts').insert({
      agent_name: agentName,
      prompt_text: promptText,
      reasoning,
      version,
      is_active: true,
      created_at: new Date().toISOString()
    });
    return data;
  } catch (e) {}
};

// Blueprint: Reflection Logs
export const logReflection = async (agentName: string, messages: any[], result: ReflectionResult) => {
  try {
    const { data, error } = await supabase.from('reflection_logs').insert({
      agent_name: agentName,
      evaluated_messages: JSON.stringify(messages),
      analysis: result.analysis,
      decision: result.score < 4 ? 'update' : 'maintain',
      score: result.score,
      timestamp: new Date().toISOString()
    });
    return data;
  } catch (e) {}
};

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
