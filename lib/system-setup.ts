import type { ControlMode } from './control-plane';
import type { UserTrack } from '../types';
import { getProviderDefinition, type CompatibleProvider } from './inference-providers';

// Product composition lives here. Selecting a module never grants tools or starts it.
export const SETUP_JOBS = [
  { id: 'summarize', label: 'Summarize information', detail: 'Turn supplied notes and documents into a clear brief.', prompt: 'Summarize the following material, preserving the key facts and open questions: ' },
  { id: 'compare', label: 'Compare options', detail: 'Explain tradeoffs, assumptions and missing evidence.', prompt: 'Compare these options using explicit criteria, assumptions and evidence: ' },
  { id: 'plan', label: 'Make a plan', detail: 'Break an objective into practical next steps.', prompt: 'Create a practical plan with checkpoints for this objective: ' },
  { id: 'draft', label: 'Draft content', detail: 'Prepare a message, document or proposal for review.', prompt: 'Prepare a draft for me to review. Audience, goal and source material: ' },
  { id: 'review', label: 'Give a second look', detail: 'Challenge a draft and identify claims that need checking.', prompt: 'Review this material for unsupported claims, inconsistencies and missing checks: ' },
  { id: 'explain', label: 'Explain a problem', detail: 'Reason from first principles using the context you provide.', prompt: 'Explain this problem from first principles. Separate facts, assumptions and possible solutions: ' },
] as const;
export type SetupJobId = typeof SETUP_JOBS[number]['id'];

export const SETUP_PRESETS = [
  { id: 'everyday', label: 'Everyday help', detail: 'Notes, planning and useful drafts.', jobs: ['summarize', 'plan', 'draft'] },
  { id: 'research', label: 'Research & learning', detail: 'Read evidence, compare ideas and question conclusions.', jobs: ['summarize', 'compare', 'review'] },
  { id: 'business', label: 'Business support', detail: 'Compare decisions, prepare plans and draft documents.', jobs: ['compare', 'plan', 'draft'] },
  { id: 'development', label: 'Development', detail: 'Explain code, plan changes and review supplied files.', jobs: ['explain', 'plan', 'review'] },
  { id: 'markets', label: 'Trading research', detail: 'Explore hypotheses and review evidence in paper mode.', jobs: ['compare', 'explain', 'review'] },
] as const satisfies readonly { id: string; label: string; detail: string; jobs: readonly SetupJobId[] }[];
export type SetupPresetId = typeof SETUP_PRESETS[number]['id'];

const MODULE_CATALOG = [
  { id: 'sources', name: 'Documents & data', group: 'Knowledge', detail: 'Import sources and assign them to an agent.', path: '/data-intake', service: undefined, requirement: 'Choose files and source assignments in Data Intake.' },
  { id: 'memory', name: 'Private memory', group: 'Knowledge', detail: 'Keep useful context across tasks.', path: '/memory', service: 'honcho', requirement: 'Review memory settings and enable recall inside the agent workspace.' },
  { id: 'skill-growth', name: 'Skills & growth', group: 'Knowledge', detail: 'SkillForge revisions and Active Skillference learning paths.', path: '/rsi-lab/skills', service: undefined, requirement: 'Review the skill policy, source provenance and candidate evidence before adoption.' },
  { id: 'starter-pilot', name: 'Reviewed Starter pilot', group: 'Tools & workflows', detail: 'A measured, text-only workflow with explicit production review.', path: '/rsi-lab/adoption', service: undefined, requirement: 'Complete a frozen local benchmark and review the exact instruction artifact and route.' },
  { id: 'operating-evidence', name: 'Runtime evidence dashboards', group: 'Tools & workflows', detail: 'Inspect workflow, access and adapter timing evidence.', path: '/agentic-os', service: undefined, requirement: 'Review captured observations and their limits in AgenticOS, IronClaw and EdgeMech.' },
  { id: 'qs-bridge', name: 'QS read-only research bridge', group: 'Specialist workspaces', detail: 'Inspect a separately running QS source with an exact endpoint/schema pin.', path: '/qs-bridge', service: undefined, requirement: 'Start QS separately, inspect its read-only service identity and review the exact endpoint pin. Research only.' },
  { id: 'hermes', name: 'Hermes workspace', group: 'Tools & workflows', detail: 'Use spaces and an agent runtime with its own tools.', path: '/hermes', service: undefined, requirement: 'Configure the runtime, intelligence and permissions in Hermes.' },
  { id: 'coding', name: 'Coding agents', group: 'Tools & workflows', detail: 'Connect a coding harness for project work.', path: '/hermes?view=coding', service: undefined, requirement: 'Install and sign in to the chosen coding agent separately.' },
  { id: 'connectors', name: 'MCP connectors', group: 'Tools & workflows', detail: 'Connect selected external tools and services.', path: '/mcp', service: undefined, requirement: 'Review each connector and its tool permissions before use.' },
  { id: 'orchestration', name: 'Team workflows', group: 'Tools & workflows', detail: 'Prepare roles and handoffs for larger projects.', path: '/work-zone', service: 'paperclip', requirement: 'Assign agents and review the workflow in Work Zone. Role setup is a draft.' },
  { id: 'research', name: 'Research lab', group: 'Specialist workspaces', detail: 'Use the dedicated evidence and market research workspace.', path: '/research', service: undefined, requirement: 'Configure data and worker connections in the research workspace; paper only.' },
  { id: 'clips', name: 'Clip Studio', group: 'Specialist workspaces', detail: 'Prepare local media jobs and model packs.', path: '/hermes?view=clips', service: undefined, requirement: 'Check local models and hardware before starting media jobs.' },
  { id: 'cloud', name: 'Cloudroom', group: 'Specialist workspaces', detail: 'Connect remote workspaces when a project needs them.', path: '/cloudroom', service: undefined, requirement: 'Configure remote accounts, permissions and spending in Cloudroom.' },
] as const;
const MODULE_USE_CASES:Record<typeof MODULE_CATALOG[number]['id'],string>={
  sources:'summarize-explicitly-assigned-source-v1',memory:'recall-admitted-private-source-v1','skill-growth':'review-versioned-skill-refinement-v1',
  'starter-pilot':'starter-source-review-v1',hermes:'complete-approved-tool-task-v1',coding:'review-bounded-workspace-change-v1',
  'operating-evidence':'inspect-observed-local-request-evidence-v1','qs-bridge':'inspect-qs-read-only-source-metadata-v1',
  connectors:'inspect-approved-connector-contract-v1',orchestration:'review-single-worker-delivery-v1',research:'complete-paper-research-report-v1',
  clips:'prepare-reviewed-local-media-artifact-v1',cloud:'complete-approved-remote-workspace-task-v1',
};
export const SETUP_MODULES = MODULE_CATALOG.map(module => ({ ...module, readiness: { version: 1 as const, useCase: MODULE_USE_CASES[module.id], evidencePath: '/rsi-lab/evidence' } }));
export type SetupModuleId = typeof SETUP_MODULES[number]['id'];

export interface SystemSetupPlan {
  version: 1;
  level: 'starter' | 'custom';
  name: string;
  preset: SetupPresetId;
  jobIds: SetupJobId[];
  moduleIds: SetupModuleId[];
  mode: ControlMode;
  provider?: CompatibleProvider;
  model?: string;
}

export function defaultSystemSetup(track: UserTrack = 'personal'): SystemSetupPlan {
  const preset: SetupPresetId = ['trading', 'investing', 'prediction'].includes(track) ? 'markets'
    : ['business', 'growth', 'credit'].includes(track) ? 'business' : track === 'education' ? 'research' : 'everyday';
  const choice = SETUP_PRESETS.find(item => item.id === preset)!;
  return { version: 1, level: 'starter', name: `${choice.label} agent`, preset, jobIds: [...choice.jobs], moduleIds: [], mode: 'chat' };
}

export function normalizeSystemSetup(value: unknown, track: UserTrack = 'personal'): SystemSetupPlan {
  const fallback = defaultSystemSetup(track);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const plan = value as Record<string, unknown>;
  if (plan.version !== 1) return fallback;
  const preset = SETUP_PRESETS.find(item => item.id === plan.preset) || SETUP_PRESETS.find(item => item.id === fallback.preset)!;
  const jobIds = SETUP_JOBS.filter(job => Array.isArray(plan.jobIds) && plan.jobIds.includes(job.id)).map(job => job.id).slice(0, 3);
  const moduleIds = SETUP_MODULES.filter(module => Array.isArray(plan.moduleIds) && plan.moduleIds.includes(module.id)).map(module => module.id);
  const route = typeof plan.provider === 'string' ? getProviderDefinition(plan.provider) : undefined;
  return {
    version: 1, level: plan.level === 'custom' ? 'custom' : 'starter',
    name: typeof plan.name === 'string' && plan.name.trim() ? plan.name.trim().slice(0, 64) : fallback.name,
    preset: preset.id, jobIds: jobIds.length ? jobIds : [...preset.jobs], moduleIds,
    mode: plan.mode === 'work' ? 'work' : 'chat',
    ...(route && typeof plan.model === 'string' && plan.model.trim() ? { provider: route.id, model: plan.model.trim().slice(0, 240) } : {}),
  };
}

export const setupStorageKey = (owner: string) => `quanta_system_setup_v1_${owner}`;
export function loadSystemSetup(owner: string, track: UserTrack): SystemSetupPlan {
  try { return normalizeSystemSetup(JSON.parse(localStorage.getItem(setupStorageKey(owner)) || 'null'), track); }
  catch { return defaultSystemSetup(track); }
}
export function saveSystemSetup(owner: string, plan: SystemSetupPlan): SystemSetupPlan {
  const normalized = normalizeSystemSetup(plan);
  localStorage.setItem(setupStorageKey(owner), JSON.stringify(normalized));
  return normalized;
}
export const setupJobs = (plan: SystemSetupPlan) => SETUP_JOBS.filter(job => plan.jobIds.includes(job.id));
export const setupModules = (plan: SystemSetupPlan) => plan.level === 'custom' ? SETUP_MODULES.filter(module => plan.moduleIds.includes(module.id)) : [];

export function setupInstructions(plan: SystemSetupPlan): string {
  const normalized = normalizeSystemSetup(plan);
  const preset = SETUP_PRESETS.find(item => item.id === normalized.preset)!;
  return `The operator's workspace focus is ${preset.label}. Its selected jobs are: ${setupJobs(normalized).map(job => job.label).join('; ')}. Use these as preferences while following the current request. Module selections are workspace shortcuts and confer no tool access.${normalized.preset === 'markets' ? ' Trading work is research and paper analysis only. Separate hypotheses from evidence; include missing data and validation requirements.' : ''}`;
}
