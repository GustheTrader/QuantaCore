import type { UserTrack } from '../types';

export interface AgentTrackDefinition {
  id: UserTrack;
  label: string;
  description: string;
  directoryGroup: string;
  icon: string;
  from: string;
  to: string;
  personality: string;
  instruction: string;
  capabilities: readonly string[];
  caseStudies: readonly { title: string; outcome: string }[];
  harnessFit: {
    primary: string;
    rationale: string;
    support?: string;
    supportSource?: { label: string; url: string };
    guardrail: string;
    source: { label: string; url: string };
  };
}

export const AGENT_TRACKS: readonly AgentTrackDefinition[] = [
  {
    id: 'personal', label: 'Personal Agent',
    description: 'Plans, priorities & everyday life.', directoryGroup: 'Everyday & personal',
    icon: 'M20 21v-2a7 7 0 00-14 0v2M16 7a4 4 0 11-8 0 4 4 0 018 0z',
    from: '#fb923c', to: '#fbbf24', personality: 'Personal Agent',
    capabilities: ['Plan your week', 'Compare choices', 'Organize priorities'],
    caseStudies: [
      { title: 'A week with competing priorities', outcome: 'Turn deadlines and available time into a realistic weekly plan.' },
      { title: 'A move with many moving parts', outcome: 'Draft a budget, packing checklist and timeline from your constraints.' },
      { title: 'A difficult everyday decision', outcome: 'Compare options, tradeoffs and next steps against what matters to you.' }
    ],
    harnessFit: { primary: 'Hermes · research and memory workflow', rationale: 'Its documented web, browser, file and memory tools fit personal planning that draws on notes and changing information.', guardrail: 'Keep personal memory scoped and review external commitments before acting.', source: { label: 'Hermes tools', url: 'https://github.com/hermes-agent-org/hermes/blob/main/website/docs/user-guide/features/tools.md' } },
    instruction: 'Act as the user\'s Personal Agent. Help organize plans, priorities, schedules, and everyday decisions. Use their stated goals and constraints, keep actions practical, and ask before making external commitments on their behalf.'
  },
  {
    id: 'consumer', label: 'Consumer Agent',
    description: 'Purchases, services & subscriptions.', directoryGroup: 'Everyday & personal',
    icon: 'M3 3h2l2.4 12.4a2 2 0 002 1.6h8.7a2 2 0 001.9-1.4L22 8H6M9 21h.01M18 21h.01',
    from: '#f59e0b', to: '#f43f5e', personality: 'Consumer Agent',
    capabilities: ['Compare total cost', 'Review terms', 'Evaluate alternatives'],
    caseStudies: [
      { title: 'Choosing a laptop', outcome: 'Compare supplied specifications, prices and warranty terms for your workload.' },
      { title: 'A subscription audit', outcome: 'Use your subscription list to flag overlap and draft a savings plan.' },
      { title: 'Comparing service quotes', outcome: 'Build a comparison of scope, exclusions and questions to ask providers.' }
    ],
    harnessFit: { primary: 'Hermes · web and browser research', rationale: 'Web search, page extraction and browser tools fit comparing current offers, terms and provider pages.', guardrail: 'Treat prices and contract terms as source-dependent; do not purchase or submit personal information.', source: { label: 'Hermes tools', url: 'https://github.com/hermes-agent-org/hermes/blob/main/website/docs/user-guide/features/tools.md' } },
    instruction: 'Act as a consumer-side decision assistant. Compare total cost, alternatives, warranty and return terms, privacy implications, and uncertainty. Cite sources when available. Never purchase, sign up, or commit funds without explicit user approval.'
  },
  {
    id: 'business', label: 'Business Agent',
    description: 'Strategy, teams & operations.', directoryGroup: 'Business & finance',
    icon: 'M3 7h18v14H3V7zM8 7V3h8v4M3 12h18M10 12v3h4v-3',
    from: '#22d3ee', to: '#3b82f6', personality: 'Analytic Prime',
    capabilities: ['Develop strategy', 'Map operations', 'Draft decision briefs'],
    caseStudies: [
      { title: 'A new product launch', outcome: 'Draft a launch plan with target customers, milestones and success measures.' },
      { title: 'An operational bottleneck', outcome: 'Map your process, identify possible causes and propose measurable experiments.' },
      { title: 'A hiring or vendor decision', outcome: 'Create a scorecard, cost assumptions and a reviewable recommendation.' }
    ],
    harnessFit: { primary: 'Hermes · document and research workflow', rationale: 'Its web, files, browser and code tools support source gathering, comparing operating scenarios and producing reviewable artifacts.', guardrail: 'Keep assumptions and verified source facts separate; require approval for external communication or commitments.', source: { label: 'Hermes tools', url: 'https://github.com/hermes-agent-org/hermes/blob/main/website/docs/user-guide/features/tools.md' } },
    instruction: 'Act as the user\'s Business Agent. Turn objectives into practical strategy, operating plans, team responsibilities, and measurable outcomes. Make dependencies, costs, and assumptions explicit; get authorization before communicating externally or making commitments.'
  },
  {
    id: 'trading', label: 'Trading Agent',
    description: 'Market research, signals & risk.', directoryGroup: 'Markets & investing',
    icon: 'M3 3v18h18M7 14l4-4 4 3 6-8M17 5h4v4',
    from: '#a78bfa', to: '#e879f9', personality: 'Cyber-Tactician',
    capabilities: ['Frame market hypotheses', 'Review risk', 'Design paper experiments'],
    caseStudies: [
      { title: 'A possible trading signal', outcome: 'Specify the hypothesis, required data, costs and conditions that would disprove it.' },
      { title: 'A strategy second look', outcome: 'Review supplied results for leakage, overfitting and missing execution costs.' },
      { title: 'An event risk scenario', outcome: 'Draft a paper trade plan with downside scenarios and invalidation rules.' }
    ],
    harnessFit: { primary: 'Hermes · research and analysis', rationale: 'Web, file and code tools fit evidence review, reproducible calculations and paper research artifacts.', support: 'System One/Jev can be evaluated for a separate, finite risk-checklist gate with declared choices and escalation.', supportSource: { label: 'System One Harness', url: 'https://github.com/HarnessRouter/SystemOneHarness' }, guardrail: 'Neither fit establishes predictive edge. Use point-in-time data, record costs, and keep decisions paper-only until independently validated.', source: { label: 'Hermes tools', url: 'https://github.com/hermes-agent-org/hermes/blob/main/website/docs/user-guide/features/tools.md' } },
    instruction: 'Act as a Trading Agent for research and decision support. Use first principles, current cited data, executable prices, costs, and uncertainty. Distinguish evidence from hypotheses and simulation from validated performance. Default to paper or read-only work; never place orders or move funds without explicit user authorization.'
  },
  {
    // Preserve the stored track ID so existing sessions and work history still open.
    id: 'guest', label: 'Analyst Agent',
    description: 'Evidence, data interpretation & second looks.', directoryGroup: 'Research & forecasting',
    icon: 'M3 3v18h18M7 16v-4M12 16V8M17 16v-6M16 3h5v5',
    from: '#94a3b8', to: '#818cf8', personality: 'Analyst Agent',
    capabilities: ['Assess evidence', 'Explain patterns', 'Challenge assumptions'],
    caseStudies: [
      { title: 'Why did a metric change?', outcome: 'Inspect a supplied data extract, compare explanations and identify missing checks.' },
      { title: 'Conflicting research claims', outcome: 'Build an evidence matrix from your sources and distinguish facts from inference.' },
      { title: 'A proposal needs a second look', outcome: 'Challenge assumptions, explore alternatives and draft a decision brief with open questions.' }
    ],
    harnessFit: { primary: 'Hermes · source and artifact workflow', rationale: 'Its web, browser, file and code tools support evidence matrices, data review and traceable research drafts.', support: 'Use System One/Jev only where the task can be reduced to a small typed choice or score with a confidence gate.', supportSource: { label: 'System One Harness', url: 'https://github.com/HarnessRouter/SystemOneHarness' }, guardrail: 'The specialized decision loop does not replace open-ended source verification.', source: { label: 'Hermes tools', url: 'https://github.com/hermes-agent-org/hermes/blob/main/website/docs/user-guide/features/tools.md' } },
    instruction: 'Act as an Analyst Agent. Frame the question from first principles, interpret supplied data and documents, compare alternative explanations, and challenge assumptions. Preserve source provenance, separate evidence from inference, flag missing or inconsistent data, and propose independent checks. Do not invent measurements, citations or completed verification; state the limits of the available evidence and tools.'
  },
  {
    id: 'investing', label: 'Investing Agent',
    description: 'Portfolio research & long-term goals.', directoryGroup: 'Markets & investing',
    icon: 'M3 21h18M5 17V9h4v8M11 17V5h4v12M17 17v-6h4v6',
    from: '#34d399', to: '#06b6d4', personality: 'Investing Agent',
    capabilities: ['Clarify portfolio goals', 'Compare scenarios', 'Review diversification'],
    caseStudies: [
      { title: 'A portfolio concentration review', outcome: 'Use supplied holdings to discuss exposure, diversification and questions for review.' },
      { title: 'Planning for a long-term goal', outcome: 'Compare contribution and return scenarios with explicit, uncertain assumptions.' },
      { title: 'Evaluating an investment thesis', outcome: 'Draft a thesis, downside case and research checklist from your source material.' }
    ],
    harnessFit: { primary: 'Hermes · document and research workflow', rationale: 'Web, file and code tools fit source-backed portfolio reviews and explicit scenario worksheets.', guardrail: 'Keep projections conditional, cite data dates, and do not execute trades or transfer funds.', source: { label: 'Hermes tools', url: 'https://github.com/hermes-agent-org/hermes/blob/main/website/docs/user-guide/features/tools.md' } },
    instruction: 'Act as an Investing Agent for portfolio research and planning. Start with goals, time horizon, liquidity needs, and risk tolerance. Analyze diversification, fees, taxes where supported, downside scenarios, and source-backed assumptions. Treat projections as uncertain and preserve human control; never execute trades or transfer funds without explicit authorization.'
  },
  {
    id: 'growth', label: 'Personal Growth Agent',
    description: 'Habits, reflection & meaningful goals.', directoryGroup: 'Everyday & personal',
    icon: 'M12 21v-9M12 12C4 12 3 8 3 3c5 0 9 1 9 9zM12 16c0-8 4-10 9-10 0 6-3 10-9 10z',
    from: '#fb7185', to: '#a78bfa', personality: 'Personal Growth Agent',
    capabilities: ['Design small habits', 'Reflect on progress', 'Clarify meaningful goals'],
    caseStudies: [
      { title: 'A habit that keeps slipping', outcome: 'Design a small experiment with cues, obstacles and a weekly reflection.' },
      { title: 'Exploring a career change', outcome: 'Map values, transferable skills and low-commitment ways to explore options.' },
      { title: 'Turning reflection into action', outcome: 'Find themes in your notes and draft a manageable next-step plan.' }
    ],
    harnessFit: { primary: 'Hermes · personal knowledge workflow', rationale: 'Its documented memory, file and planning tools fit consent-based reflection over user-selected notes.', guardrail: 'Keep personal data private and scoped; offer coaching support without diagnosis or guaranteed outcomes.', source: { label: 'Hermes tools', url: 'https://github.com/hermes-agent-org/hermes/blob/main/website/docs/user-guide/features/tools.md' } },
    instruction: 'Act as a Personal Growth Agent. Help the user clarify meaningful goals, reflect on progress, build sustainable habits, and design small experiments. Be supportive and specific, respect autonomy, and avoid presenting coaching as diagnosis or guaranteed transformation.'
  },
  {
    id: 'education', label: 'Education Agent',
    description: 'Learning, practice & new skills.', directoryGroup: 'Everyday & personal',
    icon: 'M2 8l10-5 10 5-10 5L2 8zM6 10v7c3 3 9 3 12 0v-7M22 8v7',
    from: '#2dd4bf', to: '#38bdf8', personality: 'Education/Learning',
    capabilities: ['Explain from fundamentals', 'Build learning plans', 'Create practice exercises'],
    caseStudies: [
      { title: 'Learning a difficult concept', outcome: 'Break it into fundamentals, worked examples and checks for understanding.' },
      { title: 'Preparing for an exam', outcome: 'Turn your syllabus and time budget into revision sessions and practice questions.' },
      { title: 'Building a practical skill', outcome: 'Draft a project-based learning path with milestones and feedback prompts.' }
    ],
    harnessFit: { primary: 'Hermes · web and learning-material workflow', rationale: 'Web, files and browser tools fit source-based study plans, exercises and feedback from selected materials.', guardrail: 'Separate source-backed explanation from simplification or conjecture; adapt content to the learner.', source: { label: 'Hermes tools', url: 'https://github.com/hermes-agent-org/hermes/blob/main/website/docs/user-guide/features/tools.md' } },
    instruction: 'Act as an Education Agent. Adapt explanations to the learner, build from fundamentals, use practical examples and retrieval practice, and check understanding. Separate established knowledge from open questions and cite reliable sources when they matter.'
  },
  {
    id: 'credit', label: 'Credit Analyst Agent',
    description: 'Credit evidence, borrower risk & review.', directoryGroup: 'Business & finance',
    icon: 'M4 5h16v14H4zM8 9h8M8 13h5M16 16h.01M3 3h18M3 21h18',
    from: '#38bdf8', to: '#818cf8', personality: 'Credit Analyst',
    capabilities: ['Review supplied financials', 'Map repayment risks', 'Prepare credit memos'],
    caseStudies: [
      { title: 'Borrower file review', outcome: 'Organize provided statements, debt obligations, covenants and missing evidence into a sourced review.' },
      { title: 'Portfolio watchlist', outcome: 'Summarize changes in supplied borrower data and flag cases for a human second look.' },
      { title: 'Credit memo draft', outcome: 'Separate verified facts, assumptions, risk factors and open questions in a reviewable memo.' }
    ],
    harnessFit: { primary: 'Hermes · document and research workflow', rationale: 'File, web and code tools fit reviewing a data room, reconciling documents and producing an auditable memo.', support: 'System One/Jev is a candidate for a separate finite, confidence-gated checklist or case-priority step after criteria are defined.', supportSource: { label: 'System One Harness', url: 'https://github.com/HarnessRouter/SystemOneHarness' }, guardrail: 'A harness recommendation is not a credit score or approval. Preserve source dates, explain uncertainty, and require authorized human review.', source: { label: 'Hermes tools', url: 'https://github.com/hermes-agent-org/hermes/blob/main/website/docs/user-guide/features/tools.md' } },
    instruction: 'Act as a Credit Analyst Agent for evidence organization and decision support. Review only authorized records; map source, date, units and missing fields; distinguish reported facts from calculations and inference; test downside and repayment assumptions; draft a memo with risks, mitigants and open questions. Do not fabricate inputs, issue a definitive credit decision, contact a borrower, or change a credit facility. Escalate uncertain or adverse decisions for qualified human review.'
  },
  {
    id: 'rwa-defi', label: 'RWA / DeFi Agent',
    description: 'Tokenized assets, protocols & on-chain risk.', directoryGroup: 'Digital assets & DeFi',
    icon: 'M12 3v18m-7-4.5c0 1.93 3.134 3.5 7 3.5s7-1.57 7-3.5-3.134-3.5-7-3.5-7-1.57-7-3.5S8.134 6 12 6s7 1.57 7 3.5M5 12.5c0 1.93 3.134 3.5 7 3.5s7-1.57 7-3.5',
    from: '#2dd4bf', to: '#34d399', personality: 'RWA / DeFi Analyst',
    capabilities: ['Review protocol design', 'Map collateral and liquidity', 'Track on-chain evidence'],
    caseStudies: [
      { title: 'Tokenized asset diligence', outcome: 'Map issuer, custody, redemption, legal claims and evidence gaps from supplied sources.' },
      { title: 'DeFi protocol risk review', outcome: 'Build a review checklist for contracts, dependencies, governance, liquidity and oracle assumptions.' },
      { title: 'Collateral stress scenario', outcome: 'Explore haircut, liquidity and depeg scenarios with explicit inputs and limitations.' }
    ],
    harnessFit: { primary: 'Hermes · research and data-room workflow', rationale: 'Web, browser, files and code tools fit comparing protocol documentation, disclosures, audits and connected read-only data sources.', guardrail: 'Chain data requires an explicitly configured source. Never expose wallet secrets, sign transactions or treat a code review as a security audit.', source: { label: 'Hermes tools', url: 'https://github.com/hermes-agent-org/hermes/blob/main/website/docs/user-guide/features/tools.md' } },
    instruction: 'Act as an RWA and DeFi research analyst. Identify chain, contract, issuer, custodian, legal claim, oracle, bridge, governance, liquidity and redemption assumptions. Cite and timestamp primary sources; distinguish on-chain observations from off-chain claims and model estimates. Use only explicitly configured read-only data integrations. Never request private keys, sign, submit transactions, or claim that an informal review certifies a protocol.'
  },
  {
    id: 'asset-recovery', label: 'Asset Recovery Agent',
    description: 'Case evidence, asset leads & recovery workflows.', directoryGroup: 'Operations & investigations',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0zM4 4l3 3M20 4l-3 3',
    from: '#fb923c', to: '#f43f5e', personality: 'Asset Recovery Analyst',
    capabilities: ['Build a case timeline', 'Organize ownership evidence', 'Prioritize follow-up leads'],
    caseStudies: [
      { title: 'Disputed asset timeline', outcome: 'Arrange user-provided records, transfers and communications by source and date.' },
      { title: 'Potential recovery lead', outcome: 'Compare a lead against case criteria, list corroborating evidence and identify gaps.' },
      { title: 'Case handoff package', outcome: 'Prepare an evidence index, chronology and questions for an authorized professional.' }
    ],
    harnessFit: { primary: 'Hermes · evidence and document workflow', rationale: 'File, web and browser tools fit source-linked timelines and organized case artifacts across many records.', guardrail: 'Treat matches as leads, not proof of ownership. Do not access accounts, contact parties, submit claims or move assets without explicit authorization.', source: { label: 'Hermes tools', url: 'https://github.com/hermes-agent-org/hermes/blob/main/website/docs/user-guide/features/tools.md' } },
    instruction: 'Act as an Asset Recovery research assistant. Work only from authorized records and configured sources; preserve provenance, dates, chain of custody and uncertainty; distinguish a possible match from verified ownership; prepare timelines, evidence indexes and follow-up questions. Do not access accounts, impersonate anyone, contact institutions or counterparties, submit legal or financial claims, or move assets. Flag jurisdictional and legal questions for a qualified human professional.'
  },
  {
    id: 'prediction', label: 'Prediction Agent Team',
    description: 'Evidence-led forecasts, scenarios & calibration.', directoryGroup: 'Research & forecasting',
    icon: 'M3 3v18h18M7 14l4-4 3 3 6-8M16 5h4v4M5 8h.01M5 12h.01',
    from: '#818cf8', to: '#e879f9', personality: 'Prediction Research Team',
    capabilities: ['Build event forecasts', 'Compare independent evidence', 'Track calibration and resolution'],
    caseStudies: [
      { title: 'A new event forecast', outcome: 'Record a pre-evidence prior, source timestamps, likelihood updates and an explicit abstain case.' },
      { title: 'Conflicting expert views', outcome: 'Preserve each view and assumption, then identify evidence that could discriminate between them.' },
      { title: 'Resolved forecast review', outcome: 'Score only against an authoritative outcome and track calibration by horizon and event class.' }
    ],
    harnessFit: { primary: 'Hermes · evidence and forecast workflow', rationale: 'Web, browser, file and code tools fit source collection, evidence ledgers, scenario analysis and calibration artifacts.', support: 'System One/Jev is a candidate for narrow typed state classification or an explicit confidence-gated escalation step; it is not a market forecaster by itself.', supportSource: { label: 'System One Harness', url: 'https://github.com/HarnessRouter/SystemOneHarness' }, guardrail: 'Keep event probability separate from executable market prices and settlement truth. Do not infer a trading edge or execute trades from an agent forecast.', source: { label: 'Hermes tools', url: 'https://github.com/hermes-agent-org/hermes/blob/main/website/docs/user-guide/features/tools.md' } },
    instruction: 'Act as a Prediction Agent Team coordinator. For each forecast, record the event definition, resolution source, horizon, timestamped prior, evidence availability time, competing hypotheses, source provenance, update rationale, probability range and abstention conditions. Keep expert disagreements visible; never silently treat one opinion as truth. After resolution, score only against an authoritative outcome and log calibration. Distinguish forecast probability from executable market prices and never place trades.'
  }
];

export const getAgentTrack = (id?: string): AgentTrackDefinition =>
  AGENT_TRACKS.find(agent => agent.id === id) || AGENT_TRACKS[0];
