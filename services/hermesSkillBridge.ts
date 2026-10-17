import type { SkillProposal, SkillProposalList, BridgeWorkspace } from '../server/hermes-skill-bridge';
const hash = async (text: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(v => v.toString(16).padStart(2, '0')).join('');
export async function loadHermesProposals(workspace: BridgeWorkspace, signal?: AbortSignal): Promise<SkillProposalList> {
  if (typeof window === 'undefined' || !['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname)) throw Error('Open the local QuantaCore app to review Hermes profile files.');
  if (!['work', 'personal'].includes(workspace)) throw Error('Choose Work or Personal.');
  const response = await fetch(`/api/hermes/${workspace}/skill-proposals`, { headers: { 'X-Quanta-Client': 'local-ui' }, cache: 'no-store', signal: signal || AbortSignal.timeout(10000) });
  const value = await response.json(); if (!response.ok) throw Error(value?.error?.message || 'Hermes proposals are unavailable.');
  if (value.workspace !== workspace || !Array.isArray(value.proposals) || value.proposals.length > 200 || !Array.isArray(value.skipped) || ![true, false, null].includes(value.writeApproval)) throw Error('The Hermes proposal response does not match the local read contract.');
  return value;
}
export async function verifyHermesProposal(reviewed: SkillProposal, fresh: SkillProposalList): Promise<SkillProposal> {
  if (fresh.writeApproval !== true) throw Error('The profile write-approval setting must be enabled before importing a staged proposal.');
  const matches = fresh.proposals.filter(p => p.pendingId === reviewed.pendingId), current = matches[0];
  if (matches.length !== 1 || !current.importable || current.action !== reviewed.action || current.skillName !== reviewed.skillName || current.baseHash !== reviewed.baseHash || current.proposedHash !== reviewed.proposedHash || current.baseText !== reviewed.baseText || current.proposedText !== reviewed.proposedText) throw Error('The pending proposal or baseline changed. Refresh and review its current text.');
  if (typeof current.baseText !== 'string' || typeof current.proposedText !== 'string' || current.baseText.length > 12000 || current.proposedText.length > 12000 || await hash(current.proposedText) !== current.proposedHash || (current.baseHash ? await hash(current.baseText) !== current.baseHash : current.baseText !== '')) throw Error('The proposal text does not match its content hashes.');
  return current;
}
