import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bridgeProfile, listSkillProposals, MAX_SKILL_CHARS, readWriteApproval, sha256 } from './hermes-skill-bridge';

const alpha = '---\nname: alpha\ndescription: Alpha.\n---\n\n# Alpha\n\nStep one.\nStep two.\n';
function fixture() {
  const home = mkdtempSync(path.join(tmpdir(), 'hermes-bridge-'));
  const profile = bridgeProfile('work', home), pending = path.join(profile, 'pending', 'skills');
  mkdirSync(path.join(profile, 'skills', 'research', 'alpha'), { recursive: true });
  mkdirSync(path.join(profile, 'skills', '.archive', 'beta'), { recursive: true });
  mkdirSync(pending, { recursive: true });
  writeFileSync(path.join(profile, 'skills', 'research', 'alpha', 'SKILL.md'), '﻿' + alpha);
  writeFileSync(path.join(profile, 'skills', '.archive', 'beta', 'SKILL.md'), 'archived');
  writeFileSync(path.join(profile, 'config.yaml'), 'model: x\nskills:\n  write_approval: true\n  creation_nudge_interval: 15\nplugins: {}\n');
  let n = 0;
  const stage = (payload: object, extra: object = {}) => {
    const id = `p${++n}`;
    writeFileSync(path.join(pending, `${id}.json`), JSON.stringify({ id, subsystem: 'skills', summary: `s${n}`, origin: 'background_review', created_at: 1_700_000_000 + n, payload, ...extra }));
    return id;
  };
  return { home, profile, pending, stage, cleanup: () => rmSync(home, { recursive: true, force: true }) };
}
const byId = (home: string, id: string) => listSkillProposals('work', home).proposals.find(p => p.pendingId === id)!;

test('normalizes create, edit and single-match patch proposals with hashes of the actual text', () => {
  const f = fixture();
  try {
    const created = byId(f.home, f.stage({ action: 'create', name: 'gamma', content: '# Gamma\n' }));
    assert.equal(created.importable, true); assert.equal(created.baseHash, ''); assert.equal(created.proposedHash, sha256('# Gamma\n'));
    const edited = byId(f.home, f.stage({ action: 'edit', name: 'alpha', content: alpha + 'Step three.\n' }));
    assert.equal(edited.importable, true); assert.equal(edited.baseText, alpha, 'BOM is stripped like Hermes utf-8-sig reads');
    assert.equal(edited.baseHash, sha256(alpha)); assert.equal(edited.origin, 'background_review');
    const patched = byId(f.home, f.stage({ action: 'patch', name: 'alpha', old_string: 'Step two.', new_string: 'Step two, with $& kept literal.' }));
    assert.equal(patched.importable, true); assert.equal(patched.proposedText, alpha.replace('Step two.', () => 'Step two, with $& kept literal.'));
    assert.equal(listSkillProposals('work', f.home).writeApproval, true);
  } finally { f.cleanup(); }
});

test('keeps scripts, deletes, ambiguous patches and conflicting creates out of the lab', () => {
  const f = fixture();
  try {
    const cases: [object, RegExp][] = [
      [{ action: 'write_file', name: 'alpha', file_path: 'scripts/run.py', file_content: 'print(1)' }, /Only SKILL\.md/],
      [{ action: 'patch', name: 'alpha', file_path: 'references/x.md', old_string: 'a', new_string: 'b' }, /Only SKILL\.md/],
      [{ action: 'delete', name: 'alpha' }, /stay in Hermes review/],
      [{ action: 'patch', name: 'alpha', old_string: 'Step', new_string: 'Stage' }, /exactly one place/],
      [{ action: 'patch', name: 'alpha', old_string: 'missing', new_string: 'x' }, /exactly one place/],
      [{ action: 'create', name: 'alpha', content: 'dup' }, /already installed/],
      [{ action: 'edit', name: 'beta', content: 'x' }, /not installed/],
      [{ action: 'edit', name: '../alpha', content: 'x' }, /unsafe/],
      [{ action: 'edit', name: 'alpha', content: alpha }, /does not change/],
      [{ action: 'create', name: 'big', content: 'x'.repeat(MAX_SKILL_CHARS + 1) }, /over 12000/],
    ];
    for (const [payload, reason] of cases) {
      const proposal = byId(f.home, f.stage(payload));
      assert.equal(proposal.importable, false, JSON.stringify(payload)); assert.match(proposal.reason!, reason);
    }
  } finally { f.cleanup(); }
});

test('skips unreadable records and rejects other spaces without reading anything', () => {
  const f = fixture();
  try {
    writeFileSync(path.join(f.pending, 'broken.json'), '{not json');
    f.stage({ action: 'edit', name: 'alpha', content: 'x' }, { id: '../escape' });
    const list = listSkillProposals('work', f.home);
    assert.equal(list.proposals.length, 0); assert.deepEqual(list.skipped.map(s => s.file).sort(), ['broken.json', 'p1.json']);
    assert.throws(() => listSkillProposals('ideas', f.home), /Work and Personal/);
    assert.deepEqual(listSkillProposals('personal', f.home), { workspace: 'personal', writeApproval: null, proposals: [], skipped: [] });
  } finally { f.cleanup(); }
});

test('reads the write-approval gate only from the top-level skills block', () => {
  const f = fixture();
  try {
    const file = path.join(f.profile, 'config.yaml');
    writeFileSync(file, 'memory:\n  write_approval: true\nskills:\n  creation_nudge_interval: 15\n');
    assert.equal(readWriteApproval(f.profile), false);
    writeFileSync(file, 'skills:\r\n  write_approval: on\r\n');
    assert.equal(readWriteApproval(f.profile), true);
  } finally { f.cleanup(); }
});
