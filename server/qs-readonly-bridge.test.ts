import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { QsReadOnlyBridge, qsOrigin } from './qs-readonly-bridge';
import { OperatingEvidence } from './operating-evidence';
import { normalizeQsRead, QS_READ_PATHS } from '../lib/qs-bridge-contract';
const health={status:'ok',live_data:true,books_ready:true,clob_stream_ready:true};
const inventory=()=>({live:true,markets:[{key:'unit-market',question:'SYNTHETIC FIXTURE ONLY',condition_id:'unit-condition',up_token_id:'unit-up',down_token_id:'unit-down',up_pct:55,down_pct:45,last_update_ms:Date.now(),live:true}]});
test('QS origin rejects remote hosts, credentials, paths, redirects and ambiguous hosts',()=>{
  assert.equal(qsOrigin('http://127.0.0.1:8010/'),'http://127.0.0.1:8010');
  for(const value of ['https://127.0.0.1:8010','http://localhost:8010','http://example.com:8010','http://127.0.0.1:8010/api/markets','http://key@127.0.0.1:8010','http://127.0.0.1:8010?route=orders'])assert.throws(()=>qsOrigin(value));
});
test('source inventory preserves distinct outcomes and abstains on incomplete execution evidence',()=>{
  const fresh=normalizeQsRead(health,inventory());assert.equal(fresh.markets[0].disposition,'abstain');assert.equal(fresh.markets[0].reportedDownPercent,45);
  const missing=inventory();delete (missing.markets[0] as any).down_pct;delete (missing.markets[0] as any).down_token_id;missing.markets[0].last_update_ms=Date.now()-60000;
  const m=normalizeQsRead(health,missing).markets[0];assert.equal(m.reportedDownPercent,null);assert.equal(m.downTokenId,null);assert.ok(m.reasons.some(r=>r.includes('stale')));
  for(const v of [Infinity,NaN,-1,101,'55']){const bad=inventory();(bad.markets[0] as any).up_pct=v;assert.throws(()=>normalizeQsRead(health,bad));}
});
test('only three GET routes are used; exact review, drift rejection and local-only status preserve boundaries',async()=>{
  const root=mkdtempSync(path.join(os.tmpdir(),'quanta-qs-read-')),evidence=new OperatingEvidence(root),calls:string[]=[];let version='0.4.0',extra=false;
  const request:typeof fetch=async(input,options)=>{const url=new URL(String(input));assert.equal(options?.method,'GET');assert.equal(options?.redirect,'error');assert.ok(!('Authorization' in (options?.headers||{})));calls.push(url.pathname);assert.ok((QS_READ_PATHS as readonly string[]).includes(url.pathname));return Response.json(url.pathname==='/openapi.json'?{info:{title:'Polymarket Terminal API',version},paths:{'/api/health':{get:{}},'/api/markets':{get:{}}},...(extra?{revision:'changed'}:{})}:url.pathname==='/api/health'?health:inventory());};
  const bridge=new QsReadOnlyBridge(root,evidence,request);
  try{assert.equal(bridge.status().pin,null);assert.equal(calls.length,0);await assert.rejects(()=>bridge.snapshot({approveReadOnlyRequests:true}));await assert.rejects(()=>bridge.inspect({baseUrl:'http://127.0.0.1:8010'}));assert.equal(calls.length,0);
    version='wrong';await assert.rejects(()=>bridge.inspect({baseUrl:'http://127.0.0.1:8010',approveReadOnlyRequests:true}));assert.deepEqual(calls,['/openapi.json']);version='0.4.0';calls.length=0;
    const inspection=await bridge.inspect({baseUrl:'http://127.0.0.1:8010',approveReadOnlyRequests:true});assert.deepEqual(calls,[...QS_READ_PATHS]);assert.throws(()=>bridge.save({inspectionId:inspection.inspectionId,openapiHash:inspection.pin.openapiHash}));
    const pinned=bridge.save({inspectionId:inspection.inspectionId,openapiHash:inspection.pin.openapiHash,approveEndpointPin:true});assert.ok(pinned.pin);assert.ok(!readFileSync(bridge.file,'utf8').includes('SYNTHETIC'));const count=calls.length;bridge.status();assert.equal(calls.length,count);
    const snapshot=await bridge.snapshot({revision:pinned.pin!.revision,approveReadOnlyRequests:true});assert.equal(snapshot.executionEnabled,false);assert.equal(snapshot.markets[0].disposition,'abstain');
    extra=true;const prior=calls.length;await assert.rejects(()=>bridge.snapshot({revision:pinned.pin!.revision,approveReadOnlyRequests:true}),/schema changed/);assert.equal(calls.length,prior+1);assert.equal(calls.at(-1),'/openapi.json');
    assert.ok(!JSON.stringify(evidence.list('qs-observation')).includes('SYNTHETIC'));assert.equal(evidence.list('qs-observation').length,4);
  }finally{evidence.close();}
});
