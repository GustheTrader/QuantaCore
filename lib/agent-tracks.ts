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
  capabilities: readonly string[];
  caseStudies: readonly { title: string; outcome: string }[];
}

export const AGENT_TRACKS: readonly AgentTrackDefinition[] = [
  {
    id: 'personal', label: 'Personal Agent',
    description: 'Plans, priorities & everyday life.',
    icon: 'M20 21v-2a7 7 0 00-14 0v2M16 7a4 4 0 11-8 0 4 4 0 018 0z',
    from: '#fb923c', to: '#fbbf24', personality: 'Personal Agent',
    capabilities: ['Plan your week', 'Compare choices', 'Organize priorities'],
    caseStudies: [
      { title: 'A week with competing priorities', outcome: 'Turn deadlines and available time into a realistic weekly plan.' },
      { title: 'A move with many moving parts', outcome: 'Draft a budget, packing checklist and timeline from your constraints.' },
      { title: 'A difficult everyday decision', outcome: 'Compare options, tradeoffs and next steps against what matters to you.' }
    ],
    instruction: 'Act as the user\'s Personal Agent. Help organize plans, priorities, schedules, and everyday decisions. Use their stated goals and constraints, keep actions practical, and ask before making external commitments on their behalf.'
  },
  {
    id: 'consumer', label: 'Consumer Agent',
    description: 'Purchases, services & subscriptions.',
    icon: 'M3 3h2l2.4 12.4a2 2 0 002 1.6h8.7a2 2 0 001.9-1.4L22 8H6M9 21h.01M18 21h.01',
    from: '#f59e0b', to: '#f43f5e', personality: 'Consumer Agent',
    capabilities: ['Compare total cost', 'Review terms', 'Evaluate alternatives'],
    caseStudies: [
      { title: 'Choosing a laptop', outcome: 'Compare supplied specifications, prices and warranty terms for your workload.' },
      { title: 'A subscription audit', outcome: 'Use your subscription list to flag overlap and draft a savings plan.' },
      { title: 'Comparing service quotes', outcome: 'Build a comparison of scope, exclusions and questions to ask providers.' }
    ],
    instruction: 'Act as a consumer-side decision assistant. Compare total cost, alternatives, warranty and return terms, privacy implications, and uncertainty. Cite sources when available. Never purchase, sign up, or commit funds without explicit user approval.'
  },
  {
    id: 'business', label: 'Business Agent',
    description: 'Strategy, teams & operations.',
    icon: 'M3 7h18v14H3V7zM8 7V3h8v4M3 12h18M10 12v3h4v-3',
    from: '#22d3ee', to: '#3b82f6', personality: 'Analytic Prime',
    capabilities: ['Develop strategy', 'Map operations', 'Draft decision briefs'],
    caseStudies: [
      { title: 'A new product launch', outcome: 'Draft a launch plan with target customers, milestones and success measures.' },
      { title: 'An operational bottleneck', outcome: 'Map your process, identify possible causes and propose measurable experiments.' },
      { title: 'A hiring or vendor decision', outcome: 'Create a scorecard, cost assumptions and a reviewable recommendation.' }
    ],
    instruction: 'Act as the user\'s Business Agent. Turn objectives into practical strategy, operating plans, team responsibilities, and measurable outcomes. Make dependencies, costs, and assumptions explicit; get authorization before communicating externally or making commitments.'
  },
  {
    id: 'trading', label: 'Trading Agent',
    description: 'Market research, signals & risk.',
    icon: 'M3 3v18h18M7 14l4-4 4 3 6-8M17 5h4v4',
    from: '#a78bfa', to: '#e879f9', personality: 'Cyber-Tactician',
    capabilities: ['Frame market hypotheses', 'Review risk', 'Design paper experiments'],
    caseStudies: [
      { title: 'A possible trading signal', outcome: 'Specify the hypothesis, required data, costs and conditions that would disprove it.' },
      { title: 'A strategy second look', outcome: 'Review supplied results for leakage, overfitting and missing execution costs.' },
      { title: 'An event risk scenario', outcome: 'Draft a paper trade plan with downside scenarios and invalidation rules.' }
    ],
    instruction: 'Act as a Trading Agent for research and decision support. Use first principles, current cited data, executable prices, costs, and uncertainty. Distinguish evidence from hypotheses and simulation from validated performance. Default to paper or read-only work; never place orders or move funds without explicit user authorization.'
  },
  {
    // Preserve the stored track ID so existing sessions and work history still open.
    id: 'guest', label: 'Analyst Agent',
    description: 'Evidence, data interpretation & second looks.',
    icon: 'M3 3v18h18M7 16v-4M12 16V8M17 16v-6M16 3h5v5',
    from: '#94a3b8', to: '#818cf8', personality: 'Analyst Agent',
    capabilities: ['Assess evidence', 'Explain patterns', 'Challenge assumptions'],
    caseStudies: [
      { title: 'Why did a metric change?', outcome: 'Inspect a supplied data extract, compare explanations and identify missing checks.' },
      { title: 'Conflicting research claims', outcome: 'Build an evidence matrix from your sources and distinguish facts from inference.' },
      { title: 'A proposal needs a second look', outcome: 'Challenge assumptions, explore alternatives and draft a decision brief with open questions.' }
    ],
    instruction: 'Act as an Analyst Agent. Frame the question from first principles, interpret supplied data and documents, compare alternative explanations, and challenge assumptions. Preserve source provenance, separate evidence from inference, flag missing or inconsistent data, and propose independent checks. Do not invent measurements, citations or completed verification; state the limits of the available evidence and tools.'
  },
  {
    id: 'investing', label: 'Investing Agent',
    description: 'Portfolio research & long-term goals.',
    icon: 'M3 21h18M5 17V9h4v8M11 17V5h4v12M17 17v-6h4v6',
    from: '#34d399', to: '#06b6d4', personality: 'Investing Agent',
    capabilities: ['Clarify portfolio goals', 'Compare scenarios', 'Review diversification'],
    caseStudies: [
      { title: 'A portfolio concentration review', outcome: 'Use supplied holdings to discuss exposure, diversification and questions for review.' },
      { title: 'Planning for a long-term goal', outcome: 'Compare contribution and return scenarios with explicit, uncertain assumptions.' },
      { title: 'Evaluating an investment thesis', outcome: 'Draft a thesis, downside case and research checklist from your source material.' }
    ],
    instruction: 'Act as an Investing Agent for portfolio research and planning. Start with goals, time horizon, liquidity needs, and risk tolerance. Analyze diversification, fees, taxes where supported, downside scenarios, and source-backed assumptions. Treat projections as uncertain and preserve human control; never execute trades or transfer funds without explicit authorization.'
  },
  {
    id: 'growth', label: 'Personal Growth Agent',
    description: 'Habits, reflection & meaningful goals.',
    icon: 'M12 21v-9M12 12C4 12 3 8 3 3c5 0 9 1 9 9zM12 16c0-8 4-10 9-10 0 6-3 10-9 10z',
    from: '#fb7185', to: '#a78bfa', personality: 'Personal Growth Agent',
    capabilities: ['Design small habits', 'Reflect on progress', 'Clarify meaningful goals'],
    caseStudies: [
      { title: 'A habit that keeps slipping', outcome: 'Design a small experiment with cues, obstacles and a weekly reflection.' },
      { title: 'Exploring a career change', outcome: 'Map values, transferable skills and low-commitment ways to explore options.' },
      { title: 'Turning reflection into action', outcome: 'Find themes in your notes and draft a manageable next-step plan.' }
    ],
    instruction: 'Act as a Personal Growth Agent. Help the user clarify meaningful goals, reflect on progress, build sustainable habits, and design small experiments. Be supportive and specific, respect autonomy, and avoid presenting coaching as diagnosis or guaranteed transformation.'
  },
  {
    id: 'education', label: 'Education Agent',
    description: 'Learning, practice & new skills.',
    icon: 'M2 8l10-5 10 5-10 5L2 8zM6 10v7c3 3 9 3 12 0v-7M22 8v7',
    from: '#2dd4bf', to: '#38bdf8', personality: 'Education/Learning',
    capabilities: ['Explain from fundamentals', 'Build learning plans', 'Create practice exercises'],
    caseStudies: [
      { title: 'Learning a difficult concept', outcome: 'Break it into fundamentals, worked examples and checks for understanding.' },
      { title: 'Preparing for an exam', outcome: 'Turn your syllabus and time budget into revision sessions and practice questions.' },
      { title: 'Building a practical skill', outcome: 'Draft a project-based learning path with milestones and feedback prompts.' }
    ],
    instruction: 'Act as an Education Agent. Adapt explanations to the learner, build from fundamentals, use practical examples and retrieval practice, and check understanding. Separate established knowledge from open questions and cite reliable sources when they matter.'
  }
];

export const getAgentTrack = (id?: string): AgentTrackDefinition =>
  AGENT_TRACKS.find(agent => agent.id === id) || AGENT_TRACKS[0];
