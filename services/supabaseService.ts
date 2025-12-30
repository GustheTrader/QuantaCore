
import { createClient } from '@supabase/supabase-js';
import { MemoryBlock, ReflectionResult, ChatMessage, NeuralProject } from '../types';

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
    functions: {
      invoke: async () => ({ data: null, error: new Error("Functions Substrate Offline") })
    },
    from: () => ({
      select: () => ({ order: () => ({ eq: () => Promise.resolve({ data: [], error: null }), ilike: () => Promise.resolve({ data: [], error: null }) }), eq: () => ({ single: () => Promise.resolve({ data: null, error: null }), order: () => Promise.resolve({ data: [], error: null }) }), single: () => Promise.resolve({ data: null, error: null }) }),
      upsert: () => Promise.resolve({ data: null, error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) })
    })
  };
}

export const supabase = supabaseInstance;

/**
 * EDGE FUNCTION CALLER
 * Invokes a specific Supabase Edge Function by name.
 */
export const invokeEdgeFunction = async (functionName: string, payload: any = {}) => {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload
    });
    if (error) throw error;
    return data;
  } catch (e: any) {
    console.warn(`Edge Function [${functionName}] Call Failed:`, e.message);
    throw e;
  }
};

// System Prompt Versioning
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
    await supabase.from('system_prompts').upsert({ agent_name: agentName, is_active: false });
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

// Reflection Logs
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

// Authentication
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

// Memory Management (Long Term Memory)
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
        timestamp: new Date(memory.timestamp).toISOString(),
        is_ltm: true // Identifying as Long Term Memory
      });
    if (error) throw error;
    return data;
  } catch (e) {
    console.warn('Supabase sync bypassed', e);
    return null;
  }
};

export const fetchMemoriesFromSupabase = async (filter?: { query?: string, agentName?: string }): Promise<MemoryBlock[] | null> => {
  try {
    let query = supabase
      .from('memories')
      .select('*');
    
    const { data, error } = await query.order('timestamp', { ascending: false });
    
    if (error || !data) return null;

    let result = data.map((item: any) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      category: item.category,
      assignedAgents: item.assigned_agents || [],
      timestamp: new Date(item.timestamp).getTime()
    }));

    if (filter?.agentName) {
      result = result.filter((m: MemoryBlock) => 
        m.assignedAgents.includes(filter.agentName!) || m.assignedAgents.includes("All Agents")
      );
    }

    return result;
  } catch (e) {
    return null;
  }
};

export const deleteMemoryFromSupabase = async (id: string) => {
  try {
    await supabase.from('memories').delete().eq('id', id);
  } catch (e) {}
};

// Chat History Sync
export const syncChatHistoryToSupabase = async (agentName: string, messages: ChatMessage[]) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('chat_history').upsert({
      user_id: user.id,
      agent_name: agentName,
      messages: JSON.stringify(messages),
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.error("Chat sync error:", e);
  }
};

export const fetchChatHistoryFromSupabase = async (agentName: string): Promise<ChatMessage[] | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_history')
      .select('messages')
      .eq('agent_name', agentName)
      .single();
    
    if (error || !data) return null;
    return JSON.parse(data.messages);
  } catch (e) {
    return null;
  }
};

// Project Sync
export const syncProjectsToSupabase = async (projects: NeuralProject[]) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('neural_projects').upsert({
      user_id: user.id,
      data: JSON.stringify(projects),
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.error("Project sync error:", e);
  }
};

export const fetchProjectsFromSupabase = async (): Promise<NeuralProject[] | null> => {
  try {
    const { data, error } = await supabase
      .from('neural_projects')
      .select('data')
      .single();
    
    if (error || !data) return null;
    return JSON.parse(data.data);
  } catch (e) {
    return null;
  }
}
