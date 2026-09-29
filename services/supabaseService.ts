
import { createClient } from '@supabase/supabase-js';
// Corrected import: MemoryBlock does not exist in types.ts, using SourceNode instead
import { SourceNode, ReflectionResult, ChatMessage, NeuralProject } from '../types';
import type { UserTrack } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let supabaseInstance: any;
try {
  if (!isSupabaseConfigured) throw new Error('Supabase auth is not configured.');
  supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
} catch (e) {
  if (import.meta.env.PROD) console.error("Supabase client is not configured.");
  supabaseInstance = {
    auth: { 
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOtp: async () => ({ error: new Error("Supabase unavailable") }),
      signInAnonymously: async () => ({ data: { user: null }, error: new Error("Supabase unavailable") }),
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

export const cloudStorageEnabled = (kind: 'prompts' | 'outputs' = 'outputs'): boolean => {
  try {
    const storage = JSON.parse(localStorage.getItem('quanta_api_settings') || '{}').storage;
    return Boolean(storage && ['supabase', 'hybrid'].includes(storage.provider) && storage[kind === 'prompts' ? 'syncPrompts' : 'syncOutputs'] === true);
  } catch { return false; }
};

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
  if (!cloudStorageEnabled('prompts')) return null;
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
  if (!cloudStorageEnabled('prompts')) return null;
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
  if (!cloudStorageEnabled()) return null;
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
export const signInWithMagicLink = async (email: string, track?: UserTrack) => {
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

/** Creates a temporary Supabase identity and records the tester's explicitly opted-in contact email. */
export const signInAsTestGuest = async (email: string, track: UserTrack) => {
  const normalizedEmail = email.toLowerCase().trim();
  const { data, error } = await supabase.auth.signInAnonymously({
    options: { data: { track, contact_email: normalizedEmail } },
  });
  if (error) throw error;
  if (!data?.user?.id) throw new Error('Supabase did not create a guest session.');

  const { error: contactError } = await supabase.from('test_access_contacts').insert({
    user_id: data.user.id,
    contact_email: normalizedEmail,
  });
  if (contactError) {
    await supabase.auth.signOut();
    throw contactError;
  }
  return data;
};

export const signOut = async () => {
  try {
    await supabase.auth.signOut();
  } catch (e) {}
};

// Memory Management (Long Term Memory)
// Corrected type name: MemoryBlock -> SourceNode
export const syncMemoryToSupabase = async (memory: SourceNode) => {
  if (!cloudStorageEnabled()) return null;
  try {
    const { data, error } = await supabase
      .from('memories')
      .upsert({
        id: memory.id,
        title: memory.title,
        content: memory.content,
        category: memory.category,
        type: memory.type, // Explicitly sync the type
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

// Corrected type name: MemoryBlock -> SourceNode
export const fetchMemoriesFromSupabase = async (filter?: { query?: string, agentName?: string }, signal?: AbortSignal): Promise<SourceNode[] | null> => {
  if (!cloudStorageEnabled()) return null;
  signal?.throwIfAborted();
  try {
    let query = supabase
      .from('memories')
      .select('*');
    if (signal) query = query.abortSignal(signal);
    
    const { data, error } = await query.order('timestamp', { ascending: false });
    signal?.throwIfAborted();
    
    if (error || !data) return null;

    let result = data.map((item: any) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      category: item.category,
      type: item.type || 'distilled', // Defaulting type if missing
      assignedAgents: item.assigned_agents || [],
      timestamp: new Date(item.timestamp).getTime()
    }));

    if (filter?.agentName) {
      result = result.filter((m: SourceNode) => 
        m.assignedAgents.includes(filter.agentName!) || m.assignedAgents.includes("All Agents")
      );
    }

    return result;
  } catch (e) {
    return null;
  }
};

export const deleteMemoryFromSupabase = async (id: string) => {
  if (!cloudStorageEnabled()) return;
  try {
    await supabase.from('memories').delete().eq('id', id);
  } catch (e) {}
};

// Chat History Sync
export const syncChatHistoryToSupabase = async (agentName: string, messages: ChatMessage[]) => {
  if (!cloudStorageEnabled()) return;
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
  if (!cloudStorageEnabled()) return null;
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
  if (!cloudStorageEnabled()) return;
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
  if (!cloudStorageEnabled()) return null;
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
