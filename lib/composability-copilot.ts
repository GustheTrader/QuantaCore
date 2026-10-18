import { SETUP_PRESETS, normalizeSystemSetup, type SetupJobId, type SetupPresetId, type SystemSetupPlan } from './system-setup';
export interface CompositionInterview {
  goal: string; preset: SetupPresetId; jobs: SetupJobId[];
  sources: 'paste' | 'documents' | 'memory'; workingStyle: 'draft' | 'review' | 'tools';
  qsReadOnly: boolean; evidenceDashboard: boolean;
}
export function composeInterview(base: SystemSetupPlan, answers: CompositionInterview) {
  const preset = SETUP_PRESETS.find(p => p.id === answers.preset) || SETUP_PRESETS[0];
  const modules: string[] = [], reasons = ['One agent and one model connection keep the first setup simple.'];
  if (answers.sources !== 'paste') { modules.push('sources'); reasons.push('Documents & data lets you choose and assign source files.'); }
  if (answers.sources === 'memory') { modules.push('memory'); reasons.push('Private memory needs its own admission and recall review before use.'); }
  if (answers.workingStyle === 'tools') { modules.push('hermes'); reasons.push('Hermes provides a separate workspace for explicitly approved tool use.'); }
  if (answers.qsReadOnly && preset.id === 'markets') { modules.push('qs-bridge'); reasons.push('The QS module prepares manual read-only source inspection; QS retains trading authority.'); }
  if (answers.evidenceDashboard) { modules.push('operating-evidence'); reasons.push('The evidence views help you inspect captured work and access decisions.'); }
  if (preset.id === 'markets') reasons.push('Trading work stays research and paper only; predictions need independent validation.');
  const plan = normalizeSystemSetup({ ...base, name: answers.goal.trim().slice(0, 64) || `${preset.label} agent`, preset: preset.id, jobIds: answers.jobs, moduleIds: modules, level: modules.length ? 'custom' : 'starter', mode: answers.workingStyle === 'draft' ? 'chat' : 'work' });
  return { plan, reasons };
}
