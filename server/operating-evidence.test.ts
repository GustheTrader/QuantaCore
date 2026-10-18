import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {OperatingEvidence,bindCurrentEntity,currentTrace,childTraceHeaders,evidenceHash,textHash,projectExistingJournals} from './operating-evidence';
import {createEvidenceRouter} from './evidence-router';
import {ProductionAdapter,frozenStarterRoute} from './production-adapter';
import {STARTER_RUNNER_FILES,starterRunnerHash} from './starter-evaluation-version';
import {STARTER_RUBRIC} from '../lib/starter-evaluation';
import {starterInstructions} from '../lib/starter-workflow';
import type {EvidencePackage} from '../lib/operating-contract';
const listen=async(app:any)=>{const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));return{server,url:`http://127.0.0.1:${server.address().port}`};};
const temp=()=>mkdtempSync(path.join(os.tmpdir(),'quanta-evidence-'));
test('correlated adapter spans retain IDs without request or response contents',async()=>{
  const root=temp(),store=new OperatingEvidence(root),app=express();app.use(express.json());app.use(store.middleware());
  const id=randomUUID(),correlationId=randomUUID();app.post('/api/trading/runs',(req,res)=>{bindCurrentEntity('research',id);assert.equal(currentTrace()?.correlationId,correlationId);assert.equal(childTraceHeaders()['X-Quanta-Correlation-ID'],correlationId);res.status(202).json({id,prompt:'RESPONSE_CANARY'});});
  app.post('/v1/chat/completions',(_req,res)=>res.json({id:randomUUID()}));const {server,url}=await listen(app);
  try{const r=await fetch(url+'/api/trading/runs',{method:'POST',headers:{'content-type':'application/json','X-Quanta-Correlation-ID':correlationId},body:JSON.stringify({prompt:'REQUEST_CANARY',apiKey:'SECRET_CANARY'})});assert.equal(r.status,202);assert.equal(r.headers.get('X-Quanta-Correlation-ID'),correlationId);await r.json();
    const nested=await fetch(url+'/v1/chat/completions',{method:'POST',headers:{'X-Gnoesis-Run':id}});await nested.json();
    const records=store.list<any>('request');assert.equal(records.length,2);assert.ok(records.every(r=>r.correlationId===correlationId));assert.equal(new Set(records.map(r=>r.spanId)).size,2);assert.ok(records.find(r=>r.adapter==='inference')?.parentSpanId);
    const text=JSON.stringify(records);assert.ok(!text.includes('CANARY'));assert.ok(!text.includes('apiKey'));assert.equal(store.list<any>('native-link')[0].entityId,id);
    const bad=await fetch(url+'/v1/chat/completions',{method:'POST',headers:{'X-Quanta-Correlation-ID':'bad\tvalue'}});assert.equal(bad.status,400);
  }finally{await new Promise<void>(r=>server.close(()=>r()));store.close();}
});
test('evidence GET is read only, local guarded, bounded and redacts journal source payloads',async()=>{
  const root=temp();mkdirSync(path.join(root,'.quanta'),{recursive:true});writeFileSync(path.join(root,'.quanta','hybrid-cloud.json'),JSON.stringify({jobs:[{id:randomUUID(),createdAt:new Date().toISOString(),status:'error',estimatedUpperBoundUsd:2,payload:{secret:'SOURCE_CANARY'},error:'PRIVATE_ERROR_CANARY'}]}));
  const store=new OperatingEvidence(root),app=express();app.use(express.json());const providers:any={publicConnectionSummaries:async()=>[],publicConfig:()=>{throw Error('Do not resolve credentials in a metadata view.');},connection:()=>{throw Error('Do not decrypt credentials in a metadata view.');}};app.use('/api/evidence',createEvidenceRouter(root,store,providers,null));const {server,url}=await listen(app);
  try{assert.equal((await fetch(url+'/api/evidence/snapshot')).status,403);assert.equal((await fetch(url+'/api/evidence/snapshot',{headers:{'X-Quanta-Client':'local-ui',Origin:'http://foreign.invalid'}})).status,403);
    const before=store.db.prepare('SELECT count(*) AS n FROM entries').get()!.n;
    const response=await fetch(url+'/api/evidence/snapshot',{headers:{'X-Quanta-Client':'local-ui'}});assert.equal(response.status,200);const data:any=await response.json();assert.ok(data.modules.every((m:any)=>m.cells.length===4));assert.ok(!JSON.stringify(data).includes('CANARY'));assert.equal(data.journals[0].costBasis,'reservation');assert.equal(data.journals[0].correlationBasis,'derived-legacy');assert.equal(store.db.prepare('SELECT count(*) AS n FROM entries').get()!.n,before);
    const module=data.modules[0];const skip=await fetch(url+'/api/evidence/readiness',{method:'POST',headers:{'X-Quanta-Client':'local-ui','Content-Type':'application/json'},body:JSON.stringify({...module,stage:'reviewed',outcome:'pass',reference:'FIXTURE',expiresAt:new Date(Date.now()+86400000).toISOString()})});assert.equal(skip.status,400);
  }finally{await new Promise<void>(r=>server.close(()=>r()));store.close();}
});
test('review binds the exact local model/artifact, forbids imported promotion and supports CAS/rollback',async()=>{
  const root=temp();for(const file of STARTER_RUNNER_FILES){const destination=path.join(root,file);mkdirSync(path.dirname(destination),{recursive:true});writeFileSync(destination,readFileSync(path.join(process.cwd(),file)));}
  const model='unit-fixture:1',hash='b'.repeat(64),app=express();app.use(express.json());app.get('/api/tags',(_req,res)=>res.json({models:[{name:model,digest:hash}]}));app.post('/api/show',(_req,res)=>res.json({details:{family:'fixture'}}));const {server,url}=await listen(app);
  let key='';const providers:any={connection:async()=>({model,apiKey:key,baseUrl:url+'/v1'})},store=new OperatingEvidence(root),adapter=new ProductionAdapter(store,providers);
  try{const {scope}=await frozenStarterRoute(providers,model),cases=['t1','t2','t3','t4','t5','t6'],content='UNIT TEST INSTRUCTIONS ONLY';
    const measurements=(quality:number)=>cases.map(caseId=>({caseId,quality,criticalFailures:0,latencyMs:10,costUsd:0,costBasis:'local-provider-zero' as const,inputTokens:1,outputTokens:1,outputHash:hash}));
    const p:EvidencePackage={version:1,id:randomUUID(),correlationId:randomUUID(),createdAt:new Date().toISOString(),moduleId:'starter-pilot',useCase:'starter-source-review-v1',level:'executed-benchmark',scope,artifact:{kind:'harness',baselineVersion:'fixture',baselineHash:textHash(starterInstructions()),candidateVersion:'fixture-next',candidateHash:textHash(content),content},dataset:{hash,runnerHash:starterRunnerHash(root),rubricHash:evidenceHash(STARTER_RUBRIC),frozenAt:new Date(Date.now()-1000).toISOString(),developmentIds:[],holdoutIds:cases,unseen:true},baseline:measurements(.5),candidate:measurements(1),references:[],limitations:['Synthetic unit fixture; no model was called.']};
    const imported=store.putPackage(p);assert.equal(imported.package.level,'recorded-evaluation');assert.ok((await adapter.preview(imported.hash,{minQuality:.9,maxMeanCostUsd:0,maxP95LatencyMs:50})).blockers.length);
    const measured=store.putPackage(p,'trusted-runner'),limits={minQuality:.9,maxMeanCostUsd:0,maxP95LatencyMs:50},preview=await adapter.preview(measured.hash,limits);assert.deepEqual(preview.blockers,[]);
    const input={packageHash:measured.hash,limits,artifactHash:textHash(content),expectedActiveId:null,reviewer:'UNIT FIXTURE',note:'UNIT FIXTURE ONLY',expiresAt:new Date(Date.now()+86400000).toISOString(),approve:true};
    await assert.rejects(()=>adapter.approve({...input,approve:false}));const release=await adapter.approve(input);assert.equal(adapter.active()?.id,release.id);assert.ok((await adapter.instructions(release.id)).system.includes(content));await assert.rejects(()=>adapter.approve(input));
    key='changed';await assert.rejects(()=>adapter.instructions(release.id));key='';
    const previewBeforeRollback=adapter.preview.bind(adapter);adapter.preview=async(...args)=>{const result=await previewBeforeRollback(...args);adapter.rollback({expectedActiveId:release.id,note:'UNIT FIXTURE concurrent rollback'});return result;};
    await assert.rejects(()=>adapter.instructions(release.id));assert.equal(adapter.active(),null);
    assert.throws(()=>store.db.exec("UPDATE entries SET kind='tampered'"),/append-only/);
  }finally{await new Promise<void>(r=>server.close(()=>r()));store.close();}
});
