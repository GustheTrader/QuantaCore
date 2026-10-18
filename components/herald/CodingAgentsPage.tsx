import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import {ProviderWebTabs} from './ProviderWebTabs';

type Session={id:string;agent:string;workspace:string;scope:string;purpose:string;running:boolean;intelligence:boolean;exitCode?:number};
type Agent={id:string;label:string;installed:boolean;kind:string;authentication:string};
async function codingApi(workspace:string,endpoint='',method='GET',body?:unknown){
  const token=localStorage.getItem('qs_api_token');
  const response=await fetch(`/api/hermes/${workspace}/coding${endpoint}`,{method,headers:{'Content-Type':'application/json','X-Quanta-Client':'local-ui',...(token?{'X-QS-Token':token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await response.json();if(!response.ok)throw new Error(result.error?.message||result.detail||'Coding agent request failed.');return result;
}
export function AgentTerminal({workspace,session,onError}:{workspace:string;session:Session;onError:(error:string)=>void}){
  const container=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!container.current)return;
    const terminal=new Terminal({screenReaderMode:true,cursorBlink:true,convertEol:false,fontSize:13,fontFamily:'Consolas, monospace',scrollback:4000,theme:{background:'#081125',foreground:'#dce7ff',cursor:'#7daaff'},cols:100,rows:30});
    terminal.open(container.current);terminal.textarea?.setAttribute('aria-label',`${session.agent} terminal input`);let stale=false;let seq=0;let timer:ReturnType<typeof setTimeout>;let queue=Promise.resolve();
    const input=terminal.onData(data=>{queue=queue.then(async()=>{if(!stale)await codingApi(workspace,`/${session.id}/input`,'POST',{data});}).catch(error=>{if(!stale)onError(error.message);});});
    const fit=()=>{if(!container.current)return;const rect=container.current.getBoundingClientRect();const cols=Math.max(40,Math.min(240,Math.floor(rect.width/8)));const rows=Math.max(10,Math.min(100,Math.floor(rect.height/16)));terminal.resize(cols,rows);void codingApi(workspace,`/${session.id}/resize`,'POST',{cols,rows}).catch(()=>{});};
    const observer=new ResizeObserver(fit);observer.observe(container.current);fit();
    const poll=async()=>{try{const output=await codingApi(workspace,`/${session.id}/output?after=${seq}`);if(stale)return;if(output.truncated)terminal.write('\r\n[Earlier terminal output expired]\r\n');for(const chunk of output.chunks)terminal.write(chunk.data);seq=output.seq;}catch(error){if(!stale)onError((error as Error).message);}if(!stale)timer=setTimeout(poll,500);};void poll();terminal.focus();
    return()=>{stale=true;clearTimeout(timer);observer.disconnect();input.dispose();terminal.dispose();};
  },[workspace,session.id]);
  return <div className="h-agent-terminal h-[320px] min-h-[320px]" ref={container} aria-label={`${session.agent} embedded terminal`}/>;
}
export function CodingAgentsPage({workspace,initialSurface='web'}:{workspace:string;initialSurface?:'web'|'terminal'}){
  const [surface,setSurface]=useState<'web'|'terminal'>(initialSurface);
  const [agents,setAgents]=useState<Agent[]>([]);const [sessions,setSessions]=useState<Session[]>([]);const [active,setActive]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [scope,setScope]=useState('space');const [intelligence,setIntelligence]=useState(false);
  useEffect(()=>{let stale=false;let timer:ReturnType<typeof setTimeout>;setActive('');setError('');const poll=async()=>{try{const data=await codingApi(workspace);if(!stale){setAgents(data.agents);setSessions(data.sessions);}}catch(error){if(!stale)setError((error as Error).message);}if(!stale)timer=setTimeout(poll,2000);};void poll();return()=>{stale=true;clearTimeout(timer);};},[workspace]);
  async function launch(agent:string,purpose:string){setBusy(true);setError('');try{const session=await codingApi(workspace,'','POST',{agent,purpose,scope,intelligence});setSessions(previous=>[...previous,session]);setActive(session.id);}catch(error){setError((error as Error).message);}finally{setBusy(false);}}
  const selected=sessions.find(s=>s.id===active);const labels:Record<string,string>=Object.fromEntries(agents.map(a=>[a.id,a.label]));
  return <div className="h-space-page h-coding-page"><header><div className="h-eyebrow">{workspace} space · agent modules</div><h1>Coding agents</h1><p>Your coding agents, inside one workspace. Native authentication stays on this computer.</p></header>
    <div className="h-tabs"><button aria-pressed={surface==="web"} onClick={()=>setSurface("web")}>Web pages</button><button aria-pressed={surface==="terminal"} onClick={()=>setSurface("terminal")}>Coding terminals</button></div>{surface==="web" ? <ProviderWebTabs workspace={workspace}/> : <><div className="h-agent-controls"><label>Project scope <select value={scope} onChange={e=>setScope(e.target.value)}><option value="space">Current space files</option><option value="app">QuantaCore application and backend</option></select></label><label><input type="checkbox" checked={intelligence} onChange={e=>setIntelligence(e.target.checked)}/> Attach local intelligence (read access)</label></div>
    <p className="h-agent-custody">Your data and records stay local. A cloud agent sends prompts and context it reads to its provider. Attaching intelligence grants access to this space’s memory, mission summaries, filenames and conversation titles. Native agent permissions still apply; project scope is a working directory, not isolation.</p>
    {error&&<p role="alert" className="h-error">{error}</p>}
    <div className="h-agent-catalog">{agents.map(agent=><section className="h-surface" key={agent.id}><h3>{agent.label}</h3><small>{agent.installed?'Installed':'Not installed'} · {agent.kind}</small><p>Sign in once using the native flow. Saved credentials are reused until the provider requires renewal.</p><div><button className="h-button" disabled={busy||!agent.installed} onClick={()=>void launch(agent.id,'auth')}>{agent.id==='grok'||agent.id==='goose'?'Configure provider':'Sign in / authenticate'}</button><button className="h-button" disabled={busy||!agent.installed} onClick={()=>void launch(agent.id,'work')}>Open agent ↗</button></div></section>)}</div>
    <div className="h-tabs h-agent-tabs" role="tablist" aria-label="Coding agent sessions">{sessions.map((session,index)=><button role="tab" aria-selected={active===session.id} aria-pressed={active===session.id} key={session.id} onClick={()=>setActive(session.id)}>{labels[session.agent]||session.agent} {index+1} · {session.running?'Active':'Exited'}</button>)}</div>
    {selected?<section className="h-agent-console"><header><span>{labels[selected.agent]} · {selected.purpose==='auth'?'Authentication':selected.scope==='app'?'QuantaCore':'Space files'} · Intelligence {selected.intelligence?'attached':'detached'}</span><button className="h-button" disabled={!selected.running||busy} onClick={async()=>{try{await codingApi(workspace,`/${selected.id}/stop`,'POST',{});}catch(error){setError((error as Error).message);}}}>Stop session</button></header><AgentTerminal workspace={workspace} session={selected} onError={setError}/></section>:<section className="h-surface"><h2>Choose an agent to start</h2><p>Live sessions continue when you switch pages. Credentials remain in the agent’s native local credential store. App restarts end live terminals; start the agent again to resume using its native history.</p></section>}
    <p>No sign-in passwords or terminal transcripts are stored by this page. The provider CLI may keep its own local session history. Use the native approval prompts shown in the terminal.</p></>}
  </div>;
}
