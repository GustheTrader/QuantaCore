import express from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { SETUP_MODULES } from '../lib/system-setup';
import { READINESS_STAGES, UUID, readinessCells, type ReadinessEvidence, type OperatingSnapshot } from '../lib/operating-contract';
import type { ProviderStore } from './provider-store';
import { OperatingEvidence, evidenceHash, projectExistingJournals, textHash } from './operating-evidence';
import { ProductionAdapter } from './production-adapter';

export function createEvidenceRouter(root:string,evidence:OperatingEvidence,providers:ProviderStore,research:any){
  const router=express.Router(),production=new ProductionAdapter(evidence,providers);
  router.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');const origin=req.get('origin');
    if(!['127.0.0.1','localhost','[::1]'].includes(req.hostname)||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||'')||req.get('X-Quanta-Client')!=='local-ui'||(origin&&origin!==`${req.protocol}://${req.get('host')}`))return res.status(403).json({error:{message:'Local operator access required.'}});next();});
  const route=(fn:(req:any,res:any)=>any)=>async(req:any,res:any)=>{try{await fn(req,res);}catch(e){res.status(400).json({error:{message:(e as Error).message.slice(0,500)}});}};
  async function bindings(){
    // Read configuration metadata and protected bytes only. Status views must
    // not decrypt every saved credential or wait for Windows DPAPI processes.
    const file=path.join(root,'.quanta','providers.json');let protectedStoreHash:string|null=null;
    if(existsSync(file)){if(statSync(file).size>8_000_000)throw Error('Provider metadata exceeds the bounded reader size.');protectedStoreHash=textHash(readFileSync(file));}
    const routes=await providers.publicConnectionSummaries();
    const environmentHash=evidenceHash({openrouter:process.env.OPENROUTER_API_KEY||'',openrouterUrl:process.env.OPENROUTER_BASE_URL||'',gemini:process.env.GEMINI_API_KEY||process.env.API_KEY||''});
    const qsFile=path.join(root,'.quanta','qs-readonly.json');if(existsSync(qsFile)&&statSync(qsFile).size>64000)throw Error('QS metadata exceeds the bounded reader size.');const qsHash=existsSync(qsFile)?textHash(readFileSync(qsFile)):null;
    return SETUP_MODULES.map(m=>({moduleId:m.id,name:m.name,useCase:m.readiness.useCase,configurationHash:evidenceHash({moduleId:m.id,routeConfiguration:routes,protectedStoreHash,environmentHash,...(m.id==='qs-bridge'?{qsHash}:{})}),bindingNote:'Saved provider metadata and protected-store revision. Any protected-store rewrite conservatively invalidates evidence. External runtime changes require a fresh observation; evidence expires.'}));
  }
  router.get('/snapshot',route(async(_req,res)=>{
    const native=projectExistingJournals(root,evidence,research),b=await bindings(),observations=evidence.list<ReadinessEvidence>('readiness',2000);
    const snapshot:OperatingSnapshot={version:1,custody:{storage:'local Windows account filesystem',exportPolicy:'manual-only',externalCollector:false,contentCapture:false,retention:'100000 append-only records; no automatic deletion; explicit archive required at capacity'},...native,
      modules:b.map(m=>({...m,cells:readinessCells(m.moduleId,m.useCase,m.configurationHash,observations)})),
      requests:evidence.list('request',200),telemetry:evidence.list('telemetry',100),packages:evidence.list('package',100),reviews:evidence.list('release',100),activeRelease:production.active(),productionObservations:evidence.list('production-observation',100),benchmarks:evidence.list('benchmark-status',100)};
    res.json(snapshot);
  }));
  router.post('/readiness',route(async(req,res)=>{
    const input=req.body,b=(await bindings()).find(m=>m.moduleId===input.moduleId);
    if(!b||input.configurationHash!==b.configurationHash||input.useCase!==b.useCase||!READINESS_STAGES.some(s=>s.id===input.stage)||!['pass','fail'].includes(input.outcome)||typeof input.reference!=='string'||!input.reference.trim()||input.reference.length>1000)throw Error('Select the current module binding, named use case, stage and evidence reference.');
    const expires=Date.parse(input.expiresAt);if(!Number.isFinite(expires)||expires<=Date.now()||expires>Date.now()+30*86400000)throw Error('Evidence must expire within 30 days.');
    const cells=readinessCells(b.moduleId,b.useCase,b.configurationHash,evidence.list('readiness',2000));
    const index=READINESS_STAGES.findIndex(s=>s.id===input.stage);if(input.outcome==='pass'&&cells.slice(0,index).some(c=>c.state!=='pass'))throw Error('Record current evidence for each preceding stage first.');
    const record:ReadinessEvidence={moduleId:b.moduleId,useCase:b.useCase,configurationHash:b.configurationHash,stage:input.stage,outcome:input.outcome,at:new Date().toISOString(),expiresAt:new Date(expires).toISOString(),reference:input.reference.trim(),basis:'operator-recorded'};
    res.json(evidence.append('readiness',record));
  }));
  router.get('/packages/:hash',route((req,res)=>res.json(evidence.stored(req.params.hash))));
  router.post('/packages',route((req,res)=>res.json(evidence.putPackage(req.body,'operator-import'))));
  router.post('/production/preview',route(async(req,res)=>res.json(await production.preview(req.body.packageHash,req.body.limits))));
  router.post('/production/approve',route(async(req,res)=>res.json(await production.approve(req.body))));
  router.post('/production/rollback',route((req,res)=>res.json(production.rollback(req.body))));
  router.post('/production/run',route(async(req,res)=>{
    if(req.body.approveProviderRequest!==true||typeof req.body.source!=='string'||!req.body.source.trim()||req.body.source.length>8000)throw Error('Review the source and explicitly approve one local text request.');
    const {review,system}=await production.instructions(req.body.releaseId),correlationId=randomUUID(),start=performance.now();
    const response=await fetch(`http://127.0.0.1:${process.env.QUANTA_PORT||3000}/api/inference/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json','X-Quanta-Client':'local-ui','X-Quanta-Correlation-ID':correlationId},body:JSON.stringify({provider:'local',model:review.scope.model,max_tokens:512,messages:[{role:'system',content:system},{role:'user',content:req.body.source}]}),signal:AbortSignal.timeout(30000),redirect:'error'});
    const body=await response.json();if(!response.ok)throw Error('The reviewed local inference request failed. Inspect the correlated request metadata.');
    if(body.model!==review.scope.model||body.choices?.[0]?.finish_reason!=='stop'||typeof body.choices?.[0]?.message?.content!=='string'||body.choices[0].message.tool_calls)throw Error('The route did not return completed text on the reviewed model.');
    const text=body.choices[0].message.content;
    evidence.append('production-observation',{id:randomUUID(),correlationId,releaseId:review.id,level:'production-observation',at:new Date().toISOString(),outputHash:textHash(text),latencyMs:Math.round(performance.now()-start),quality:null,criticalFailures:null,costUsd:0,costBasis:'local-provider-zero',limitations:'Ungraded production observation; no improvement claim.'});
    res.json({text,correlationId,releaseId:review.id,latencyMs:Math.round(performance.now()-start),quality:null,productionImprovementDemonstrated:false});
  }));
  router.post('/telemetry',route((req,res)=>{
    const b=req.body;if(!UUID.test(b.id)||!UUID.test(b.correlationId)||!['trace.started','trace.completed','trace.error','rule-score'].includes(b.event)||!['context-optimization','structured-output-present'].includes(b.name)||(b.value!==undefined&&(typeof b.value!=='number'||!Number.isFinite(b.value)||b.value<0||b.value>1))||(b.latencyMs!==undefined&&(typeof b.latencyMs!=='number'||!Number.isFinite(b.latencyMs)||b.latencyMs<0)))throw Error('Unsupported local telemetry metadata.');
    res.json(evidence.append('telemetry',{id:b.id,correlationId:b.correlationId,event:b.event,name:b.name,at:new Date().toISOString(),...(b.value!==undefined?{value:b.value}:{}),...(b.latencyMs!==undefined?{latencyMs:b.latencyMs}:{}),basis:b.event==='rule-score'?'structural check only; not model quality':'observed browser event'}));
  }));
  return router;
}
