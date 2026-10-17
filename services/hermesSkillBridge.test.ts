import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyHermesProposal } from './hermesSkillBridge';
import type { SkillProposal, SkillProposalList } from '../server/hermes-skill-bridge';
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const proposal=():SkillProposal=>({pendingId:'unit-pending',action:'edit',origin:'background_review',createdAt:'2026-10-17T00:00:00Z',summary:'UNIT FIXTURE ONLY',skillName:'unit',baseText:'BASE',baseHash:hash('BASE'),proposedText:'CANDIDATE',proposedHash:hash('CANDIDATE'),importable:true});
const list=(p=proposal()):SkillProposalList=>({workspace:'work',writeApproval:true,proposals:[p],skipped:[]});
test('browser import verifies fresh proposal bytes and recorded hashes',async()=>{
  const p=proposal();assert.deepEqual(await verifyHermesProposal(p,list(p)),p);
  for(const gate of [false,null])await assert.rejects(()=>verifyHermesProposal(p,{...list(),writeApproval:gate}),/write-approval/);
  await assert.rejects(()=>verifyHermesProposal(p,{...list(),proposals:[]}),/changed/);
  await assert.rejects(()=>verifyHermesProposal(p,{...list(),proposals:[p,p]}),/changed/);
  await assert.rejects(()=>verifyHermesProposal(p,list({...p,proposedText:'ALTERED'})),/changed/);
  const invalid={...p,proposedHash:'f'.repeat(64)};await assert.rejects(()=>verifyHermesProposal(invalid,list(invalid)),/hashes/);
});
