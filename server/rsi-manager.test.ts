import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { execFileSync } from 'node:child_process';
import express from 'express';
import { ProviderStore } from './provider-store';
import { RsiManager } from './rsi-manager';
import { createRsiRouter } from './rsi-router';
import { createInferenceRouters } from './inference-router';
import type { RsiRequest, RsiRun } from '../lib/rsi-contract';

const root = path.resolve(import.meta.dirname, '..');
const config: RsiRequest = { name:'Fixture',policyModel:'local/test',searchModel:'local/test',rounds:1,trials:1,maxParallel:1,budget:{maxCalls:10,maxTokens:10000,maxOutputTokens:256,maxSeconds:60,maxCostUsd:null},rates:[],systemPrompt:'General research.' };
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'quanta-rsi-test-'));
  const connection = {baseUrl:'http://127.0.0.1:11434/v1',model:'test',apiKey:'fixture-secret'};
  const store = new ProviderStore(path.join(directory, 'store'));
  store.connection = async () => connection;
  store.selectedConnection = async () => connection;
  store.publicConfig = async () => ({connections:[{id:'local',baseUrl:connection.baseUrl,model:'test',hasKey:true}],preferredProvider:'local',gatewayKeyConfigured:false,harnessRouterKeyConfigured:false});
  class FixtureManager extends RsiManager { override async probe() { return {ready:true,commit:this.pin.commit}; } }
  const manager = new FixtureManager(store, root, 0, path.join(directory,'data'));
  return {manager,connection,directory,clean:()=>{manager.close(); const rel=path.relative(path.resolve(tmpdir()),path.resolve(directory)); assert.ok(!rel.startsWith('..') && path.basename(directory).startsWith('quanta-rsi-test-'));rmSync(directory,{recursive:true,force:true});}};
}
function active(manager: RsiManager) {
  const run: RsiRun = {id:randomUUID(),name:'Fixture',status:'running',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),configurationHash:'fixture',request:structuredClone(config),sourceCommit:manager.pin.commit,suiteHash:'fixture',usage:{calls:0,tokens:0,costUsd:null,estimated:false},phase:'fixture'};
  const token='fixture-token'; const route={id:'local/test',provider:'local',model:'test',connection:{baseUrl:'http://127.0.0.1:11434/v1',model:'test',apiKey:'fixture-secret'},input:null,output:null};
  (manager as any).active={run,token,routes:[route],accepting:true,resultReceived:false,admissions:new Map()};
  const req:any={get:(name:string)=>({'authorization':`Bearer ${token}`,'X-Gnoesis-Run':run.id}[name]),socket:{remoteAddress:'127.0.0.1'}};
  return {run,req};
}
test('unknown prices reject USD caps and unchanged review is required', async()=>{
  const f=fixture(); try {
    await assert.rejects(f.manager.estimate({...config,budget:{...config.budget,maxCostUsd:1}}),/requires.*rate/);
    const review=await f.manager.estimate(config);
    assert.equal(review.knownCost,false);
    assert.ok(!JSON.stringify(review).includes('fixture-secret'));
    await assert.rejects(f.manager.start(review.id,false),/explicitly approve/);
    f.connection.apiKey='rotated-fixture';
    await assert.rejects(f.manager.start(review.id,true),/changed/);
    assert.equal(f.manager.list().length,0);
  } finally{f.clean();}
});
test('reservations block a second call and missing usage retains the first charge',()=>{
  const f=fixture();try{
    const {run,req}=active(f.manager);const body={messages:[{role:'user',content:'x'.repeat(7000)}],max_tokens:256,stream:false};
    const a=f.manager.admit(req,'local','test','http://127.0.0.1:11434/v1',body,new AbortController());
    const reserved=run.usage.tokens;
    assert.throws(()=>f.manager.admit(req,'local','test','http://127.0.0.1:11434/v1',body,new AbortController()),/token limit/);
    assert.equal(run.usage.calls,1);f.manager.complete(a,null);f.manager.complete(a,null);
    assert.equal(run.usage.tokens,reserved);assert.equal(run.usage.estimated,true);
    assert.equal(run.usage.costUsd,null);
    assert.throws(()=>f.manager.admit({...req,get:(n:string)=>n==='authorization'?'Bearer wrong':req.get(n)},'local','test','http://127.0.0.1:11434/v1',body,new AbortController()),/authorization/);
  }finally{f.clean();}
});
test('route scope and output bounds cannot be bypassed by the worker',()=>{
  const f=fixture();try{const {req}=active(f.manager);
    assert.throws(()=>f.manager.admit(req,'local','other','http://127.0.0.1:11434/v1',{max_tokens:256,stream:false},new AbortController()),/frozen/);
    assert.throws(()=>f.manager.admit(req,'local','test','http://127.0.0.1:11434/v1',{max_tokens:8192,stream:false},new AbortController()),/bounded/);
  }finally{f.clean();}
});
test('local HTTP gates reject cross-origin, rebound host and unauthorized gateway calls',async()=>{
  const f=fixture();const app=express();app.use(express.json());app.use('/api/rsi',createRsiRouter(f.manager));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const port=(server.address() as any).port;const url=`http://127.0.0.1:${port}/api/rsi`;
  try{
    assert.equal((await fetch(`${url}/runs`,{headers:{'X-Quanta-Client':'local-ui',Origin:'https://other.example'}})).status,403);
    const rebound = await new Promise<number>(resolve => { const req=httpRequest(`${url}/runs`,{headers:{'X-Quanta-Client':'local-ui',Host:'other.example'}},res=>{res.resume();resolve(res.statusCode!);});req.end(); });
    assert.equal(rebound,403);
    assert.equal((await fetch(`${url}/gateway/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
    const runs=await fetch(`${url}/runs`,{headers:{'X-Quanta-Client':'local-ui'}});assert.equal(runs.status,200);assert.deepEqual(await runs.json(),[]);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.clean();}
});
test('single journal ownership prevents reconciling another live controller',()=>{
  const f=fixture();try{
    f.manager.initialize();const other=new RsiManager(f.manager.store,root,0,(f.manager as any).dataDir);
    assert.throws(()=>other.initialize(),/another live/);other.close();
  }finally{f.clean();}
});
test('restart reconciliation marks unfinished evidence interrupted without running models',()=>{
  const f=fixture();try{
    const run={...config,id:randomUUID(),status:'running',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    const dir=path.join(f.manager.dataDir,run.id);mkdirSync(dir,{recursive:true});writeFileSync(path.join(dir,'state.json'),JSON.stringify(run));
    f.manager.initialize();assert.equal(f.manager.get(run.id).status,'interrupted');assert.equal(f.manager.events(run.id)[0].type,'interrupted');
  }finally{f.clean();}
});
test('measured review gates export and changed evidence invalidates approval',async()=>{
  const f=fixture();try{
    const id=randomUUID(),dir=path.join(f.manager.dataDir,id),repo=path.join(dir,'repo');mkdirSync(path.join(repo,'domains','quanta','harness'),{recursive:true});
    const profile=JSON.parse(readFileSync(path.join(root,'rsi','harness.json'),'utf8'));
    writeFileSync(path.join(repo,'domains','quanta','harness','harness.json'),JSON.stringify(profile));
    const git=(...args:string[])=>execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@localhost',...args],{cwd:repo,windowsHide:true,encoding:'utf8'}).trim();
    git('init','-b','fixture');git('add','domains');git('commit','-m','Synthetic fixture candidate');const commit=git('rev-parse','HEAD');
    const result={profile,baseline:{S:.5},frontier:{incumbent:{S:.8,commit}},baselineHoldout:{S:.7,missing:0},finalHoldout:{S:.8,missing:0},replay:{status:'insufficient_history',policy:null},limitations:['Synthetic test']};
    const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
    const resultHash=createHash('sha256').update(JSON.stringify(canonical(result))).digest('hex');
    const run:any={id,name:'Synthetic fixture',status:'completed',request:config,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),result,resultHash};
    writeFileSync(path.join(dir,'state.json'),JSON.stringify(run));writeFileSync(path.join(dir,'result.json'),JSON.stringify(result));
    assert.throws(()=>f.manager.artifact(id),/Approve/);
    await f.manager.review(id,'approve','Synthetic test of candidate approval gate.');
    assert.equal(f.manager.artifact(id).active,false);
    run.result.profile.systemPrompt='Changed after measurement';writeFileSync(path.join(dir,'result.json'),JSON.stringify(run.result));
    assert.throws(()=>f.manager.artifact(id),/evidence changed/);
  }finally{f.clean();}
});
test('frozen worker transport meters a completion without decrypting unrelated routes',async()=>{
  const f=fixture();const {run}=active(f.manager);
  f.manager.store.read=async()=>{throw Error('Unrelated credential decryption must not occur.');};
  let upstreamCalls=0;
  const mock=(async (_url:any,options:any)=>{upstreamCalls++;assert.equal(options.headers.Authorization,'Bearer fixture-secret');return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{role:'assistant',content:'{"answer":"fixture"}'}}],usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}}),{headers:{'Content-Type':'application/json'}});}) as typeof fetch;
  const app=express();app.use(express.json());app.use('/gateway',createInferenceRouters(f.manager.store,f.manager,mock).openai);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try{
    const response=await fetch(`http://127.0.0.1:${(server.address() as any).port}/gateway/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer fixture-token','X-Gnoesis-Run':run.id},body:JSON.stringify({model:'local/test',messages:[{role:'user',content:'Synthetic fixture'}],max_tokens:256,stream:false})});
    assert.equal(response.status,200);assert.ok(!JSON.stringify(await response.json()).includes('fixture-secret'));
    assert.equal(upstreamCalls,1);assert.equal(run.usage.calls,1);assert.equal(run.usage.tokens,15);assert.equal(run.usage.estimated,false);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));f.clean();}
});
test('provider metadata stays public and selected resolution decrypts one credential',async()=>{
  const f=fixture();try{
    const store=new ProviderStore(path.join(f.directory,'metadata-store'));mkdirSync(store.directory);
    writeFileSync(path.join(store.directory,'providers.json'),JSON.stringify({connections:{local:{model:'profile-model',baseUrl:'http://127.0.0.1:11434/v1',credential:'protected-local'},groq:{model:'other-model',credential:'protected-other'}}}));
    let decrypted=0;(store as any).unprotect=async(value:string)=>{decrypted++;assert.equal(value,'protected-local');return 'fixture-key';};
    const summaries=await store.publicConnectionSummaries();assert.equal(decrypted,0);assert.equal(summaries.find(s=>s.id==='local')?.hasKey,true);assert.ok(!JSON.stringify(summaries).includes('protected-local'));
    const selected=await store.selectedConnection('local');assert.equal(decrypted,1);assert.equal(selected.apiKey,'fixture-key');
  }finally{f.clean();}
});
