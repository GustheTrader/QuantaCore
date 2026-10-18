import React, { useCallback, useEffect, useState } from 'react';

// Cloudroom inside QuantaCore.
// - "Workspace" shows the Cloudroom app (cloudroom-gui) running on this computer.
// - "Cloud core" saves and checks the Cloudroom core running on Zo Computer.
// - "Setup" lists the steps to get both running.
// The core token is saved by the QuantaCore server and is never sent back to this page.

type Config = { guiUrl: string; coreUrl: string; hasToken: boolean };
type CoreCheck = { coreUrl: string; checkedAt: string; status: string; storage?: string; harnesses: { id: string; model?: string; models: string[] }[]; sessions: number | null };
type View = 'workspace' | 'core' | 'setup';

const panel = 'rounded-3xl border border-blue-400/20 bg-[#0b192d] p-5 md:p-7';
const input = 'mt-2 w-full rounded-xl border border-blue-400/20 bg-[#071326] px-4 py-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none';
const button = 'rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 text-xs font-black text-slate-950 hover:brightness-110 disabled:opacity-40';
const code = 'mt-2 block overflow-x-auto whitespace-pre rounded-xl bg-[#050c18] p-4 font-mono text-xs text-slate-200';

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch('/api/cloudroom' + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Local service returned ${response.status}.`);
  return data;
}

export default function CloudroomWorkspace() {
  const [view, setView] = useState<View>('workspace');
  const [config, setConfig] = useState<Config | null>(null);
  const [guiRunning, setGuiRunning] = useState<boolean | null>(null);
  const [guiUrl, setGuiUrl] = useState('');
  const [coreUrl, setCoreUrl] = useState('');
  const [token, setToken] = useState('');
  const [check, setCheck] = useState<CoreCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const saved = await api<Config>('/config');
    setConfig(saved); setGuiUrl(saved.guiUrl); setCoreUrl(saved.coreUrl);
    const gui = await api<{ running: boolean }>('/gui');
    setGuiRunning(gui.running);
  }, []);

  useEffect(() => { void refresh().catch(error => setNotice(error.message)); }, [refresh]);

  async function save() {
    setBusy(true); setNotice('');
    try {
      const saved = await api<Config>('/config', 'PUT', { guiUrl, coreUrl, ...(token ? { token } : {}) });
      setConfig(saved); setToken('');
      setGuiRunning((await api<{ running: boolean }>('/gui')).running);
      setNotice('Cloudroom settings saved.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Save failed.'); }
    finally { setBusy(false); }
  }

  async function testCore() {
    setBusy(true); setNotice(''); setCheck(null);
    try { setCheck(await api<CoreCheck>('/core/test', 'POST', {})); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Check failed.'); }
    finally { setBusy(false); }
  }

  async function forgetToken() {
    setBusy(true);
    try { setConfig(await api<Config>('/config', 'PUT', { clearToken: true })); setCheck(null); setNotice('Core token removed from this computer.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not remove the token.'); }
    finally { setBusy(false); }
  }

  const tabs: [View, string][] = [['workspace', 'Workspace'], ['core', 'Cloud core on Zo'], ['setup', 'Setup']];
  const coreState = check ? 'CORE ONLINE' : config?.coreUrl && config.hasToken ? 'CORE SAVED' : 'CORE NOT SET';

  return <main className="min-h-screen overflow-y-auto bg-[#050c18] px-4 py-6 text-slate-100 md:px-8 md:py-10"><div className="mx-auto max-w-[1500px]">
    <header className="rounded-[2rem] border border-cyan-400/30 bg-[radial-gradient(ellipse_at_top_right,_rgba(34,211,238,0.18),_transparent_40%),linear-gradient(135deg,#102544,#08152a_60%,#06101f)] p-6 md:p-9">
      <p className="text-[10px] font-black uppercase tracking-[.32em] text-cyan-300">Hands · Quanta × Cloudroom × Zo</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight md:text-5xl">Cloudroom</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">Run coding agents on this computer or in your Zo cloud sandbox, and move a running thread between them.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className={`rounded-full border px-4 py-2 ${guiRunning ? 'border-emerald-400/30 text-emerald-200' : 'border-amber-400/30 text-amber-200'}`}>{guiRunning === null ? 'CHECKING APP' : guiRunning ? 'APP RUNNING' : 'APP NOT RUNNING'}</span>
          <span className={`rounded-full border px-4 py-2 ${check ? 'border-emerald-400/30 text-emerald-200' : 'border-slate-500/40 text-slate-300'}`}>{coreState}</span>
        </div>
      </div>
    </header>

    <nav aria-label="Cloudroom sections" className="mt-6 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
      {tabs.map(([id, label]) => <button key={id} onClick={() => setView(id)} className={`rounded-xl px-4 py-3 text-xs font-bold ${view === id ? 'bg-blue-500/20 text-cyan-200' : 'text-slate-400 hover:bg-slate-800'}`}>{label}</button>)}
    </nav>
    {notice && <p role="status" className="mt-5 rounded-xl border border-amber-500/30 p-4 text-sm text-amber-100">{notice}</p>}

    {view === 'workspace' && <section className="mt-6">
      {guiRunning ? <>
        <div className="mb-3 flex flex-wrap justify-between gap-3 text-xs text-slate-400">
          <p>Cloudroom app at <span className="font-mono">{config?.guiUrl}</span></p>
          <a href={config?.guiUrl} target="_blank" rel="noreferrer" className="text-cyan-200 underline">Open in its own window ↗</a>
        </div>
        <iframe src={config?.guiUrl} title="Cloudroom workspace" className="h-[85vh] min-h-[700px] w-full rounded-2xl border border-blue-400/20 bg-[#071326]" allow="clipboard-read; clipboard-write" />
      </> : <div className={panel}>
        <h2 className="text-xl font-bold">The Cloudroom app isn’t running yet</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">QuantaCore shows Cloudroom here once it is running on this computer at <span className="font-mono">{config?.guiUrl || 'http://127.0.0.1:39886'}</span>. The Setup tab has the steps.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={button} onClick={() => setView('setup')}>Show setup steps</button>
          <button className="rounded-xl border border-blue-400/30 px-4 py-3 text-xs text-cyan-200" onClick={() => void refresh().catch(error => setNotice(error.message))}>Check again</button>
        </div>
      </div>}
    </section>}

    {view === 'core' && <section className="mt-6 grid gap-5 lg:grid-cols-2">
      <div className={panel}>
        <h2 className="text-xl font-bold">Connection</h2>
        <label className="mt-5 block text-xs">Cloudroom core address (your Zo service URL)
          <input className={input} value={coreUrl} onChange={event => setCoreUrl(event.target.value)} placeholder="https://cloudroom-core-yourname.zo.computer" />
        </label>
        <label className="mt-4 block text-xs">Core token {config?.hasToken && <span className="text-emerald-300">· saved on this computer</span>}
          <input className={input} type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} placeholder={config?.hasToken ? 'Leave empty to keep the saved token' : 'CLOUDROOM_TOKEN from the Zo setup'} />
        </label>
        <label className="mt-4 block text-xs">Cloudroom app address on this computer
          <input className={input} value={guiUrl} onChange={event => setGuiUrl(event.target.value)} />
        </label>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={button} disabled={busy} onClick={save}>Save</button>
          <button className={button} disabled={busy || !config?.coreUrl || !config?.hasToken} onClick={testCore}>{busy ? 'Checking…' : 'Test core'}</button>
          {config?.hasToken && <button className="px-2 text-xs text-slate-400 underline" disabled={busy} onClick={forgetToken}>Remove token</button>}
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-400">Use your Zo <strong>private</strong> address (ending in <span className="font-mono">.zo.computer</span>), which needs your Zo sign-in. The token lets anyone holding it run agents on your Zo machine, so keep it secret.</p>
      </div>
      <div className={panel}>
        <h2 className="text-xl font-bold">Core status</h2>
        {!check ? <p className="mt-6 text-sm text-slate-400">Save the address and token, then choose Test core.</p> : <div className="mt-5 space-y-3 text-sm">
          <p><span className="text-slate-400">Status:</span> <strong className="text-emerald-300">{check.status}</strong>{check.storage && <> · disk {check.storage}</>}</p>
          <p><span className="text-slate-400">Sessions:</span> {check.sessions ?? 'unknown'}</p>
          <div><p className="text-slate-400">Agent harnesses:</p>
            {check.harnesses.length ? <ul className="mt-2 space-y-2">{check.harnesses.map(h => <li key={h.id} className="rounded-xl border border-slate-700 p-3"><strong>{h.id}</strong>{h.model && <span className="text-slate-400"> · {h.model}</span>}{h.models.length > 0 && <p className="mt-1 text-xs text-slate-500">{h.models.join(' · ')}</p>}</li>)}</ul> : <p className="mt-2 text-xs text-amber-200">No harness is configured yet. Sign in to Codex, Claude Code or Pi on Zo (Setup, step 3).</p>}
          </div>
          <p className="text-xs text-slate-500">Checked {new Date(check.checkedAt).toLocaleString()}</p>
        </div>}
        <p className="mt-6 text-xs leading-5 text-slate-400">To run cloud threads, also enter this address and token in the Cloudroom app: <strong>Settings → Cloudroom account → Connect your own Core</strong>.</p>
      </div>
    </section>}

    {view === 'setup' && <section className="mt-6 grid gap-5 lg:grid-cols-2">
      <article className={panel}>
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Step 1 · Zo Computer</p>
        <h2 className="mt-2 text-xl font-bold">Install the core on Zo</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">Open a terminal on your Zo, copy <span className="font-mono">scripts/cloudroom-zo/zo-setup.sh</span> from this QuantaCore folder into it, then run:</p>
        <code className={code}>{'sudo bash zo-setup.sh check     # looks, changes nothing\nsudo bash zo-setup.sh install   # installs the core'}</code>
        <p className="mt-3 text-sm leading-6 text-slate-300">Then register a Zo service: mode <strong>http</strong>, local port <strong>9840</strong>, entrypoint <span className="font-mono">sudo bash /usr/local/lib/cloudroom/zo-start.sh</span>. Make it <strong>private</strong>.</p>
      </article>
      <article className={panel}>
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Step 2 · This computer</p>
        <h2 className="mt-2 text-xl font-bold">Run the Cloudroom app</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">From your cloudroom-gui folder (needs Node 22.19+ and pnpm 9.15):</p>
        <code className={code}>{'cd gui\npnpm install --frozen-lockfile\npnpm build\npnpm start'}</code>
        <p className="mt-3 text-xs leading-5 text-amber-200">Cloudroom officially supports macOS and Linux. On Windows, run it inside WSL (Ubuntu); its address 127.0.0.1:39886 still opens here.</p>
      </article>
      <article className={panel}>
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Step 3 · Zo Computer</p>
        <h2 className="mt-2 text-xl font-bold">Sign in an agent</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">The core runs agents with your own subscriptions. The setup script prints the exact sign-in command for Codex, Claude Code or Pi.</p>
      </article>
      <article className={panel}>
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Step 4 · Connect</p>
        <h2 className="mt-2 text-xl font-bold">Link everything</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">Enter the Zo address and token on the Cloud core tab and choose Test core. Enter the same values in the Cloudroom app’s Connect your own Core screen.</p>
        <button className={`${button} mt-5`} onClick={() => setView('core')}>Go to Cloud core</button>
      </article>
    </section>}

    <footer className="mt-8 border-t border-slate-800 py-5 text-xs leading-5 text-slate-500">Cloudroom (cloudroom-gui and cloudroom-core) is Apache 2.0, based on BB (MIT). The core token stays on this computer, encrypted with your other keys.</footer>
  </div></main>;
}
