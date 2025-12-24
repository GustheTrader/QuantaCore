
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  sources?: { uri: string; title: string }[];
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}

export interface OptimizationTelemetry {
  reasoningDepth: number;
  neuralSync: number;
  contextPurity: number;
  optimizations: string[];
}

export interface MemoryBlock {
  id: string;
  title: string;
  content: string;
  category: string;
  assignedAgents: string[]; // List of agent names this memory is associated with
  timestamp: number;
}
