import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { UUID, validateEvidencePackage, type AdapterId, type EvidencePackage, type JournalSummary, type StoredPackage, type TraceIdentity } from '../lib/operating-contract';

export const canonical = (v: any): string => JSON.stringify(v === undefined ? null : Array.isArray(v) ? v.map(x=>JSON.parse(canonical(x))) : v && typeof v==='object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])) : v);
export const evidenceHash = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex');
export const textHash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const context = new AsyncLocalStorage<{trace:TraceIdentity;evidence:OperatingEvidence}>();
export const currentTrace = () => context.getStore()?.trace;
export function bindCurrentEntity(adapter:AdapterId,entityId:string){const c=context.getStore();if(c&&UUID.test(entityId)){try{c.evidence.link(adapter,entityId,c.trace);}catch{console.error('Local native evidence link could not be recorded.');}}}
export const childTraceHeaders = () => { const t=currentTrace(); return t ? { 'X-Quanta-Correlation-ID':t.correlationId, 'X-Quanta-Parent-Span-ID':t.spanId } : {}; };
export interface RequestEvidence extends TraceIdentity {
  id: string; adapter: AdapterId; at: string; method: string; operation: string; status: number; latencyMs: number;
  entityId: string | null; linkRole: 'creation' | 'interaction'; model: string | null;
}
export class OperatingEvidence {
  readonly db: DatabaseSync;
  readonly directory: string;
  constructor(root: string) {
    this.directory=path.join(root,'.quanta','evidence'); mkdirSync(this.directory,{recursive:true});
    this.db=new DatabaseSync(path.join(this.directory,'operating.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS entries(seq INTEGER PRIMARY KEY,kind TEXT NOT NULL,id TEXT NOT NULL UNIQUE,value TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS evidence_kind ON entries(kind,seq);
      CREATE TRIGGER IF NOT EXISTS evidence_no_update BEFORE UPDATE ON entries BEGIN SELECT RAISE(ABORT,'Evidence is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS evidence_no_delete BEFORE DELETE ON entries BEGIN SELECT RAISE(ABORT,'Evidence is append-only'); END;`);
  }
  close(){this.db.close();}
  linkFor(adapter:AdapterId,entityId:string):any{const row=this.db.prepare("SELECT value FROM entries WHERE kind='native-link' AND id=?").get(`native-link:${adapter}:${entityId}`);return row?JSON.parse(String(row.value)):null;}
  link(adapter:AdapterId,entityId:string,trace:TraceIdentity){const key=`native-link:${adapter}:${entityId}`;if(!this.db.prepare('SELECT id FROM entries WHERE id=?').get(key))this.append('native-link',{adapter,entityId,...trace},key);}
  append(kind:string,value:any,id:string=randomUUID()) {
    const json=JSON.stringify(value); if(Buffer.byteLength(json)>256000) throw Error('Evidence record exceeds 256 KB.');
    if(Number(this.db.prepare('SELECT count(*) AS n FROM entries').get()!.n)>=100000) throw Error('Local evidence capacity reached; archive under an explicit retention scope.');
    this.db.prepare('INSERT INTO entries(kind,id,value) VALUES(?,?,?)').run(kind,id,json); return value;
  }
  list<T=any>(kind:string,limit=200):T[]{ return this.db.prepare('SELECT value FROM entries WHERE kind=? ORDER BY seq DESC LIMIT ?').all(kind,Math.max(1,Math.min(limit,2000))).map(row=>JSON.parse(String(row.value))); }
  stored(hash:string):StoredPackage { const found=this.db.prepare("SELECT value FROM entries WHERE kind='package' AND id=?").get(hash); if(!found) throw Error('Evidence package not found.'); return JSON.parse(String(found.value)); }
  putPackage(value:unknown,origin:StoredPackage['origin']='operator-import'){
    const p=validateEvidencePackage(value), declaredLevel=p.level;
    if(origin==='operator-import') p.level='recorded-evaluation';
    const hash=evidenceHash(p), record:StoredPackage={hash,origin,declaredLevel,package:p};
    if(!this.db.prepare('SELECT id FROM entries WHERE id=?').get(hash)) this.append('package',record,hash);
    return record;
  }
  middleware():RequestHandler{return (req,res,next)=>{
    const p=req.path;
    const adapter:AdapterId|undefined=p.startsWith('/api/qs-bridge')?'qs-bridge':p.startsWith('/api/inference')||p.startsWith('/v1/')?'inference':p.startsWith('/api/trading')?'research':p.startsWith('/api/rsi')?'rsi':p.startsWith('/api/hermes')?'hermes':p.startsWith('/api/harness-router')?'harness-router':p.startsWith('/api/hybrid')?'hybrid':p.startsWith('/api/work-zone')?'work-zone':p.startsWith('/api/memory')?'memory':undefined;
    if(!adapter)return next();
    const requested=req.get('X-Quanta-Correlation-ID'),parent=req.get('X-Quanta-Parent-Span-ID');
    if((requested&&!UUID.test(requested))||(parent&&!UUID.test(parent)))return res.status(400).json({error:{message:'Correlation headers must contain UUIDs.'}});
    const nativeRun=req.get('X-Gnoesis-Run');
    const inherited=!requested&&nativeRun&&UUID.test(nativeRun)?this.linkFor('research',nativeRun)||this.linkFor('rsi',nativeRun):null;
    const trace:TraceIdentity={correlationId:requested||inherited?.correlationId||randomUUID(),spanId:randomUUID(),...((parent||inherited?.spanId)?{parentSpanId:parent||inherited.spanId}:{})};
    res.setHeader('X-Quanta-Correlation-ID',trace.correlationId);res.setHeader('X-Quanta-Span-ID',trace.spanId);res.locals.evidenceTrace=trace;
    const start=performance.now(),at=new Date().toISOString(); let entityId:string|null=null,linkRole:RequestEvidence['linkRole']='interaction';
    const send=res.json.bind(res);
    res.json=((body:any)=>{
      // Inspect only native identifiers. Never retain response bodies, prompts or errors.
      const candidates=[body?.id,body?.run?.id,body?.job?.id,body?.responseId];
      entityId=candidates.find(v=>typeof v==='string'&&UUID.test(v))||null;
      if(req.method==='POST'&&(/\/(runs|jobs|sessions)$/.test(p)||/\/test$/.test(p)))linkRole='creation';
      if(entityId&&linkRole==='creation'&&res.statusCode<300)try{this.link(adapter,entityId,trace);}catch{res.setHeader('X-Quanta-Evidence-Status','unavailable');}
      return send(body);
    }) as typeof res.json;
    let recorded=false;
    const finish=(closed=false)=>{if(recorded)return;recorded=true;
      // Native route templates omit query strings and path IDs from metadata.
      const operation=`${req.baseUrl||''}${req.route?.path||'/unmatched'}`.slice(0,200);
      const model=typeof req.body?.model==='string'&&/^[\w./:@-]{1,240}$/.test(req.body.model)?req.body.model:null;
      try{this.append('request',{...trace,id:randomUUID(),adapter,at,method:req.method,operation,status:closed?499:res.statusCode,latencyMs:Math.round(performance.now()-start),entityId,linkRole,model} satisfies RequestEvidence);}catch{console.error('Local evidence write failed; no request content was logged.');}
    };
    res.once('finish',()=>finish());res.once('close',()=>{if(!res.writableFinished)finish(true);});
    context.run({trace,evidence:this},next);
  };}
}
const nativeAdapters:AdapterId[]=['research','rsi','hybrid','inference','hermes','work-zone','memory','qs-bridge'];
function readJson(file:string){if(!existsSync(file))return null;if(statSync(file).size>8_000_000)throw Error('Source exceeds the bounded metadata reader size.');return JSON.parse(readFileSync(file,'utf8'));}
const derivedId=(adapter:AdapterId,id:string)=>{const h=textHash(`${adapter}:${id}`);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
export function projectExistingJournals(root:string,evidence:OperatingEvidence,research?:{db:DatabaseSync}) {
  const journals:JournalSummary[]=[],sources:{adapter:AdapterId;state:'available'|'missing'|'unavailable';note:string}[]=[];
  const requests=evidence.list<RequestEvidence>('request',2000);
  const add=(adapter:AdapterId,id:any,at:any,status:any,extra:Partial<JournalSummary>={})=>{
    if(typeof id!=='string'||!id||id.length>160)return;
    const linked=evidence.linkFor(adapter,id)||requests.filter(r=>r.adapter===adapter&&r.entityId===id&&r.linkRole==='creation'&&r.status<300).at(-1);
    journals.push({adapter,entityId:id,at:typeof at==='string'?at:new Date(0).toISOString(),status:typeof status==='string'?status.slice(0,60):'unknown',eventCount:0,correlationId:linked?.correlationId||derivedId(adapter,id),correlationBasis:linked?'captured':'derived-legacy',digest:null,integrity:'unverified',costUsd:null,costBasis:'unknown',latencyMs:null,...extra});
  };
  for(const adapter of nativeAdapters){try{
    let available=false;
    if(adapter==='research'&&research){
      available=true;
      for(const row of research.db.prepare('SELECT id,value FROM runs ORDER BY rowid DESC LIMIT 100').all()){
        const run=JSON.parse(String(row.value)); const last=research.db.prepare('SELECT seq,value FROM events WHERE run_id=? ORDER BY seq DESC LIMIT 1').get(row.id);
        add(adapter,run.id,run.updated_at,run.status,{eventCount:Number(last?.seq||0),digest:last?JSON.parse(String(last.value)).hash:null,costUsd:run.usage?.cost_usd??null,costBasis:run.usage?.cost_usd==null?'unknown':run.usage?.estimated?'estimated':'metered'});
      }
    }else if(adapter==='rsi'){
      const dir=path.join(root,'data','rsi');available=existsSync(dir);
      if(available)for(const id of readdirSync(dir).filter(id=>UUID.test(id)).slice(-100)){
        const run=readJson(path.join(dir,id,'state.json'));if(!run)continue;
        const events=path.join(dir,id,'events.jsonl');const lines=existsSync(events)&&statSync(events).size<=8_000_000?readFileSync(events,'utf8').trim().split('\n').filter(Boolean):[];
        add(adapter,run.id,run.updatedAt,run.status,{eventCount:lines.length,digest:lines.length?textHash(lines.at(-1)!):null,costUsd:run.usage?.costUsd??null,costBasis:run.usage?.costUsd==null?'unknown':run.usage?.estimated?'estimated':'metered'});
      }
    }else if(adapter==='hybrid'){
      const data=readJson(path.join(root,'.quanta','hybrid-cloud.json'));available=!!data;
      for(const job of data?.jobs?.slice(-100)||[])add(adapter,job.id,job.completedAt||job.createdAt,job.status,{digest:job.resultHash||job.requestHash||null,costUsd:job.estimatedUpperBoundUsd??null,costBasis:'reservation'});
    }else if(adapter==='inference'){
      const data=readJson(path.join(root,'.quanta','gateway-policy.json'));available=!!data;
      for(const item of data?.records?.slice(-100)||[])add(adapter,item.id,item.at,item.status,{costUsd:item.reservedUsd??null,costBasis:'reservation'});
    }else if(adapter==='hermes'){
      const data=readJson(path.join(root,'.quanta','hermes','sessions.json'));available=!!data;
      for(const session of Array.isArray(data)?data.slice(-100):[])add(adapter,session.id,new Date(session.updatedAt||0).toISOString(),session.running?'running':session.error?'error':'idle',{eventCount:session.activity?.length||0});
    }else if(adapter==='memory'){
      const file=path.join(root,'.quanta','memory-v2','ledger.sqlite');available=existsSync(file);
      if(available){const db=new DatabaseSync(file,{readOnly:true});try{for(const row of db.prepare("SELECT id,json_extract(value,'$.at') AS at,json_extract(value,'$.action') AS action,json_extract(value,'$.contentSha256') AS digest FROM events ORDER BY rowid DESC LIMIT 100").all())add(adapter,row.id,row.at,row.action,{digest:typeof row.digest==='string'?row.digest:null,eventCount:1});}finally{db.close();}}
    }else if(adapter==='qs-bridge'){
      available=true;
      for(const record of evidence.list<any>('qs-observation',100))add(adapter,record.id,record.at,record.status,{eventCount:1,digest:record.digest,correlationId:record.correlationId,correlationBasis:'captured',latencyMs:record.latencyMs});
    }else if(adapter==='work-zone'){
      const data=readJson(path.join(root,'.quanta','operator-workzones.json'));available=!!data;
      for(const value of Object.values(data||{}) as any[])for(const delivery of value.deliveries?.slice(-100)||[])add(adapter,delivery.id,delivery.reviewedAt||delivery.createdAt,delivery.status,{digest:delivery.evidenceSha256||null});
    }
    sources.push({adapter,state:available?'available':'missing',note:available?'Read-only metadata projection; source contents omitted.':'No local journal at the expected location.'});
  }catch{sources.push({adapter,state:'unavailable',note:'Source could not be read within the bounded metadata contract. Existing data was preserved.'});}}
  return {journals:journals.sort((a,b)=>b.at.localeCompare(a.at)).slice(0,400),sources};
}
