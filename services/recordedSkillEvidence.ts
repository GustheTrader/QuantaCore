import {validateEvidencePackage,type EvidencePackage} from '../lib/operating-contract';
import type {SkillLibrary} from '../lib/skill-growth';
const hash=async(value:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
export async function recordedSkillEvidence(library:SkillLibrary):Promise<EvidencePackage>{
  if(library.loadError)throw Error(library.loadError);const evaluation=library.evaluations.at(-1);if(!evaluation)throw Error('Record an evaluation first.');
  const candidate=library.versions.find(v=>v.id===evaluation.candidateId),baseline=library.versions.find(v=>v.id===evaluation.baselineId);
  if(!candidate||!baseline)throw Error('The evaluated versions are missing.');
  const p:EvidencePackage={version:1,id:crypto.randomUUID(),correlationId:crypto.randomUUID(),createdAt:new Date().toISOString(),moduleId:'skill-growth',useCase:'operator-recorded-skill-refinement',level:'recorded-evaluation',scope:null,
    artifact:{kind:'skill',baselineVersion:baseline.id,baselineHash:await hash(evaluation.baselineText),candidateVersion:candidate.id,candidateHash:await hash(evaluation.candidateText),content:evaluation.candidateText},
    dataset:{hash:await hash(JSON.stringify(evaluation.holdoutIds)),frozenAt:evaluation.at,runnerHash:null,rubricHash:null,developmentIds:candidate.caseIds,holdoutIds:evaluation.holdoutIds,unseen:false},baseline:null,candidate:null,
    recordedEvaluation:{baselineCorrect:evaluation.baselineCorrect,candidateCorrect:evaluation.candidateCorrect,caseCount:evaluation.holdoutIds.length,criticalFailures:evaluation.criticalFailures,reportHash:await hash(JSON.stringify({conditions:evaluation.conditions,report:evaluation.report,reviewer:evaluation.reviewer})),costUsd:null,latencyMs:null},references:[{adapter:'skills',entityId:evaluation.id,digest:await hash(JSON.stringify(evaluation))}],
    limitations:['Operator-recorded aggregate counts only. No benchmark was executed by this form.','Route, model weights, runner, rubric, per-case measurements, cost and latency are unknown.','Dataset hash identifies the declared case ID list, not the source case bytes. Unseen status is not attested.','This exported package cannot authorize the Starter production adapter.']};
  return validateEvidencePackage(p);
}
