import { useEffect, useRef, useState } from 'react';
import type { FormEvent, CSSProperties } from 'react';
import { paletteVars, wallpaperTint } from './herald/theme';
import { heraldThemes } from './herald/themes';
import { drawWallpaperFrame } from './herald/wallpaper';
import avatar from './herald/hermes-avatar.jpg';
import './herald/hermes.css';
import { SpacePages } from './herald/SpacePages';
import { CodingAgentsPage } from './herald/CodingAgentsPage';
import { ClipStudio } from './herald/ClipStudio';

type Workspace = 'work' | 'personal' | 'ideas';
interface Conversation {
  id: string; title: string; running: boolean; partial: string; error: string;
  messages: { role: string; content: string }[];
  attachments: { name: string }[];
  activity: { type: string; payload: Record<string, unknown> }[];
  pending: { id: string; method: string; params: { description?: string; command?: string; question?: string; choices?: string[]; questions?: { qid: string; question: string }[] } }[];
}
async function api<T>(endpoint: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const token = localStorage.getItem('qs_api_token');
  const response = await fetch('/api/hermes' + endpoint, {
    method, signal, headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui', ...(token ? { 'X-QS-Token': token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || result.detail || `Hermes request failed (${response.status}).`);
  return result;
}

export function HermesWorkspace() {
  const [themeName, setThemeName] = useState(() => localStorage.getItem('hermes-herald-theme') || 'herald-ocean');
  const [view, setView] = useState<'overview' | 'hermes' | 'missions' | 'memory' | 'files' | 'automations' | 'connections' | 'coding' | 'clips' | 'sessions' | 'activity' | 'settings'>(() => { const initial = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search).get('view'); return initial === 'clips' || initial === 'coding' || initial === 'connections' ? initial : 'overview'; });
  const [outputTab, setOutputTab] = useState<'preview' | 'activity'>('preview');
  const [collapsed, setCollapsed] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const theme = heraldThemes.find(t => t.name === themeName) || heraldThemes.find(t => t.name === 'herald-ocean')!;
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    let frame = 0; let last = 0; let phase = 18; const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const draw = () => {
      const box = node.getBoundingClientRect(); node.width = Math.max(1, Math.round(box.width * 0.5)); node.height = Math.max(1, Math.round(box.height * 0.5));
      const ctx = node.getContext('2d'); if (ctx) drawWallpaperFrame(ctx, node.width, node.height, phase, 0.5, wallpaperTint(theme.colors, theme.shell?.scheme));
    };
    const animate = (time: number) => { if (time - last > 33 && !document.hidden && !reduced.matches) { phase += 0.025; draw(); last = time; } frame = requestAnimationFrame(animate); };
    const observer = new ResizeObserver(draw); observer.observe(node); draw(); frame = requestAnimationFrame(animate); return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [theme]);
  function chooseTheme(name: string) { setThemeName(name); localStorage.setItem('hermes-herald-theme', name); }
  const [workspace, setWorkspace] = useState<Workspace>('work');
  const [sessions, setSessions] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attachment, setAttachment] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const end = useRef<HTMLDivElement>(null);
  const active = sessions.find(s => s.id === activeId) || sessions[0];
  const scope = useRef(workspace); scope.current = workspace;
  const refresh = async (signal?: AbortSignal) => {
    const selected = workspace;
    const [status, result] = await Promise.all([
      api<{ connected: boolean; starting: boolean; message?: string }>('/status', 'GET', undefined, signal),
      api<{ sessions: Conversation[] }>(`/${selected}/sessions`, 'GET', undefined, signal),
    ]);
    if (scope.current !== selected || signal?.aborted) return;
    setConnected(status.connected); setStarting(status.starting); setSessions(result.sessions);
    if (!status.connected && !status.starting && status.message && status.message !== 'Start the local Hermes backend to connect.') setError(status.message);
  };
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { await refresh(controller.signal); }
      catch (cause) { if (!controller.signal.aborted) { setConnected(false); setError((cause as Error).message); } }
      if (!controller.signal.aborted) timer = setTimeout(poll, 1000);
    };
    void poll(); return () => { controller.abort(); clearTimeout(timer); };
  }, [workspace]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [active?.messages.length, active?.partial]);
  function changeWorkspace(next: Workspace) { setWorkspace(next); setSessions([]); setActiveId(''); setDraft(''); setAttachment(''); setError(''); }
  async function action(work: () => Promise<void>) {
    setBusy(true); setError('');
    try { await work(); await refresh(); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  async function create() {
    const session = await api<Conversation>(`/${workspace}/sessions`, 'POST', {});
    if (scope.current === workspace) { setActiveId(session.id); setSessions(previous => [session, ...previous]); }
    return session;
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if (!draft.trim() || busy || active?.running) return;
    const text = draft;
    await action(async () => {
      const session = active || await create();
      await api(`/${workspace}/sessions/${session.id}/messages`, 'POST', { text });
      if (scope.current === workspace) { setDraft(''); setAttachment(''); }
    });
  }
  async function fileSelected(file?: File) {
    if (!file) return;
    if (file.size > 1_000_000) { setError('Choose a file smaller than 1 MB.'); return; }
    await action(async () => {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read the selected file.')); reader.readAsDataURL(file); });
      const session = active || await create();
      await api(`/${workspace}/sessions/${session.id}/files`, 'POST', { name: file.name, data }); setAttachment(file.name);
    });
  }

  const button = 'h-button';
  const output = active?.messages.filter(m => m.role === 'assistant').at(-1)?.content;
  const activity = <div className="h-events">{!active?.activity.length && <div className="h-empty"><span>◌</span><h3>No activity yet</h3><p>Tool calls and runtime updates appear here.</p></div>}{active?.activity.slice(-30).map((event, index) => <details key={index}><summary>{event.type}</summary><pre>{JSON.stringify(event.payload, null, 2)}</pre></details>)}</div>;
  return (
    <section className="herald-hermes" aria-label="Hermes main agent workspace" style={paletteVars(theme.colors, { scheme: theme.shell?.scheme }) as CSSProperties}>
      <canvas ref={canvas} className="h-wallpaper" aria-hidden="true" />
      <div className="h-menubar"><strong>✦ Hermes</strong><span className="h-brand">GnoesisQuanta Intelligence</span><div role="group" aria-label="Workspace" className="h-spaces">{(['personal','work','ideas'] as const).map(item => <button key={item} aria-pressed={workspace === item} disabled={busy} onClick={() => changeWorkspace(item)}><i style={{background:item==='work'?'#36e6a6':item==='ideas'?'#b98aff':'#4d92ff'}} />{item.charAt(0).toUpperCase()+item.slice(1)}</button>)}</div><span role="status" className="h-connection"><i style={{background:connected?'var(--color-ok)':'var(--color-warn)'}} />{connected?'Connected':starting?'Starting…':'Offline'}</span></div>
      <div className={'h-window' + (collapsed ? ' h-collapsed' : '')}>
        <aside className="h-rail">
          <div className="h-identity"><img src={avatar} alt="Hermes" /><strong>Hermes</strong><em>A more capable you. Always.</em></div>
          <nav aria-label="Hermes pages">{([['overview','⌂','Overview'],['hermes','◈','Hermes'],['missions','◎','Missions'],['memory','✣','Memory'],['files','▱','Files'],['automations','⟳','Automations'],['connections','♧','Connections'],['coding','⌘','Coding agents'],['clips','✂','Clip Studio'],['settings','☼','Settings']] as const).map(([id,icon,label]) => <button key={id} title={label} aria-label={label} aria-current={view===id?'page':undefined} onClick={() => setView(id)}><span>{icon}</span><span className="h-nav-label">{label}</span></button>)}</nav>
          <div className="h-divider" /><div className="h-space-label">SPACES</div>
          {(['personal','work','ideas'] as const).map(item => <button className="h-space" aria-pressed={workspace===item} key={item} disabled={busy} onClick={() => changeWorkspace(item)} title={item}><i style={{background:item==='work'?'#36e6a6':item==='ideas'?'#b98aff':'#4d92ff'}}/><span className="h-nav-label">{item.charAt(0).toUpperCase()+item.slice(1)}</span></button>)}
          <button className="h-collapse" aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)}>◧ <span className="h-nav-label">{collapsed?'Expand':'Collapse'}</span></button>
        </aside>
        <div className="h-page">
          <div className="h-toolbar"><span>{view === 'hermes' ? 'Main agent · '+workspace : view.charAt(0).toUpperCase()+view.slice(1)}</span>{!connected && <button className={button} disabled={starting || busy} onClick={() => void action(async () => { await api('/start','POST',{}); setStarting(true); })}>Start Hermes</button>}<button className={button} disabled={!connected || busy} onClick={() => void action(async () => { await create(); setDraft(''); setView('hermes'); })}>＋ New conversation</button><button className="h-button h-icon" aria-label="Open sessions" onClick={() => setView('sessions')}>•••</button></div>
          {view === 'clips' ? <ClipStudio key={workspace} workspace={workspace} ask={text => {setDraft(text);setView('hermes');}} /> : view === 'coding' ? <CodingAgentsPage key={workspace} workspace={workspace}/> : ['overview','missions','memory','files','automations','connections'].includes(view) ? <SpacePages key={workspace+view} page={view} workspace={workspace} sessions={sessions} connected={connected} navigate={setView} resume={id => {setActiveId(id);setView('hermes');}} ask={text => {setDraft(text);setView('hermes');}} /> : view === 'settings' ? <div className="h-settings"><section className="h-surface"><h2>How much autonomy?</h2><p>Hermes works within the selected profile tool permissions. Sensitive actions show an approval card.</p><dl><dt>Allow once</dt><dd>Approve only the action shown.</dd><dt>Allow this session</dt><dd>Approve the matching action category for this conversation, when Hermes offers it.</dd><dt>Always allow</dt><dd>Save a persistent permission for the matching action, when Hermes offers it. Review the scope before choosing.</dd><dt>Deny</dt><dd>Refuse this action and let Hermes explain or choose another approach.</dd></dl><p>Zo currently asks for each tool call. Scheduling an automation does not grant additional access. This page does not enable unattended email sending, publishing, or financial execution.</p></section><h2>Appearance</h2><p>The original Herald OS themes. Your selection is saved on this computer.</p><div className="h-theme-grid">{heraldThemes.map(item => <button key={item.name} aria-pressed={theme.name===item.name} onClick={() => chooseTheme(item.name)} style={{background:item.colors.bg,color:item.colors.fg,borderColor:theme.name===item.name?item.colors.accent:item.colors.border_inactive}}><div className="h-swatches">{[item.colors.bg2,item.colors.surface,item.colors.accent,item.colors.fg].map((color,index)=><i key={index} style={{background:color}} />)}</div><strong>{item.label}</strong><small>{item.description}</small></button>)}</div><p className="h-profile-note">Work, Personal and Ideas have separate profiles, memory and workspace directories. Profiles are not a filesystem sandbox.</p></div> : view === 'sessions' ? <div className="h-sessions"><h2>{workspace.charAt(0).toUpperCase()+workspace.slice(1)} conversations</h2>{!sessions.length && <p>No conversations yet.</p>}{sessions.map(session => <div key={session.id}><button onClick={() => {setActiveId(session.id);setView('hermes');setError('');}}><strong>{session.title}</strong><small>{session.running?'Running':session.messages.length+' messages'}</small></button><button aria-label={'Remove '+session.title+' from workspace'} disabled={session.running || busy} onClick={() => void action(async () => { await api('/'+workspace+'/sessions/'+session.id,'DELETE'); })}>×</button></div>)}</div> : view === 'activity' ? <div className="h-activity-page"><h2>Runtime activity</h2>{activity}</div> : <div className="h-split">
            <main className="h-conversation h-card"><header className="h-chat-header"><img src={avatar} alt=""/><div><strong>Hermes</strong><small>{active?.title || (workspace.charAt(0).toUpperCase()+workspace.slice(1))+' workspace'}</small></div></header>
              <div className="h-transcript">{!active?.messages.length && <div className="h-hero"><img src={avatar} alt=""/><h2>Hermes</h2><p>Your computer, in conversation.</p><div className="h-suggestions">{['Draft a brief for my next product review','Help me plan my day','Research an idea with cited sources','Review a document with me'].map(text=><button key={text} onClick={() => setDraft(text)}>{text}</button>)}</div></div>}
                {active?.messages.map((message,index)=><article key={index} className={'h-message '+(message.role==='user'?'h-user':'h-assistant')}><div className="h-message-role">{message.role==='user'?'You':'Hermes'}</div><div>{message.content}</div></article>)}{active?.partial && <article className="h-message h-assistant">{active.partial}</article>}{active?.running && <p role="status" className="h-working">◌ Working · Hermes is working…</p>}<div ref={end}/>
              </div>
          {!!active?.pending.length && <div className="h-approvals">{active.pending.map(request => <div key={request.id} className="h-approval"><strong>Hermes wants to act on this computer</strong><p className="whitespace-pre-wrap text-xs">{request.params.description || request.params.question || request.method}</p>{request.params.command && <pre className="my-2 overflow-auto text-xs">{request.params.command}</pre>}{request.method === 'approval' ? <div className="mt-3 flex gap-2">{(request.params.choices?.length ? request.params.choices.filter(choice => ['once','session','always','deny'].includes(choice)) : ['once','deny']).map(choice => <button key={choice} className={button} onClick={() => void action(async () => { await api(`/${workspace}/sessions/${active.id}/answer`, 'POST', { requestId: request.id, result: { choice } }); })}>{({once:'Allow once',session:'Allow this session',always:'Always allow',deny:'Deny'} as Record<string,string>)[choice]}</button>)}</div> : request.method === 'clarify' ? <>{request.params.questions?.map(question => <label key={question.qid} className="mt-2 block text-xs">{question.question}<input className="mt-1 w-full rounded bg-slate-800 p-2 text-sm" value={answers[request.id + ':' + question.qid] || ''} onChange={event => setAnswers(previous => ({ ...previous, [request.id + ':' + question.qid]: event.target.value }))} /></label>)}{!request.params.questions?.length && <input aria-label="Answer Hermes" className="mt-2 w-full rounded bg-slate-800 p-2 text-sm" value={answers[request.id] || ''} onChange={event => setAnswers(previous => ({ ...previous, [request.id]: event.target.value }))} />}<button className={`${button} mt-2`} onClick={() => void action(async () => { await api(`/${workspace}/sessions/${active.id}/answer`, 'POST', { requestId: request.id, result: request.params.questions?.length ? { answers: Object.fromEntries(request.params.questions.map(question => [question.qid, answers[request.id + ':' + question.qid] || ''])) } : { answer: answers[request.id] || '' } }); })}>Answer</button></> : <p className="mt-2 text-xs text-amber-200">This request needs the native Hermes interface. Stop the turn to cancel it.</p>}</div>)}</div>}

              <div className="h-compose-wrap">{(error || active?.error) && <p role="alert" className="h-error">{error || active?.error}</p>}<form onSubmit={send} className="h-composer"><label title="Attach file" className="h-attach"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m21 11-8 8a6 6 0 0 1-8-8l9-9a4 4 0 0 1 6 6l-9 9a2 2 0 0 1-3-3l8-8"/></svg><input aria-label="Attach a file to Hermes" type="file" disabled={!connected || busy || active?.running} onChange={event => { void fileSelected(event.target.files?.[0]);event.target.value=''; }}/></label><textarea aria-label={'Message Hermes in '+workspace} rows={1} maxLength={32000} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Ask Hermes anything…" onKeyDown={event => {if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form?.requestSubmit();}}}/>{active?.running?<button type="button" aria-label="Stop" className="h-send" onClick={() => void action(async()=>{await api('/'+workspace+'/sessions/'+active.id+'/stop','POST',{});})}>■</button>:<button aria-label="Send" type="submit" className="h-send" disabled={!connected||busy||!draft.trim()}>↑</button>}</form>{(active?.attachments?.length || attachment) && <small className="h-attachments">{active?.attachments?.map(file=>file.name).join(', ') || attachment}</small>}</div>
            </main>
            <aside className="h-output h-card"><header><div className="h-tabs"><button aria-pressed={outputTab==='preview'} onClick={() => setOutputTab('preview')}>Preview</button><button aria-pressed={outputTab==='activity'} onClick={() => setOutputTab('activity')}>Activity</button></div><small>• Review before sharing</small></header>{outputTab==='activity'?activity:<div className="h-preview">{output?<><div className="h-output-label">Latest Hermes response</div><div className="h-preview-text">{output}</div></>:<div className="h-empty"><span>▤</span><h3>Nothing to preview yet</h3><p>Ask Hermes to draft something and it will appear here.</p></div>}</div>}</aside>
          </div>}
        </div>
      </div>
    </section>
  );
}
