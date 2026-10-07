export interface NavigationItem {
  name: string;
  icon: string;
  path: string;
  description?: string;
}

export interface NavigationGroup {
  name: 'Brain' | 'Hands' | 'Nervous Systems' | 'Governess';
  caption: string;
  accent: 'cyan' | 'blue' | 'violet' | 'emerald';
  items: NavigationItem[];
}

const brainIcon = 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
const chatIcon = 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z';
const agentIcon = 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
const networkIcon = 'M12 8V3m0 5l-6 5m6-5l6 5M6 13v5m12-5v5M9 3h6M3 18h6m6 0h6';
const searchIcon = 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z';
const boltIcon = 'M13 10V3L4 14h7v7l9-11h-7z';
const shieldIcon = 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z';
const bookIcon = 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18s-3.332.477-4.5 1.253';
const folderIcon = 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z';

export const MISSION_CONTROL_NAV: NavigationItem = {
  name: 'Mission Control',
  path: '/',
  icon: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z',
  description: 'Activate an agent and open its workspace'
};

// This inventory keeps the product's existing tools reachable under one operating model.
export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    name: 'Brain',
    caption: 'LLM models & inference',
    accent: 'cyan',
    items: [
      { name: 'LLM Models', path: '/settings', icon: brainIcon, description: 'Model connections and inference settings' },
      { name: 'Neural Chat', path: '/chat', icon: chatIcon, description: 'Talk with your selected model' }
    ]
  },
  {
    name: 'Hands',
    caption: 'Agents that do the work',
    accent: 'blue',
    items: [
      { name: 'Agent Control Plane', path: '/agent', icon: agentIcon, description: 'Chat and work with your operational agent' },
      { name: 'Open House Channel', path: '/agent-house', icon: networkIcon, description: 'Named agents, task harnesses, private KBs and a shared master KB' },
      { name: 'OpenMuse Agent', path: '/openmuse', icon: agentIcon, description: 'Personal and Consumer agent workspace' },
      { name: 'OpenDots Agents', path: '/opendots', icon: networkIcon, description: 'Persistent specialist coworkers and optional per-agent computers' },
      { name: 'Operator Work Zone', path: '/work-zone', icon: networkIcon, description: 'Paperclip organizations, workboard, onboarding and skill reviews' },
      { name: 'QuantaTrade', path: '/quantatrade', icon: searchIcon, description: 'SME trading desk, stock research and reviewed decisions' },
      { name: 'Agent Directory', path: '/agents', icon: agentIcon, description: 'Agents grouped by purpose with optional computer sessions' },
      { name: 'Coding Harnesses', path: '/coding-harness', icon: 'M8 8l-4 4 4 4m8-8l4 4-4 4M14 4l-4 16', description: 'FireConnect setup and Quanta CLI' },
      { name: 'Gnoesis Agenic Research', path: '/research', icon: searchIcon, description: 'TradingAgents research, evidence and decision journal' },
      { name: 'SME Council', path: '/council', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2' },
      { name: 'SME Builder', path: '/sme-builder', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
      { name: 'Deep Agent', path: '/deep-agent', icon: searchIcon },
      { name: 'Deep Diver', path: '/deep-diver', icon: 'M19 14l-7 7m0 0l-7-7m7 7V3' },
      { name: 'Agent Zero', path: '/agent-zero', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
      { name: 'Iron Claw', path: '/iron-claw', icon: shieldIcon },
      { name: 'Visual Forge', path: '/images', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-9h.01M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z' },
      { name: 'Cinematic Forge', path: '/videos', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' }
    ]
  },
  {
    name: 'Nervous Systems',
    caption: 'Orchestration & telemetry',
    accent: 'violet',
    items: [
      { name: 'Neural Core', path: '/neural-core', icon: networkIcon, description: 'Memory architecture and runtime status' },
      { name: 'Agentic OS', path: '/agentic-os', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' },
      { name: 'Hermes Protocol', path: '/hermes', icon: boltIcon },
      { name: 'Unified Gateway', path: '/gateway', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { name: 'MCP Connectors', path: '/mcp', icon: 'M8 12h8m-4-4v8M7 4h10a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7a3 3 0 013-3z' },
      { name: 'Edge Mech Network', path: '/edge-mech', icon: networkIcon },
      { name: 'Process Flow', path: '/tasks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 3h6v4H9V3z' },
      { name: 'Persistent Memory', path: '/memory', icon: bookIcon }
    ]
  },
  {
    name: 'Governess',
    caption: 'Privacy, security, policy & your data',
    accent: 'emerald',
    items: [
      { name: 'Data Intake', path: '/data-intake', icon: folderIcon, description: 'Preview, validate and assign local trading, business, personal and chat data' },
      { name: 'Sovereign Knowledge', path: '/notebook', icon: bookIcon, description: 'Your knowledge library and source documents' },
      { name: 'Projects', path: '/projects', icon: folderIcon, description: 'Your saved work and project context' }
    ]
  }
];

export const AGENT_CATEGORIES: Record<string, string> = {
  '/work-zone': 'Command & collaboration', '/quantatrade': 'Trading & markets', '/agents': 'Command & collaboration', '/agent': 'Command & collaboration', '/agent-house': 'Command & collaboration',
  '/openmuse': 'Personal & consumer', '/opendots': 'Persistent coworkers',
  '/research': 'Research & specialists', '/council': 'Research & specialists', '/sme-builder': 'Research & specialists',
  '/deep-agent': 'Research & specialists', '/deep-diver': 'Research & specialists',
  '/coding-harness': 'Execution & security', '/agent-zero': 'Execution & security', '/iron-claw': 'Execution & security',
  '/images': 'Creative studios', '/videos': 'Creative studios',
  '/hermes': 'Execution & security', '/agentic-os': 'Orchestration'
};
