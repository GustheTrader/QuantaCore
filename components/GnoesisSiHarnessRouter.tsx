import React, { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Bot, CircleAlert, CircleCheck, CircleDashed, Globe2, KeyRound, Network, Play, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { harnessRouterService, isLocalQuantaHost, type HarnessRouterBase, type HarnessRouterModel, type HarnessRouterMode, type HarnessRouterRunResult, type HarnessRouterStatus } from '../services/harnessRouterService';

const CONSOLE_URL = 'http://127.0.0.1:3100/';

const GnoesisSiHarnessRouter: React.FC = () => {
  const localHost = isLocalQuantaHost();
  const [mode, setMode] = useState<HarnessRouterMode>(localHost ? 'local' : 'hosted');
  const [status, setStatus] = useState<HarnessRouterStatus | null>(null);
  const [models, setModels] = useState<HarnessRouterModel[]>([]);
  const [bases, setBases] = useState<HarnessRouterBase[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedHarnessId, setSelectedHarnessId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [runResult, setRunResult] = useState<HarnessRouterRunResult | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const next = await harnessRouterService.status(mode);
      setStatus(next);
      if (next.reachable && next.apiKeyConfigured) {
        const catalog = await harnessRouterService.capabilities(mode);
        setModels(catalog.models);
        setBases(catalog.bases);
      } else { setModels([]); setBases([]); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read HarnessRouter status.');
    }
  }, [mode]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const eligibleBases = bases.filter(base => (mode === 'hosted' ? base.testAllowed : true) && !['disabled', 'unavailable', 'error'].includes(base.status.toLowerCase()));
    const eligibleModels = models.filter(model => model.available && (mode === 'hosted' ? model.testAllowed : true));
    if (!eligibleBases.some(base => base.id === selectedHarnessId)) setSelectedHarnessId(eligibleBases[0]?.id || '');
    if (!eligibleModels.some(model => model.id === selectedModelId)) setSelectedModelId(eligibleModels[0]?.id || '');
  }, [bases, models, mode, selectedHarnessId, selectedModelId]);

  const saveKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!apiKey.trim() || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await harnessRouterService.saveKey(apiKey.trim());
      setApiKey('');
      setNotice('API key validated and saved in QuantaCore’s protected local store.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The API key could not be saved.');
    } finally { setBusy(false); }
  };

  const clearKey = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      await harnessRouterService.clearKey();
      setModels([]);
      setBases([]);
      setNotice('Saved HarnessRouter API key removed.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The API key could not be removed.');
    } finally { setBusy(false); }
  };

  const runTest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (running || !prompt.trim() || !selectedHarnessId || !selectedModelId) return;
    setRunning(true); setError(null); setRunResult(null); setNotice(null);
    try {
      const result = await harnessRouterService.run(mode, {
        prompt: prompt.trim(), harnessId: selectedHarnessId, modelId: selectedModelId, requestId: crypto.randomUUID()
      });
      setRunResult(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The bounded test run failed.');
    } finally { setRunning(false); }
  };

  const reachable = status?.reachable === true;
  const keyConfigured = status?.apiKeyConfigured === true;
  const runnableBases = bases.filter(base => (mode === 'hosted' ? base.testAllowed : true) && !['disabled', 'unavailable', 'error'].includes(base.status.toLowerCase()));
  const runnableModels = models.filter(model => model.available && (mode === 'hosted' ? model.testAllowed : true));
  const runnable = reachable && keyConfigured && (mode === 'local' || status?.executionEnabled === true) && runnableBases.length > 0 && runnableModels.length > 0;

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-5 pb-24 sm:p-9">
      <header className="rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-950/70 via-slate-950 to-indigo-950/60 p-7 sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200"><Network size={13} /> Gnoesis Superintelligence Harness</div>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">Gnoesis SI Harness Router</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">QuantaCore chooses the problem, policy, and approval boundary. Select a local Docker runtime or the authenticated hosted browser route. Route quality will be earned through task-specific evidence, not a single global model ranking.</p>
          </div>
          {mode === 'local' && <a href={CONSOLE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/70 px-4 py-3 text-xs font-semibold text-white hover:border-cyan-300/50">Open HarnessRouter Console <ArrowUpRight size={15} /></a>}
        </div>
        <div className="mt-7 flex flex-wrap gap-2" role="group" aria-label="HarnessRouter connection mode">
          {localHost && <button type="button" onClick={() => { setMode('local'); setRunResult(null); setError(null); setNotice(null); }} aria-pressed={mode === 'local'} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold ${mode === 'local' ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100' : 'border-slate-700 bg-slate-900 text-slate-400'}`}><Network size={14} /> Local Docker</button>}
          <button type="button" onClick={() => { setMode('hosted'); setRunResult(null); setError(null); setNotice(null); }} aria-pressed={mode === 'hosted'} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold ${mode === 'hosted' ? 'border-indigo-300/50 bg-indigo-300/15 text-indigo-100' : 'border-slate-700 bg-slate-900 text-slate-400'}`}><Globe2 size={14} /> Hosted browser</button>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <StatusTile icon={mode === 'local' ? <Activity size={17} /> : <Globe2 size={17} />} label={mode === 'local' ? 'Local runtime' : 'Hosted runtime'} value={status ? (reachable ? 'Online' : 'Offline / unconfigured') : 'Checking'} detail={mode === 'local' ? (status?.version || '127.0.0.1:3100') : (status?.version || 'Supabase authenticated route')} tone={reachable ? 'green' : 'slate'} />
          <StatusTile icon={<KeyRound size={17} />} label={mode === 'local' ? 'Router API key' : 'Server API key'} value={keyConfigured ? 'Configured' : 'Not connected'} detail={mode === 'local' ? 'Saved in QuantaCore’s protected local vault' : 'Held only in Supabase Function Secrets'} tone={keyConfigured ? 'green' : 'slate'} />
          <StatusTile icon={<ShieldCheck size={17} />} label="Test execution" value={mode === 'hosted' && status?.executionEnabled !== true ? 'Allowlist required' : 'Opt-in only'} detail="Single bounded test; no default route or trading authority" tone="cyan" />
        </div>
      </header>

      {(error || notice) && <div role={error ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-400/30 bg-rose-950/30 text-rose-200' : 'border-emerald-400/30 bg-emerald-950/30 text-emerald-200'}`}>{error ? <CircleAlert size={17} className="mt-0.5 shrink-0" /> : <CircleCheck size={17} className="mt-0.5 shrink-0" />}{error || notice}</div>}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-bold text-white">{mode === 'local' ? 'Connect the local control plane' : 'Hosted browser connection'}</h2><p className="mt-1 text-sm text-slate-400">{mode === 'local' ? 'Paste a user-minted HarnessRouter key. Quanta validates it before saving; the browser never stores it.' : 'The browser calls an authenticated Supabase function. The HTTPS endpoint and HarnessRouter key stay in server-side secrets.'}</p></div>
            <button type="button" onClick={() => void refresh()} disabled={busy || running} aria-label={`Refresh ${mode} router status`} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-cyan-400/50 disabled:opacity-50"><RefreshCw size={16} /></button>
          </div>
          {!reachable && <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-xs leading-5 text-amber-100">{mode === 'local' ? <>Start the local HarnessRouter service first. QuantaCore checks it at <code className="text-amber-200">127.0.0.1:3100</code>.</> : 'Hosted HarnessRouter is not configured or cannot be reached. Configure its HTTPS URL and API key in Supabase Function Secrets, then deploy the quanta-harness-router function.'}</p>}
          {mode === 'local' ? <form onSubmit={saveKey} className="mt-6 space-y-3">
            <label htmlFor="harness-router-key" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">HarnessRouter API key</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input id="harness-router-key" type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="sk-hr-…" disabled={!reachable || busy} className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-sm text-white outline-none focus:border-cyan-400/60 disabled:opacity-50" />
              <button type="submit" disabled={!reachable || busy || !apiKey.trim()} className="rounded-xl bg-cyan-300 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Saving…' : keyConfigured ? 'Replace key' : 'Validate and save'}</button>
            </div>
          </form>
          : <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-4 text-xs leading-5 text-slate-400">Hosted setup requires an HTTPS HarnessRouter endpoint, a server-side API key, and explicit allowlists of read-only test harness and model IDs. The function enforces user sign-in, origin checks, rate limits, a 512-token output cap, a two-step limit, and a 45-second run budget.</div>}
          {mode === 'local' && keyConfigured && <button type="button" onClick={() => void clearKey()} disabled={busy} className="mt-4 inline-flex items-center gap-2 text-xs text-rose-300 hover:text-rose-200 disabled:opacity-50"><X size={14} /> Remove saved key</button>}
          <p className="mt-5 text-[11px] leading-5 text-slate-500">{mode === 'local' ? 'Create the key in the HarnessRouter Console after sign-in. QuantaCore keeps the credential in its existing protected local vault and sends it only to the loopback router.' : 'Never paste the hosted key into the browser. Store it only in Supabase Function Secrets.'}</p>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 sm:p-8">
          <div className="flex items-center gap-3"><Play className="text-cyan-200" size={20} /><div><h2 className="text-lg font-bold text-white">Run a bounded harness test</h2><p className="mt-1 text-xs text-slate-400">One prompt, one selected harness and model, limited output.</p></div></div>
          <form onSubmit={runTest} className="mt-6 space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="harness-test-prompt">Test prompt</label>
            <textarea id="harness-test-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={3000} rows={4} placeholder="Use a read-only question to verify the selected harness and model." disabled={!reachable || running} className="w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60 disabled:opacity-50" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-slate-400">Harness<select value={selectedHarnessId} onChange={event => setSelectedHarnessId(event.target.value)} disabled={!runnable || running} className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"><option value="">Choose a harness</option>{runnableBases.map(base => <option key={base.id} value={base.id}>{base.label} · {base.status}</option>)}</select></label>
              <label className="block text-xs text-slate-400">Model<select value={selectedModelId} onChange={event => setSelectedModelId(event.target.value)} disabled={!runnable || running} className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"><option value="">Choose a model</option>{runnableModels.map(model => <option key={`${model.backend}:${model.id}`} value={model.id}>{model.id} · {model.backend}</option>)}</select></label>
            </div>
            <button type="submit" disabled={!runnable || running || !prompt.trim() || !selectedHarnessId || !selectedModelId} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"><Play size={14} />{running ? 'Running test…' : 'Run test'}</button>
            {!runnable && <p className="text-[11px] leading-5 text-amber-200">{mode === 'hosted' && status?.executionEnabled !== true ? 'Hosted execution is gated until the server owner adds allowed read-only harness and model IDs.' : 'Connect a runtime and API key, then load at least one available harness and model.'}</p>}
          </form>
          {runResult && <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-950/20 p-4"><div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-200"><span>{runResult.status}</span><span>Harness {runResult.harnessId}</span><span>Requested {runResult.requestedModel}</span><span>Served {runResult.servedModel || 'not reported'}{runResult.modelFallback ? ' · fallback' : ''}</span></div><pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-200">{runResult.outputText || 'The run completed without a text output.'}</pre></div>}
          <p className="mt-4 text-[10px] leading-5 text-slate-500">The request is limited to 3,000 input characters, 512 output tokens, two harness steps, and 45 seconds. Use only a configured read-only harness. Agent instructions do not substitute for its actual tool permissions.</p>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 sm:p-8">
          <div className="flex items-center gap-3"><Bot className="text-indigo-300" size={20} /><div><h2 className="text-lg font-bold text-white">Superintelligence Harness policy</h2><p className="mt-1 text-xs text-slate-400">A governed workflow under evaluation</p></div></div>
          <ol className="mt-6 space-y-3">
            {['Choose the most useful tractable problem', 'Filter routes by task, permissions, and budget', 'Run bounded specialists and capture their traces', 'Check evidence independently; show uncertainty', 'Return a decision card for operator approval'].map((item, index) => <li key={item} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-indigo-400/30 bg-indigo-400/10 text-[10px] font-bold text-indigo-200">0{index + 1}</span>{item}</li>)}
          </ol>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 p-4"><p className="text-xs font-bold text-violet-200">Jev classifier</p><p className="mt-1 text-[11px] leading-5 text-slate-400">Planned as bounded, schema-checked triage with abstention and a deterministic shadow baseline.</p></div>
            <div className="rounded-xl border border-slate-800 p-4"><p className="text-xs font-bold text-cyan-200">Model strengths</p><p className="mt-1 text-[11px] leading-5 text-slate-400">Rank harness × model × task class using verified quality, uncertainty, cost, latency, and failure rates.</p></div>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-bold text-white">Installed agent harnesses</h2><p className="mt-1 text-xs text-slate-400">Runtime options and tool surfaces reported by HarnessRouter.</p></div><span className="rounded-full border border-slate-700 px-3 py-1 text-[10px] text-slate-400">{bases.length} listed</span></div>
        {!keyConfigured || !reachable ? <div className="mt-5 flex items-center gap-3 rounded-xl border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-500"><CircleDashed size={17} /> Connect the runtime and validate an API key to load its harness list.</div> : bases.length === 0 ? <div className="mt-5 rounded-xl border border-slate-800 px-4 py-5 text-sm text-slate-400">The router did not report any base harnesses.</div> : <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{bases.map(base => <article key={base.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><div className="flex items-center justify-between gap-3"><h3 className="truncate text-sm font-bold text-white">{base.label}</h3><span className="rounded-full bg-indigo-400/10 px-2 py-1 text-[9px] font-bold uppercase text-indigo-200">{base.status}</span></div><p className="mt-2 font-mono text-[10px] text-slate-500">{base.backend} · {base.id}</p><p className="mt-3 text-[10px] text-slate-400">{base.tools.length ? base.tools.join(' · ') : 'No tools reported'}</p></article>)}</div>}
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-bold text-white">Available model routes</h2><p className="mt-1 text-xs text-slate-400">Catalog data from the local HarnessRouter API. Availability does not establish task quality.</p></div><span className="rounded-full border border-slate-700 px-3 py-1 text-[10px] text-slate-400">{models.length} listed</span></div>
        {!keyConfigured || !reachable ? <div className="mt-5 flex items-center gap-3 rounded-xl border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-500"><CircleDashed size={17} /> Connect the runtime and validate an API key to load its catalog.</div> : models.length === 0 ? <div className="mt-5 rounded-xl border border-slate-800 px-4 py-5 text-sm text-slate-400">The API returned no model entries. Configure a provider in HarnessRouter before starting a run.</div> : <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{models.map(model => <div key={`${model.backend}:${model.id}`} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"><div className="min-w-0"><p className="truncate font-mono text-xs text-slate-200">{model.id}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{model.backend}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${model.available ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>{model.available ? 'Available' : 'Unavailable'}</span></div>)}</div>}
      </section>
      <p className="flex items-center gap-2 text-[11px] leading-5 text-slate-500"><ShieldCheck size={14} className="shrink-0" /> This local pilot does not change QuantaCore’s default agent route and does not grant order placement or money movement.</p>
    </main>
  );
};

function StatusTile({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: 'green' | 'slate' | 'cyan' }) {
  const styles = tone === 'green' ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-200' : tone === 'cyan' ? 'border-cyan-400/20 bg-cyan-400/5 text-cyan-100' : 'border-slate-700 bg-slate-900/60 text-slate-200';
  return <div className={`rounded-2xl border p-4 ${styles}`}><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-80">{icon}{label}</div><p className="mt-2 text-xl font-black">{value}</p><p className="mt-1 text-[10px] text-slate-400">{detail}</p></div>;
}

export default GnoesisSiHarnessRouter;
