import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=process.argv[2];
if(!source||!path.isAbsolute(source)||!fs.existsSync(path.join(source,'src','App.tsx')))throw new Error('Pass the absolute path to a local LostAssets source checkout.');
const dependencies=path.join(source,'node_modules');
if(!fs.existsSync(path.join(dependencies,'vite','bin','vite.js')))throw new Error('Install the LostAssets frontend dependencies in its checkout first.');
const workspace=path.join(root,'.quanta','lost-assets-build',String(Date.now()));
const output=path.join(root,'.quanta','lost-assets-app');
fs.mkdirSync(workspace,{recursive:true});fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(workspace,'package.json'),JSON.stringify({private:true,type:'module'}));
function copyTree(from,to){
  fs.mkdirSync(to,{recursive:true});
  for(const entry of fs.readdirSync(from,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw new Error('Source symlinks are not accepted in the frontend package.');
    const input=path.join(from,entry.name),target=path.join(to,entry.name);
    if(entry.isDirectory())copyTree(input,target);else if(entry.isFile())fs.copyFileSync(input,target);
  }
}
copyTree(path.join(source,'src'),path.join(workspace,'src'));
// Reuse Quanta's installed Herald interface and native Hermes APIs inside LA Plus.
const heraldDirectory=path.join(workspace,'src','components','herald');
fs.mkdirSync(heraldDirectory,{recursive:true});
for(const name of ['SpacePages.tsx','theme.ts','themes.ts','wallpaper.ts','hermes.css','hermes-avatar.jpg','LICENSE'])fs.copyFileSync(path.join(root,'components','herald',name),path.join(heraldDirectory,name));
let herald=fs.readFileSync(path.join(root,'components','HermesWorkspace.tsx'),'utf8');
herald=herald.replace('GnoesisQuanta Intelligence','Herald OS · Lost Assets').replace("initial : 'overview';","initial : 'missions';");
fs.writeFileSync(path.join(workspace,'src','components','HermesWorkspace.tsx'),herald);
for(const [name,view,label] of [['CodingAgentsPage','coding','Coding agents'],['ClipStudio','clips','Clip Studio']])fs.writeFileSync(path.join(heraldDirectory,name+'.tsx'),`export function ${name}(_props:any){return <section className="h-space-page"><h2>${label}</h2><p>This uses the existing Quanta workspace.</p><a className="h-button" href="/#/hermes?view=${view}" target="_top">Open ${label} in Quanta →</a></section>;}\n`);
const cssFile=path.join(workspace,'src','index.css');
fs.writeFileSync(cssFile,fs.readFileSync(cssFile,'utf8').replace(/@import url\([^)]*\);\s*/g,'').replace('@import "tailwindcss";','@import "tailwindcss" source(none);\n@source "./**/*.{tsx,ts,jsx,js}";'));
const browserDbFile=path.join(workspace,'src','lib','db.ts');
fs.writeFileSync(browserDbFile,fs.readFileSync(browserDbFile,'utf8').replace('https://sql.js.org/dist/${file}','/api/lost-assets/app/${file}'));
fs.writeFileSync(path.join(workspace,'src','components','TraceConsole.tsx'),"export function TraceConsole(){return <section className=\"rounded-xl border border-slate-700 p-8\"><h2 className=\"text-2xl font-bold\">Trace & relationship verification</h2><p className=\"mt-4 text-slate-400\">No live OSINT adapter is configured. Review imported Person Records, Asset Person Links and Evidence Log in Quanta’s Claims & evidence tab. No simulated matches or contact details are generated.</p></section>;}\n");
const intakeFile=path.join(workspace,'src','components','ClientIntake.tsx');
fs.writeFileSync(intakeFile,[
  "import {useState} from 'react';",
  "export function ClientIntake({onWorkflowComplete}:{onWorkflowComplete?:(draft:any)=>void}){",
  "const [name,setName]=useState(''),[email,setEmail]=useState(''),[notes,setNotes]=useState(''),[message,setMessage]=useState('');",
  "function save(event:React.FormEvent){event.preventDefault();try{const key='quanta_la_plus_intake_drafts';const drafts=JSON.parse(localStorage.getItem(key)||'[]');const draft={id:crypto.randomUUID(),name:name.trim(),email:email.trim(),notes:notes.trim(),status:'Draft · unverified',createdAt:new Date().toISOString()};localStorage.setItem(key,JSON.stringify([draft,...drafts]));onWorkflowComplete?.(draft);setMessage('Draft saved in this browser. No claim, contract or message was submitted.');}catch{setMessage('Browser storage is unavailable. The draft was not saved.')}}",
  "return <section className=\"mx-auto max-w-3xl space-y-6\"><div><p className=\"text-xs font-bold text-orange-400\">LOCAL RECOVERY WORKSPACE</p><h2 className=\"mt-3 text-3xl font-bold\">Start with verified evidence.</h2><p className=\"mt-3 text-sm leading-7 text-slate-400\">Search your connected property records in Search Workbench or Database Explorer. Review workbook cases and person-to-asset evidence in Quanta’s Claims & evidence tab before choosing a claimant.</p></div><form onSubmit={save} className=\"space-y-5 rounded-2xl border border-slate-700 p-6\"><h3 className=\"text-xl font-bold\">New intake draft</h3><p className=\"text-xs leading-6 text-slate-400\">Identity and ownership are unverified. Saving creates a local draft for human review.</p><label className=\"block text-sm\">Claimant or organization<input className=\"mt-2 block w-full rounded border border-slate-700 bg-slate-950 p-3\" value={name} required maxLength={200} onChange={event=>setName(event.target.value)}/></label><label className=\"block text-sm\">Contact email · optional<input className=\"mt-2 block w-full rounded border border-slate-700 bg-slate-950 p-3\" type=\"email\" value={email} maxLength={254} onChange={event=>setEmail(event.target.value)}/></label><label className=\"block text-sm\">Case notes and source identifiers<textarea className=\"mt-2 block w-full rounded border border-slate-700 bg-slate-950 p-3\" value={notes} maxLength={5000} onChange={event=>setNotes(event.target.value)}/></label><button className=\"rounded bg-orange-500 px-5 py-3 font-bold text-black\">Save local draft</button>{message&&<p role=\"status\" className=\"text-sm text-cyan-200\">{message}</p>}</form></section>;}",
].join('\n'));
for(const component of ['OutreachAndDataTools.tsx','CaliforniaSpecialTools.tsx']){
  const file=path.join(workspace,'src','components',component);
  fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/claimNumber: `[^`]*Math\.floor\(Math\.random\(\) \* 89999\) \+ 10000\}`/g,'claimNumber: "DRAFT — not submitted"'));
}
fs.copyFileSync(path.join(source,'index.html'),path.join(workspace,'index.html'));
fs.symlinkSync(dependencies,path.join(workspace,'node_modules'),'junction');
const services=path.join(workspace,'src','services');
fs.writeFileSync(path.join(services,'mockDataService.ts'),[
  "import type {AssetRecord,Relative,SearchQuery} from '../types';",
  "export const AVAILABLE_STATES=['CA','NV','OR','WA','AZ','UT','ID','CO','IL','WI','KY','TN','TX','NY','FL'];",
  "export const ASSET_TYPES:AssetRecord['type'][]=['Bank Account','Uncashed Check','Life Insurance','Utility Deposit','Safe Deposit Box'];",
  "async function local(path:string,body:unknown){const response=await fetch('/api/lost-assets/la-plus/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Quanta-Client':'local-ui'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.error?.message||'The local DuckDB request failed.');return data;}",
  "export async function searchLostAssets(query:SearchQuery):Promise<AssetRecord[]>{return (await local('search',query)).assets;}",
  "export async function trackRelatives(query:SearchQuery,state:string,assets:AssetRecord[]):Promise<Relative[]>{return (await local('relatives',{query,state,propertyIds:assets.map(asset=>asset.stateId)})).relatives;}",
].join('\n'));
fs.writeFileSync(path.join(services,'geminiService.ts'),"export async function generateOutreachEmail(..._args:unknown[]):Promise<string>{throw new Error('Cloud reasoning is not configured for this local recovery workspace. No record was sent to a provider.');}\n");
const explorer=[
  "import {useEffect,useState} from 'react';",
  "export function DatabaseExplorer(){",
  "const [query,setQuery]=useState(''),[scope,setScope]=useState('priority'),[rows,setRows]=useState<any[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);",
  "async function load(){setBusy(true);setMessage('');try{const response=await fetch('/api/lost-assets/la-plus/duckdb/records?'+new URLSearchParams({search:query,scope,limit:'50'}),{headers:{'X-Quanta-Client':'local-ui'}});const data=await response.json();if(!response.ok)throw new Error(data.error?.message||'Local query failed');setRows(data);}catch(error){setMessage(error instanceof Error?error.message:'Query failed')}finally{setBusy(false)}}",
  "useEffect(()=>{void load()},[scope]);",
  "return <section className=\"space-y-5\"><div><p className=\"text-xs text-orange-400\">QUANTA LOCAL DATA</p><h2 className=\"text-3xl font-bold\">DuckDB records</h2><p className=\"mt-2 text-sm text-slate-400\">Read your connected CSV files on this computer. Showing bounded results; full source totals have not been scanned.</p></div><form className=\"flex flex-wrap gap-3\" onSubmit={event=>{event.preventDefault();void load()}}><input className=\"rounded border border-slate-700 bg-slate-950 p-3\" value={query} onChange={event=>setQuery(event.target.value)} placeholder=\"Owner name or property ID\"/><select className=\"rounded border border-slate-700 bg-slate-950 p-3\" value={scope} onChange={event=>setScope(event.target.value)}><option value=\"priority\">From $500 to beyond</option><option value=\"all\">All records · large scan</option></select><button className=\"rounded bg-orange-500 px-5 py-3 font-bold text-black\" disabled={busy}>{busy?'Searching…':'Search local files'}</button></form>{message&&<p role=\"status\" className=\"text-amber-300\">{message}</p>}<p className=\"text-xs text-slate-400\">{rows.length} records shown · Original files are read-only</p><div className=\"overflow-auto\"><table className=\"w-full text-left text-sm\"><thead><tr>{['Property ID','Owner','Holder','Location','Cash balance'].map(title=><th key={title} className=\"p-3 text-slate-400\">{title}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.state_id} className=\"border-t border-slate-800\"><td className=\"p-3\">{row.state_id}</td><td className=\"p-3\">{row.first_name}</td><td className=\"p-3\">{row.company}</td><td className=\"p-3\">{row.location}</td><td className=\"p-3\">{Number(row.amount).toLocaleString('en-US',{style:'currency',currency:'USD'})}</td></tr>)}</tbody></table></div></section>;",
  "}",
].join('\n');
fs.writeFileSync(path.join(workspace,'src','components','DatabaseExplorer.tsx'),explorer);
// Source datasets, .env files, server tools and browser profiles are never packaged.
const appFile=path.join(workspace,'src','App.tsx');
let app=fs.readFileSync(appFile,'utf8');
app='import {HermesWorkspace} from "./components/HermesWorkspace";\n'+app;
if(!app.includes('<OutreachAndDataTools toolType="hermes" />'))throw new Error('LostAssets source no longer has the expected Hermes panel.');
app=app.replace('<OutreachAndDataTools toolType="hermes" />','<div style={{height:"max(760px, 85vh)"}}><HermesWorkspace /></div>');
app=app.replace('const [firstName, setFirstName] = useState("Thomson Diggs");','const [firstName, setFirstName] = useState("");').replace('const [lastName, setLastName] = useState("Company");','const [lastName, setLastName] = useState("");');
app=app.replace(/handleDraftEmail\(\{\s*id: "generic-heir",[\s\S]*?\}\);/, 'setDraftedEmail("Select a verified person from your workbook evidence before drafting outreach.");');
const supportedTabs=['client_intake','search_workbench','saved_cases','database_explorer','hermes'];
app=app.replace(/\{activeTab === "([^"]+)" && \(/g,(match,tab)=>supportedTabs.includes(tab)?match:'{false && (');
app=app.replace('{/* A) ACTIVE SUBAREA RENDER ROUTER */}',`{!${JSON.stringify(supportedTabs)}.includes(activeTab) && <section className="rounded-2xl border border-slate-700 p-8"><h2 className="text-2xl font-bold">Local setup required</h2><p className="mt-4 text-slate-400">This tool is not configured for local use. Your property records are available in Database Explorer. Prepared cases and evidence are in Quanta’s Claims &amp; evidence tab.</p></section>}\n{/* A) ACTIVE SUBAREA RENDER ROUTER */}`);
fs.writeFileSync(appFile,app);
let html=fs.readFileSync(path.join(workspace,'index.html'),'utf8');
html=html.replace('</head>','<script src="/api/lost-assets/app/quanta-bridge.js"></script><style>body{background:#071326!important;padding-top:34px}#quanta-local-banner{position:fixed;top:0;left:0;right:0;height:34px;z-index:999999;background:#0c223d;border-bottom:1px solid #f59e0b66;color:#cbd5e1;font:11px system-ui;display:flex;align-items:center;justify-content:center;gap:12px}.bg-neutral-950{background-color:#071326!important}</style></head>').replace('<body>','<body><div id="quanta-local-banner"><strong style="color:#fdba74">QUANTA · LOCAL LA PLUS</strong><span>DuckDB records · case drafts on this computer · external tools require setup</span></div>');
fs.writeFileSync(path.join(workspace,'index.html'),html);
const config="import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';import tailwind from '@tailwindcss/vite';import path from 'node:path';export default defineConfig({base:'/api/lost-assets/app/',plugins:[react(),tailwind()],css:{postcss:{plugins:[]}},define:{'process.env.GEMINI_API_KEY':JSON.stringify('')},resolve:{alias:{'@':path.resolve('src')}},build:{outDir:"+JSON.stringify(output)+",emptyOutDir:false,sourcemap:false}});";
fs.writeFileSync(path.join(workspace,'vite.config.ts'),config);
const result=spawnSync(process.execPath,[path.join(dependencies,'vite','bin','vite.js'),'build','--config',path.join(workspace,'vite.config.ts')],{cwd:workspace,stdio:'inherit',windowsHide:true});
if(result.status!==0)throw new Error('Local LA Plus build failed.');
fs.copyFileSync(path.join(dependencies,'sql.js','dist','sql-wasm.wasm'),path.join(output,'sql-wasm.wasm'));
fs.copyFileSync(path.join(root,'components','herald','LICENSE'),path.join(output,'HERALD-LICENSE.txt'));
fs.writeFileSync(path.join(output,'quanta-bridge.js'),"(()=>{const original=window.fetch.bind(window);window.fetch=(input,init={})=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/api/')){if(!url.pathname.startsWith('/api/lost-assets/')&&!url.pathname.startsWith('/api/hermes/'))url.pathname='/api/lost-assets/la-plus/'+url.pathname.slice(5);const headers=new Headers(init.headers||{});headers.set('X-Quanta-Client','local-ui');return original(url.href,{...init,headers});}return original(input,init);};})();\n");
const commit=spawnSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).stdout?.trim()||null;
fs.writeFileSync(path.join(output,'integration.json'),JSON.stringify({sourceRepository:'GustheTrader/LostAssets',localSourceCommit:commit,builtAt:new Date().toISOString(),dataBundled:false,cloudInferenceConfigured:false,syntheticRelatives:false},null,2));
console.log(JSON.stringify({appReady:true,output,dataBundled:false,syntheticRelatives:false}));
