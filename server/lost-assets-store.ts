import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { open, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { LOST_ASSETS_INTEGRATION } from '../lib/lost-assets-integration';

export type WorkbookSlot = '051_250' | '251_500';
export type LostAssetsConfig = { duckdbPath: string; csvPath: string; archivePath: string; workbooks: Partial<Record<WorkbookSlot,string>> };
type Source = { id: string; kind: 'csv'|'archive'|'workbook'; path: string; label: string; tables: string[]; bytes: number; connectedAt: string; files?: string[]; sheets?: string[]; rowCounts?: Record<string,number>; columns?: Record<string,string[]> };
type Job = { id:string;kind:string;status:'running'|'complete'|'failed'|'interrupted';startedAt:string;finishedAt?:string;message?:string };
export const sqlText=(value:string)=>"'"+value.replace(/'/g,"''")+"'";
const ident=(value:string)=>'"'+value.replace(/"/g,'""')+'"';
const cashValueSql=(columns:string[])=>{
  const fields=['CURRENT_CASH_BALANCE','CASH_REPORTED'].filter(field=>columns.includes(field));
  if(!fields.length)return null;
  const values=fields.map(field=>"try_cast(regexp_replace(replace(cast("+ident(field)+" as varchar),'(','-'),'[$,[:space:])]', '', 'g') as decimal(24,2))");
  return values.length>1?'coalesce('+values.join(',')+')':values[0];
};
const rowCashValue=(row:Record<string,any>)=>{
  for(const field of ['CURRENT_CASH_BALANCE','CASH_REPORTED']){const raw=String(row[field]??'').trim();if(!raw)continue;const value=Number(raw.replace('(','-').replace(/[$,\s)]/g,''));if(Number.isFinite(value))return value;}
  return Number.NEGATIVE_INFINITY;
};
const message=(error:unknown)=>error instanceof Error?error.message:'Local data operation failed.';
const PROPERTY_COLUMNS=['PROPERTY_ID','PROPERTY_TYPE','CASH_REPORTED','SHARES_REPORTED','NAME_OF_SECURITIES_REPORTED','NO_OF_OWNERS','OWNER_NAME','OWNER_STREET_1','OWNER_STREET_2','OWNER_STREET_3','OWNER_CITY','OWNER_STATE','OWNER_ZIP','OWNER_COUNTRY_CODE','CURRENT_CASH_BALANCE','NUMBER_OF_PENDING_CLAIMS','NUMBER_OF_PAID_CLAIMS','HOLDER_NAME','HOLDER_STREET_1','HOLDER_STREET_2','HOLDER_STREET_3','HOLDER_CITY','HOLDER_STATE','HOLDER_ZIP','CUSIP'];
async function validatePropertyHeader(file:string){
  const handle=await open(file,'r');
  try{
    const buffer=Buffer.alloc(16384),result=await handle.read(buffer,0,buffer.length,0);
    const first=buffer.subarray(0,result.bytesRead).toString('utf8').replace(/^\uFEFF/,'').split(/\r?\n/)[0];
    const columns=first.split(',').map(value=>value.trim().replace(/^"|"$/g,''));
    if(JSON.stringify(columns)!==JSON.stringify(PROPERTY_COLUMNS))throw new Error('CSV schema differs from the 25-column property-record schema. Original file was preserved.');
  }finally{await handle.close();}
}
function propertyReader(files:string[]){
  const columns=PROPERTY_COLUMNS.map(column=>sqlText(column)+":'VARCHAR'").join(',');
  return 'read_csv(['+files.map(sqlText).join(',')+"], header=true, auto_detect=false, parallel=false, delim=',', quote='\"', escape='\"', columns={"+columns+'}, filename=true)';
}

function discoverDuckDb(){
  const candidates=[process.env.DUCKDB_PATH,...(process.env.PATH||'').split(path.delimiter).map(folder=>path.join(folder,'duckdb.exe'))].filter(Boolean) as string[];
  if(process.env.LOCALAPPDATA){
    const packages=path.join(process.env.LOCALAPPDATA,'Microsoft','WinGet','Packages');
    try{for(const name of readdirSync(packages))if(name.toLowerCase().startsWith('duckdb.cli_'))candidates.push(path.join(packages,name,'duckdb.exe'));}catch{}
  }
  return candidates.find(candidate=>{try{return path.basename(candidate).toLowerCase()==='duckdb.exe'&&statSync(candidate).isFile();}catch{return false;}})||'';
}
export function absoluteFile(value:unknown,label:string,extension?:string){
  if(typeof value!=='string'||!value.trim()||value.length>4096||!path.isAbsolute(value.trim()))throw new Error(label+' must be a full local file path.');
  const file=path.resolve(value.trim());
  if(!existsSync(file)||!statSync(file).isFile()||(extension&&path.extname(file).toLowerCase()!==extension))throw new Error(label+' is not an available '+(extension||'local')+' file.');
  return file;
}
function processOutput(executable:string,args:string[],timeoutMs:number,maxBytes=8_000_000):Promise<string>{
  return new Promise((resolve,reject)=>{
    const child=spawn(executable,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
    let out='',err='',settled=false;
    const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(out);};
    const timer=setTimeout(()=>{child.kill();finish(new Error('The local data operation timed out. The original source files were preserved.'));},timeoutMs);
    child.stdout.on('data',chunk=>{out+=String(chunk);if(out.length>maxBytes){child.kill();finish(new Error('Query output exceeded the local result limit.'));}});
    child.stderr.on('data',chunk=>{err=(err+String(chunk)).slice(-3000);});
    child.on('error',()=>finish(new Error('The local executable could not be started.')));
    child.on('close',code=>finish(code===0?undefined:new Error(err.replace(/[\r\n]+/g,' ').slice(0,700)||'The local data operation failed.')));
  });
}
const jsonRows=(output:string):Record<string,any>[]=>{const parsed=JSON.parse(output.trim()||'[]');return Array.isArray(parsed)?parsed:[parsed];};

export class LostAssetsStore{
  readonly directory:string;
  readonly database:string;
  readonly appDirectory:string;
  private active=false;
  private queryQueue:Promise<unknown>=Promise.resolve();
  private pendingQueries=0;
  constructor(readonly root:string){
    this.directory=path.join(root,'data','lost-assets');
    this.database=path.join(this.directory,'lost-assets.duckdb');
    this.appDirectory=path.join(root,'.quanta','lost-assets-app');
    mkdirSync(this.directory,{recursive:true});
    mkdirSync(path.join(this.directory,'temp'),{recursive:true});
  }
  config():LostAssetsConfig{
    let saved:any={};try{saved=JSON.parse(readFileSync(path.join(this.directory,'config.json'),'utf8'));}catch{}
    return {duckdbPath:saved.duckdbPath||discoverDuckDb(),csvPath:saved.csvPath||'',archivePath:saved.archivePath||'',workbooks:saved.workbooks||{}};
  }
  private async saveJson(name:string,value:unknown){
    const file=path.join(this.directory,name),temp=file+'.'+crypto.randomUUID()+'.tmp';
    await writeFile(temp,JSON.stringify(value,null,2),{mode:0o600});await rename(temp,file);
  }
  async configure(input:any){
    if(this.active)throw new Error('Wait for the current source connection before changing paths.');
    const current=this.config();
    const config:LostAssetsConfig={
      duckdbPath:absoluteFile(input.duckdbPath||current.duckdbPath,'DuckDB executable','.exe'),
      csvPath:input.csvPath?absoluteFile(input.csvPath,'Records CSV','.csv'):'',
      archivePath:input.archivePath?absoluteFile(input.archivePath,'Records ZIP','.zip'):'',
      workbooks:{},
    };
    if(path.basename(config.duckdbPath).toLowerCase()!=='duckdb.exe')throw new Error('Choose duckdb.exe.');
    for(const slot of ['051_250','251_500'] as WorkbookSlot[])if(input.workbooks?.[slot])config.workbooks[slot]=absoluteFile(input.workbooks[slot],'Heir Recovery workbook','.xlsx');
    await this.saveJson('config.json',config);return config;
  }
  sources():Source[]{try{return JSON.parse(readFileSync(path.join(this.directory,'sources.json'),'utf8'));}catch{return [];}}
  private async record(source:Source){
    const sources=this.sources().filter(item=>item.id!==source.id);sources.push(source);await this.saveJson('sources.json',sources);
  }
  status(){
    let job:Job|null=null;try{job=JSON.parse(readFileSync(path.join(this.directory,'import-job.json'),'utf8'));}catch{}
    if(job?.status==='running'&&!this.active)job={...job,status:'interrupted',message:'The previous connector stopped. Original source files are intact; retry the connection.'};
    const sources=this.sources();
    return {localOnly:true,persistence:this.directory,database:existsSync(this.database),config:this.config(),sources,tables:sources.flatMap(source=>source.tables),job,searchPaused:this.active,appReady:existsSync(path.join(this.appDirectory,'index.html')),integration:LOST_ASSETS_INTEGRATION};
  }
  async sql(query:string,write=false,timeoutMs=120000){
    const config=this.config();
    if(!config.duckdbPath)throw new Error('DuckDB is not configured.');
    const prefix="SET memory_limit='768MB'; SET threads=2; SET temp_directory="+sqlText(path.join(this.directory,'temp'))+'; ';
    const args=['-json',...(write?[]:['-readonly']),this.database,'-c',prefix+query];
    if(this.pendingQueries>=5)throw new Error('The local data engine is busy. Retry after the current search.');
    this.pendingQueries++;
    const operation=this.queryQueue.catch(()=>{}).then(async()=>{
      const output=await processOutput(config.duckdbPath,args,timeoutMs);
      try{return jsonRows(output);}catch(error){if(write)return [];throw error;}
    });
    this.queryQueue=operation;
    try{return await operation;}finally{this.pendingQueries--;}
  }
  private async job(kind:string,work:()=>Promise<void>){
    if(this.active)throw new Error('Wait for the current source connection to finish.');
    this.active=true;
    const job:Job={id:crypto.randomUUID(),kind,status:'running',startedAt:new Date().toISOString()};
    await this.saveJson('import-job.json',job);
    try{await work();await this.saveJson('import-job.json',{...job,status:'complete',finishedAt:new Date().toISOString(),message:'Local source connected. DuckDB search is ready.'});}
    catch(error){await this.saveJson('import-job.json',{...job,status:'failed',finishedAt:new Date().toISOString(),message:message(error)});throw error;}
    finally{this.active=false;}
  }
  async connectCsv(){
    await this.job('csv',async()=>{
      const file=absoluteFile(this.config().csvPath,'Records CSV','.csv');
      await validatePropertyHeader(file);
      const current=await this.sql("SELECT table_type FROM information_schema.tables WHERE table_name='claims';",true);
      if(current.some(row=>row.table_type==='BASE TABLE'))throw new Error('A materialized claims table already exists. It was preserved; use a different database before replacing it with a view.');
      await this.sql('CREATE OR REPLACE VIEW claims AS SELECT * FROM '+propertyReader([file])+';',true);
      const schema=await this.sql('DESCRIBE claims;');
      await this.record({id:'master-csv',kind:'csv',path:file,label:'All records · file-backed view',tables:['claims'],bytes:statSync(file).size,connectedAt:new Date().toISOString(),columns:{claims:schema.map(row=>String(row.column_name))}});
    });
  }
  private sourceHelper(mode:'Archive'|'WorkbookSheets',source:string,destination?:string){
    // Run our bounded helper as a command; leave the machine's script policy unchanged.
    const literal=(value:string)=>"'"+value.replace(/'/g,"''")+"'";
    const script=readFileSync(path.join(this.root,'scripts','lost-assets-source.ps1'),'utf8');
    const command='& {\n'+script+'\n} -Mode '+literal(mode)+' -Source '+literal(source)+(destination?' -Destination '+literal(destination)+' -Root '+literal(this.root):'');
    return processOutput('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],mode==='Archive'?600000:60000,1_000_000);
  }
  async connectArchive(){
    await this.job('archive',async()=>{
      const file=absoluteFile(this.config().archivePath,'Records ZIP','.zip'),stat=statSync(file);
      const id=crypto.createHash('sha256').update(file+'|'+stat.size+'|'+stat.mtimeMs).digest('hex').slice(0,16);
      const destination=path.join(this.directory,'sources',id);
      const output=await this.sourceHelper('Archive',file,destination);
      const archive=JSON.parse(output.replace(/^\uFEFF/,'').trim()) as {files:{path:string;bytes:number}[]};
      const files=archive.files.map(item=>item.path);
      if(!files.length)throw new Error('No CSV entries were extracted.');
      for(const entry of files)await validatePropertyHeader(entry);
      await this.sql('CREATE OR REPLACE VIEW priority_claims AS SELECT * FROM '+propertyReader(files)+';',true);
      const schema=await this.sql('DESCRIBE priority_claims;');
      await this.record({id:'priority-archive',kind:'archive',path:file,label:'From $500 to beyond · 4-part source',tables:['priority_claims'],bytes:stat.size,files,connectedAt:new Date().toISOString(),columns:{priority_claims:schema.map(row=>String(row.column_name))}});
    });
  }
  async importWorkbook(slot:WorkbookSlot){
    if(!['051_250','251_500'].includes(slot))throw new Error('Choose a supported workbook range.');
    await this.job('workbook '+slot,async()=>{
      const file=absoluteFile(this.config().workbooks[slot],'Heir Recovery workbook','.xlsx');
      const output=await this.sourceHelper('WorkbookSheets',file);
      const names=(JSON.parse(output.replace(/^\uFEFF/,'').trim()).sheets||[]) as string[];
      const selected=names.filter(name=>['Asset_Cases','Person_Records','Asset_Person_Links','Evidence_Log','Review_Log'].includes(name)||/^Top\d+_\d+_View$/.test(name));
      if(!selected.includes('Asset_Cases'))throw new Error('Workbook is missing its Asset_Cases sheet.');
      const tables=selected.map(name=>'heir_'+slot+'_'+name.toLowerCase()),columns:Record<string,string[]>={},rowCounts:Record<string,number>={};
      let query='INSTALL excel; LOAD excel; BEGIN TRANSACTION; ';
      selected.forEach((sheet,index)=>{query+='CREATE OR REPLACE TABLE '+ident(tables[index])+' AS SELECT *, '+sqlText(path.basename(file))+' AS _quanta_source_file, '+sqlText(sheet)+' AS _quanta_source_sheet FROM read_xlsx('+sqlText(file)+', sheet='+sqlText(sheet)+", header=true, all_varchar=true); ";});
      query+='COMMIT;';
      await this.sql(query,true,240000);
      for(const table of tables){columns[table]=(await this.sql('DESCRIBE '+ident(table)+';')).map(row=>String(row.column_name));rowCounts[table]=Number((await this.sql('SELECT COUNT(*) AS n FROM '+ident(table)+';'))[0]?.n||0);}
      await this.record({id:'workbook-'+slot,kind:'workbook',path:file,label:'Heir Recovery ranks '+slot.replace('_','–'),tables,sheets:selected,bytes:statSync(file).size,rowCounts,columns,connectedAt:new Date().toISOString()});
    });
  }
  private selectedTables(scope:string){
    const tables=this.sources().flatMap(source=>source.tables);
    if(scope==='all')return tables.includes('claims')?['claims']:[];
    if(scope==='prepared')return tables.filter(table=>table.endsWith('_asset_cases'));
    if(scope==='evidence')return tables.filter(table=>/_person_records$|_asset_person_links$|_evidence_log$|_review_log$/.test(table));
    return tables.includes('priority_claims')?['priority_claims']:tables.filter(table=>table.endsWith('_asset_cases'));
  }
  async search(query:string,scope='priority',limit=20){
    if(this.active)throw new Error('Search is paused while the source connection completes.');
    const text=query.trim().slice(0,200),results:{table:string;row:Record<string,any>}[]=[];
    if(!text)throw new Error('Enter a name, property ID or case identifier.');
    for(const table of this.selectedTables(scope)){
      const source=this.sources().find(item=>item.tables.includes(table));
      let columns=source?.columns?.[table]||[];
      if(!columns.length)columns=(await this.sql('DESCRIBE '+ident(table)+';')).map(row=>String(row.column_name));
      const preferred=columns.filter(column=>/OWNER_NAME|PROPERTY_ID|name|case.?id|person.?id|asset.?id|holder/i.test(column)&&!column.startsWith('_quanta'));
      const where=(preferred.length?preferred:columns.filter(column=>!column.startsWith('_quanta'))).map(column=>'contains(lower(coalesce(cast('+ident(column)+" as varchar),'')),lower("+sqlText(text)+'))').join(' OR ');
      if(!where)continue;
      const cash=cashValueSql(columns);
      const rows=await this.sql('SELECT * FROM '+ident(table)+' WHERE '+where+(cash?' ORDER BY '+cash+' DESC NULLS LAST'+(columns.includes('PROPERTY_ID')?', PROPERTY_ID ASC':''):'')+' LIMIT '+Math.min(limit,100)+';');
      rows.forEach(row=>results.push({table,row}));
    }
    return results.sort((a,b)=>rowCashValue(b.row)-rowCashValue(a.row)).slice(0,100);
  }
  async records(options:{search?:string;state?:string;highValue?:boolean;limit?:number;scope?:string}={}){
    if(this.active)throw new Error('Source connection is in progress.');
    const tables=this.selectedTables(options.scope||'priority').filter(table=>table==='claims'||table==='priority_claims');
    if(!tables.length)return [];
    const table=tables[0],where:string[]=[];
    const tokens=(options.search||'').trim().slice(0,200).split(/\s+/).filter(Boolean);
    tokens.forEach(token=>where.push('(contains(lower(OWNER_NAME),lower('+sqlText(token)+')) OR PROPERTY_ID='+sqlText(token)+')'));
    if(options.state)where.push('upper(OWNER_STATE)='+sqlText(options.state.toUpperCase().slice(0,2)));
    if(options.highValue)where.push("try_cast(regexp_replace(CURRENT_CASH_BALANCE,'[$,]','','g') as double)>=500");
    const cash=cashValueSql(PROPERTY_COLUMNS)!;
    const rows=await this.sql('SELECT * FROM '+ident(table)+(where.length?' WHERE '+where.join(' AND '):'')+' ORDER BY '+cash+' DESC NULLS LAST, PROPERTY_ID ASC LIMIT '+Math.max(1,Math.min(Number(options.limit)||100,500))+';');
    return rows.map((row,index)=>{
      const amount=Number(String(row.CURRENT_CASH_BALANCE||row.CASH_REPORTED||'0').replace(/[$,]/g,''))||0;
      return {id:index+1,first_name:String(row.OWNER_NAME||''),last_name:'',state:String(row.OWNER_STATE||''),property_type:String(row.PROPERTY_TYPE||''),amount,company:String(row.HOLDER_NAME||''),location:[row.OWNER_STREET_1,row.OWNER_CITY,row.OWNER_STATE,row.OWNER_ZIP].filter(Boolean).join(', '),state_id:String(row.PROPERTY_ID||''),category_id:'1',category_title:'Local unclaimed-property records',sub_type:String(row.PROPERTY_TYPE||''),source:'DuckDB · '+path.basename(String(row.filename||this.sources().find(source=>source.tables.includes(table))?.path||'')),scraped_at:null};
    });
  }
  async prepared(){
    const result=[];
    for(const table of this.selectedTables('prepared')){
      const source=this.sources().find(item=>item.tables.includes(table));
      result.push({table,source:source?.label,rows:await this.sql('SELECT * FROM '+ident(table)+' LIMIT 500;')});
    }
    return result;
  }
}
