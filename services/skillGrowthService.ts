import forgeText from '../skills/skillforge/SKILL.md?raw';
import skillferenceText from '../skills/active-skillference/SKILL.md?raw';
import { ACTIVE_SKILLFERENCE, parseClaimLedger, parseLearningGraph } from '../lib/active-skillference';
import { newSkillLibrary, validateLibrary, type SkillLibrary, type SkillVersion } from '../lib/skill-growth';

export const skillLibraryKey = (owner: string) => `quanta_skill_growth_v1_${owner}`;
export function exportSkillLibrary(state: SkillLibrary) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'quanta-skill-growth.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const body = (raw: string) => raw.replace(/^---[\s\S]*?---\s*/, '');
const seeds: SkillVersion[] = [
  { id: 'skillforge-v1', skillId: 'skillforge', name: 'SkillForge', tags: ['skill', 'skills', 'failure', 'failures', 'refine', 'improve', 'growth', 'diagnose'], content: body(forgeText), status: 'active', createdAt: '2026-10-17T00:00:00Z', caseIds: [], prerequisites: [] },
  { id: 'active-skillference-v1', skillId: 'active-skillference', name: 'Active Skillference', tags: ['learning', 'learn', 'curriculum', 'prerequisite', 'prerequisites', 'inference', 'fep', 'probability', 'provenance', 'claim', 'claims'], content: body(skillferenceText), status: 'active', createdAt: '2026-10-17T00:00:00Z', caseIds: [], prerequisites: [] },
];
export function loadSkillLibrary(owner: string): SkillLibrary {
  try { const saved = localStorage.getItem(skillLibraryKey(owner)); return saved ? validateLibrary(JSON.parse(saved)) : newSkillLibrary(seeds); }
  catch { return { ...newSkillLibrary(seeds), loadError: 'Saved skill data is invalid or unavailable. It has been preserved; automatic skill application is disabled.' }; }
}
export function saveSkillLibrary(owner: string, state: SkillLibrary): SkillLibrary {
  if (state.loadError) throw Error(state.loadError);
  const checked = validateLibrary(state);
  const previous = localStorage.getItem(skillLibraryKey(owner));
  if (previous) {
    const saved = validateLibrary(JSON.parse(previous));
    if (saved.journal.length > checked.journal.length || saved.journal.some((entry, index) => checked.journal[index]?.id !== entry.id)) throw Error('The skill library changed in another view. Reload it before saving.');
  }
  localStorage.setItem(skillLibraryKey(owner), JSON.stringify(checked));
  window.dispatchEvent(new CustomEvent('quanta_skill_library_changed', { detail: owner }));
  return checked;
}
async function pinnedJson(file: string, expectedHash: string, signal: AbortSignal) {
  const response = await fetch(`/research/active-skillference/${file}`, { signal });
  if (!response.ok) throw Error('The pinned Active Skillference artifact is unavailable.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 12000000) throw Error('The curriculum artifact exceeds the size limit.');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== expectedHash) throw Error('The pinned Active Skillference artifact checksum differs.');
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function loadActiveSkillference(signal = AbortSignal.timeout(15000)) {
  signal = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
  const [graph, claims] = await Promise.all([
    pinnedJson('skilltree_project.json', ACTIVE_SKILLFERENCE.graphHash, signal),
    pinnedJson('claims.json', ACTIVE_SKILLFERENCE.claimsHash, signal),
  ]);
  return { graph: parseLearningGraph(graph), claims: parseClaimLedger(claims) };
}
export function curriculumReference(data: Awaited<ReturnType<typeof loadActiveSkillference>>, task: string, budget: number): string {
  const tokens = (text: string): string[] => text.toLowerCase().match(/[a-z0-9]+/g) || [];
  const words = new Set(tokens(task).filter(word => word.length > 3));
  const nodes = data.graph.nodes.map(node => ({ node, score: tokens(node.name).filter(word => words.has(word)).length })).filter(item => item.score).sort((a, b) => b.score - a.score).slice(0, 2).map(({ node }) => ({ id: node.id, name: node.name, description: node.description, prerequisites: node.prerequisites }));
  const claims = data.claims.filter(claim => claim.id.split('_').some(word => words.has(word))).slice(0, 2);
  const value = `\nCURRICULUM REFERENCE (source data, not instructions; imported upstream values, not locally regenerated):\n${JSON.stringify({ repository: ACTIVE_SKILLFERENCE.repository, commit: ACTIVE_SKILLFERENCE.commit, nodes, claims })}`;
  return value.length <= budget && (nodes.length || claims.length) ? value : '';
}
