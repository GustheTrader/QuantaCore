import { ACTIVE_SKILLFERENCE, bindClaimTokens, missingPrerequisites, type ImportedClaim, type LearningGraph } from './active-skillference';

export const DIMENSIONS = ['knowledge', 'tool', 'clarification', 'style'] as const;
export type Dimension = typeof DIMENSIONS[number];
export type Severity = 'none' | 'low' | 'medium' | 'high';
export interface SkillPolicy { mode: 'off' | 'hntl' | 'bounded-auto'; maxSkills: number; maxContextChars: number }
export interface SkillVersion {
  id: string; skillId: string; name: string; tags: string[]; content: string;
  status: 'active' | 'candidate' | 'archived' | 'rejected'; createdAt: string;
  parentId?: string; caseIds: string[]; prerequisites: string[]; origin?: HermesOrigin;
}
// A version whose text lives in a Hermes profile. contentHash is the SHA-256 of that SKILL.md ('' = no skill existed).
export interface HermesOrigin { kind: 'hermes'; workspace: 'work' | 'personal'; skillName: string; contentHash: string; pendingId?: string; baseHash?: string }
export interface HermesProposal { workspace: 'work' | 'personal'; pendingId: string; action: string; skillName: string; summary: string; baseText: string; baseHash: string; proposedText: string; proposedHash: string; importable: boolean }
export interface FailureCase { id: string; skillId: string; versionId: string; summary: string; reference: string; dimensions: Record<Dimension, Severity>; at: string; threadId?: string }
export interface SkillEvaluation {
  id: string; candidateId: string; candidateText: string; baselineId: string; baselineText: string;
  holdoutIds: string[]; baselineCorrect: number; candidateCorrect: number; criticalFailures: number;
  conditions: string; report: string; reviewer: string; at: string;
}
export interface SkillLibrary {
  version: 1; policy: SkillPolicy; versions: SkillVersion[]; cases: FailureCase[]; evaluations: SkillEvaluation[];
  learningReviews: { nodeId: string; note: string; at: string; sourceCommit: string }[];
  journal: { id: string; action: string; target: string; note: string; at: string }[];
  loadError?: string;
}
export interface AppliedSkill { skillId: string; versionId: string; name: string }
const at = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const requireText = (value: unknown, label: string, max = 4000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error(`${label} is required (maximum ${max} characters).`);
  return value.trim();
};
export function newSkillLibrary(versions: SkillVersion[]): SkillLibrary {
  return { version: 1, policy: { mode: 'hntl', maxSkills: 2, maxContextChars: 10000 }, versions: structuredClone(versions), cases: [], evaluations: [], learningReviews: [], journal: [] };
}
export function validateLibrary(value: unknown): SkillLibrary {
  const state = value as SkillLibrary;
  if (!state || state.version !== 1 || !['off', 'hntl', 'bounded-auto'].includes(state.policy?.mode) || !Number.isInteger(state.policy?.maxSkills) || state.policy.maxSkills < 1 || state.policy.maxSkills > 3 || !Number.isInteger(state.policy.maxContextChars) || state.policy.maxContextChars < 1000 || state.policy.maxContextChars > 16000) throw Error('Invalid saved skill policy.');
  for (const [key, max] of [['versions', 32], ['cases', 100], ['evaluations', 100], ['learningReviews', 2000], ['journal', 2000]] as const) if (!Array.isArray(state[key]) || state[key].length > max) throw Error(`Invalid or oversized skill ${key}.`);
  const ids = new Set<string>(), active = new Set<string>();
  for (const version of state.versions) {
    requireText(version.id, 'Version ID', 100); requireText(version.skillId, 'Skill ID', 100); requireText(version.name, 'Skill name', 120); requireText(version.content, 'Skill content', 12000);
    if (ids.has(version.id) || !['active', 'candidate', 'archived', 'rejected'].includes(version.status) || !Array.isArray(version.tags) || version.tags.length > 30 || version.tags.some(tag => typeof tag !== 'string' || tag.length > 80) || !Array.isArray(version.caseIds) || version.caseIds.length > 100 || version.caseIds.some(v => typeof v !== 'string') || !Array.isArray(version.prerequisites) || version.prerequisites.length > 30 || version.prerequisites.some(v => typeof v !== 'string')) throw Error('Invalid skill version.');
    if (version.origin !== undefined) validateHermesOrigin(version);
    ids.add(version.id);
    if (version.status === 'active') { if (active.has(version.skillId)) throw Error('Multiple active versions of one skill.'); active.add(version.skillId); }
  }
  if (!active.size) throw Error('A library needs at least one active baseline.');
  const caseIds = new Set<string>();
  for (const item of state.cases) {
    requireText(item.id, 'Case ID', 100); requireText(item.summary, 'Failure summary'); requireText(item.reference, 'Reference');
    if (caseIds.has(item.id) || !state.versions.some(version => version.id === item.versionId && version.skillId === item.skillId) || DIMENSIONS.some(key => !['none', 'low', 'medium', 'high'].includes(item.dimensions?.[key]))) throw Error('Invalid failure case.');
    caseIds.add(item.id);
  }
  for (const item of state.learningReviews) { requireText(item.nodeId, 'Learning skill ID', 100); requireText(item.note, 'Review evidence', 2000); requireText(item.sourceCommit, 'Curriculum source pin', 100); }
  for (const item of state.evaluations) {
    if (!Array.isArray(item.holdoutIds) || item.holdoutIds.length > 500 || item.holdoutIds.some(v => typeof v !== 'string' || !v.trim()) || new Set(item.holdoutIds).size !== item.holdoutIds.length || [item.baselineCorrect, item.candidateCorrect, item.criticalFailures].some(value => !Number.isInteger(value) || value < 0) || Math.max(item.baselineCorrect, item.candidateCorrect) > item.holdoutIds.length) throw Error('Invalid saved evaluation.');
    requireText(item.candidateText, 'Candidate snapshot', 12000); requireText(item.baselineText, 'Baseline snapshot', 12000);
    requireText(item.conditions, 'Frozen comparison setup'); requireText(item.report, 'Evaluation report'); requireText(item.reviewer, 'Reviewer', 200);
  }
  for (const entry of state.journal) { requireText(entry.id, 'Journal identity', 100); requireText(entry.action, 'Journal action', 100); requireText(entry.target, 'Journal target', 100); requireText(entry.note, 'Journal note'); }
  return structuredClone(state);
}
const HASH = /^[0-9a-f]{64}$/, HERMES_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
function validateHermesOrigin(version: SkillVersion) {
  const origin = version.origin!;
  if (!origin || origin.kind !== 'hermes' || !['work', 'personal'].includes(origin.workspace) || typeof origin.skillName !== 'string' || !HERMES_NAME.test(origin.skillName)
    || version.skillId !== hermesSkillId(origin.workspace, origin.skillName) || (origin.contentHash !== '' && !HASH.test(origin.contentHash))
    || (origin.baseHash !== undefined && origin.baseHash !== '' && !HASH.test(origin.baseHash)) || (origin.pendingId !== undefined && !/^[A-Za-z0-9_-]{1,64}$/.test(origin.pendingId))) throw Error('Invalid Hermes skill origin.');
}
export const hermesSkillId = (workspace: string, skillName: string) => `hermes:${workspace}:${skillName}`;
export const isHermesLinked = (version: SkillVersion) => version.origin?.kind === 'hermes';
// Non-empty baseline lines that no longer appear in the candidate (multiset, so a duplicated line removed once counts).
export function removedLines(baseline: string, candidate: string): number {
  const left = new Map<string, number>();
  for (const line of candidate.split(/\r?\n/)) left.set(line.trim(), (left.get(line.trim()) || 0) + 1);
  let removed = 0;
  for (const line of baseline.split(/\r?\n/).map(value => value.trim()).filter(Boolean)) {
    const count = left.get(line) || 0;
    if (count) left.set(line, count - 1); else removed++;
  }
  return removed;
}
function edit(state: SkillLibrary): SkillLibrary {
  if (state.loadError) throw Error(state.loadError);
  return validateLibrary(state);
}
function audit(state: SkillLibrary, action: string, target: string, note: string): SkillLibrary {
  if (state.journal.length >= 2000) throw Error('The review journal is full. Export the library before starting a new archive.');
  state.journal.push({ id: id(), action, target, note: requireText(note, 'Review note'), at: at() });
  return validateLibrary(state);
}
export function failureVerdict(dimensions: Record<Dimension, Severity>) {
  const rank = { none: 0, low: 1, medium: 2, high: 3 };
  if (DIMENSIONS.some(key => !(dimensions[key] in rank))) throw Error('Invalid failure dimensions.');
  const maximum = Math.max(...DIMENSIONS.map(key => rank[dimensions[key]]));
  return { failed: maximum === 3 || DIMENSIONS.filter(key => dimensions[key] === 'medium').length >= 2, primary: DIMENSIONS.find(key => rank[dimensions[key]] === maximum)!, severity: (['none', 'low', 'medium', 'high'] as const)[maximum] };
}
export function addFailure(state: SkillLibrary, input: Omit<FailureCase, 'id' | 'at'>): SkillLibrary {
  const next = edit(state); if (next.cases.length >= 100) throw Error('Failure-case limit reached. Export this batch.');
  failureVerdict(input.dimensions);
  const item = { ...input, id: id(), at: at(), summary: requireText(input.summary, 'Failure summary'), reference: requireText(input.reference, 'Expected behavior / evidence') };
  next.cases.push(item); return audit(next, 'failure-recorded', item.id, item.summary);
}
export function diagnose(state: SkillLibrary, caseIds: string[]) {
  const cases = state.cases.filter(item => caseIds.includes(item.id));
  return DIMENSIONS.map(dimension => ({ dimension, count: cases.filter(item => ['medium', 'high'].includes(item.dimensions[dimension])).length }));
}
export function proposeVersion(state: SkillLibrary, parentId: string, caseIds: string[], refinement: string, prerequisites: string[] = []): SkillLibrary {
  const next = edit(state), parent = next.versions.find(version => version.id === parentId && version.status === 'active');
  if (!parent) throw Error('Choose an active baseline version.');
  if (isHermesLinked(parent)) throw Error('Hermes-linked skills take revisions from Hermes proposals; lab-authored revisions need the Hermes write step.');
  if (next.versions.length >= 32) throw Error('Version limit reached. Export this library.');
  const ids = [...new Set(caseIds)];
  if (!ids.length || ids.some(id => !next.cases.some(item => item.id === id && item.versionId === parentId && failureVerdict(item.dimensions).failed))) throw Error('Select diagnosed failures from this baseline.');
  const content = `${parent.content}\n\n## Evidence-linked refinement\n${requireText(refinement, 'Refinement')}`;
  if (content.length > 12000) throw Error('Candidate is too large; keep the refinement focused.');
  const candidate: SkillVersion = { ...parent, id: id(), parentId, content, status: 'candidate', caseIds: ids, prerequisites: [...new Set([...parent.prerequisites, ...prerequisites])], createdAt: at() };
  next.versions.push(candidate); return audit(next, 'candidate-proposed', candidate.id, `Additive revision of ${parent.id}; cases ${ids.join(', ')}`);
}
// Turns one staged Hermes skill write into a lab candidate. The Hermes record itself is not touched.
export function importHermesCandidate(state: SkillLibrary, proposal: HermesProposal, note: string): SkillLibrary {
  const next = edit(state), { workspace, pendingId, skillName } = proposal;
  if (!proposal.importable || !['create', 'edit', 'patch'].includes(proposal.action)) throw Error('This Hermes proposal stays in Hermes review.');
  if (!HASH.test(proposal.proposedHash) || (proposal.baseHash !== '' && !HASH.test(proposal.baseHash)) || (proposal.action === 'create') !== (proposal.baseHash === '')) throw Error('The Hermes proposal is missing its content hashes.');
  const skillId = hermesSkillId(workspace, skillName);
  if (next.versions.some(version => version.origin?.pendingId === pendingId && version.skillId === skillId)) throw Error('This Hermes proposal is already in the library.');
  if (next.versions.some(version => version.skillId === skillId && version.status === 'candidate')) throw Error('Finish or reject the open candidate for this Hermes skill first.');
  const reviewNote = requireText(note, 'Import note');
  let baseline = next.versions.find(version => version.skillId === skillId && version.status === 'active');
  if (baseline && baseline.origin?.contentHash !== proposal.baseHash) throw Error('The Hermes skill changed since the lab last saw it; import its current text again.');
  if (next.versions.length + (baseline ? 1 : 2) > 32) throw Error('Version limit reached. Export this library.');
  const origin = (contentHash: string, extra: Partial<HermesOrigin> = {}): HermesOrigin => ({ kind: 'hermes', workspace, skillName, contentHash, ...extra });
  if (!baseline) {
    baseline = { id: id(), skillId, name: skillName, tags: [], status: 'active', createdAt: at(), caseIds: [], prerequisites: [], origin: origin(proposal.baseHash),
      content: proposal.action === 'create' ? `No Hermes skill named ${skillName} existed before proposal ${pendingId}.` : proposal.baseText };
    next.versions.push(baseline); audit(next, 'baseline-imported', baseline.id, `Hermes ${workspace} profile ${skillName} at ${proposal.baseHash || 'no prior skill'}.`);
  }
  const candidate: SkillVersion = { id: id(), skillId, name: skillName, tags: [], content: proposal.proposedText, status: 'candidate', parentId: baseline.id, createdAt: at(), caseIds: [], prerequisites: [],
    origin: origin(proposal.proposedHash, { pendingId, baseHash: proposal.baseHash }) };
  next.versions.push(candidate);
  return audit(next, 'candidate-imported', candidate.id, `Hermes ${proposal.action} ${pendingId}: ${reviewNote}`);
}
export function recordEvaluation(state: SkillLibrary, candidateId: string, input: Omit<SkillEvaluation, 'id' | 'candidateId' | 'candidateText' | 'baselineId' | 'baselineText' | 'at'>): SkillLibrary {
  const next = edit(state), candidate = next.versions.find(version => version.id === candidateId && version.status === 'candidate');
  const baseline = next.versions.find(version => version.id === candidate?.parentId);
  if (!candidate || !baseline) throw Error('Choose an existing candidate and baseline.');
  if (next.evaluations.length >= 100) throw Error('Evaluation limit reached. Export this batch.');
  const evaluation = { ...input, id: id(), candidateId, candidateText: candidate.content, baselineId: baseline.id, baselineText: baseline.content, holdoutIds: [...new Set(input.holdoutIds.map(value => requireText(value, 'Holdout case ID', 100)))], conditions: requireText(input.conditions, 'Frozen comparison setup'), report: requireText(input.report, 'Evaluation report'), reviewer: requireText(input.reviewer, 'Reviewer', 200), at: at() };
  if ([input.baselineCorrect, input.candidateCorrect, input.criticalFailures].some(value => !Number.isInteger(value) || value < 0) || Math.max(input.baselineCorrect, input.candidateCorrect) > evaluation.holdoutIds.length) throw Error('Evaluation counts must fit the distinct holdout cases.');
  next.evaluations.push(evaluation); return audit(next, 'evaluation-recorded', candidateId, 'Operator-recorded comparison; no model evaluation was executed by this form.');
}
export interface PromotionOptions { removalsReviewed?: boolean; appliedHash?: string }
export function promotionReasons(state: SkillLibrary, candidateId: string, graph?: LearningGraph, claims: ImportedClaim[] = [], options: PromotionOptions = {}): string[] {
  const candidate = state.versions.find(version => version.id === candidateId && version.status === 'candidate');
  if (!candidate) return ['Candidate is unavailable.'];
  const baseline = state.versions.find(version => version.id === candidate.parentId && version.status === 'active');
  const evaluation = state.evaluations.filter(item => item.candidateId === candidateId).at(-1);
  const reasons: string[] = [];
  try { bindClaimTokens(candidate.content, graph, claims); } catch (error) { reasons.push((error as Error).message); }
  if (!baseline || baseline.skillId !== candidate.skillId) reasons.push('The active baseline changed; evaluate a new candidate.');
  if (isHermesLinked(candidate) && baseline?.origin?.contentHash) {
    const removed = removedLines(baseline.content, candidate.content);
    if (removed && !options.removalsReviewed) reasons.push(`The Hermes proposal removes ${removed} baseline line${removed === 1 ? '' : 's'}; confirm the removals were reviewed.`);
  }
  if (!evaluation) reasons.push('Record a held-out baseline/candidate comparison.');
  else {
    if (evaluation.candidateText !== candidate.content || evaluation.baselineText !== baseline?.content) reasons.push('Evaluation does not match the frozen versions.');
    if (evaluation.holdoutIds.length < 5) reasons.push('At least five distinct holdout cases are required for this screening gate.');
    if (evaluation.holdoutIds.some(id => candidate.caseIds.includes(id))) reasons.push('Development and holdout cases overlap.');
    if (evaluation.candidateCorrect <= evaluation.baselineCorrect) reasons.push('Candidate did not improve the recorded result.');
    if (evaluation.criticalFailures !== 0) reasons.push('Critical failures remain.');
  }
  if (candidate.prerequisites.length) {
    if (!graph) reasons.push('Load the pinned Active Skillference graph.');
    else { try { if (missingPrerequisites(graph, candidate.prerequisites, reviewedNodeIds(state)).length) reasons.push('Record reviews for the selected curriculum prerequisites.'); } catch { reasons.push('Candidate contains an unknown curriculum prerequisite.'); } }
  }
  return reasons;
}
export function adoptVersion(state: SkillLibrary, candidateId: string, note: string, graph?: LearningGraph, claims: ImportedClaim[] = [], options: PromotionOptions = {}): SkillLibrary {
  const next = edit(state), reasons = promotionReasons(next, candidateId, graph, claims, options);
  if (reasons.length) throw Error(reasons.join(' '));
  const candidate = next.versions.find(version => version.id === candidateId)!;
  // Push-then-adopt: a Hermes-linked candidate becomes active only after its verified write to the profile.
  if (isHermesLinked(candidate) && options.appliedHash !== candidate.origin!.contentHash) throw Error('Apply this candidate to the Hermes profile first; the lab adopts it after the verified write.');
  next.versions = next.versions.map(version => version.id === candidateId ? { ...version, status: 'active' } : version.id === candidate.parentId ? { ...version, status: 'archived' } : version);
  return audit(next, 'operator-adopted', candidateId, requireText(note, 'Adoption note'));
}
export function rollbackVersion(state: SkillLibrary, versionId: string, note: string): SkillLibrary {
  const next = edit(state), target = next.versions.find(version => version.id === versionId && version.status === 'archived');
  if (!target) throw Error('Choose a prior archived version.');
  if (isHermesLinked(target)) throw Error('Rolling back a Hermes-linked skill needs the Hermes write step; restore it in Hermes for now.');
  next.versions = next.versions.map(version => version.id === target.id ? { ...version, status: 'active' } : version.skillId === target.skillId && version.status === 'active' ? { ...version, status: 'archived' } : version);
  return audit(next, 'operator-rollback', versionId, note);
}
export function rejectVersion(state: SkillLibrary, versionId: string, note: string): SkillLibrary {
  const next = edit(state), target = next.versions.find(version => version.id === versionId && version.status === 'candidate');
  if (!target) throw Error('Choose a candidate to reject.');
  target.status = 'rejected'; return audit(next, 'operator-rejected', versionId, note);
}
export function updateSkillPolicy(state: SkillLibrary, policy: SkillPolicy): SkillLibrary {
  const next = edit(state); next.policy = { ...policy }; return audit(next, 'policy-updated', 'skill-policy', `${policy.mode}; maximum ${policy.maxSkills} skills / ${policy.maxContextChars} characters`);
}
export function reviewLearningNode(state: SkillLibrary, graph: LearningGraph, nodeId: string, note: string): SkillLibrary {
  const next = edit(state), node = graph.nodes.find(node => node.id === nodeId);
  if (!node) throw Error('Unknown learning skill.');
  if (missingPrerequisites(graph, node.prerequisites, reviewedNodeIds(next)).length) throw Error('Review the prerequisite concepts first.');
  next.learningReviews = [...next.learningReviews.filter(review => review.nodeId !== nodeId), { nodeId, note: requireText(note, 'Local review evidence', 2000), at: at(), sourceCommit: ACTIVE_SKILLFERENCE.commit }];
  return audit(next, 'local-study-review', nodeId, 'Local operator annotation; no SkillTree completion or mastery is claimed.');
}
export const reviewedNodeIds = (state: SkillLibrary) => state.learningReviews.filter(review => review.sourceCommit === ACTIVE_SKILLFERENCE.commit).map(review => review.nodeId);
export function selectApprovedSkills(state: SkillLibrary, task: string, graph?: LearningGraph, claims: ImportedClaim[] = []) {
  if (state.loadError || state.policy.mode === 'off') return { selected: [] as SkillVersion[], context: '' };
  const words = new Set(task.toLowerCase().match(/[a-z0-9]+/g) || []);
  // Hermes-linked versions are applied by Hermes itself, never injected into Quanta requests.
  const ranked = state.versions.filter(version => version.status === 'active' && !isHermesLinked(version)).map(version => ({ version, score: version.tags.filter(tag => words.has(tag)).length })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.version.id.localeCompare(b.version.id));
  const selected: SkillVersion[] = []; let context = '';
  for (const { version } of ranked) {
    if (selected.length >= state.policy.maxSkills) break;
    try { if (version.prerequisites.length && (!graph || missingPrerequisites(graph, version.prerequisites, reviewedNodeIds(state)).length)) continue; }
    catch { continue; }
    let content: string; try { content = bindClaimTokens(version.content, graph, claims); } catch { continue; }
    const entry = `\nSKILL ${version.skillId} / VERSION ${version.id}\n${content}\n`;
    if (context.length + entry.length > state.policy.maxContextChars) continue;
    selected.push(structuredClone(version)); context += entry;
  }
  return { selected, context };
}
