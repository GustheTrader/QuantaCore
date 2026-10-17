import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Read-only view of Hermes skill writes staged by `skills.write_approval` (see docs/HERMES_SKILL_BRIDGE.md).
// Nothing here applies, rejects or edits a Hermes record; pending payloads and skill text are untrusted data.
export type BridgeWorkspace = 'work' | 'personal';
export interface SkillProposal {
  pendingId: string; action: string; origin: 'foreground' | 'background_review'; createdAt: string; summary: string; skillName: string;
  baseText: string; baseHash: string; proposedText: string; proposedHash: string; importable: boolean; reason?: string;
}
export interface SkillProposalList { workspace: BridgeWorkspace; writeApproval: boolean | null; proposals: SkillProposal[]; skipped: { file: string; reason: string }[] }

export const MAX_SKILL_CHARS = 12000;
const MAX_RECORDS = 200, MAX_RECORD_BYTES = 1_000_000, MAX_SKILL_BYTES = 1_000_000;
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/, PENDING_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const readText = (file: string) => readFileSync(file, 'utf8').replace(/^﻿/, '');
export const hermesHome = () => process.env.HERMES_HOME || path.join(process.env.LOCALAPPDATA || '', 'hermes');

export function bridgeProfile(workspace: string, home = hermesHome()) {
  if (workspace !== 'work' && workspace !== 'personal') throw new Error('Skill proposals are available for the Work and Personal spaces.');
  return path.join(home, 'profiles', 'gnoesis-' + workspace);
}

// Hermes keeps `skills:` as a top-level YAML block; only the boolean under it matters here.
export function readWriteApproval(profile: string): boolean | null {
  const file = path.join(profile, 'config.yaml');
  if (!existsSync(file)) return null;
  const lines = readText(file).split(/\r?\n/), start = lines.findIndex(line => /^skills:\s*$/.test(line));
  if (start < 0) return false;
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const match = line.match(/^\s+write_approval:\s*(\S+)\s*$/);
    if (match) return ['true', 'yes', 'on', '1'].includes(match[1].toLowerCase());
  }
  return false;
}

// Finds <skills>/[category/]<name>/SKILL.md without following links or entering dot folders (.archive, backups).
export function findSkillFile(skillsRoot: string, name: string): string[] {
  if (!existsSync(skillsRoot)) return [];
  const root = realpathSync(skillsRoot), found: string[] = [];
  const visit = (directory: string, depth: number) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || !entry.isDirectory() || entry.isSymbolicLink()) continue;
      const child = path.join(directory, entry.name), skill = path.join(child, 'SKILL.md');
      if (entry.name === name && existsSync(skill) && !lstatSync(skill).isSymbolicLink()) {
        const resolved = realpathSync(skill);
        if (resolved.startsWith(root + path.sep)) found.push(resolved);
      } else if (depth < 2) visit(child, depth + 1);
    }
  };
  visit(root, 0);
  return found;
}

function occurrences(text: string, part: string) {
  let count = 0;
  for (let index = text.indexOf(part); index >= 0 && count < 2; index = text.indexOf(part, index + part.length)) count++;
  return count;
}

export function normalizeProposal(record: any, skillsRoot: string): SkillProposal {
  if (!record || typeof record !== 'object' || !record.payload || typeof record.payload !== 'object') throw new Error('Not a pending skill record.');
  const payload = record.payload, pendingId = String(record.id || ''), skillName = String(payload.name || '');
  if (!PENDING_ID.test(pendingId)) throw new Error('Invalid pending ID.');
  const proposal: SkillProposal = {
    pendingId, action: String(payload.action || record.action || ''), skillName,
    origin: record.origin === 'background_review' ? 'background_review' : 'foreground',
    createdAt: Number.isFinite(record.created_at) ? new Date(record.created_at * 1000).toISOString() : '',
    summary: String(record.summary || '').slice(0, 500), baseText: '', baseHash: '', proposedText: '', proposedHash: '', importable: false,
  };
  const refuse = (reason: string) => ({ ...proposal, reason });
  if (!NAME.test(skillName)) return refuse('Skill name is missing or unsafe.');
  const files = findSkillFile(skillsRoot, skillName);
  if (files.length > 1) return refuse('More than one installed skill has this name; review it in Hermes.');
  if (files.length) {
    if (lstatSync(files[0]).size > MAX_SKILL_BYTES) return refuse('The installed SKILL.md is too large to review here.');
    proposal.baseText = readText(files[0]); proposal.baseHash = sha256(proposal.baseText);
  }
  const target = payload.file_path;
  if (target !== undefined && target !== null && target !== '' && target !== 'SKILL.md') return refuse('Only SKILL.md changes can enter the lab; scripts and reference files stay in Hermes review.');
  let proposed: string;
  switch (proposal.action) {
    case 'create':
      if (files.length) return refuse('A skill with this name is already installed.');
      proposed = String(payload.content ?? ''); break;
    case 'edit':
      if (!files.length) return refuse('The skill to rewrite is not installed in this profile.');
      proposed = String(payload.content ?? ''); break;
    case 'patch': {
      if (!files.length) return refuse('The skill to patch is not installed in this profile.');
      const before = String(payload.old_string ?? ''), after = String(payload.new_string ?? '');
      if (!before || occurrences(proposal.baseText, before) !== 1) return refuse('The patch does not match exactly one place in the current SKILL.md.');
      proposed = proposal.baseText.replace(before, () => after); break;
    }
    default: return refuse(`"${proposal.action || 'unknown'}" changes stay in Hermes review (/skills diff ${pendingId}).`);
  }
  if (!proposed.trim()) return refuse('The proposed SKILL.md is empty.');
  proposal.proposedText = proposed; proposal.proposedHash = sha256(proposed);
  if (proposed === proposal.baseText) return refuse('The proposal does not change SKILL.md.');
  if (proposed.length > MAX_SKILL_CHARS || proposal.baseText.length > MAX_SKILL_CHARS) return { ...proposal, reason: `Skill text over ${MAX_SKILL_CHARS} characters cannot enter the lab yet.` };
  return { ...proposal, importable: true };
}

export function listSkillProposals(workspace: string, home = hermesHome()): SkillProposalList {
  const profile = bridgeProfile(workspace, home), pending = path.join(profile, 'pending', 'skills');
  const result: SkillProposalList = { workspace: workspace as BridgeWorkspace, writeApproval: readWriteApproval(profile), proposals: [], skipped: [] };
  if (!existsSync(pending) || lstatSync(pending).isSymbolicLink()) return result;
  const names = readdirSync(pending, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.json')).map(entry => entry.name).sort();
  for (const name of names.slice(0, MAX_RECORDS)) {
    try {
      const file = path.join(pending, name);
      if (lstatSync(file).size > MAX_RECORD_BYTES) throw new Error('Pending record is too large.');
      result.proposals.push(normalizeProposal(JSON.parse(readText(file)), path.join(profile, 'skills')));
    } catch (error) { result.skipped.push({ file: name, reason: (error as Error).message }); }
  }
  if (names.length > MAX_RECORDS) result.skipped.push({ file: '', reason: `Only the first ${MAX_RECORDS} pending records are shown.` });
  result.proposals.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return result;
}
