import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GatewayPolicy } from './gateway-policy';
test('scoped gateway reserves before calls, rejects oversubscription, persists uncertainty and revokes', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(),'gateway-policy-')); let secrets: any = {};
  const store: any = { directory, connection: async () => ({ baseUrl:'https://api.x.ai/v1',model:'fixture',apiKey:'fixture-key' }), getOAuthCredentials:async()=>secrets,setOAuthCredentials:async(d:any)=>{secrets=d;} };
  const body = { name:'Test',provider:'grok',model:'fixture',enabled:true,approveCloud:true,maxInputBytes:256,maxOutputTokens:32,requestsPerMinute:3,monthlyCalls:3,monthlyCapUsd:0.2,reservePerCallUsd:0.1 };
  const request = () => ({ messages:[{role:'user',content:'Plan'}] });
  try {
    const p=new GatewayPolicy(store); await assert.rejects(p.configure({...body,approveCloud:false}),/approval/);
    const c=await p.configure(body); const id=p.authenticate('Bearer '+c.key);
    assert.throws(()=>p.authenticate('Bearer quanta_old_broad_key'),/scoped/);
    assert.throws(()=>p.admit(id,'grok/other',request(),'https://api.x.ai/v1','fixture-key'),/not authorized/);
    assert.throws(()=>p.admit(id,'grok/fixture',{...request(),tools:[]},'https://api.x.ai/v1','fixture-key'),/text only/);
    assert.throws(()=>p.admit(id,'grok/fixture',request(),'https://different.example/v1','fixture-key'),/changed/);
    assert.throws(()=>p.admit(id,'grok/fixture',request(),'https://api.x.ai/v1','new-key'),/changed/);
    const a=p.admit(id,'grok/fixture',request(),'https://api.x.ai/v1','fixture-key');
    assert.throws(()=>p.admit(id,'grok/fixture',request(),'https://api.x.ai/v1','fixture-key'),/active/);
    p.complete(a,{usage:{prompt_tokens:10,completion_tokens:4}});
    p.admit(id,'grok/fixture',request(),'https://api.x.ai/v1','fixture-key');
    const restarted=new GatewayPolicy(store); assert.equal(restarted.status().records[1].status,'uncertain'); assert.equal(restarted.status().clients[0].reservedUsd,0.2);
    assert.throws(()=>restarted.admit(id,'grok/fixture',request(),'https://api.x.ai/v1','fixture-key'),/monthly/);
    restarted.revoke(id); assert.throws(()=>restarted.authenticate('Bearer '+c.key),/disabled/);
    assert.equal(JSON.stringify(restarted.status()).includes(c.key!),false);
  } finally { rmSync(directory,{recursive:true,force:true}); }
});

test('request rate remains enforced after restart', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(),'gateway-rate-')); let secrets: any = {};
  const store: any = { directory, connection: async () => ({baseUrl:'http://127.0.0.1:11434/v1',model:'fixture',apiKey:''}), getOAuthCredentials:async()=>secrets,setOAuthCredentials:async(d:any)=>{secrets=d;} };
  try {
    const p=new GatewayPolicy(store);
    const c=await p.configure({name:'Local',provider:'local',model:'fixture',enabled:true,maxInputBytes:256,maxOutputTokens:32,requestsPerMinute:1,monthlyCalls:10,monthlyCapUsd:0,reservePerCallUsd:0});
    const id=p.authenticate('Bearer '+c.key);
    const request=()=>({messages:[{role:'user',content:'Plan'}]});
    const admitted=p.admit(id,'local/fixture',request(),'http://127.0.0.1:11434/v1',''); p.complete(admitted,{});
    const reopened=new GatewayPolicy(store);
    assert.throws(()=>reopened.admit(id,'local/fixture',request(),'http://127.0.0.1:11434/v1',''),/rate/);
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
