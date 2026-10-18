import {randomUUID,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ProviderStore} from '../server/provider-store';
import {OperatingEvidence,evidenceHash,textHash} from '../server/operating-evidence';
import {frozenStarterRoute} from '../server/production-adapter';
import {STARTER_HARNESS_VERSION,STARTER_USE_CASE,starterInstructions} from '../lib/starter-workflow';
import {STARTER_RUBRIC,makeStarterCases,gradeStarterOutput,type StarterCase} from '../lib/starter-evaluation';
import {UUID,validateEvidencePackage,summarizeMeasurements,type EvidencePackage,type CaseMeasurement} from '../lib/operating-contract';
import {starterRunnerHashes} from '../server/starter-evaluation-version';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceHashes=()=>starterRunnerHashes(root);
const args=process.argv.slice(2),mode=args[0]||'prepare';
const option=(name:string)=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
async function main(){
  const evidence=new OperatingEvidence(root);
  try{
    const providers=new ProviderStore(path.join(root,'.quanta'));
    if(mode==='prepare'){
      const frozenAt=new Date().toISOString(),id=randomUUID(),hashes=sourceHashes();
      const model=option('--model')||(await providers.connection('local')).model;
      let route:any=null,blockedReason:string|null=null;
      try{route=await frozenStarterRoute(providers,model);}catch{blockedReason='No configured, responding, installed local Ollama model was available. No model requests were sent.';}
      const candidateFile=option('--candidate');const candidate=candidateFile?readFileSync(path.resolve(candidateFile),'utf8'):null;
      if(candidate!==null&&(!candidate.trim()||candidate.length>8000))throw Error('Candidate must be an explicit instruction text file up to 8000 characters.');
      // Freeze instructions, grader and runner before private instance generation.
      const freeze={id,frozenAt,runnerHashes:hashes,runnerHash:evidenceHash(hashes),rubricHash:evidenceHash(STARTER_RUBRIC),baselineHash:textHash(starterInstructions()),candidateHash:candidate===null?null:textHash(candidate),scope:route?.scope||null,limits:STARTER_RUBRIC.limits};
      const cases=makeStarterCases(()=>randomBytes(4).readUInt32BE()/2**32,randomUUID);
      const directory=path.join(evidence.directory,'evaluations',id);mkdirSync(directory,{recursive:true});
      writeFileSync(path.join(directory,'cases.json'),JSON.stringify(cases),{mode:0o600});
      const manifest={...freeze,casesHash:evidenceHash(cases),candidate,candidateVersion:candidateFile?path.basename(candidateFile):null};
      writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});
      const status={id,correlationId:randomUUID(),at:new Date().toISOString(),state:blockedReason?'blocked':'prepared',caseCount:cases.length,model:model||null,runnerHash:freeze.runnerHash,datasetHash:evidenceHash(cases),freezeHash:evidenceHash(manifest),calls:0,reason:blockedReason||'Frozen private holdout prepared. No cases or output were exposed for tuning.'};
      evidence.append('benchmark-status',status);writeFileSync(path.join(directory,'status.json'),JSON.stringify(status,null,2),{mode:0o600});
      console.log(JSON.stringify({...status,directory},null,2));return;
    }
    if(mode!=='run'||!UUID.test(args[1]||''))throw Error('Usage: node --import tsx scripts/evaluate-starter.ts prepare [--model LOCAL_MODEL] [--candidate TEXT_FILE], or run PREPARED_UUID');
    const directory=path.join(evidence.directory,'evaluations',args[1]);
    if(existsSync(path.join(directory,'started.json')))throw Error('This holdout has already been attempted. Do not retry or tune against it. Prepare a new frozen holdout.');
    const manifest=JSON.parse(readFileSync(path.join(directory,'manifest.json'),'utf8'));
    const frozen=evidence.list<any>('benchmark-status',2000).find(s=>s.id===args[1]&&s.freezeHash);
    if(!frozen||evidenceHash(manifest)!==frozen.freezeHash)throw Error('Frozen preparation receipt differs from manifest bytes.');
    if(evidenceHash(sourceHashes())!==manifest.runnerHash||manifest.baselineHash!==textHash(starterInstructions())||manifest.rubricHash!==evidenceHash(STARTER_RUBRIC))throw Error('Runner, baseline or rubric changed after freeze. Prepare a new holdout.');
    if(!manifest.scope){console.log(JSON.stringify({id:args[1],state:'blocked',calls:0,reason:'Prepare a new holdout after configuring the exact local model. No model requests were sent.'}));return;}
    const actual=await frozenStarterRoute(providers,manifest.scope.model);if(evidenceHash(actual.scope)!==evidenceHash(manifest.scope))throw Error('Frozen route or model digest changed. Prepare a new holdout.');
    const cases:StarterCase[]=JSON.parse(readFileSync(path.join(directory,'cases.json'),'utf8'));if(evidenceHash(cases)!==manifest.casesHash||cases.length!==6)throw Error('Frozen holdout bytes differ.');
    const startedAt=new Date().toISOString(),correlationId=randomUUID();writeFileSync(path.join(directory,'started.json'),JSON.stringify({startedAt,correlationId}),{flag:'wx',mode:0o600});
    const baseline:CaseMeasurement[]=[],candidate:CaseMeasurement[]=[],outputs:any[]=[];const deadline=Date.now()+360000;
    let calls=0;
    for(let i=0;i<cases.length;i++){
      const variants=manifest.candidate!==null?(i%2?['candidate','baseline']:['baseline','candidate']):['baseline'];
      for(const variant of variants){
        if(calls>=12||Date.now()>=deadline)throw Error('Fixed evaluation budget reached. Partial outputs remain local; no production receipt issued.');
        const nowRoute=await frozenStarterRoute(providers,manifest.scope.model);if(evidenceHash(nowRoute.scope)!==evidenceHash(manifest.scope))throw Error('Model route or weights changed during evaluation.');
        if(Date.now()>=deadline)throw Error('Fixed evaluation time budget reached during route validation. No further model request was sent.');
        const start=performance.now();let text='',usage:any=null,errorCode:string|null=null;calls++;
        try{
          const response=await fetch(`http://127.0.0.1:${process.env.QUANTA_PORT||3000}/api/inference/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json','X-Quanta-Client':'local-ui','X-Quanta-Correlation-ID':correlationId},body:JSON.stringify({provider:'local',model:manifest.scope.model,temperature:0,max_tokens:512,messages:[{role:'system',content:starterInstructions(variant==='candidate'?manifest.candidate:'')},{role:'user',content:cases[i].prompt}]}),signal:AbortSignal.timeout(Math.min(30000,deadline-Date.now())),redirect:'error'});
          const data=await response.json();if(!response.ok||data.model!==manifest.scope.model||data.choices?.[0]?.finish_reason!=='stop'||typeof data.choices[0].message?.content!=='string'||data.choices[0].message.tool_calls)throw Error('INCOMPLETE_OR_WRONG_ROUTE');text=data.choices[0].message.content;usage=data.usage;
        }catch{errorCode='REQUEST_FAILED_OR_INCOMPLETE';}
        const graded=gradeStarterOutput(cases[i],text),measurement:CaseMeasurement={caseId:cases[i].id,...graded,latencyMs:Math.round(performance.now()-start),costUsd:0,costBasis:'local-provider-zero',inputTokens:Number.isSafeInteger(usage?.prompt_tokens)?usage.prompt_tokens:null,outputTokens:Number.isSafeInteger(usage?.completion_tokens)?usage.completion_tokens:null,outputHash:textHash(text)};
        (variant==='baseline'?baseline:candidate).push(measurement);outputs.push({caseId:cases[i].id,variant,text,errorCode});
        writeFileSync(path.join(directory,'partial.json'),JSON.stringify({calls,baseline,candidate,outputs},null,2),{mode:0o600});
      }
    }
    const p:EvidencePackage={version:1,id:randomUUID(),correlationId,createdAt:new Date().toISOString(),moduleId:'starter-pilot',useCase:STARTER_USE_CASE,level:'executed-benchmark',scope:manifest.scope,
      artifact:{kind:manifest.candidate===null?'workflow':'harness',baselineVersion:STARTER_HARNESS_VERSION,baselineHash:manifest.baselineHash,candidateVersion:manifest.candidateVersion,candidateHash:manifest.candidateHash,content:manifest.candidate},
      dataset:{hash:manifest.casesHash,frozenAt:manifest.frozenAt,runnerHash:manifest.runnerHash,rubricHash:manifest.rubricHash,developmentIds:[],holdoutIds:cases.map(c=>c.id),unseen:true},baseline,candidate:manifest.candidate===null?null:candidate,references:[{adapter:'starter',entityId:manifest.id,digest:evidenceHash({baseline,candidate})}],
      limitations:['Six generated source-review instances only; no general quality or production improvement claim.','No tools or memory. Deterministic field grader is narrow and not an independent scientific evaluator.','Local provider charge is zero; hardware and electricity are not included.','Fresh private case instances were generated after runner/instruction freeze; templates are known. No adaptive retries.']};
    validateEvidencePackage(p);const saved=evidence.putPackage(p,'trusted-runner');
    writeFileSync(path.join(directory,'package.json'),JSON.stringify(saved,null,2),{mode:0o600});
    const status={id:manifest.id,correlationId,at:p.createdAt,state:'completed',calls,packageHash:saved.hash,baseline:summarizeMeasurements(baseline),candidate:p.candidate?summarizeMeasurements(candidate):null,productionImprovementDemonstrated:false};
    evidence.append('benchmark-status',status);writeFileSync(path.join(directory,'status.json'),JSON.stringify(status,null,2),{mode:0o600});console.log(JSON.stringify(status,null,2));
  }finally{evidence.close();}
}
main().catch(e=>{console.error((e as Error).message);process.exitCode=1;});
