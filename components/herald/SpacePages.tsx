import { useEffect, useState } from 'react';

export function SpacePages({ page, workspace, sessions, connected, navigate, resume, ask }: {
  page: string; workspace: string; sessions: any[]; connected: boolean;
  navigate: (page: any) => void; resume: (id: string) => void; ask: (text: string) => void;
}) {
  const [data, setData] = useState<any>({});
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [schedule, setSchedule] = useState('');
  const [filePath, setFilePath] = useState('');
  const [loading, setLoading] = useState(false);
  async function request(method = 'GET', body?: unknown) {
    const token = localStorage.getItem('qs_api_token');
    const response = await fetch(`/api/hermes/${workspace}/${page}${page === 'files' ? '?path=' + encodeURIComponent(filePath) : ''}`, {
      method, headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui', ...(token ? { 'X-QS-Token': token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || result.detail || 'Could not load this page.');
    return result;
  }
  useEffect(() => {
    let stale = false;
    setData({}); setError(''); setLoading(true);
    if (page === 'overview') { setLoading(false); return; }
    request().then(result => { if (!stale) setData(result); }).catch(cause => { if (!stale) setError(cause.message); }).finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [page, workspace, filePath]);
  async function mutate(body: unknown) {
    setLoading(true); setError('');
    try { await request('POST', body); setData(await request()); setTitle(''); setPrompt(''); }
    catch (cause) { setError((cause as Error).message); }
    finally { setLoading(false); }
  }
  return <div className="h-space-page">
    <header><div className="h-eyebrow">{workspace} space</div><h1>{page.charAt(0).toUpperCase() + page.slice(1)}</h1><p>{({ overview: 'Pick up where you left off.', missions: 'Give your work a direction. Plan a mission, then work with Hermes.', memory: 'What Hermes remembers about you and your work.', files: 'Documents and outputs in this space.', automations: 'Work that runs on your schedule.', connections: 'Tools and accounts available to this Hermes profile.' } as Record<string,string>)[page]}</p></header>
    {error && <p className="h-error" role="alert">{error}</p>}{loading && <p role="status">Loading…</p>}
    {page === 'overview' && <><div className="h-dashboard-grid"><section className="h-surface"><h2>Working with you</h2><p>{connected ? 'Hermes is connected and ready.' : 'Hermes is offline. Start the runtime to continue.'}</p><button className="h-button" onClick={() => ask('Help me plan my day and identify the next useful step.')}>Plan my day ↗</button></section><section className="h-surface"><h2>Your space</h2><p>{sessions.length} conversations · {sessions.filter(s => s.running).length} running</p><div className="h-quick-links">{['missions','memory','files','automations','connections'].map(item => <button className="h-button" key={item} onClick={() => navigate(item)}>{item}</button>)}</div></section></div><h2>Pick up where you left off</h2><div className="h-dashboard-grid">{sessions.slice(0, 6).map(session => <button className="h-surface h-resume" key={session.id} onClick={() => resume(session.id)}><h3>{session.title}</h3><p>{session.messages.at(-1)?.content?.slice(0, 170) || 'Start the conversation.'}</p><small>{session.running ? 'Working…' : 'Continue conversation ↗'}</small></button>)}</div>{!sessions.length && <p>No recent conversations in this space.</p>}</>}
    {page === 'missions' && <><form className="h-editor" onSubmit={e => { e.preventDefault(); void mutate({ title, prompt }); }}><input aria-label="Mission title" placeholder="Mission title" value={title} onChange={e => setTitle(e.target.value)} required maxLength={200}/><textarea aria-label="Mission brief" placeholder="What do you want to accomplish?" value={prompt} onChange={e => setPrompt(e.target.value)}/><button className="h-button" disabled={loading}>Create mission</button></form><div className="h-dashboard-grid">{data.missions?.map((mission: any) => <section className="h-surface" key={mission.id}><small>Planned</small><h3>{mission.title}</h3><p>{mission.prompt}</p><button className="h-button" onClick={() => ask(`Mission: ${mission.title}\n${mission.prompt}\nHelp me plan and execute this mission, asking for approval when needed.`)}>Work with Hermes ↗</button></section>)}</div></>}
    {page === 'memory' && data.files?.map((file: any) => <section className="h-surface" key={file.name}><h2>{file.name === 'USER.md' ? 'About you' : 'Hermes memory'}</h2><pre>{file.content || 'No memory saved in this profile yet.'}</pre><button className="h-button" onClick={() => ask('Help me review and update my '+ file.name + ' memory. Ask which facts I want to save.')}>Review with Hermes</button></section>)}
    {page === 'files' && <><button className="h-button" onClick={() => setFilePath(filePath.split('/').slice(0,-1).join('/'))}>↑ Parent folder</button><p>{filePath || 'Space root'}</p>{data.entries?.map((file: any) => <button className="h-file-row" key={file.name} onClick={() => setFilePath([filePath,file.name].filter(Boolean).join('/'))}><span>{file.directory ? '▱' : '▤'}</span>{file.name}<span>↗</span></button>)}{data.entries?.length === 0 && <p>No files in this folder yet. Ask Hermes to create an output here.</p>}{data.content !== undefined && <pre className="h-surface">{data.content}</pre>}</>}
    {page === 'automations' && <><form className="h-editor" onSubmit={e => { e.preventDefault(); void mutate({ action:'add', name:title, prompt, schedule }); }}><input aria-label="Automation name" placeholder="Automation name" value={title} onChange={e => setTitle(e.target.value)} required/><input aria-label="Schedule" placeholder="Schedule, e.g. every 1h" value={schedule} onChange={e => setSchedule(e.target.value)} required/><textarea aria-label="Automation prompt" placeholder="What should Hermes do?" value={prompt} onChange={e => setPrompt(e.target.value)} required/><button className="h-button" disabled={loading || !connected}>Create automation</button></form><p>Scheduled runs use this profile’s model and permissions. Output stays local.</p>{data.jobs?.map((job: any) => <section className="h-surface" key={job.job_id}><h3>{job.name}</h3><p>{job.prompt_preview}</p><p>{job.schedule} · {job.enabled ? 'Enabled' : 'Paused'} · {job.last_status || 'No runs yet'}</p><button className="h-button" disabled={loading} onClick={() => void mutate({ action:job.enabled?'pause':'resume', name:job.job_id })}>{job.enabled?'Pause':'Resume'}</button></section>)}</>}
    {page === 'connections' && <><p>Connections belong to this profile. Work’s Zo account is not shared with Personal or Ideas.</p><div className="h-dashboard-grid">{data.servers?.map((server: any) => <section className="h-surface" key={server.name}><h2>{server.name === 'zo' ? 'Zo Computer' : server.name}</h2><p>{server.disabled ? 'Disabled' : server.connected ? 'Connected' : server.status} · {server.tools} tools</p><small>{server.transport} · {server.source}</small><p>Hermes requests approval for tools according to this connection’s trust policy.</p></section>)}</div>{data.servers?.length === 0 && <section className="h-surface"><h2>No connections yet</h2><p>This profile has no MCP connections configured.</p></section>}<section className="h-surface"><h2>Zo-connected accounts</h2><p>Gmail, Calendar and Drive account discovery and OpenHands remote orchestration are still being integrated.</p><button className="h-button" disabled={workspace !== 'work' || !connected} onClick={() => ask('Find the Zo tools for inspecting my connected apps. Ask for approval before querying Zo account metadata. Do not read emails or documents.')}>Inspect with Hermes ↗</button></section></>}
  </div>;
}
