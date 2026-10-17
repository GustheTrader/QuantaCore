import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ACTIVE_SKILLFERENCE, bindClaimTokens, graphClaims, missingPrerequisites, parseClaimLedger, parseLearningGraph } from './active-skillference';
import { addFailure, adoptVersion, failureVerdict, newSkillLibrary, promotionReasons, proposeVersion, recordEvaluation, reviewLearningNode, rollbackVersion, selectApprovedSkills, validateLibrary, type SkillLibrary, type SkillVersion } from './skill-growth';

const seed: SkillVersion = { id: 'base-v1', skillId: 'source-review', name: 'Source review', tags: ['evidence'], content: 'Preserve source identity and state missing evidence.', status: 'active', createdAt: '2026-10-17T00:00:00Z', caseIds: [], prerequisites: [] };
const graphInput = { projectId: 'course', subjects: [{ subjectId: 's', name: 'Foundations', skills: [{ skillId: 'root', name: 'Root', description: 'Foundation definition.' }, { skillId: 'advanced', name: 'Advanced', description: 'Depends on the foundation.' }] }], dependencies: [{ skillId: 'advanced', dependsOnSkillId: 'root' }] };
function candidate(prerequisites: string[] = []) {
  let state = addFailure(newSkillLibrary([seed]), { skillId: seed.skillId, versionId: seed.id, summary: 'A source was missing.', reference: 'Expected source reference in the supplied task.', dimensions: { knowledge: 'high', tool: 'none', clarification: 'none', style: 'none' } });
  state = proposeVersion(state, seed.id, [state.cases[0].id], 'If a required source is absent, ask for it and label the answer provisional.', prerequisites);
  return state;
}
function evaluated(state: SkillLibrary, overrides = {}) {
  return recordEvaluation(state, state.versions.at(-1)!.id, { holdoutIds: ['h1', 'h2', 'h3', 'h4', 'h5'], baselineCorrect: 2, candidateCorrect: 4, criticalFailures: 0, conditions: 'Frozen test cases, model, rubric and request limits.', report: 'local://comparison/report-1', reviewer: 'independent reviewer', ...overrides });
}

test('pinned Active Skillference artifacts match their checksums and have a valid complete graph', () => {
  const graphBytes = readFileSync(new URL('../public/research/active-skillference/skilltree_project.json', import.meta.url));
  const claimBytes = readFileSync(new URL('../public/research/active-skillference/claims.json', import.meta.url));
  assert.equal(createHash('sha256').update(graphBytes).digest('hex'), ACTIVE_SKILLFERENCE.graphHash);
  assert.equal(createHash('sha256').update(claimBytes).digest('hex'), ACTIVE_SKILLFERENCE.claimsHash);
  const graph = parseLearningGraph(JSON.parse(graphBytes.toString()));
  assert.equal(graph.nodes.length, 630); assert.equal(graph.subjects, 111); assert.equal(graph.edges, 1199);
  assert.equal(graphClaims(graph)[0].value, graph.nodes.length);
  assert.ok(parseClaimLedger(JSON.parse(claimBytes.toString())).length > 0);
});

test('graph validation rejects cycles, missing edges, duplicates and unsupported claim values', () => {
  assert.deepEqual(missingPrerequisites(parseLearningGraph(graphInput), ['advanced'], []), ['advanced', 'root']);
  assert.throws(() => parseLearningGraph({ ...graphInput, dependencies: [...graphInput.dependencies, { skillId: 'root', dependsOnSkillId: 'advanced' }] }), /cycle/);
  assert.throws(() => parseLearningGraph({ ...graphInput, dependencies: [{ skillId: 'advanced', dependsOnSkillId: 'missing' }] }), /Dangling/);
  assert.throws(() => parseLearningGraph({ ...graphInput, dependencies: [...graphInput.dependencies, ...graphInput.dependencies] }), /duplicate/);
  assert.throws(() => parseClaimLedger({ claim: { value: Infinity, source: 'kernel', units: '' } }), /Unsupported/);
});

test('failure verdict follows the paper threshold and deterministic tie priority', () => {
  assert.equal(failureVerdict({ knowledge: 'medium', tool: 'none', clarification: 'none', style: 'none' }).failed, false);
  const verdict = failureVerdict({ knowledge: 'medium', tool: 'medium', clarification: 'none', style: 'none' });
  assert.equal(verdict.failed, true); assert.equal(verdict.primary, 'knowledge');
  assert.equal(failureVerdict({ knowledge: 'none', tool: 'none', clarification: 'none', style: 'high' }).failed, true);
});

test('a proposal preserves the baseline and cannot enter inference before review', () => {
  const state = candidate();
  assert.equal(state.versions[0].content, seed.content);
  assert.ok(state.versions[1].content.startsWith(seed.content));
  assert.equal(state.versions[1].status, 'candidate');
  assert.deepEqual(selectApprovedSkills(state, 'review evidence').selected.map(version => version.id), [seed.id]);
  assert.throws(() => adoptVersion(state, state.versions[1].id, 'adopt'), /held-out/);
});

test('adoption rejects contaminated, stale, weak and critical-failure comparisons', () => {
  const start = candidate(), versionId = start.versions[1].id;
  for (const overrides of [
    { holdoutIds: [start.cases[0].id, 'h2', 'h3', 'h4', 'h5'] },
    { criticalFailures: 1 }, { candidateCorrect: 2 }, { holdoutIds: ['h1', 'h1', 'h2', 'h3', 'h4'] },
  ]) assert.ok(promotionReasons(evaluated(start, overrides), versionId).length > 0);
  const stale = evaluated(start); stale.versions[1].content += '\nUnreviewed modification';
  assert.ok(promotionReasons(stale, versionId).some(reason => reason.includes('frozen')));
  assert.throws(() => evaluated(start, { candidateCorrect: 9 }), /counts/);
});

test('adoption and rollback retain immutable versions and a review journal', () => {
  const before = evaluated(candidate()), versionId = before.versions[1].id;
  const adopted = adoptVersion(before, versionId, 'Reviewed the holdout report and regression cases.');
  assert.equal(before.versions[0].status, 'active');
  assert.equal(adopted.versions[0].status, 'archived');
  assert.equal(selectApprovedSkills(adopted, 'evidence').selected[0].id, versionId);
  const restored = rollbackVersion(adopted, seed.id, 'Regression observed; restore baseline.');
  assert.equal(restored.versions.filter(version => version.status === 'active').length, 1);
  assert.equal(restored.versions[0].content, seed.content);
  assert.equal(restored.journal.at(-1)!.action, 'operator-rollback');
});

test('prerequisite review is ordered, tied to the source pin and required for adoption', () => {
  const graph = parseLearningGraph(graphInput);
  let state = evaluated(candidate(['advanced'])); const versionId = state.versions[1].id;
  assert.throws(() => reviewLearningNode(state, graph, 'advanced', 'Read the source.'), /prerequisite/);
  assert.ok(promotionReasons(state, versionId, graph).some(reason => reason.includes('curriculum')));
  state = reviewLearningNode(state, graph, 'root', 'Checked foundational reference.');
  state = reviewLearningNode(state, graph, 'advanced', 'Checked the dependent concept and its derivation.');
  assert.equal(promotionReasons(state, versionId, graph).length, 0);
  state.learningReviews[0].sourceCommit = 'old-source';
  assert.ok(promotionReasons(state, versionId, graph).length > 0);
});

test('selection observes context limits, off mode and unknown prerequisites', () => {
  const state = newSkillLibrary([{ ...seed, content: 'x'.repeat(11000) }]);
  assert.equal(selectApprovedSkills(state, 'evidence').selected.length, 0);
  state.versions[0].content = seed.content; state.policy.mode = 'off';
  assert.equal(selectApprovedSkills(state, 'evidence').selected.length, 0);
  state.policy.mode = 'hntl'; state.versions[0].prerequisites = ['missing'];
  assert.equal(selectApprovedSkills(state, 'evidence', parseLearningGraph(graphInput)).selected.length, 0);
  assert.throws(() => validateLibrary({ ...state, versions: [seed, { ...seed, id: 'duplicate-active' }] }), /Multiple active/);
});

test('claim binding retains origin and rejects unknown claims during adoption and selection', () => {
  const graph = parseLearningGraph(graphInput);
  assert.match(bindClaimTokens('Nodes: {{claim:curriculum.skills}}', graph), /2 \[local computation/);
  assert.match(bindClaimTokens('Value: {{claim:entropy}}', undefined, [{ id: 'entropy', value: 0.5, units: 'nats', source: 'upstream.kernel' }]), /imported upstream result.*not regenerated locally/);
  const state = evaluated(candidate()); state.versions[1].content += '\nClaim: {{claim:unknown}}';
  assert.ok(promotionReasons(state, state.versions[1].id, graph).some(reason => reason.includes('Unsupported claim')));
  const active = newSkillLibrary([{ ...seed, content: '{{claim:unknown}}' }]);
  assert.equal(selectApprovedSkills(active, 'evidence', graph).selected.length, 0);
});

test('invalid persisted evaluation counts and empty baselines fail validation', () => {
  const state = evaluated(candidate()); state.evaluations[0].baselineCorrect = -1;
  assert.throws(() => validateLibrary(state), /evaluation/);
  assert.throws(() => validateLibrary({ ...newSkillLibrary([seed]), versions: [] }), /active baseline/);
});
