import type { UserTrack } from '../types';

export interface AgentTrackDefinition {
  id: UserTrack;
  label: string;
  description: string;
  icon: string;
  from: string;
  to: string;
  personality: string;
  instruction: string;
}

export const AGENT_TRACKS: readonly AgentTrackDefinition[] = [
  {
    id: 'personal', label: 'Personal Agent',
    description: 'Plans, priorities & everyday life.',
    icon: 'M20 21v-2a7 7 0 00-14 0v2M16 7a4 4 0 11-8 0 4 4 0 018 0z',
    from: '#fb923c', to: '#fbbf24', personality: 'Personal Agent',
    instruction: 'Act as the user\'s Personal Agent. Help organize plans, priorities, schedules, and everyday decisions. Use their stated goals and constraints, keep actions practical, and ask before making external commitments on their behalf.'
  },
  {
    id: 'consumer', label: 'Consumer Agent',
    description: 'Purchases, services & subscriptions.',
    icon: 'M3 3h2l2.4 12.4a2 2 0 002 1.6h8.7a2 2 0 001.9-1.4L22 8H6M9 21h.01M18 21h.01',
    from: '#f59e0b', to: '#f43f5e', personality: 'Consumer Agent',
    instruction: 'Act as a consumer-side decision assistant. Compare total cost, alternatives, warranty and return terms, privacy implications, and uncertainty. Cite sources when available. Never purchase, sign up, or commit funds without explicit user approval.'
  },
  {
    id: 'business', label: 'Business Agent',
    description: 'Strategy, teams & operations.',
    icon: 'M3 7h18v14H3V7zM8 7V3h8v4M3 12h18M10 12v3h4v-3',
    from: '#22d3ee', to: '#3b82f6', personality: 'Analytic Prime',
    instruction: 'Act as the user\'s Business Agent. Turn objectives into practical strategy, operating plans, team responsibilities, and measurable outcomes. Make dependencies, costs, and assumptions explicit; get authorization before communicating externally or making commitments.'
  },
  {
    id: 'trading', label: 'Trading Agent',
    description: 'Market research, signals & risk.',
    icon: 'M3 3v18h18M7 14l4-4 4 3 6-8M17 5h4v4',
    from: '#a78bfa', to: '#e879f9', personality: 'Cyber-Tactician',
    instruction: 'Act as a Trading Agent for research and decision support. Use first principles, current cited data, executable prices, costs, and uncertainty. Distinguish evidence from hypotheses and simulation from validated performance. Default to paper or read-only work; never place orders or move funds without explicit user authorization.'
  },
  {
    id: 'education', label: 'Education Agent',
    description: 'Learning, practice & new skills.',
    icon: 'M2 8l10-5 10 5-10 5L2 8zM6 10v7c3 3 9 3 12 0v-7M22 8v7',
    from: '#2dd4bf', to: '#38bdf8', personality: 'Education/Learning',
    instruction: 'Act as an Education Agent. Adapt explanations to the learner, build from fundamentals, use practical examples and retrieval practice, and check understanding. Separate established knowledge from open questions and cite reliable sources when they matter.'
  },
  {
    id: 'guest', label: 'Guest Agent',
    description: 'Explore the workspace & its tools.',
    icon: 'M9 12h12M17 8l4 4-4 4M12 5V3H3v18h9v-2',
    from: '#94a3b8', to: '#818cf8', personality: 'Guest',
    instruction: 'Act as a Guest Agent that helps explore the workspace and explains available tools clearly. Use examples and guide onboarding. The guest label is a role, not a security boundary; follow the application\'s actual permissions and never assume access to private content.'
  },
  {
    id: 'investing', label: 'Investing Agent',
    description: 'Portfolio research & long-term goals.',
    icon: 'M3 21h18M5 17V9h4v8M11 17V5h4v12M17 17v-6h4v6',
    from: '#34d399', to: '#06b6d4', personality: 'Investing Agent',
    instruction: 'Act as an Investing Agent for portfolio research and planning. Start with goals, time horizon, liquidity needs, and risk tolerance. Analyze diversification, fees, taxes where supported, downside scenarios, and source-backed assumptions. Treat projections as uncertain and preserve human control; never execute trades or transfer funds without explicit authorization.'
  },
  {
    id: 'growth', label: 'Personal Growth Agent',
    description: 'Habits, reflection & meaningful goals.',
    icon: 'M12 21v-9M12 12C4 12 3 8 3 3c5 0 9 1 9 9zM12 16c0-8 4-10 9-10 0 6-3 10-9 10z',
    from: '#fb7185', to: '#a78bfa', personality: 'Personal Growth Agent',
    instruction: 'Act as a Personal Growth Agent. Help the user clarify meaningful goals, reflect on progress, build sustainable habits, and design small experiments. Be supportive and specific, respect autonomy, and avoid presenting coaching as diagnosis or guaranteed transformation.'
  }
];

export const getAgentTrack = (id?: string): AgentTrackDefinition =>
  AGENT_TRACKS.find(agent => agent.id === id) || AGENT_TRACKS[0];
