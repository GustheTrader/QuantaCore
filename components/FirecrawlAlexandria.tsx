import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, CheckCircle2, CircleDollarSign, Database, Search, ShieldCheck, Sparkles } from 'lucide-react';

type Capability = {
  id: string; provider: string; capability: string; address: string; name: string; useWhen: string;
  priceCredits: number | null; priceLabel: string; perRecord: boolean; inspected: boolean; optionsSchema: Record<string, unknown> | null;
};
type Discovery = { discoveryId: string; query: string; discoveryCostCredits: number; expiresInSeconds: number; inspected?: boolean; capabilities: Capability[] };
type Status = { configured: boolean; mode: string };

const panel = 'rounded-2xl border border-slate-800/90 bg-slate-900/55 p-5 shadow-[0_14px_45px_rgba(2,6,23,0.22)]';
const field = 'w-full rounded-xl border border-slate-700 bg-[#07101f] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10 disabled:opacity-60';

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/firecrawl-alexandria${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'X-Quanta-Client': 'local-ui', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    credentials: 'same-origin', cache: 'no-store'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Alexandria request failed (${response.status}).`);
  return payload as T;
}

function formatCredits(value: number | null) {
  return value === null ? 'Price unavailable' : `${value.toLocaleString()} ${value === 1 ? 'credit' : 'credits'}`;
}

function startingOptions(schema: Record<string, unknown> | null) {
  const properties = schema?.properties && typeof schema.properties === 'object' ? schema.properties as Record<string, any> : {};
  const required = Array.isArray(schema?.required) ? schema.required as string[] : [];
  const values: Record<string, unknown> = {};
  for (const name of required) {
    const type = properties[name]?.type;
    values[name] = type === 'number' || type === 'integer' ? 0 : type === 'boolean' ? false : type === 'array' ? [] : type === 'object' ? {} : '';
  }
  return JSON.stringify(values, null, 2);
}

export default function FirecrawlAlexandria() {
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState('');
  const [query, setQuery] = useState('Hyperliquid perpetual account state: margin summaries, withdrawable balance, open positions, entry and liquidation prices, leverage, and cumulative funding for a trader, sub-account, or vault address');
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [optionsText, setOptionsText] = useState('{}');
  const [result, setResult] = useState<unknown>(null);
  const [reportedCost, setReportedCost] = useState<number | null>(null);
  const [publishedCost, setPublishedCost] = useState<number | null>(null);
  const pendingRequestId = useRef('');
  const [busy, setBusy] = useState<'status' | 'discover' | 'inspect' | 'retrieve' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setBusy('status');
    request<Status>('/status').then(value => { if (live) setStatus(value); })
      .catch(cause => { if (live) setStatusError(cause instanceof Error ? cause.message : 'Could not read local Firecrawl status.'); })
      .finally(() => { if (live) setBusy(current => current === 'status' ? null : current); });
    return () => { live = false; };
  }, []);

  const selected = useMemo(() => discovery?.capabilities.find(item => item.id === selectedId) || null, [discovery, selectedId]);

  async function discover(event: React.FormEvent) {
    event.preventDefault(); setBusy('discover'); setError(''); setMessage(''); setResult(null); setReportedCost(null); setPublishedCost(null); setDiscovery(null); setSelectedId(''); pendingRequestId.current = '';
    try {
      const value = await request<Discovery>('/discover', { query });
      setDiscovery(value); setMessage(`Free discovery returned ${value.capabilities.length} ${value.capabilities.length === 1 ? 'candidate' : 'candidates'}. Inspect their live inputs and prices before choosing one.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Alexandria discovery failed.'); }
    finally { setBusy(null); }
  }

  async function inspect() {
    if (!discovery) return;
    setBusy('inspect'); setError(''); setMessage(''); setSelectedId(''); setResult(null); pendingRequestId.current = '';
    try {
      const value = await request<{ discoveryId: string; inspected: boolean; inspectionCostCredits: number; capabilities: Capability[] }>('/inspect', { discoveryId: discovery.discoveryId });
      setDiscovery(current => current ? { ...current, inspected: value.inspected, capabilities: value.capabilities } : current);
      setMessage(`Contract inspection completed for free. ${value.capabilities.length} discovered ${value.capabilities.length === 1 ? 'capability' : 'capabilities'} inspected.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Contract inspection failed.'); }
    finally { setBusy(null); }
  }

  async function retrieve() {
    if (!selected || !discovery) return;
    if (selected.priceCredits === null) { setError('This capability has no confirmed credit price, so it cannot be run.'); return; }
    let options: unknown;
    try { options = JSON.parse(optionsText); } catch { setError('Capability options must be valid JSON.'); return; }
    if (!options || Array.isArray(options) || typeof options !== 'object') { setError('Capability options must be a JSON object.'); return; }
    if (!pendingRequestId.current) pendingRequestId.current = crypto.randomUUID();
    const requestId = pendingRequestId.current;
    setBusy('retrieve'); setError(''); setMessage(''); setResult(null); setReportedCost(null);
    try {
      const value = await request<{ result: unknown; publishedPriceCredits: number; reportedChargeCredits: number | null }>('/retrieve', {
        discoveryId: discovery.discoveryId, capabilityId: selected.id, options, expectedCredits: selected.priceCredits, requestId
      });
      setResult(value.result); setReportedCost(value.reportedChargeCredits); setPublishedCost(value.publishedPriceCredits);
      pendingRequestId.current = '';
      setMessage('Retrieval finished. Review the provider response and reported credit charge below.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Alexandria retrieval failed.'); }
    finally { setBusy(null); }
  }

  const localHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname);

  return (
    <main className="min-h-screen overflow-y-auto bg-[#020617] px-4 py-6 text-slate-100 sm:px-7 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-cyan-400/25 bg-[radial-gradient(ellipse_at_85%_10%,rgba(34,211,238,0.17),transparent_33%),radial-gradient(ellipse_at_15%_100%,rgba(99,102,241,0.18),transparent_40%),linear-gradient(135deg,#0b1730,#07101f_58%,#10142b)] p-6 sm:p-9">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-cyan-300/10 shadow-[0_0_100px_rgba(34,211,238,0.08)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200"><Sparkles size={14} /> Alexandria · Firecrawl</div>
              <h1 className="font-outfit text-3xl font-black tracking-tight sm:text-5xl">Discover specialist data for your agents.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Find provider capabilities, inspect their inputs and listed credit price, then retrieve through a server-side connection. Your Firecrawl key stays in the local Quanta server.</p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 font-semibold">{status?.configured ? <CheckCircle2 size={16} className="text-emerald-300" /> : <ShieldCheck size={16} className="text-amber-300" />}{status?.configured ? 'Key configured' : busy === 'status' ? 'Checking local key…' : 'Key not configured'}</div>
              <p className="mt-1 text-xs text-slate-400">Local server · key never sent to the browser</p>
            </div>
          </div>
        </section>

        {!localHost && <section className={panel}><p className="text-sm text-amber-200">Alexandria is available in the local QuantaCore app. Open this workspace at 127.0.0.1 to use the server-side key.</p></section>}
        {statusError && <section className={panel}><p className="text-sm text-rose-300">{statusError}</p></section>}

        <section className={`${panel} grid gap-6 lg:grid-cols-[minmax(0,1fr)_270px]`}>
          <form onSubmit={discover} className="space-y-3">
            <label htmlFor="alexandria-query" className="flex items-center gap-2 text-sm font-bold text-slate-100"><Search size={16} className="text-cyan-300" /> What should the agents look for?</label>
            <textarea id="alexandria-query" value={query} onChange={event => setQuery(event.target.value)} maxLength={500} rows={3} className={field} placeholder="Describe the data or provider capability you need" disabled={busy !== null} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-400">Discovery is free · maximum 500 characters</span>
              <button type="submit" disabled={!localHost || busy !== null || !query.trim()} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 px-5 py-3 text-sm font-bold text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.12)] transition hover:border-cyan-200/70 hover:from-cyan-500/30 hover:to-blue-500/30 disabled:cursor-not-allowed disabled:opacity-45"><Search size={16} />{busy === 'discover' ? 'Discovering…' : 'Discover providers · 0 credits'}</button>
            </div>
          </form>
          <aside className="rounded-xl border border-slate-800 bg-[#07101f]/80 p-4">
            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-violet-200"><Database size={15} /> Guarded workflow</h2>
            <ol className="mt-3 space-y-2 text-xs leading-5 text-slate-400"><li><b className="text-cyan-200">01</b> Discover tools for free.</li><li><b className="text-cyan-200">02</b> Inspect returned inputs and price.</li><li><b className="text-cyan-200">03</b> Run only the selected result.</li></ol>
          </aside>
        </section>

        {message && <div role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200">{message}</div>}
        {(error || (!status?.configured && status)) && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">{error || 'Add FIRECRAWL_API_KEY to C:\\QuantaCore\\.env and restart the local QuantaCore server.'}</div>}

        {discovery && <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Free discovery · {discovery.capabilities.length} results</p><h2 className="mt-1 text-xl font-bold">Choose a discovered capability</h2></div><p className="text-xs text-slate-500">Discovery expires in {Math.round(discovery.expiresInSeconds / 60)} minutes. A fresh discovery is required after that.</p></div>
          {discovery.capabilities.length === 0 ? <div className={panel}><p className="text-sm text-slate-300">No Alexandria capabilities were returned for this query. Refine the request and discover again.</p></div> : !discovery.inspected ? <div className={`${panel} space-y-4`}>
            <div className="grid gap-3 sm:grid-cols-2">{discovery.capabilities.map(capability => <div key={capability.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">{capability.provider}</span><h3 className="mt-1 font-bold text-slate-100">{capability.name}</h3><code className="mt-1 block break-all text-[11px] text-slate-400">{capability.address}</code><p className="mt-2 text-xs leading-5 text-slate-500">{capability.useWhen || 'Inspect this returned capability to load its input contract and price.'}</p></div>)}</div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4"><div><p className="text-sm font-bold text-slate-100">Step 2 · inspect returned contracts</p><p className="mt-1 text-xs text-slate-400">This free Firecrawl find-tools call is scoped to the providers and capabilities returned above.</p></div><button type="button" onClick={inspect} disabled={busy !== null} className="rounded-xl border border-cyan-300/40 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-45">{busy === 'inspect' ? 'Inspecting…' : 'Inspect inputs & prices · 0 credits'}</button></div>
          </div> : <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-3">
              {discovery.capabilities.map(capability => <button type="button" key={capability.id} onClick={() => { setSelectedId(capability.id); setOptionsText(startingOptions(capability.optionsSchema)); setError(''); setResult(null); pendingRequestId.current = ''; }} className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === capability.id ? 'border-cyan-300/50 bg-cyan-400/[0.07] shadow-[0_0_24px_rgba(34,211,238,0.08)]' : 'border-slate-800 bg-slate-900/45 hover:border-slate-600'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">{capability.provider}</span><h3 className="mt-1 font-bold text-slate-100">{capability.name}</h3><code className="mt-1 block break-all text-[11px] text-slate-400">{capability.address}</code></div><span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-2.5 py-1 text-xs font-bold text-amber-100"><CircleDollarSign size={14} />{capability.priceLabel || formatCredits(capability.priceCredits)}</span></div>
                {capability.useWhen && <p className="mt-3 text-xs leading-5 text-slate-400">{capability.useWhen}</p>}
              </button>)}
            </div>

            <div className={`${panel} h-fit space-y-4`}>
              {selected ? <>
                <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Inspect before retrieval</p><h3 className="mt-1 text-lg font-bold">{selected.name}</h3><p className="mt-1 break-all font-mono text-[11px] text-slate-500">{selected.provider}/{selected.capability}</p></div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-3"><div className="flex items-center justify-between text-xs"><span className="text-slate-400">Listed execution price</span><strong className="text-amber-200">{selected.priceLabel || formatCredits(selected.priceCredits)}</strong></div><p className="mt-1 text-[11px] text-slate-500">Live Firecrawl find-tools contract · retrieved at no cost.</p></div>
                <div><div className="mb-2 flex items-center justify-between"><label htmlFor="alexandria-options" className="text-xs font-bold text-slate-200">Inputs as JSON</label><span className="text-[10px] text-slate-500">validated against discovery schema</span></div>{Array.isArray(selected.optionsSchema?.required) && selected.optionsSchema.required.length > 0 && <p className="mb-2 text-[11px] text-cyan-200">Required: {(selected.optionsSchema.required as string[]).join(', ')}</p>}<textarea id="alexandria-options" value={optionsText} onChange={event => { setOptionsText(event.target.value); pendingRequestId.current = ''; }} rows={5} className={`${field} font-mono text-xs`} spellCheck={false} /></div>
                {selected.optionsSchema && <details className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-300">View discovered input schema</summary><pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-slate-400">{JSON.stringify(selected.optionsSchema, null, 2)}</pre></details>}
                <button type="button" onClick={retrieve} disabled={busy !== null || selected.priceCredits === null || selected.perRecord || !status?.configured || !localHost} className="w-full rounded-xl border border-amber-300/35 bg-gradient-to-r from-amber-400/15 to-orange-500/15 px-4 py-3 text-sm font-black text-amber-100 transition hover:border-amber-200/70 hover:from-amber-400/25 hover:to-orange-500/25 disabled:cursor-not-allowed disabled:opacity-40">{busy === 'retrieve' ? 'Retrieving…' : selected.perRecord ? `Retrieval paused · ${selected.priceLabel}` : `Retrieve data · spends ${formatCredits(selected.priceCredits)}`}</button>
                <p className="text-[11px] leading-4 text-slate-500">This button is the paid action. Quanta sends only this discovery’s provider and capability, plus the validated inputs.</p>
              </> : <div className="flex min-h-60 flex-col items-center justify-center text-center"><Database size={30} className="text-slate-600" /><p className="mt-3 text-sm font-semibold text-slate-300">Select a result to inspect it</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">The returned schema and listed price appear here before any data retrieval.</p></div>}
            </div>
          </div>}
        </section>}

        {result !== null && <section className={`${panel} space-y-4`}>
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Retrieval complete</p><h2 className="mt-1 text-xl font-bold">Provider response</h2></div><div className="min-w-52 rounded-xl border border-slate-700 bg-slate-950/75 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Provider-reported charge</p><p className="mt-1 text-sm font-black text-amber-200">{reportedCost === null ? `Not reported · listed ${formatCredits(publishedCost)}` : formatCredits(reportedCost)}</p></div></div>
          <pre className="max-h-[560px] overflow-auto rounded-xl border border-slate-800 bg-[#050b16] p-4 text-xs leading-5 text-slate-300">{JSON.stringify(result, null, 2)}</pre>
          <p className="text-xs text-slate-500">Firecrawl reports the actual charge when its response contains a credit-usage field. The listed price remains available above for comparison.</p>
        </section>}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/70 py-4 text-[11px] text-slate-500"><span>Local-only Quanta connection · no Firecrawl key in VITE variables</span><a className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-100" href="https://docs.firecrawl.dev/features/alexandria" target="_blank" rel="noreferrer">Alexandria docs <ArrowUpRight size={13} /></a></footer>
      </div>
    </main>
  );
}
