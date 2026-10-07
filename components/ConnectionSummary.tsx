import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadProviderConnections, loadLocalRuntime } from '../services/inferenceService';
import { getProviderDefinition } from '../lib/inference-providers';
import { logConnection, readConnectionLog, type ConnectionEvent } from '../services/connectionLog';
export default function ConnectionSummary({ onSetup }: { onSetup?: () => void } = {}) {
  const [entries, setEntries] = useState<ConnectionEvent[]>(readConnectionLog);
  const [rows, setRows] = useState<{ name: string; status: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState('');
  const check = async () => {
    setBusy(true);
    const account = async () => { const response = await fetch('/api/chatgpt/status', {headers:{'X-Quanta-Client':'local-ui'},signal:AbortSignal.timeout(15000)}); if(!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Account status unavailable'); return response.json(); };
    const results = await Promise.allSettled([loadProviderConnections(), loadLocalRuntime(), account()]);
    const next: { name: string; status: string }[] = [];
    if(results[0].status === 'fulfilled') { const config=results[0].value; const route=config.connections.find(c=>c.id===config.preferredProvider); next.push({name:'Quanta backend',status:'Responding'}); next.push({name:'Selected text model',status:route?.model ? (getProviderDefinition(route.id)?.label || route.id)+' · '+route.model+' · configured, reply not checked' : 'Not configured'}); }
    else next.push({name:'Quanta backend',status:'Unavailable · open setup'});
    if(results[1].status === 'fulfilled') for(const service of results[1].value.services) next.push({name:service.label,status:service.status === 'responding' ? 'HTTP responding · task not tested' : service.status === 'authentication-required' ? 'Reachable · sign-in required' : 'Unavailable'});
    else next.push({name:'Local services',status:'Status check unavailable'});
    if(results[2].status === 'fulfilled') { const accountStatus = results[2].value; next.push({name:'ChatGPT plan',status:accountStatus.accounts?.some((a: any) => a.id === accountStatus.activeAccountId && a.connected && a.planUsageEnabled) ? 'Account authorized · separate plan route' : 'Sign-in or plan authorization needed'}); }
    else next.push({name:'ChatGPT plan',status:'Status check unavailable'});
    for(const row of next) logConnection(row.name, row.status.startsWith('Unavailable') ? 'unavailable' : 'checked',row.status);
    setRows(next); setChecked(new Date().toLocaleTimeString()); setBusy(false);
  };
  useEffect(()=> { const update=()=>setEntries(readConnectionLog()); window.addEventListener('quanta_connection_log',update); void check(); return ()=>window.removeEventListener('quanta_connection_log',update); },[]);
  const download = () => { const blob=new Blob([JSON.stringify(readConnectionLog(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='quanta-connection-log.json';a.click();URL.revokeObjectURL(url); };
  return <section aria-label="Connections and running services" className="rounded-2xl border border-cyan-400/30 bg-slate-950/60 p-5 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-white">Your system · before launching an agent</h2><p className="mt-1 text-xs text-slate-400">{busy ? 'Checking saved connections and service availability…' : 'Checked '+checked+' · no model calls or agents started'}</p></div><div className="flex gap-3 text-sm"><button disabled={busy} onClick={check} className="text-cyan-300 disabled:opacity-40">Refresh status</button><Link to="/startup" onClick={onSetup} className="text-cyan-300">Connect / fix →</Link></div></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{rows.map(row=><div key={row.name} className="rounded-xl border border-slate-700 px-3 py-3"><p className="text-sm text-white">{row.name}</p><p className="mt-1 text-xs text-slate-300">{row.status}</p></div>)}</div><details><summary className="cursor-pointer text-sm text-cyan-200">Connection log · {entries.length} recent events</summary><p className="my-3 text-xs text-slate-400">Stored in this browser. Historical checks are not live readiness. No keys, tokens, account emails or prompts are logged.</p><button onClick={download} className="mb-3 text-xs text-cyan-300">Download log</button><div className="max-h-64 overflow-auto space-y-2">{entries.slice().reverse().map((e,i)=><div key={e.at+i} className="border-b border-slate-800 pb-2 text-xs text-slate-300"><time className="text-slate-500">{new Date(e.at).toLocaleString()}</time> · {e.source} · {e.status}<p className="mt-1">{e.detail}</p></div>)}</div></details></section>;
}
