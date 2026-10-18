import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readinessCells,READINESS_STAGES,validateEvidencePackage,releaseBlockers,summarizeMeasurements,type EvidencePackage,type ReadinessEvidence} from './operating-contract';
import {gradeStarterOutput,makeStarterCases} from './starter-evaluation';
const hash='a'.repeat(64);
function measured():EvidencePackage{return{version:1,id:randomUUID(),correlationId:randomUUID(),createdAt:'2026-10-17T12:00:00Z',moduleId:'starter-pilot',useCase:'starter-source-review-v1',level:'executed-benchmark',scope:{provider:'local',model:'fixture',modelHash:hash,routeHash:hash,harnessHash:hash},artifact:{kind:'harness',baselineVersion:'fixture-base',baselineHash:hash,candidateVersion:'fixture-next',candidateHash:hash,content:'UNIT TEST FIXTURE ONLY'},dataset:{hash,runnerHash:hash,rubricHash:hash,frozenAt:'2026-10-17T11:00:00Z',developmentIds:['dev'],holdoutIds:['h1','h2','h3','h4','h5','h6'],unseen:true},baseline:['h1','h2','h3','h4','h5','h6'].map(caseId=>({caseId,quality:.5,criticalFailures:0,latencyMs:10,costUsd:0,costBasis:'local-provider-zero',inputTokens:null,outputTokens:null,outputHash:hash})),candidate:['h1','h2','h3','h4','h5','h6'].map(caseId=>({caseId,quality:1,criticalFailures:0,latencyMs:11,costUsd:0,costBasis:'local-provider-zero',inputTokens:null,outputTokens:null,outputHash:hash})),references:[],limitations:['Unit fixture only; no model result.']};}
const limits={minQuality:.9,maxMeanCostUsd:0,maxP95LatencyMs:30};
test('all four readiness states remain visible and scoped to config/use case/expiry',()=>{
  const now=Date.parse('2026-10-17T12:00:00Z'),evidence:ReadinessEvidence[]=READINESS_STAGES.map(s=>({moduleId:'m',useCase:'named',configurationHash:hash,stage:s.id,outcome:'pass',at:'2026-10-17T11:00:00Z',expiresAt:'2026-10-18T12:00:00Z',reference:'fixture',basis:'operator-recorded'}));
  assert.equal(readinessCells('m','named',hash,[],now).length,4);
  assert.ok(readinessCells('m','named',hash,evidence,now).every(c=>c.state==='pass'));
  assert.ok(readinessCells('m','named','b'.repeat(64),evidence,now).every(c=>c.state==='stale'));
  assert.ok(readinessCells('m','different',hash,evidence,now).every(c=>c.state==='unknown'));
  assert.ok(readinessCells('m','named',hash,evidence,now+3*86400000).every(c=>c.state==='stale'));
  evidence.push({...evidence[0],at:'2026-10-17T11:30:00Z',outcome:'fail'});
  const cells=readinessCells('m','named',hash,evidence,now);assert.equal(cells[0].state,'fail');assert.ok(cells.slice(1).every(c=>c.state==='stale'));
});
test('measured package rejects overlap, duplicate cases, bad counts and unknown measured scope',()=>{
  validateEvidencePackage(measured());
  for(const change of [(p:EvidencePackage)=>p.dataset.developmentIds.push('h1'),(p:EvidencePackage)=>p.baseline![0].quality=NaN,(p:EvidencePackage)=>p.baseline![0].costUsd=-1,(p:EvidencePackage)=>p.candidate![1].caseId='h1',(p:EvidencePackage)=>p.scope=null]){const p=measured();change(p);assert.throws(()=>validateEvidencePackage(p));}
});
test('recorded evaluation, unknown metrics, critical failures and weak result cannot release',()=>{
  const p=measured(),record={hash,origin:'trusted-runner' as const,declaredLevel:p.level,package:p};assert.deepEqual(releaseBlockers(record,limits),[]);
  assert.ok(releaseBlockers({...record,origin:'operator-import'},limits).some(r=>r.includes('receipt')));
  for(const change of [(p:EvidencePackage)=>p.candidate![0].criticalFailures=1,(p:EvidencePackage)=>p.candidate!.forEach(c=>c.quality=.5),(p:EvidencePackage)=>{p.candidate![0].costUsd=null;p.candidate![0].costBasis='unknown';},(p:EvidencePackage)=>p.candidate![0].latencyMs=null,(p:EvidencePackage)=>p.dataset.unseen=false]){const changed=measured();change(changed);assert.ok(releaseBlockers({...record,package:changed},limits).length);}
  const unknown=measured();unknown.baseline![0].costUsd=null;unknown.baseline![0].costBasis='unknown';assert.equal(summarizeMeasurements(unknown.baseline!).meanCostUsd,null);assert.ok(releaseBlockers({...record,package:unknown},limits).some(r=>r.includes('baseline')));
  const untimed=measured();untimed.baseline![0].latencyMs=null;assert.ok(releaseBlockers({...record,package:untimed},limits).some(r=>r.includes('baseline')));
});
test('six generated cases cover three starter jobs and graders reject source injection/action claims',()=>{
  const cases=makeStarterCases(()=>.4,randomUUID);assert.equal(cases.length,6);assert.equal(new Set(cases.map(c=>c.id)).size,6);assert.equal(new Set(cases.map(c=>c.job)).size,3);
  for(const c of cases){assert.deepEqual(gradeStarterOutput(c,JSON.stringify(c.expected)),{quality:1,criticalFailures:0});assert.ok(gradeStarterOutput(c,JSON.stringify({...c.expected,action_taken:true})).criticalFailures);assert.ok(gradeStarterOutput(c,'Sent the message and placed a trade.').criticalFailures);}
});
export {measured};
