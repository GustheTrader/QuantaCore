import React, { useEffect, useState } from 'react';
import { ArrowUpRight, ExternalLink, Search, ShieldCheck } from 'lucide-react';

type TinyFishSearchResult = { position?: number; site_name?: string; title?: string; snippet?: string; url?: string };
type TinyFishFetchResult = { url?: string; title?: string; format?: string; text?: string; content?: string };
type Status = { configured: boolean; mode: string };

const field = 'w-full rounded-xl border border-slate-700 bg-[#07101f] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10 disabled:opacity-60';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-45';

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/tinyfish${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'X-Quanta-Client': 'local-ui', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    credentials: 'same-origin', cache: 'no-store'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `TinyFish request failed (${response.status}).`);
  return payload as T;
}

export default function TinyFishResearch() {
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState('');
  const [query, setQuery] = useState('');
  const [url, setUrl] = useState('');
  const [results, setResults] = useState<TinyFishSearchResult[]>([]);
  const [fetchResult, setFetchResult] = useState<TinyFishFetchResult | null>(null);
  const [busy, setBusy] = useState<'search' | 'fetch' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    request<Status>('/status').then(value => { if (live) setStatus(value); })
      .catch(cause => { if (live) setStatusError(cause instanceof Error ? cause.message : 'Could not read local TinyFish status.'); });
    return () => { live = false; };
  }, []);

  async function search(event: React.FormEvent) {
    event.preventDefault(); setBusy('search'); setError(''); setResults([]); setFetchResult(null);
    try {
      const value = await request<{ results: TinyFishSearchResult[] }>('/search', { query, location: 'US', language: 'en' });
      setResults(value.results);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'TinyFish search failed.'); }
    finally { setBusy(null); }
  }

  async function fetchUrl(target: string) {
    setBusy('fetch'); setError(''); setFetchResult(null); setUrl(target);
    try {
      const value = await request<{ results: TinyFishFetchResult[]; errors: unknown[] }>('/fetch', { urls: [target], format: 'markdown' });
      if (!value.results.length) throw new Error(value.errors.length ? JSON.stringify(value.errors[0]) : 'TinyFish returned no page content.');
      setFetchResult(value.results[0]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'TinyFish fetch failed.'); }
    finally { setBusy(null); }
  }

  async function submitUrl(event: React.FormEvent) { event.preventDefault(); await fetchUrl(url); }
  const content = fetchResult?.text || fetchResult?.content || '';

  return <main className="min-h-screen overflow-y-auto bg-[#020617] px-4 py-6 text-slate-100 sm:px-7 lg:px-10">
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-[28px] border border-cyan-400/25 bg-[radial-gradient(ellipse_at_85%_10%,rgba(34,211,238,0.17),transparent_33%),linear-gradient(135deg,#0b1730,#07101f_65%,#10142b)] p-6 sm:p-9">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200"><Search size={14} /> TinyFish · Search & Fetch</div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-3xl"><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Live web research</h1><p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">Search the web and fetch JavaScript-rendered pages as clean Markdown. This gives QuantaCore a TinyFish path alongside Firecrawl Alexandria.</p></div>
          <a className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-200 hover:text-white" href="https://github.com/tinyfish-io/tinyfish-cookbook" target="_blank" rel="noreferrer">Cookbook <ArrowUpRight size={15} /></a>
        </div>
      </section>

      {statusError && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">{statusError}</div>}
      {status && <div className={'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ' + (status.configured ? 'border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-100' : 'border-amber-300/20 bg-amber-300/[0.05] text-amber-100')}>
        <ShieldCheck size={16} />{status.configured ? 'TinyFish key found on the local server.' : 'Add TINYFISH_API_KEY to C:\\QuantaCore\\.env and restart QuantaCore.'}
      </div>}
      {error && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">{error}</div>}

      <section className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={search} className="space-y-4 rounded-2xl border border-slate-800/90 bg-slate-900/55 p-5">
          <div><h2 className="text-lg font-bold">Search</h2><p className="mt-1 text-xs leading-5 text-slate-400">Get ranked, structured results from the live web.</p></div>
          <label className="sr-only" htmlFor="tinyfish-query">Search the web</label><textarea id="tinyfish-query" className={field + ' min-h-28 resize-y'} value={query} onChange={event => setQuery(event.target.value)} placeholder="What should TinyFish search for?" maxLength={500} />
          <button className={button} disabled={busy !== null || !query.trim()}>{busy === 'search' ? 'Searching…' : <><Search size={15} /> Search web</>}</button>
        </form>
        <form onSubmit={submitUrl} className="space-y-4 rounded-2xl border border-slate-800/90 bg-slate-900/55 p-5">
          <div><h2 className="text-lg font-bold">Fetch a URL</h2><p className="mt-1 text-xs leading-5 text-slate-400">Render a page and extract clean Markdown content.</p></div>
          <label className="sr-only" htmlFor="tinyfish-url">Public web URL</label><input id="tinyfish-url" type="url" className={field} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com/article" maxLength={2048} />
          <button className={button} disabled={busy !== null || !url.trim()}>{busy === 'fetch' ? 'Fetching…' : 'Fetch page'}</button>
        </form>
      </section>

      {results.length > 0 && <section className="space-y-3"><h2 className="text-xl font-bold">Search results <span className="text-sm font-normal text-slate-500">({results.length})</span></h2>{results.map((item, index) => <article key={item.url || index} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">{item.site_name || 'Web result'}{item.position ? ` · #${item.position}` : ''}</p><h3 className="mt-1 font-bold text-slate-100">{item.title || item.url}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{item.snippet}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-xs text-slate-400 hover:text-cyan-200">{item.url}<ExternalLink size={12} /></a>}</div>
          {item.url && <button type="button" className={button} disabled={busy !== null} onClick={() => void fetchUrl(item.url!)}>Fetch</button>}</div>
      </article>)}</section>}

      {fetchResult && <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/55"><div className="border-b border-slate-800 p-4 sm:px-5"><h2 className="font-bold">{fetchResult.title || 'Fetched page'}</h2><p className="mt-1 break-all text-xs text-slate-500">{fetchResult.url || url}</p></div><pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap break-words p-4 text-sm leading-6 text-slate-200 sm:p-5">{content || JSON.stringify(fetchResult, null, 2)}</pre></section>}

      <p className="flex items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500"><ShieldCheck size={14} />Key stays on the local QuantaCore server. Search and Fetch access uses your TinyFish account and is subject to its current limits.</p>
    </div>
  </main>;
}
