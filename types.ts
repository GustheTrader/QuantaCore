
export interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  category: string;
  description?: string; // Short summary
  content?: string; // Full markdown body
  icon?: string; // Emoji or SVG
  coverImage?: string; // URL
  attachments: TaskAttachment[];
  timestamp: number;
}

export interface TaskAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  localUrl: string; // Blob URL or local path
  s3Url: string; // s3://bucket/key
  synced: boolean;
}

export type ComputeProvider = 'gemini' | 'groq' | 'local' | 'abacus' | 'novita';

export interface FPTAudit {
  deconstruction: string[]; // Breaking down the problem
  assumptionsRemoved: string[]; // What analogies were stripped
  axioms: string[]; // The fundamental truths remaining
  reconstruction: string; // The solution built up from axioms
}

export interface ContextOptimizationData {
  original: string;
  optimized: string;
  structure: {
    role: string;
    task: string;
    constraints: string[];
    context: string;
  };
  missingInfo: string[];
  traceId: string;
  latency: number;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  sources?: { uri: string; title: string }[];
  provider?: ComputeProvider;
  citations?: { sourceId: string; sourceTitle: string; snippet: string }[];
  fptAudit?: FPTAudit; // Optional audit trace for First Principles
}

export interface SourceNode {
  id: string;
  title: string;
  content: string;
  type: 'doc' | 'url' | 'pdf' | 'distilled';
  category: string;
  assignedAgents: string[]; 
  timestamp: number;
  metadata?: {
    author?: string;
    url?: string;
    wordCount?: number;
    summary?: string;
  };
}

export interface ProjectChat {
  id: string;
  title: string;
  lastActive: number;
  messages: ChatMessage[];
}

export interface ProjectFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
}

export interface NeuralProject {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'archived';
  customInstructions: string;
  files: ProjectFile[];
  chats: ProjectChat[];
  skills: NeuralSkill[];
  ideas: string[];
  createdAt: number;
}

export interface NeuralSkill {
  id: string;
  name: string;
  instruction: string;
  fileFormat: 'md';
  version: string;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  type: 'image' | 'video';
}

export interface ZeroLogEntry {
  id: string;
  type: 'info' | 'code' | 'output' | 'error' | 'agent';
  agentName?: string;
  content: string;
  timestamp: number;
  lat?: number;
}

export interface AgentZeroSession {
  id: string;
  status: 'idle' | 'executing' | 'error';
  dockerStatus: 'connected' | 'offline';
  logs: ZeroLogEntry[];
  workspace: string; // Path
}

export interface OptimizationTelemetry {
  reasoningDepth: number;
  neuralSync: number;
  contextPurity: number;
  optimizations: string[];
}

export interface ReflectionResult {
  score: number;
  analysis: string;
  suggestedPrompt: string | null;
  weaknesses: string[];
  strengths: string[];
}

export interface CouncilTurn {
  agentName: string;
  role: 'proposer' | 'critic' | 'judge' | 'board';
  content: string;
  status: 'pending' | 'processing' | 'complete';
  sources?: { uri: string; title: string }[];
  logicAudit?: {
    deconstruction: string[];
    axioms: string[];
    reconstruction: string;
  };
}

export interface DeepStep {
  id: string;
  type: 'plan' | 'search' | 'analyze' | 'critique' | 'synthesize' | 'dive';
  status: 'pending' | 'running' | 'complete' | 'error';
  label: string;
  content?: string;
  sources?: { uri: string; title: string }[];
  fptContext?: string; // Small FPT note for steps
}

export interface DeepAgentSession {
  id: string;
  query: string;
  steps: DeepStep[];
  finalResult?: string;
  startTime: number;
  endTime?: number;
}

export interface AbacusStreamChunk {
  text?: string;
  is_complete: boolean;
  error?: string;
}

export type MCPConnectorType = 'local' | 'docker';

export interface MCPConnector {
  id: string;
  name: string;
  type: MCPConnectorType;
  status: 'active' | 'error' | 'disconnected';
  endpoint: string;
  assignedAgents: string[];
  config: {
    command?: string;
    image?: string;
    ports?: string[];
    env?: Record<string, string>;
    sovereignShield: boolean;
  };
}

export interface StorageSettings {
  provider: 'local' | 'supabase' | 'hybrid';
  supabaseUrl: string;
  supabaseAnonKey: string;
  bucketName: string;
  syncPrompts: boolean;
  syncOutputs: boolean;
  localPath: string;
}

export interface ApiSettings {
  computeMode: 'credits' | 'sovereign';
  geminiKey: string;
  groqKey: string;
  novitaKey: string;
  novitaModel: string;
  localEndpoint: string;
  preferredModel: string;
  storage: StorageSettings;
}

export interface UserCredits {
  cloudTokens: number;
  deepAgentTokens: number;
  visualEnergy: number;
  lastSync: number;
}

// EDGE & MECH NETWORK TYPES
export type EdgeDomain = 'futures' | 'crypto' | 'prediction' | 'sports_arb';

export interface MechNode {
  id: string;
  region: string; // e.g., 'us-east', 'eu-west'
  status: 'idle' | 'spinning' | 'hot' | 'cooling';
  latency: number; // ms
  load: number; // 0-100
  activeTask?: string;
}

export interface HotPathLog {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'crit' | 'exec';
  source: 'REDIS' | 'EDGE' | 'MECH' | 'CORE';
  message: string;
  latency?: number;
}

export interface EdgeSession {
  isActive: boolean;
  domains: EdgeDomain[];
  nodes: MechNode[];
  logs: HotPathLog[];
  redisMetrics: {
    opsPerSec: number;
    hitRate: number;
    memoryUsage: string;
  };
}
