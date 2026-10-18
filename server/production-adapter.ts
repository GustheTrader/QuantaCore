import type { ProviderStore } from './provider-store';
import { OperatingEvidence, evidenceHash, textHash } from './operating-evidence';
import { HASH } from '../lib/operating-contract';
import path from 'node:path';
import {starterRunnerHash} from './starter-evaluation-version';
import {STARTER_RUBRIC} from '../lib/starter-evaluation';
import {boundedJson} from './bounded-json';
import { releaseBlockers, type ReleaseReview } from '../lib/operating-contract';
import { STARTER_USE_CASE, starterInstructions } from '../lib/starter-workflow';

export async function frozenStarterRoute(providers:ProviderStore,model:string){
  const connection=await providers.connection('local');
  const url=new URL(connection.baseUrl);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.protocol!=='http:'||url.username||url.password||url.search||url.hash)throw Error('The Starter pilot requires the local loopback Ollama route.');
  if(!model||model!==connection.model)throw Error('Configure and select one installed local model before evaluating the Starter pilot.');
  if(/(?:cloud|remote)/i.test(model))throw Error('Cloud or remote model aliases are outside this local pilot scope.');
  const tags=await fetch(`${url.origin}/api/tags`,{signal:AbortSignal.timeout(3000),redirect:'error'}).then(async r=>{if(!r.ok)throw Error('Local Ollama inventory is unavailable.');return boundedJson(r,2_000_000);});
  const installed=tags.models?.find((m:any)=>m.name===model||m.model===model),modelHash=String(installed?.digest||'').replace(/^sha256:/,'');
  if(!installed||!HASH.test(modelHash)||installed.remote_host||installed.remote_model)throw Error('The exact model must be installed locally with a known model digest.');
  const shown=await fetch(`${url.origin}/api/show`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model}),signal:AbortSignal.timeout(3000),redirect:'error'}).then(async r=>{if(!r.ok)throw Error('Local model metadata is unavailable.');return boundedJson(r,2_000_000);});
  if(shown.remote_host||shown.remote_model)throw Error('This Ollama model forwards to a remote host; it is outside the local scope.');
  return {scope:{provider:'local',model,modelHash,routeHash:evidenceHash({provider:'local',model,modelHash,baseUrl:connection.baseUrl,keyHash:textHash(connection.apiKey)}),harnessHash:textHash(starterInstructions())},connection};
}
export class ProductionAdapter {
  constructor(readonly evidence:OperatingEvidence,readonly providers:ProviderStore){}
  active(){const actions=this.evidence.list<any>('release-action',2000);const latest=actions.find(a=>a.useCase===STARTER_USE_CASE);if(!latest?.releaseId)return null;return this.evidence.list<ReleaseReview>('release',2000).find(r=>r.id===latest.releaseId)||null;}
  async preview(packageHash:string,limits:ReleaseReview['limits']){
    const record=this.evidence.stored(packageHash),reasons=releaseBlockers(record,limits);
    const p=record.package;
    if(evidenceHash(p)!==record.hash)reasons.push('Package bytes differ from their stored receipt.');
    if(p.artifact.content&&textHash(p.artifact.content)!==p.artifact.candidateHash)reasons.push('Candidate instruction bytes differ from their hash.');
    if(p.artifact.baselineHash!==textHash(starterInstructions()))reasons.push('The frozen baseline differs from the current Starter harness.');
    if(p.dataset.runnerHash!==starterRunnerHash(path.resolve(this.evidence.directory,'../..'))||p.dataset.rubricHash!==evidenceHash(STARTER_RUBRIC))reasons.push('Runner or rubric revision differs from the currently reviewed implementation.');
    if(p.scope)try{const route=await frozenStarterRoute(this.providers,p.scope.model);if(evidenceHash(route.scope)!==evidenceHash(p.scope))reasons.push('Model weights, endpoint, credential or harness binding changed.');}catch{reasons.push('The exact local model route is unavailable or changed.');}
    return {packageHash,scope:p.scope,artifactHash:p.artifact.candidateHash,content:p.artifact.content,blockers:reasons,activeId:this.active()?.id||null,productionImprovementDemonstrated:false};
  }
  async approve(input:any){
    if(input?.approve!==true||typeof input.reviewer!=='string'||!input.reviewer.trim()||input.reviewer.length>200||typeof input.note!=='string'||!input.note.trim()||input.note.length>2000)throw Error('Explicit approval, reviewer and decision note are required.');
    const preview=await this.preview(input.packageHash,input.limits);
    if(preview.blockers.length)throw Error(preview.blockers.join(' '));
    if(input.expectedActiveId!==preview.activeId||input.artifactHash!==preview.artifactHash)throw Error('Review no longer matches the active slot or exact artifact. Preview again.');
    const expiry=Date.parse(input.expiresAt);if(!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+30*86400000)throw Error('Choose an expiry within the next 30 days.');
    const review:ReleaseReview={id:crypto.randomUUID(),packageHash:input.packageHash,useCase:STARTER_USE_CASE,scope:preview.scope!,artifactHash:preview.artifactHash!,reviewer:input.reviewer.trim(),note:input.note.trim(),at:new Date().toISOString(),expiresAt:new Date(expiry).toISOString(),previousId:preview.activeId,limits:input.limits};
    this.evidence.db.exec('BEGIN IMMEDIATE');try{this.evidence.append('release',review);this.evidence.append('release-action',{useCase:review.useCase,releaseId:review.id,at:review.at,action:'operator-approved'});this.evidence.db.exec('COMMIT');}catch(e){this.evidence.db.exec('ROLLBACK');throw e;}return review;
  }
  rollback(input:any){const active=this.active();if(!active||active.id!==input.expectedActiveId||typeof input.note!=='string'||!input.note.trim()||input.note.length>2000)throw Error('Current release identity and rollback note are required.');
    this.evidence.append('release-action',{useCase:STARTER_USE_CASE,releaseId:active.previousId,at:new Date().toISOString(),action:'operator-rollback',note:input.note});return this.active();}
  async instructions(releaseId:string){const active=this.active();if(!active||active.id!==releaseId||Date.parse(active.expiresAt)<=Date.now())throw Error('This release is inactive or expired.');
    const preview=await this.preview(active.packageHash,active.limits);if(preview.blockers.length||preview.artifactHash!==active.artifactHash||preview.activeId!==releaseId||this.active()?.id!==releaseId||Date.parse(active.expiresAt)<=Date.now())throw Error('Production scope changed; review a new release.');return{review:active,system:starterInstructions(preview.content!)};}
}
