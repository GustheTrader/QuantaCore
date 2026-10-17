import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { addFailure, adoptVersion, hermesSkillId, importHermesCandidate, newSkillLibrary, promotionReasons, proposeVersion, recordEvaluation, removedLines, rollbackVersion, selectApprovedSkills, validateLibrary, type HermesProposal, type SkillLibrary, type SkillVersion } from './skill-growth';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const seed: SkillVersion = { id: 'base-v1', skillId: 'source-review', name: 'Source review', tags: ['evidence'], content: 'Preserve source identity.', status: 'active', createdAt: '2026-10-17T00:00:00Z', caseIds: [], prerequisites: [] };
const base = '# Alpha\n\nStep one.\nStep two.\n';
function proposal(overrides: Partial<HermesProposal> = {}): HermesProposal {
  const proposedText = overrides.proposedText ?? base + 'Step three.\n', baseText = overrides.baseText ?? base;
  return { workspace: 'work', pendingId: 'p1', action: 'edit', skillName: 'alpha', summary: 'rewrite alpha', baseText, baseHash: sha(baseText), proposedText, proposedHash: sha(proposedText), importable: true, ...overrides };
}
const evaluate = (state: SkillLibrary) => recordEvaluation(state, state.versions.at(-1)!.id, { holdoutIds: ['h1', 'h2', 'h3', 'h4', 'h5'], baselineCorrect: 2, candidateCorrect: 4, criticalFailures: 0, conditions: 'Frozen Hermes profile, model and cases.', report: 'local://hermes/eval-1', reviewer: 'operator' });

test('an edit proposal imports the current Hermes text as baseline and the proposal as a frozen candidate', () => {
  const state = importHermesCandidate(newSkillLibrary([seed]), proposal(), 'Background review after a missed step.');
  const [baseline, candidate] = state.versions.slice(-2);
  assert.equal(baseline.skillId, hermesSkillId('work', 'alpha')); assert.equal(baseline.status, 'active'); assert.equal(baseline.content, base);
  assert.equal(baseline.origin!.contentHash, sha(base));
  assert.equal(candidate.status, 'candidate'); assert.equal(candidate.parentId, baseline.id); assert.equal(candidate.content, base + 'Step three.\n');
  assert.deepEqual(candidate.origin, { kind: 'hermes', workspace: 'work', skillName: 'alpha', contentHash: sha(base + 'Step three.\n'), pendingId: 'p1', baseHash: sha(base) });
  assert.deepEqual(state.journal.map(entry => entry.action), ['baseline-imported', 'candidate-imported']);
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(state))).versions.length, 3, 'origin survives a localStorage round trip');
});

test('imports refuse duplicates, stale bases, open candidates and non-importable records', () => {
  const once = importHermesCandidate(newSkillLibrary([seed]), proposal(), 'first');
  assert.throws(() => importHermesCandidate(once, proposal(), 'again'), /already in the library/);
  assert.throws(() => importHermesCandidate(once, proposal({ pendingId: 'p2' }), 'second'), /open candidate/);
  assert.throws(() => importHermesCandidate(newSkillLibrary([seed]), proposal({ importable: false }), 'x'), /stays in Hermes review/);
  assert.throws(() => importHermesCandidate(newSkillLibrary([seed]), proposal({ action: 'delete' }), 'x'), /stays in Hermes review/);
  assert.throws(() => importHermesCandidate(newSkillLibrary([seed]), proposal({ proposedHash: 'nope' }), 'x'), /hashes/);
  const rejected = { ...once, versions: once.versions.map(v => v.status === 'candidate' ? { ...v, status: 'rejected' as const } : v) };
  assert.throws(() => importHermesCandidate(rejected, proposal({ pendingId: 'p3', baseText: base + 'changed\n' }), 'stale'), /changed since/);
  assert.equal(importHermesCandidate(rejected, proposal({ pendingId: 'p3' }), 'fresh').versions.length, 4, 'same base reuses the baseline');
  assert.throws(() => validateLibrary({ ...once, versions: once.versions.map(v => ({ ...v, origin: v.origin && { ...v.origin, skillName: '../x' } })) }), /Hermes skill origin/);
});

test('a create proposal compares against an explicit no-skill placeholder', () => {
  const state = importHermesCandidate(newSkillLibrary([seed]), proposal({ action: 'create', baseText: '', baseHash: '', skillName: 'gamma' }), 'new skill');
  const [baseline] = state.versions.slice(-2);
  assert.equal(baseline.origin!.contentHash, ''); assert.match(baseline.content, /No Hermes skill named gamma/);
  assert.throws(() => importHermesCandidate(newSkillLibrary([seed]), proposal({ action: 'create' }), 'x'), /hashes/);
});

test('the SkillForge gate applies in full, removals need review, and adoption waits for the verified Hermes write', () => {
  const shrink = proposal({ proposedText: '# Alpha\n\nStep one, merged with two.\n' });
  const state = evaluate(importHermesCandidate(newSkillLibrary([seed]), shrink, 'cleanup'));
  const candidate = state.versions.at(-1)!;
  assert.deepEqual(promotionReasons(state, candidate.id), ['The Hermes proposal removes 2 baseline lines; confirm the removals were reviewed.']);
  assert.deepEqual(promotionReasons(state, candidate.id, undefined, [], { removalsReviewed: true }), []);
  assert.throws(() => adoptVersion(state, candidate.id, 'ok', undefined, [], { removalsReviewed: true }), /Apply this candidate to the Hermes profile first/);
  assert.throws(() => adoptVersion(state, candidate.id, 'ok', undefined, [], { removalsReviewed: true, appliedHash: sha(base) }), /Apply this candidate/);
  const adopted = adoptVersion(state, candidate.id, 'verified write', undefined, [], { removalsReviewed: true, appliedHash: shrink.proposedHash });
  assert.equal(adopted.versions.find(v => v.id === candidate.id)!.status, 'active');
  const unevaluated = importHermesCandidate(newSkillLibrary([seed]), proposal(), 'x');
  assert.ok(promotionReasons(unevaluated, unevaluated.versions.at(-1)!.id).includes('Record a held-out baseline/candidate comparison.'));
  const archived = adopted.versions.find(v => v.status === 'archived')!;
  assert.throws(() => rollbackVersion(adopted, archived.id, 'undo'), /Hermes write step/);
});

test('Hermes-linked skills stay out of Quanta request context and lab-authored revisions', () => {
  let state = importHermesCandidate(newSkillLibrary([seed]), proposal(), 'x');
  state = { ...state, versions: state.versions.map(v => v.origin ? { ...v, tags: ['alpha'] } : v) };
  assert.deepEqual(selectApprovedSkills(state, 'alpha evidence').selected.map(v => v.id), ['base-v1']);
  const baseline = state.versions.find(v => v.origin && v.status === 'active')!;
  state = addFailure(state, { skillId: baseline.skillId, versionId: baseline.id, summary: 'missed', reference: 'ref', dimensions: { knowledge: 'high', tool: 'none', clarification: 'none', style: 'none' } });
  assert.throws(() => proposeVersion(state, baseline.id, [state.cases[0].id], 'more'), /Hermes-linked/);
});

test('removed line counting is order-insensitive and counts duplicates', () => {
  assert.equal(removedLines('a\nb\n\nc', 'c\na\nb\nnew'), 0);
  assert.equal(removedLines('a\na\nb', 'a\nb'), 1);
  assert.equal(removedLines('  a  \r\nb', 'a'), 1);
});
