
export interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  category: string;
  description?: string;
  timestamp: number;
}

export type ComputeProvider = 'gemini' | 'groq' | 'local' | 'abacus' | 'novita';

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  sources?: { uri: string; title: string }[];
  provider?: ComputeProvider;
  citations?: { sourceId: string; sourceTitle: string; snippet: string }[];
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

// ==================== NOTEBOOKLM INTEGRATION ====================

export interface NotebookLMNotebook {
  id: string;
  title: string;
  sourceCount: number;
  lastModified: string;
  createdDate?: string;
}

export interface NotebookLMSource {
  id: string;
  title: string;
  type: 'pdf' | 'url' | 'doc' | 'text' | 'youtube';
  url?: string;
  addedDate?: string;
}

export interface NotebookLMCitation {
  sourceId: string;
  sourceTitle: string;
  excerpt: string;
  pageNumber?: number;
}

export interface NotebookLMChatResponse {
  success: boolean;
  notebookId: string;
  question: string;
  answer: string;
  citations: NotebookLMCitation[];
}

export interface NotebookLMBriefing {
  success: boolean;
  notebookId: string;
  format: 'summary' | 'briefing' | 'study-guide' | 'faq' | 'table';
  content: string;
  length: number;
  generatedAt?: number;
}

export interface NotebookLMFlashcard {
  question: string;
  answer: string;
  difficulty?: 'basic' | 'intermediate' | 'advanced';
}

export interface NotebookLMQuiz {
  questions: Array<{
    question: string;
    type: 'multiple-choice' | 'short-answer';
    options?: string[];
    correctAnswer: string;
  }>;
  answerKey: Record<string, string>;
}

export interface NotebookLMPodcast {
  success: boolean;
  notebookId: string;
  audioUrl: string;
  transcriptUrl?: string;
  duration?: number;
  tone: 'conversational' | 'educational' | 'professional';
  generatedAt: number;
}

export interface NotebookLMToolResult {
  success: boolean;
  data: any;
  error?: string;
  timestamp: number;
}

export interface NotebookLMSession {
  currentNotebookId: string | null;
  notebooks: NotebookLMNotebook[];
  lastSync: number;
}

// Tool registry types
export type ToolCategory = 'search' | 'analysis' | 'synthesis' | 'notebook' | 'mcp' | 'internal';
export type ToolProvider = 'gemini' | 'notebooklm' | 'mcp' | 'internal';

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  provider: ToolProvider;
  schema: any; // FunctionDeclaration schema
  enabledByDefault: boolean;
  requiredAgents?: string[];
  cost?: number; // Token cost estimate
}

export interface AgentContext {
  agentName: string;
  sessionId: string;
  history: ChatMessage[];
  availableTools: ToolDefinition[];
  enabledSkills: string[];
}

export interface ToolExecutionResult {
  success: boolean;
  toolId: string;
  result: any;
  error?: string;
  tokensUsed?: number;
  executionTime?: number;
}
