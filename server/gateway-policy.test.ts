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

test('agent clients (Gnoesis Bot) may stream and call tools only after explicit approval', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(),'gateway-agent-')); let secrets: any = {};
  const store: any = { directory, connection: async () => ({ baseUrl:'https://api.x.ai/v1',model:'fixture',apiKey:'fixture-key' }), getOAuthCredentials:async()=>secrets,setOAuthCredentials:async(d:any)=>{secrets=d;} };
  const body = { name:'Gnoesis Bot',provider:'grok',model:'fixture',enabled:true,approveCloud:true,profile:'agent',maxInputBytes:2000000,maxOutputTokens:16384,requestsPerMinute:60,monthlyCalls:100,monthlyCapUsd:5,reservePerCallUsd:0.01 };
  const agentRequest = () => ({ stream:true, tools:[{type:'function',function:{name:'read_file',parameters:{}}}], max_tokens:4000, messages:[{role:'system',content:'You are an agent'},{role:'user',content:[{type:'text',text:'Fix the bug'}]},{role:'assistant',content:null,tool_calls:[{id:'1',type:'function',function:{name:'read_file',arguments:'{}'}}]},{role:'tool',tool_call_id:'1',content:'file text'}] });
  try {
    const p=new GatewayPolicy(store);
    await assert.rejects(p.configure(body),/Approve streaming and tool calls/);
    await assert.rejects(p.configure({...body,approveAgentTools:true},true),/external clients/);
    await assert.rejects(p.configure({...body,profile:undefined,maxInputBytes:2000000,approveAgentTools:true}),/Invalid integer/);
    const c=await p.configure({...body,approveAgentTools:true}); const id=p.authenticate('Bearer '+c.key);
    assert.equal(p.profile(id),'agent');
    assert.equal(p.status().textOnly,false);
    const ids=[1,2,3,4].map(()=>p.admit(id,'grok/fixture',agentRequest(),'https://api.x.ai/v1','fixture-key'));
    assert.throws(()=>p.admit(id,'grok/fixture',agentRequest(),'https://api.x.ai/v1','fixture-key'),/active/);
    p.complete(ids[0],{}); const again=p.admit(id,'grok/fixture',agentRequest(),'https://api.x.ai/v1','fixture-key'); p.complete(again,{});
    assert.throws(()=>p.admit(id,'grok/fixture',{...agentRequest(),plugins:[{}]},'https://api.x.ai/v1','fixture-key'),/plugins/);
    assert.throws(()=>p.admit(id,'grok/other',agentRequest(),'https://api.x.ai/v1','fixture-key'),/not authorized/);
    assert.throws(()=>p.admit(id,'grok/fixture',{...agentRequest(),max_tokens:20000},'https://api.x.ai/v1','fixture-key'),/Output token/);
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
