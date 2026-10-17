export const ACTIVE_SKILLFERENCE = {
  repository: 'https://github.com/ActiveInferenceInstitute/Active_Skillference',
  commit: '1f1030f053f2922f1c16ea7170e62635b511d603',
  doi: 'https://zenodo.org/records/21865644',
  graphHash: '9e905563876a45c960f1f081aa3f62b6be844058fd199b5c34e7f39b97265cce',
  claimsHash: '68bcc9ec67b536dbfececa6dc2257bb12e9edabed1cfd728dad436287618ada6',
} as const;
export interface LearningNode { id: string; name: string; description: string; subject: string; prerequisites: string[] }
export interface LearningGraph { projectId: string; nodes: LearningNode[]; edges: number; subjects: number; roots: string[] }
export interface ImportedClaim { id: string; value: number; units: string; source: string }
const object = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected a curriculum object.');
  return value as Record<string, any>;
};
const text = (value: unknown, max = 20000): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error('Invalid curriculum text.');
  return value;
};
export function parseLearningGraph(value: unknown): LearningGraph {
  const raw = object(value);
  if (!Array.isArray(raw.subjects) || !raw.subjects.length || raw.subjects.length > 500 || !Array.isArray(raw.dependencies) || raw.dependencies.length > 10000) throw Error('Invalid curriculum shape or size.');
  const nodes: LearningNode[] = [];
  const subjects = new Set<string>();
  for (const entry of raw.subjects) {
    const subject = object(entry), id = text(subject.subjectId, 100);
    if (subjects.has(id) || !Array.isArray(subject.skills)) throw Error('Duplicate subject or missing skills.');
    subjects.add(id);
    for (const item of subject.skills) {
      const skill = object(item);
      nodes.push({ id: text(skill.skillId, 100), name: text(skill.name, 300), description: text(skill.description), subject: text(subject.name, 300), prerequisites: [] });
    }
  }
  if (!nodes.length || nodes.length > 2000) throw Error('Curriculum skill count is outside the supported range.');
  const byId = new Map(nodes.map(node => [node.id, node]));
  if (byId.size !== nodes.length) throw Error('Duplicate curriculum skill ID.');
  const edgeIds = new Set<string>();
  for (const entry of raw.dependencies) {
    const edge = object(entry), id = text(edge.skillId, 100), dependency = text(edge.dependsOnSkillId, 100);
    const key = `${id}/${dependency}`;
    if (!byId.has(id) || !byId.has(dependency) || id === dependency || edgeIds.has(key)) throw Error('Dangling, self-referencing or duplicate prerequisite.');
    edgeIds.add(key); byId.get(id)!.prerequisites.push(dependency);
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw Error('Curriculum prerequisite cycle.');
    if (visited.has(id)) return;
    visiting.add(id); for (const prerequisite of byId.get(id)!.prerequisites) visit(prerequisite);
    visiting.delete(id); visited.add(id);
  };
  for (const node of nodes) visit(node.id);
  return { projectId: text(raw.projectId, 100), nodes, edges: edgeIds.size, subjects: subjects.size, roots: nodes.filter(node => !node.prerequisites.length).map(node => node.id) };
}
export function parseClaimLedger(value: unknown): ImportedClaim[] {
  const entries = Object.entries(object(value));
  if (entries.length > 2000) throw Error('Claim ledger exceeds the supported size.');
  return entries.map(([id, entry]) => {
    const claim = object(entry);
    if (typeof claim.value !== 'number' || !Number.isFinite(claim.value) || typeof claim.units !== 'string') throw Error('Unsupported upstream claim value.');
    return { id: text(id, 200), value: claim.value, units: claim.units.slice(0, 100), source: text(claim.source, 500) };
  });
}
export function missingPrerequisites(graph: LearningGraph, ids: string[], reviewed: string[]): string[] {
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  const needed = new Set<string>();
  const visit = (id: string) => {
    const node = byId.get(id); if (!node) throw Error(`Unknown curriculum prerequisite: ${id}`);
    if (needed.has(id)) return; needed.add(id); node.prerequisites.forEach(visit);
  };
  ids.forEach(visit);
  return [...needed].filter(id => !reviewed.includes(id));
}
export function graphClaims(graph: LearningGraph) {
  return [
    { id: 'curriculum.skills', value: graph.nodes.length, source: 'Validated pinned export: count unique skill IDs' },
    { id: 'curriculum.subjects', value: graph.subjects, source: 'Validated pinned export: count unique subject IDs' },
    { id: 'curriculum.edges', value: graph.edges, source: 'Validated pinned export: count unique prerequisite edges' },
    { id: 'curriculum.roots', value: graph.roots.length, source: 'Validated pinned export: count nodes with no prerequisites' },
  ];
}
export function bindClaimTokens(content: string, graph?: LearningGraph, claims: ImportedClaim[] = []): string {
  const values = new Map<string, string>();
  for (const claim of claims) values.set(claim.id, `${claim.value}${claim.units ? ` ${claim.units}` : ''} [imported upstream result; ${claim.source}; not regenerated locally]`);
  if (graph) for (const claim of graphClaims(graph)) values.set(claim.id, `${claim.value} [local computation; ${claim.source}]`);
  return content.replace(/\{\{claim:([^}]+)\}\}/g, (_match, key: string) => {
    const value = values.get(key); if (!value) throw Error(`Unsupported claim token: ${key}`); return value;
  });
}
