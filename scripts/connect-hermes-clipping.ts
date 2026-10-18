// Register the local clipping tools in each native Hermes profile. Existing connectors are preserved.
import { readFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const token = readFileSync(path.join(root, '.quanta', 'hermes', 'gateway-token'), 'utf8').trim();
const socket = new WebSocket(`ws://127.0.0.1:${Number(process.env.GNOESIS_HERMES_PORT || 9120)}/api/ws?token=${encodeURIComponent(token)}`);
const pending = new Map<string, {resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
let readyResolve:()=>void; const ready = new Promise<void>(resolve => { readyResolve=resolve; });
socket.addEventListener('message', event => {
  for (const line of String(event.data).split('\n').filter(Boolean)) {
    let frame:any; try { frame=JSON.parse(line); } catch { continue; }
    if (frame.method==='event' && frame.params?.type==='gateway.ready') readyResolve();
    if (frame.method) continue; const request=pending.get(String(frame.id)); if (!request) continue;
    clearTimeout(request.timer); pending.delete(String(frame.id)); frame.error ? request.reject(new Error(frame.error.message)) : request.resolve(frame.result);
  }
});
socket.addEventListener('close',()=>{ for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('Hermes disconnected.'));}pending.clear();});
const rpc=(method:string,params:Record<string,unknown>)=>new Promise<any>((resolve,reject)=>{const id=randomUUID();const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Hermes configuration timed out.'));},60000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({jsonrpc:'2.0',id,method,params}));});
let timeout:ReturnType<typeof setTimeout>;
try {
  if (!existsSync(path.join(root,'.quanta','clipping','agent-capabilities.json'))) throw new Error('Start the updated QuantaCore backend before registering clipping tools.');
  await Promise.race([ready,new Promise<void>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Start Hermes first.')),20000);})]); clearTimeout(timeout!);
  const backup=path.join(root,'.quanta','hermes','clipping-backup'); mkdirSync(backup,{recursive:true});
  for(const space of ['work','personal','ideas']) {
    const profile='gnoesis-'+space; const servers=await rpc('mcp.servers.list',{profile});
    const existing=servers.servers?.find((server:any)=>server.name==='clip-studio');
    if (!existing) {
      const config=path.join(process.env.LOCALAPPDATA || '', 'hermes','profiles',profile,'config.yaml');
      if(existsSync(config))copyFileSync(config,path.join(backup,`${space}-${Date.now()}.yaml`));
      await rpc('mcp.servers.add',{profile,name:'clip-studio',config:{command:process.execPath,args:[path.join(root,'scripts','clipping-tools.mjs'),'--space',space],trust:'untrusted',timeout:90}});
    }
    console.log(JSON.stringify({profile,configured:true,approval:'native per-call',capabilities:'space-scoped media metadata, transcript excerpts, draft proposals and local jobs; no publishing'}));
  }
} catch(error) {console.error((error as Error).message);process.exitCode=1;}
finally {clearTimeout(timeout!);socket.close();}
