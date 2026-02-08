
import { GoogleGenAI, Type } from "@google/genai";
// Corrected import: MemoryBlock does not exist in types.ts, using SourceNode instead
import { DeepStep, DeepAgentSession, SourceNode } from "../types";
import { recallRelevantMemories, distillMemoryFromChat } from "./geminiService";
import { syncMemoryToSupabase } from "./supabaseService";
import { streamAbacusAgent } from "./abacusService";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const runDeepAgentLoop = async (
  query: string,
  onUpdate: (session: DeepAgentSession) => void
) => {
  const ai = getAI();
  const sessionId = Math.random().toString(36).substr(2, 9);
  
  let session: DeepAgentSession = {
    id: sessionId,
    query,
    steps: [],
    startTime: Date.now()
  };

  const addStep = (step: DeepStep) => {
    session.steps.push(step);
    onUpdate({ ...session });
  };

  const updateStep = (id: string, updates: Partial<DeepStep>) => {
    session.steps = session.steps.map(s => s.id === id ? { ...s, ...updates } : s);
    onUpdate({ ...session });
  };

  try {
    // 0. RECALL PHASE (LTM Integration)
    const recallId = 'step_recall';
    addStep({ id: recallId, type: 'analyze', status: 'running', label: 'Consulting Long-Term Memory' });
    const recalledContext = await recallRelevantMemories(query, "Deep Agent");
    updateStep(recallId, { 
      status: 'complete', 
      content: recalledContext ? `Recalled ${recalledContext.length} bytes of relevant LTM context.` : "No relevant prior research found in LTM." 
    });

    // 1. PLANNING PHASE
    const planId = 'step_plan';
    addStep({ id: planId, type: 'plan', status: 'running', label: 'Developing Neural Logic Plan' });
    
    const planResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User Query: ${query}\n\nRECALLED LTM CONTEXT: ${recalledContext || "None"}\n\nDeconstruct this into 3 investigative sub-goals. Factor in recalled knowledge. Return as JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            goals: { type: Type.ARRAY, items: { type: Type.STRING } },
            strategy: { type: Type.STRING }
          },
          required: ["goals", "strategy"]
        }
      }
    });

    const plan = JSON.parse(planResponse.text || '{"goals":[], "strategy":""}');
    updateStep(planId, { status: 'complete', content: plan.strategy });

    // 2. SEARCH & ANALYSIS PHASES
    let globalContext = recalledContext || "";
    let allSources: {uri: string, title: string}[] = [];

    for (let i = 0; i < plan.goals.length; i++) {
      const goal = plan.goals[i];
      const searchId = `search_${i}`;
      addStep({ id: searchId, type: 'search', status: 'running', label: `Investigating Node ${i+1}: ${goal}` });

      const searchResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Execute deep research into: ${goal}. FACTOR IN PRIOR KNOWLEDGE: ${globalContext}`,
        config: { tools: [{ googleSearch: {} }] }
      });

      const sources = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter(chunk => chunk.web)
        ?.map(chunk => ({ uri: chunk.web?.uri || '', title: chunk.web?.title || 'Source' })) || [];

      allSources = [...allSources, ...sources];
      globalContext += `\n\n### NODE ${i+1}: ${goal}\n${searchResponse.text}`;
      updateStep(searchId, { status: 'complete', content: `Node investigated. ${sources.length} axioms retrieved.`, sources });
    }

    // 3. CRITIQUE PHASE
    const critiqueId = 'step_critique';
    addStep({ id: critiqueId, type: 'critique', status: 'running', label: 'Self-Reflecting on Collected Data' });
    
    const critiqueResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `CONTEXT:\n${globalContext}\n\nCRITIQUE: Does this sufficiently address: "${query}"?`,
    });
    updateStep(critiqueId, { status: 'complete', content: critiqueResponse.text });

    // 4. SYNTHESIS PHASE
    const synthId = 'step_synth';
    addStep({ id: synthId, type: 'synthesize', status: 'running', label: 'Synthesizing Final Neural Report' });
    
    const synthResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Final Task: Comprehensive synthesis report.\n\nRESEARCH:\n${globalContext}\n\nCRITIQUE:\n${critiqueResponse.text}\n\nUSER QUERY:\n${query}`,
    });

    updateStep(synthId, { status: 'complete', content: 'Synthesis complete.' });
    
    session.finalResult = synthResponse.text;
    session.endTime = Date.now();
    
    // 5. ARCHIVE TO LTM (Long Term Memory)
    // Corrected type: MemoryBlock -> SourceNode
    const memory: SourceNode = {
      id: `deep_${sessionId}`,
      title: `Deep Research: ${query.substring(0, 40)}...`,
      content: synthResponse.text || "",
      category: "Strategic",
      assignedAgents: ["Deep Agent", "All Agents"],
      timestamp: Date.now(),
      type: 'distilled' // Corrected property: source -> type
    };
    await syncMemoryToSupabase(memory);
    
    onUpdate({ ...session });

  } catch (error) {
    console.error("Deep Agent Loop Failure:", error);
    addStep({ id: 'error', type: 'critique', status: 'error', label: 'Neural Connection Lost' });
  }
};

export const runAbacusAgentSession = async (
  query: string,
  agentId: string,
  onUpdate: (session: DeepAgentSession) => void
) => {
  const sessionId = `ABACUS_${Math.random().toString(36).substr(2, 9)}`;
  let session: DeepAgentSession = {
    id: sessionId,
    query,
    steps: [{ 
      id: 'abacus_stream', 
      type: 'synthesize', 
      status: 'running', 
      label: 'Abacus Neural Stream' 
    }],
    startTime: Date.now(),
    finalResult: ''
  };

  onUpdate({ ...session });

  try {
    await streamAbacusAgent(agentId, query, (chunk) => {
      if (chunk.text) {
        session.finalResult = (session.finalResult || '') + chunk.text;
      }
      if (chunk.is_complete) {
        session.endTime = Date.now();
        session.steps[0].status = 'complete';
        session.steps[0].label = 'Abacus Inference Complete';
      }
      onUpdate({ ...session });
    });
  } catch (e: any) {
    session.steps[0].status = 'error';
    session.steps[0].label = 'Abacus Signal Interrupted';
    session.steps[0].content = e.message;
    session.endTime = Date.now();
    onUpdate({ ...session });
  }
};
