import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Event as ResearchEvent, Evidence, Run, RunRequest, RunStatus } from '../lib/research-contract';
import {
  isLocalResearchHost, parsePortfolio, researchService, safeResearchUrl, watchResearchEvents,
  type ResearchBatch, type ResearchEstimate, type ResearchHealth, type ResearchStreamState,
} from '../services/researchService';
import { exportToBrowser } from '../services/utils';
import { ActionHub } from './ActionHub';

type Analyst = RunRequest['selected_analysts'][number];
type Tab = 'research' | 'ledger' | 'evaluation';
type Draft = {
  ticker: string; date: string; deep: string; quick: string; analysts: Analyst[];
  debateRounds: number; riskRounds: number; maxCalls: number; maxTokens: number;
  maxOutput: number; maxSeconds: number; maxCost: string; portfolio: string;
};

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const utcDate = () => new Date().toISOString().slice(0, 10);
const tickerPattern = /^[A-Z0-9][A-Z0-9.^=-]{0,23}$/;
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(new Date(`${value}T00:00:00Z`).getTime()) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const pending = (status: RunStatus | undefined) => !!status && ['queued', 'running', 'cancelling'].includes(status);
const resumable = (status: RunStatus) => ['cancelled', 'error'].includes(status);
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Research request failed.';
const costText = (value: number | null | undefined, known = true) => known && typeof value === 'number' && Number.isFinite(value) ? `$${value.toFixed(4)}` : 'Unknown';
const numberText = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : 'Not supplied';
const timeText = (value: string) => Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString() : value;
const panel = 'rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6';
const input = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/60 disabled:opacity-50';
const button = 'rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-500/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/60 disabled:cursor-not-allowed disabled:opacity-40';
const primary = `${button} border-cyan-500/50 bg-cyan-500/15 text-cyan-200`;

const roles: { id: string; label: string; analyst?: Analyst; group: string }[] = [
  { id: 'market_analyst', label: 'Market Analyst', analyst: 'market', group: 'Evidence' },
  { id: 'social_analyst', label: 'Social Analyst', analyst: 'social', group: 'Evidence' },
  { id: 'news_analyst', label: 'News Analyst', analyst: 'news', group: 'Evidence' },
  { id: 'fundamentals_analyst', label: 'Fundamentals Analyst', analyst: 'fundamentals', group: 'Evidence' },
  { id: 'bull_researcher', label: 'Bull Researcher', group: 'Investment debate' },
  { id: 'bear_researcher', label: 'Bear Researcher', group: 'Investment debate' },
  { id: 'research_manager', label: 'Research Manager', group: 'Investment debate' },
  { id: 'trader', label: 'Trader · research plan', group: 'Research plan' },
  { id: 'aggressive_analyst', label: 'Aggressive Risk Analyst', group: 'Risk debate' },
  { id: 'conservative_analyst', label: 'Conservative Risk Analyst', group: 'Risk debate' },
  { id: 'neutral_analyst', label: 'Neutral Risk Analyst', group: 'Risk debate' },
  { id: 'portfolio_manager', label: 'Portfolio Manager', group: 'Final decision' },
];

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block min-w-0 space-y-2">
    <span className="block text-xs font-semibold text-slate-300">{label}</span>
    {children}
    {hint && <span className="block text-xs leading-relaxed text-slate-500">{hint}</span>}
  </label>
);

const Pill: React.FC<{ children: React.ReactNode; tone?: 'cyan' | 'amber' | 'green' | 'red' | 'muted' }> = ({ children, tone = 'muted' }) => {
  const tones = { cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300', amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300', green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', red: 'border-rose-500/30 bg-rose-500/10 text-rose-300', muted: 'border-slate-700 bg-slate-900 text-slate-400' };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
};

const Status: React.FC<{ status: RunStatus }> = ({ status }) => <Pill tone={status === 'done' ? 'green' : status === 'error' ? 'red' : ['review', 'data_insufficient'].includes(status) ? 'amber' : pending(status) ? 'cyan' : 'muted'}>{status.replaceAll('_', ' ')}</Pill>;
const Metric: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
    <p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 break-words text-lg font-semibold text-slate-100">{value}</p>
    {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
  </div>
);
const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm leading-relaxed text-slate-500">{children}</div>;
const JsonDetails: React.FC<{ title: string; value: unknown; open?: boolean }> = ({ title, value, open }) => (
  <details open={open} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
    <summary className="cursor-pointer text-sm font-semibold text-slate-300">{title}</summary>
    <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-400">{JSON.stringify(value, null, 2)}</pre>
  </details>
);

const EvidenceCard: React.FC<{ evidence: Evidence }> = ({ evidence }) => {
  const links = [...new Set([evidence.query.url, evidence.query.source_url, evidence.artifact, ...(evidence.excerpt.match(/https?:\/\/[^\s<>"\)\]]+/g) || [])].map(safeResearchUrl).filter((url): url is string => !!url))];
  return (
    <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <summary className="cursor-pointer text-sm text-slate-300">
        <span className="mr-2 font-semibold">{evidence.tool}</span><Pill tone={evidence.status === 'success' ? 'green' : 'amber'}>{evidence.status.replaceAll('_', ' ')}</Pill>
        <span className="ml-2 text-xs text-slate-500">{evidence.vendor} · {evidence.kind.replaceAll('_', ' ')}</span>
      </summary>
      <div className="mt-4 space-y-3 text-xs text-slate-400">
        <p>As of: <span className="text-slate-200">{evidence.as_of || 'Unavailable'}</span> · Fetched: {evidence.fetched_at ? timeText(evidence.fetched_at) : 'Unavailable'}</p>
        <p className="break-all font-mono">SHA-256: {evidence.sha256 || 'Unavailable'}</p>
        {evidence.error && <p className="text-amber-300">{evidence.error}</p>}
        {links.length ? <div className="flex flex-wrap gap-3">{links.map((link, index) => <a key={link} href={link} target="_blank" rel="noopener noreferrer" className="break-all text-cyan-300 underline">Source {index + 1}</a>)}</div> : <p>Source URL unavailable. Provenance is recorded below.</p>}
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono leading-relaxed">{evidence.excerpt || 'No excerpt returned.'}</pre>
        <JsonDetails title="Query and provenance" value={{ id: evidence.id, node_id: evidence.node_id, query: evidence.query, artifact: evidence.artifact }} />
      </div>
    </details>
  );
};

const runMarkdown = (run: Run) => {
  const decision = run.decision;
  return `# Gnoesis Agenic Research\n\nResearch only. Predictive value is unvalidated.\n\nRun: ${run.id}\nTicker: ${run.ticker}\nDate: ${run.trade_date}\nStatus: ${run.status}\nCreated: ${run.created_at}\nConfiguration hash: ${run.configuration_hash}\nAttempt: ${run.attempt}\n\n## Decision\n\n${decision?.rating || 'No decision'}\n\n${decision?.executive_summary || ''}\n\n${decision?.investment_thesis || ''}\n\n## Warnings\n\n${decision?.warnings.map(warning => `- ${warning}`).join('\n') || 'None recorded.'}\n\n## Full reports\n\n${decision ? Object.entries(decision.reports).map(([name, report]) => `### ${name}\n\n${report}`).join('\n\n') : ''}\n\n## Raw final output\n\n${decision?.raw_text || ''}\n\n## Configuration and measured usage\n\n\`\`\`json\n${JSON.stringify({ request: run.request, usage: run.usage, error: run.error }, null, 2)}\n\`\`\`\n\n## Evidence\n\n\`\`\`json\n${JSON.stringify(decision?.evidence || [], null, 2)}\n\`\`\`\n\n## Settlement\n\n\`\`\`json\n${JSON.stringify(run.settlement, null, 2)}\n\`\`\``;
};

const GnoesisResearch: React.FC = () => {
  const local = isLocalResearchHost();
  const [tab, setTab] = useState<Tab>('research');
  const [health, setHealth] = useState<ResearchHealth | null>(null);
  const [loading, setLoading] = useState(local);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; message: string } | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<ResearchEvent[]>([]);
  const [replayVersion, setReplayVersion] = useState(0);
  const [stream, setStream] = useState<{ state: ResearchStreamState; message?: string }>({ state: 'closed' });
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    ticker: '', date: localDate(), deep: '', quick: '', analysts: ['market', 'social', 'news', 'fundamentals'],
    debateRounds: 1, riskRounds: 1, maxCalls: 60, maxTokens: 200000, maxOutput: 2048, maxSeconds: 900, maxCost: '', portfolio: '',
  });
  const [estimate, setEstimate] = useState<{ key: string; value: ResearchEstimate; request: RunRequest } | null>(null);
  const [confirmStart, setConfirmStart] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState({ ticker: '', rating: '', date: '' });
  const [ledger, setLedger] = useState<Run[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [batchTickers, setBatchTickers] = useState('');
  const [batchDates, setBatchDates] = useState('');
  const [batchEstimate, setBatchEstimate] = useState<{ key: string; value: ResearchEstimate; request: RunRequest; tickers: string[]; dates: string[] } | null>(null);
  const [confirmBatch, setConfirmBatch] = useState(false);
  const [batch, setBatch] = useState<ResearchBatch | null>(null);
  const [batchLookup, setBatchLookup] = useState('');
  const selectedRun = runs.find(run => run.id === selectedId) || null;
  const selectedRef = useRef(selectedRun);
  selectedRef.current = selectedRun;
  const draftKey = JSON.stringify([draft, health?.models, health?.engine]);
  const draftKeyRef = useRef(draftKey);
  draftKeyRef.current = draftKey;
  const batchKey = JSON.stringify([draftKey, batchTickers, batchDates]);
  const batchKeyRef = useRef(batchKey);
  batchKeyRef.current = batchKey;
  const startKey = useRef<{ draft: string; key: string } | null>(null);
  const batchStartKey = useRef<{ draft: string; key: string } | null>(null);
  const canRun = local && health?.sidecar.status === 'ready' && !!health?.models.length;
  const pricesKnown = !!health?.models.find(model => model.id === draft.deep && model.input_rate !== null && model.output_rate !== null) &&
    !!health?.models.find(model => model.id === draft.quick && model.input_rate !== null && model.output_rate !== null);
  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(previous => ({ ...previous, [key]: value }));

  const updateRun = useCallback((run: Run) => {
    setRuns(previous => [run, ...previous.filter(item => item.id !== run.id)].sort((a, b) => b.created_at.localeCompare(a.created_at)));
  }, []);

  const refreshAll = useCallback(async () => {
    if (!local) return;
    setLoading(true);
    const results = await Promise.allSettled([researchService.health(), researchService.runs()]);
    const healthResult = results[0];
    if (healthResult.status === 'fulfilled') {
      setHealth(healthResult.value);
      const catalog = healthResult.value.models;
      setDraft(previous => ({ ...previous, deep: previous.deep || catalog[0]?.id || '', quick: previous.quick || catalog[1]?.id || catalog[0]?.id || '' }));
    } else { setHealth(null); setNotice({ kind: 'error', message: errorText(healthResult.reason) }); }
    const runsResult = results[1];
    if (runsResult.status === 'fulfilled') {
      const history = runsResult.value.runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setRuns(history);
      setSelectedId(previous => previous || history[0]?.id || null);
    } else setNotice({ kind: 'error', message: errorText(runsResult.reason) });
    setLoading(false);
  }, [local]);

  useEffect(() => { void refreshAll(); }, [refreshAll]);
  useEffect(() => { setEstimate(null); setConfirmStart(false); }, [draftKey]);
  useEffect(() => { setBatchEstimate(null); setConfirmBatch(false); }, [batchKey]);

  useEffect(() => {
    if (!local || !selectedId) return;
    const controller = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    setEvents([]);
    setStream({ state: 'connecting' });
    const refresh = async () => {
      try { const run = await researchService.run(selectedId); if (!controller.signal.aborted) updateRun(run); }
      catch (error) { if (!controller.signal.aborted) setStream({ state: 'reconnecting', message: errorText(error) }); }
    };
    void refresh();
    void watchResearchEvents(selectedId, {
      signal: controller.signal,
      onState: (state, message) => {
        if (!controller.signal.aborted) {
          setStream({ state, message });
          if (state === 'closed') void refresh();
        }
      },
      onEvent: event => {
        if (controller.signal.aborted) return;
        setEvents(previous => previous.some(item => item.seq === event.seq) ? previous : [...previous, event]);
        const snapshot = event.payload.snapshot;
        if (event.type === 'run.projection' && snapshot && typeof snapshot === 'object' && 'id' in snapshot && snapshot.id === selectedId && 'usage' in snapshot && 'request' in snapshot) {
          selectedRef.current = snapshot as Run;
          updateRun(snapshot as Run);
        } else if (/^(run\.|result$|worker\.error$|usage$)/.test(event.type) && !refreshTimer) {
          refreshTimer = setTimeout(() => { refreshTimer = undefined; void refresh(); }, 250);
        }
      },
      shouldReconnect: () => pending(selectedRef.current?.status),
    }).catch(error => { if (!controller.signal.aborted) setStream({ state: 'closed', message: errorText(error) }); });
    const snapshotTimer = setInterval(() => { if (pending(selectedRef.current?.status)) void refresh(); }, 5000);
    return () => { controller.abort(); clearTimeout(refreshTimer); clearInterval(snapshotTimer); };
  }, [local, selectedId, selectedRun?.attempt, replayVersion, updateRun]);

  const loadLedger = useCallback(async (filter: typeof ledgerFilter) => {
    if (!local) return;
    setLedgerLoading(true);
    try { setLedger((await researchService.decisions(filter)).runs); }
    catch (error) { setNotice({ kind: 'error', message: errorText(error) }); }
    finally { setLedgerLoading(false); }
  }, [local]);
  useEffect(() => { if (tab === 'ledger') void loadLedger({ ticker: '', rating: '', date: '' }); }, [tab, loadLedger]);

  useEffect(() => {
    if (!local || !batch?.id) return;
    const id = batch.id;
    const timer = setInterval(() => {
      if (batch.runs.some(run => pending(run.status))) researchService.batch(id).then(setBatch).catch(error => setNotice({ kind: 'error', message: errorText(error) }));
    }, 5000);
    return () => clearInterval(timer);
  }, [local, batch?.id, batch?.runs.some(run => pending(run.status))]);

  const makeRequest = (mode: 'research' | 'evaluation', ticker = draft.ticker.trim().toUpperCase(), date = draft.date): RunRequest => {
    if (!tickerPattern.test(ticker)) throw new Error('Enter a valid stock ticker (for example MSFT or BRK-B).');
    if (!validDate(date) || date > localDate()) throw new Error('Choose a valid research date on or before today.');
    if (!health?.models.some(model => model.id === draft.deep) || !health.models.some(model => model.id === draft.quick)) throw new Error('Choose both deep and quick models from the local model catalog.');
    if (!draft.analysts.length) throw new Error('Select at least one evidence analyst.');
    const limits: [string, number, number, number][] = [
      ['Debate rounds', draft.debateRounds, 1, 3], ['Risk rounds', draft.riskRounds, 1, 3],
      ['Maximum calls', draft.maxCalls, 1, 120], ['Token budget', draft.maxTokens, 1000, 500000],
      ['Output tokens per call', draft.maxOutput, 128, 4096], ['Time budget', draft.maxSeconds, 30, 1800],
    ];
    for (const [label, value, minimum, maximum] of limits) if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${label} must be an integer from ${minimum.toLocaleString()} to ${maximum.toLocaleString()}.`);
    const maxCost = draft.maxCost.trim() ? Number(draft.maxCost) : null;
    if (maxCost !== null && (!Number.isFinite(maxCost) || maxCost < 0 || maxCost > 50)) throw new Error('USD limit must be a finite number from 0 to 50, or left blank.');
    if (maxCost !== null && !pricesKnown) throw new Error('A USD limit needs known prices for both models. Clear it and use the call, token and time limits while pricing is unknown.');
    return {
      ticker, trade_date: date, asset_type: 'stock', models: { deep: draft.deep, quick: draft.quick },
      selected_analysts: [...draft.analysts], debate_rounds: draft.debateRounds, risk_rounds: draft.riskRounds,
      budget: { max_calls: draft.maxCalls, max_tokens: draft.maxTokens, max_output_tokens: draft.maxOutput, max_duration_seconds: draft.maxSeconds, max_cost_usd: maxCost },
      portfolio: parsePortfolio(draft.portfolio), mode, confirmed: true,
    };
  };

  const reviewCost = async () => {
    setBusy('estimate'); setNotice(null); setConfirmStart(false);
    const key = draftKey;
    try {
      const request = makeRequest('research');
      const value = await researchService.estimate(request);
      if (key === draftKeyRef.current) setEstimate({ key, value, request });
    } catch (error) { setNotice({ kind: 'error', message: errorText(error) }); }
    finally { setBusy(null); }
  };

  const startRun = async () => {
    if (!estimate || estimate.key !== draftKey || !confirmStart || !canRun) return;
    setBusy('start'); setNotice(null);
    if (startKey.current?.draft !== draftKey) startKey.current = { draft: draftKey, key: crypto.randomUUID() };
    try {
      const result = await researchService.start(estimate.request, startKey.current.key);
      updateRun(result.run); setSelectedId(result.run_id); setConfirmStart(false); startKey.current = null;
      setNotice({ kind: 'success', message: `Created research run ${result.run_id}.` });
    } catch (error) { setNotice({ kind: 'error', message: errorText(error) }); }
    finally { setBusy(null); }
  };

  const changeRun = async (run: Run, action: 'cancel' | 'resume') => {
    if (action === 'resume' && !window.confirm(`Resume ${run.ticker} (${run.id}) using its original budgets? Additional model calls may incur costs. The earlier attempt remains in the journal.`)) return;
    setBusy(`${action}:${run.id}`); setNotice(null);
    try { updateRun(await researchService[action](run.id)); }
    catch (error) { setNotice({ kind: 'error', message: errorText(error) }); }
    finally { setBusy(null); }
  };

  const download = async (run: Run, format: 'md' | 'json') => {
    setBusy(`download:${format}`);
    try { exportToBrowser(`Gnoesis_Agenic_Research_${run.ticker}_${run.id}`, await researchService.artifact(run.id, format), format); }
    catch (error) { setNotice({ kind: 'error', message: errorText(error) }); }
    finally { setBusy(null); }
  };

  const reviewBatch = async () => {
    setBusy('batch-estimate'); setNotice(null); setConfirmBatch(false);
    const key = batchKey;
    try {
      const tickers = [...new Set<string>(batchTickers.split(/[\s,]+/).filter(Boolean).map(ticker => ticker.toUpperCase()))];
      const dates = [...new Set<string>(batchDates.split(/[\s,]+/).filter(Boolean))];
      if (!tickers.length || tickers.length > 4 || tickers.some(ticker => !tickerPattern.test(ticker))) throw new Error('Evaluation accepts 1–4 distinct stock tickers separated by commas or spaces.');
      if (!dates.length || dates.length > 3 || dates.some(date => !validDate(date) || date > localDate())) throw new Error('Evaluation accepts 1–3 valid dates on or before today, using YYYY-MM-DD.');
      const request = makeRequest('evaluation', tickers[0], dates[0]);
      const value = await researchService.estimate(request);
      if (key === batchKeyRef.current) setBatchEstimate({ key, value, request, tickers, dates });
    } catch (error) { setNotice({ kind: 'error', message: errorText(error) }); }
    finally { setBusy(null); }
  };

  const startBatch = async () => {
    if (!batchEstimate || batchEstimate.key !== batchKey || !confirmBatch || !canRun) return;
    setBusy('batch-start'); setNotice(null);
    if (batchStartKey.current?.draft !== batchKey) batchStartKey.current = { draft: batchKey, key: crypto.randomUUID() };
    try {
      const result = await researchService.startBatch({ tickers: batchEstimate.tickers, dates: batchEstimate.dates, template: batchEstimate.request }, batchStartKey.current.key);
      const snapshot = await researchService.batch(result.batch_id);
      setBatch(snapshot); setBatchLookup(result.batch_id); setConfirmBatch(false); batchStartKey.current = null;
      snapshot.runs.forEach(updateRun);
      setNotice({ kind: 'success', message: `Created evaluation batch ${result.batch_id} with ${result.run_ids.length} cells.` });
    } catch (error) { setNotice({ kind: 'error', message: errorText(error) }); }
    finally { setBusy(null); }
  };

  const lookupBatch = async () => {
    if (!batchLookup.trim()) return;
    setBusy('batch-lookup');
    try { setBatch(await researchService.batch(batchLookup.trim())); }
    catch (error) { setNotice({ kind: 'error', message: errorText(error) }); }
    finally { setBusy(null); }
  };

  const resumeBatch = async () => {
    if (!batch || !window.confirm('Resume cancelled or failed cells with their original budgets? Completed cells are retained. Additional model calls may incur costs.')) return;
    setBusy('batch-resume');
    try { const result = await researchService.resumeBatch(batch.id); setBatch(result); result.runs.forEach(updateRun); }
    catch (error) { setNotice({ kind: 'error', message: errorText(error) }); }
    finally { setBusy(null); }
  };

  const settleThroughToday = async (run: Run) => {
    if (!window.confirm(`Settle eligible ${run.ticker} research decisions through ${utcDate()} UTC, including this run? Records native indicative returns and reflections. A portfolio performance study remains separate.`)) return;
    setBusy(`settle:${run.id}`); setNotice(null);
    try {
      updateRun(await researchService.settle(run.id));
      await refreshAll();
      setReplayVersion(previous => previous + 1);
      setNotice({ kind: 'success', message: `Settlement check completed for eligible ${run.ticker} research decisions through ${utcDate()} UTC. Review settlement events for source outcomes and limitations.` });
    } catch (error) { setNotice({ kind: 'error', message: errorText(error) }); }
    finally { setBusy(null); }
  };

  const runActions = (run: Run) => <div className="flex flex-wrap gap-2">
    {pending(run.status) && <button className={button} disabled={!!busy || run.status === 'cancelling'} onClick={() => void changeRun(run, 'cancel')}>{run.status === 'cancelling' ? 'Cancelling…' : 'Cancel run'}</button>}
    {resumable(run.status) && run.error?.code !== 'RESEARCH_BUDGET_EXHAUSTED' && <button className={button} disabled={!!busy || !canRun} onClick={() => void changeRun(run, 'resume')}>Resume run</button>}
    {resumable(run.status) && run.error?.code === 'RESEARCH_BUDGET_EXHAUSTED' && <p className="text-xs text-amber-300">This frozen run cannot resume within its remaining budget. Start a new reviewed run to change the limits.</p>}
  </div>;

  const decisionView = selectedRun?.decision && (
    <section className={`${panel} group`} aria-label="Research decision">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Decision</h2>
        <div className="flex flex-wrap gap-2"><Pill tone={selectedRun.decision.rating === 'REVIEW' ? 'amber' : 'cyan'}>{selectedRun.decision.rating}</Pill><Pill>{selectedRun.decision.source.replaceAll('_', ' ')}</Pill></div>
      </div>
      {selectedRun.decision.source === 'fixture' && <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">Diagnostic fixture output. This run does not contain a market research result.</p>}
      {selectedRun.decision.data_status === 'insufficient' && <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">Data insufficient. Review the evidence and missing sources before interpreting this decision.</p>}
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">Executive summary</h3>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{selectedRun.decision.executive_summary || 'No summary supplied.'}</p>
      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-cyan-300">Investment thesis</h3>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{selectedRun.decision.investment_thesis || 'No thesis supplied.'}</p>
      <div className="my-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Metric label="Price target" value={numberText(selectedRun.decision.price_target)} />
        <Metric label="Time horizon" value={selectedRun.decision.time_horizon || 'Not supplied'} />
        <Metric label="Entry price" value={numberText(selectedRun.decision.entry_price)} />
        <Metric label="Stop loss" value={numberText(selectedRun.decision.stop_loss)} />
        <Metric label="Position sizing" value={selectedRun.decision.position_sizing || 'Not supplied'} />
        <Metric label="Evidence outcomes" value={`${selectedRun.decision.evidence.filter(item => item.status === 'success').length} / ${selectedRun.decision.evidence.length}`} hint="Successful source responses" />
      </div>
      {!!selectedRun.decision.warnings.length && <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><h3 className="mb-2 text-sm font-semibold text-amber-300">Warnings</h3><ul className="list-disc space-y-2 pl-5 text-sm text-amber-200/80">{selectedRun.decision.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
      <details className="mb-4 rounded-xl border border-slate-800 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">Full raw reports ({Object.keys(selectedRun.decision.reports).length})</summary>
        <div className="mt-4 space-y-4">{Object.entries(selectedRun.decision.reports).map(([name, report]) => <details key={name} className="rounded-xl border border-slate-800 p-3"><summary className="cursor-pointer text-xs font-semibold text-cyan-300">{name.replaceAll('_', ' ')}</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-400">{report}</pre></details>)}<details className="rounded-xl border border-slate-800 p-3"><summary className="cursor-pointer text-xs font-semibold text-cyan-300">Raw final decision</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-400">{selectedRun.decision.raw_text}</pre></details></div>
      </details>
      <details className="mb-5 rounded-xl border border-slate-800 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-300">Evidence and provenance ({selectedRun.decision.evidence.length})</summary><div className="mt-4 space-y-3">{selectedRun.decision.evidence.length ? selectedRun.decision.evidence.map(evidence => <EvidenceCard key={evidence.id} evidence={evidence} />) : <Empty>No source evidence was recorded.</Empty>}</div></details>
      {selectedRun.decision.baseline && <JsonDetails title="Decision evaluation and baseline (indicative)" value={selectedRun.decision.baseline} />}
      <div className="mt-5 flex flex-wrap gap-3"><button className={button} disabled={!!busy} onClick={() => void download(selectedRun, 'md')}>Download full Markdown</button><button className={button} disabled={!!busy} onClick={() => void download(selectedRun, 'json')}>Download JSON</button></div>
      <ActionHub content={runMarkdown(selectedRun)} agentName="Gnoesis Agenic Research" title={`${selectedRun.ticker} · ${selectedRun.trade_date} · ${selectedRun.id}`} />
    </section>
  );

  const currentAttemptStart = [...events].reverse().find(event => ['run.started', 'run.resumed', 'run.recovered'].includes(event.type))?.seq || 0;
  const reflectionEvents = useMemo(() => events.filter(event => /reflect|settle/.test(event.type)), [events]);

  return (
    <div className="pb-20">
      <header className="mb-7">
        <div className="mb-3 flex flex-wrap items-center gap-2"><Pill tone="cyan">QuantaCore + TradingAgents</Pill><Pill tone="amber">Research only</Pill><Pill>Stocks</Pill></div>
        <h1 className="font-outfit text-3xl font-bold tracking-tight text-white md:text-5xl">Gnoesis Agenic Research</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">Evidence, investment debate and risk review with an immutable run journal. Research decisions require independent review. Predictive value is unvalidated.</p>
      </header>

      {!local ? (
        <section className={`${panel} border-amber-500/25`}>
          <h2 className="text-lg font-semibold text-amber-200">Local research workspace</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">This hosted page cannot run research or access your local journal. Open Gnoesis Agenic Research in the QuantaCore server on your computer using localhost or 127.0.0.1, then configure models in the local Unified Gateway.</p>
          <p className="mt-3 text-xs text-slate-500">Model credentials and research storage belong to the local service.</p>
        </section>
      ) : (
        <>
          <section className={`${panel} mb-5 flex flex-wrap items-center justify-between gap-4`} aria-label="Research service health">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Pill tone={health?.sidecar.status === 'ready' ? 'green' : 'amber'}>{loading ? 'Checking local services…' : `TradingAgents ${health?.sidecar.status || 'unavailable'}`}</Pill>{health && <span className="text-xs text-slate-500">Sidecar :{health.sidecar.port} · {health.engine.version} · {health.engine.commit?.slice(0, 10)}</span>}</div><p className="mt-2 text-xs leading-relaxed text-slate-400">{health?.sidecar.message || 'Connect the local QuantaCore backend and TradingAgents sidecar to begin.'}</p>{health && !health.models.length && <p className="mt-2 text-xs text-amber-300">No research models are configured. Add a provider in the local Unified Gateway.</p>}</div>
            <div className="flex gap-2"><a href="#/gateway" className={button}>Model settings</a><button className={button} disabled={loading} onClick={() => void refreshAll()}>Refresh services</button></div>
          </section>
          {notice && <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`mb-5 flex items-start justify-between gap-4 rounded-xl border p-4 text-sm ${notice.kind === 'error' ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}><span className="break-words">{notice.message}</span><button aria-label="Dismiss message" className="shrink-0 px-1" onClick={() => setNotice(null)}>×</button></div>}
          <nav className="mb-6 flex flex-wrap gap-2" aria-label="Research sections">{(['research', 'ledger', 'evaluation'] as Tab[]).map(item => <button key={item} type="button" aria-current={tab === item ? 'page' : undefined} className={`${tab === item ? primary : button} capitalize`} onClick={() => setTab(item)}>{item === 'ledger' ? 'Decision ledger' : item}</button>)}</nav>

          {tab === 'research' && <div className="grid items-start gap-6 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
            <div className="space-y-5">
              <section className={panel} aria-label="New research run">
                <h2 className="mb-5 text-lg font-semibold text-white">New research run</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3"><Field label="Stock ticker"><input className={input} aria-label="Stock ticker" value={draft.ticker} placeholder="MSFT" maxLength={24} onChange={event => updateDraft('ticker', event.target.value.toUpperCase())} /></Field><Field label="Research date"><input className={input} aria-label="Research date" type="date" value={draft.date} max={localDate()} onChange={event => updateDraft('date', event.target.value)} /></Field></div>
                  <Field label="Deep model" hint="Investment and risk synthesis"><select className={input} aria-label="Deep model" value={draft.deep} onChange={event => updateDraft('deep', event.target.value)}><option value="">Choose a configured model</option>{health?.models.map(model => <option key={model.id} value={model.id}>{model.label} · {model.id}</option>)}</select></Field>
                  <Field label="Quick model" hint="Evidence analysts and shorter steps"><select className={input} aria-label="Quick model" value={draft.quick} onChange={event => updateDraft('quick', event.target.value)}><option value="">Choose a configured model</option>{health?.models.map(model => <option key={model.id} value={model.id}>{model.label} · {model.id}</option>)}</select></Field>
                  <fieldset><legend className="mb-2 text-xs font-semibold text-slate-300">Evidence analysts</legend><div className="grid grid-cols-2 gap-2">{(['market', 'social', 'news', 'fundamentals'] as Analyst[]).map(analyst => <label key={analyst} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 p-3 text-sm capitalize text-slate-300"><input type="checkbox" className="accent-cyan-400" checked={draft.analysts.includes(analyst)} onChange={event => updateDraft('analysts', event.target.checked ? [...draft.analysts, analyst] : draft.analysts.filter(item => item !== analyst))} />{analyst}</label>)}</div></fieldset>
                  <div className="grid grid-cols-2 gap-3"><Field label="Investment rounds"><select className={input} value={draft.debateRounds} onChange={event => updateDraft('debateRounds', Number(event.target.value))}>{[1, 2, 3].map(round => <option key={round} value={round}>{round}</option>)}</select></Field><Field label="Risk rounds"><select className={input} value={draft.riskRounds} onChange={event => updateDraft('riskRounds', Number(event.target.value))}>{[1, 2, 3].map(round => <option key={round} value={round}>{round}</option>)}</select></Field></div>
                  <details open className="rounded-xl border border-slate-800 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-300">Run budgets</summary><div className="mt-4 grid grid-cols-2 gap-3"><Field label="Maximum calls"><input className={input} type="number" min={1} max={120} step={1} value={draft.maxCalls} onChange={event => updateDraft('maxCalls', Number(event.target.value))} /></Field><Field label="Total token budget"><input className={input} type="number" min={1000} max={500000} step={1000} value={draft.maxTokens} onChange={event => updateDraft('maxTokens', Number(event.target.value))} /></Field><Field label="Output tokens / call"><input className={input} type="number" min={128} max={4096} step={128} value={draft.maxOutput} onChange={event => updateDraft('maxOutput', Number(event.target.value))} /></Field><Field label="Time budget (seconds)"><input className={input} type="number" min={30} max={1800} step={30} value={draft.maxSeconds} onChange={event => updateDraft('maxSeconds', Number(event.target.value))} /></Field><div className="col-span-2"><Field label="Optional USD limit" hint={pricesKnown ? 'Known provider rates support a USD cap. Leave blank to use the other limits.' : 'Provider pricing is unknown. Call, token and time limits remain available.'}><input className={input} type="number" min={0} max={50} step={0.1} placeholder={pricesKnown ? 'No USD limit' : 'Unknown pricing'} value={draft.maxCost} onChange={event => updateDraft('maxCost', event.target.value)} /></Field></div></div></details>
                  <details className="rounded-xl border border-slate-800 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-300">Manual portfolio context (optional)</summary><p className="mt-3 text-xs leading-relaxed text-slate-500">Operator supplied context is recorded separately from observed market evidence. No account connection is created.</p><textarea className={`${input} mt-3 h-40 resize-y font-mono text-xs`} aria-label="Manual portfolio JSON" value={draft.portfolio} onChange={event => updateDraft('portfolio', event.target.value)} placeholder={'{"cash":10000,"currency":"USD","positions":[{"ticker":"MSFT","quantity":10,"average_price":350}]}'} /></details>
                  <button type="button" className={`${primary} w-full`} disabled={!!busy || !canRun} onClick={() => void reviewCost()}>{busy === 'estimate' ? 'Estimating…' : 'Review cost and limits'}</button>
                  <p className="text-xs leading-relaxed text-slate-500">Estimation makes no model calls. Review is required again after changing any configuration.</p>
                  {estimate?.key === draftKey && <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4"><h3 className="mb-3 text-sm font-semibold text-cyan-200">Planning estimate</h3><div className="grid grid-cols-2 gap-2"><Metric label="Expected calls" value={estimate.value.expected_calls} /><Metric label="Estimated USD" value={costText(estimate.value.estimated_cost_usd, estimate.value.price_known)} /><Metric label="Input tokens" value={estimate.value.estimated_input_tokens.toLocaleString()} /><Metric label="Output tokens" value={estimate.value.estimated_output_tokens.toLocaleString()} /></div>{estimate.value.warnings.map((warning, index) => <p key={index} className="mt-3 text-xs leading-relaxed text-amber-300">{warning}</p>)}{!estimate.value.price_known && <p className="mt-3 text-xs leading-relaxed text-amber-300">USD cost is unknown. Providers may charge for calls; the estimate does not mean the run is free.</p>}<label className="my-4 flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-slate-300"><input type="checkbox" className="mt-0.5 accent-cyan-400" checked={confirmStart} onChange={event => setConfirmStart(event.target.checked)} /><span>I reviewed the estimate and budgets and approve this research run.</span></label><button type="button" className={`${primary} w-full`} disabled={!!busy || !confirmStart || !canRun} onClick={() => void startRun()}>{busy === 'start' ? 'Creating run…' : 'Confirm and start research'}</button></div>}
                </div>
              </section>
              <section className={panel} aria-label="Research run history"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Run history</h2><span className="text-xs text-slate-500">{runs.length} runs</span></div>{runs.length ? <div className="max-h-96 space-y-2 overflow-auto pr-1">{runs.map(run => <button key={run.id} type="button" onClick={() => setSelectedId(run.id)} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedId === run.id ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'}`}><div className="mb-2 flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-200">{run.ticker} <span className="text-xs font-normal text-slate-500">{run.trade_date}</span></span><Status status={run.status} /></div><p className="break-all font-mono text-[10px] text-slate-500">{run.id}</p>{run.request.mode === 'fixture' && <p className="mt-1 text-[10px] text-amber-300">Diagnostic fixture</p>}</button>)}</div> : <Empty>No runs yet. Create a research run to populate the journal.</Empty>}</section>
            </div>

            <div className="min-w-0 space-y-5">
              {!selectedRun ? <section className={panel}><Empty>Select a run to see real agent events, usage, source evidence and decisions.</Empty></section> : <>
                <section className={panel} aria-label="Selected research run"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">{selectedRun.ticker} <span className="text-base font-normal text-slate-400">· {selectedRun.trade_date}</span></h2><p className="mt-2 break-all font-mono text-xs text-slate-500">{selectedRun.id}</p></div><Status status={selectedRun.status} /></div><div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="Actual calls" value={selectedRun.usage.calls} hint={`Limit ${selectedRun.request.budget.max_calls}`} /><Metric label={selectedRun.usage.estimated ? "Estimated tokens used" : "Reported tokens used"} value={selectedRun.usage.total_tokens.toLocaleString()} hint={`Limit ${selectedRun.request.budget.max_tokens.toLocaleString()}`} /><Metric label={selectedRun.usage.estimated ? "Estimated USD cost" : "Recorded USD cost"} value={costText(selectedRun.usage.cost_usd, selectedRun.usage.price_known)} hint={selectedRun.usage.price_known ? selectedRun.usage.estimated ? 'Based on estimated token counts' : 'Based on configured rates' : 'Provider pricing unavailable'} /><Metric label="Attempt" value={selectedRun.attempt} hint={timeText(selectedRun.updated_at)} /></div>{selectedRun.error && <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200"><p>{selectedRun.error.message}</p><p className="mt-2 break-all font-mono text-[11px] text-rose-300/70">{selectedRun.error.code} · {selectedRun.error.error_id}</p></div>}{runActions(selectedRun)}<div className="mt-4"><JsonDetails title="Configuration, provenance and budget record" value={{ request: selectedRun.request, configuration_hash: selectedRun.configuration_hash, created_at: selectedRun.created_at, updated_at: selectedRun.updated_at, usage: selectedRun.usage }} /></div></section>
                <section className={panel} aria-label="Agent roles and events"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold text-white">12 agent roles</h2><Pill tone={stream.state === 'connected' ? 'green' : pending(selectedRun.status) ? 'amber' : 'muted'}>{stream.state === 'closed' ? 'Journal replay complete' : `Event stream ${stream.state}`}</Pill></div>{stream.message && <p className="mb-3 text-xs text-amber-300">{stream.message} Run snapshots refresh while work is active.</p>}<div className="grid grid-cols-2 gap-2 md:grid-cols-3">{roles.map(role => {
                  const skipped = !!role.analyst && !selectedRun.request.selected_analysts.includes(role.analyst);
                  const recorded = events.filter(event => event.node_id === role.id && event.seq > currentAttemptStart);
                  const lifecycle = recorded.filter(event => event.type.startsWith('node.'));
                  const last = lifecycle[lifecycle.length - 1];
                  const finished = last?.type === 'node.completed';
                  const started = last?.type === 'node.started';
                  const status = skipped ? 'Skipped by selection' : last ? finished ? 'Completed event' : started ? 'Started event' : last.type.replaceAll('_', ' ') : pending(selectedRun.status) ? 'Awaiting event' : 'No event recorded';
                  return <div key={role.id} className={`rounded-xl border p-3 ${skipped ? 'border-slate-800 bg-slate-950/40 opacity-60' : started ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-slate-800 bg-slate-950/50'}`}><p className="text-[10px] text-slate-600">{role.group}</p><h3 className="my-1 text-xs font-semibold text-slate-300">{role.label}</h3><p className={`text-[11px] ${finished ? 'text-emerald-400' : started ? 'text-cyan-300' : 'text-slate-500'}`}>{status}</p>{recorded.length > 0 && <p className="mt-1 text-[10px] text-slate-600">{recorded.length} recorded events</p>}</div>;
                })}</div><details className="mt-5 rounded-xl border border-slate-800 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-300">Event journal ({events.length} events)</summary><div className="mt-4 max-h-96 space-y-2 overflow-auto">{events.length ? events.slice(-100).map(event => <details key={event.seq} className="rounded-lg border border-slate-800 p-3"><summary className="cursor-pointer break-words text-xs text-slate-400"><span className="mr-2 font-mono text-slate-600">#{event.seq}</span><span className="font-semibold text-slate-200">{event.type}</span>{event.node_id && <span className="ml-2 text-cyan-300">{event.node_id}</span>}<span className="ml-2 text-slate-600">{timeText(event.at)}</span></summary><pre className="mt-3 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-500">{JSON.stringify({ payload: event.payload, hash: event.hash, previous_hash: event.previous_hash }, null, 2)}</pre></details>) : <p className="text-xs text-slate-500">No events received yet.</p>}</div>{events.length > 100 && <p className="mt-3 text-xs text-slate-500">Showing the latest 100 events. The full journal is included in run artifacts.</p>}</details></section>
                {decisionView || <section className={panel}><Empty>{pending(selectedRun.status) ? 'Decision pending. Reports and evidence appear after the research workflow returns.' : 'This run has no decision. Review its error and event journal.'}</Empty><div className="mt-4 flex flex-wrap gap-2"><button className={button} disabled={!!busy} onClick={() => void download(selectedRun, 'md')}>Download run Markdown</button><button className={button} disabled={!!busy} onClick={() => void download(selectedRun, 'json')}>Download run JSON</button></div></section>}
                <section className={panel} aria-label="Settlement and reflections"><h2 className="mb-4 text-lg font-semibold text-white">Settlement and reflections</h2>{selectedRun.request.mode === "research" && selectedRun.decision?.data_status === "ready" && selectedRun.status === "done" && selectedRun.trade_date < utcDate() && <div className="mb-4 rounded-xl border border-slate-800 p-4"><p className="mb-3 text-xs leading-relaxed text-slate-400">Settle eligible {selectedRun.ticker} research decisions through {utcDate()} UTC, including this run. Native returns and reflections are indicative; a portfolio performance study remains separate.</p><button className={button} disabled={!!busy || !canRun || runs.some(run => pending(run.status))} onClick={() => void settleThroughToday(selectedRun)}>{busy === `settle:${selectedRun.id}` ? "Checking outcomes…" : "Settle through today"}</button></div>}{selectedRun.settlement ? <JsonDetails title="Recorded settlement" value={selectedRun.settlement} open /> : <p className="text-sm leading-relaxed text-slate-500">No settlement is recorded. Research ratings are not realized returns.</p>}{reflectionEvents.length > 0 && <div className="mt-4 space-y-3">{reflectionEvents.map(event => <JsonDetails key={event.seq} title={`${event.type} · ${timeText(event.at)}`} value={event.payload} />)}</div>}<p className="mt-4 text-xs leading-relaxed text-slate-500">Outcome annotations and reflections must retain their source and timestamps. A reflection remains an interpretation of the evidence.</p></section>
              </>}
            </div>
          </div>}

          {tab === 'ledger' && <section className={panel}><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">Decision ledger</h2><p className="mt-2 text-xs text-slate-500">Separate run IDs preserve repeated research for the same ticker and date.</p></div><Pill>{ledger.length} entries</Pill></div><form className="mb-6 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={event => { event.preventDefault(); void loadLedger(ledgerFilter); }}><Field label="Ticker filter"><input className={input} value={ledgerFilter.ticker} placeholder="All tickers" onChange={event => setLedgerFilter(previous => ({ ...previous, ticker: event.target.value.toUpperCase() }))} /></Field><Field label="Rating filter"><select className={input} value={ledgerFilter.rating} onChange={event => setLedgerFilter(previous => ({ ...previous, rating: event.target.value }))}><option value="">All ratings</option>{['Buy', 'Overweight', 'Hold', 'Underweight', 'Sell', 'REVIEW'].map(rating => <option key={rating} value={rating}>{rating}</option>)}</select></Field><Field label="Date filter"><input className={input} type="date" value={ledgerFilter.date} onChange={event => setLedgerFilter(previous => ({ ...previous, date: event.target.value }))} /></Field><button className={primary} disabled={ledgerLoading} type="submit">{ledgerLoading ? 'Loading…' : 'Filter decisions'}</button></form>{ledger.length ? <div className="space-y-3">{ledger.map(run => <details key={run.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"><summary className="cursor-pointer"><span className="mr-3 text-sm font-semibold text-white">{run.ticker}</span><span className="mr-3 text-xs text-slate-500">{run.trade_date}</span><Pill tone={run.decision?.rating === 'REVIEW' ? 'amber' : 'cyan'}>{run.decision?.rating || 'No decision'}</Pill><span className="ml-2"><Status status={run.status} /></span><span className="mt-2 block break-all font-mono text-[10px] text-slate-600">{run.id} · {timeText(run.created_at)}</span></summary><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">{run.decision?.executive_summary || 'No executive summary recorded.'}</p><div className="mt-4 space-y-3">{run.settlement ? <JsonDetails title="Settlement and recorded evaluation" value={run.settlement} /> : <p className="text-xs text-slate-500">Unsettled</p>}{run.decision?.baseline && <JsonDetails title="Indicative baseline evaluation" value={run.decision.baseline} />}</div><button className={`${button} mt-4`} onClick={() => { updateRun(run); setSelectedId(run.id); setTab('research'); }}>Open full run and reflections</button></details>)}</div> : <Empty>{ledgerLoading ? 'Loading decision ledger…' : 'No decisions match these filters.'}</Empty>}</section>}

          {tab === 'evaluation' && <div className="space-y-5"><section className={`${panel} border-amber-500/25`}><h2 className="text-xl font-semibold text-white">Indicative decision evaluation</h2><p className="mt-3 text-sm leading-relaxed text-amber-200/90">Predictive value is unvalidated. Historical-date research can contain information learned after that date. Workflow completion and rating counts do not establish trading edge.</p><p className="mt-2 text-xs leading-relaxed text-slate-500">A valid performance study needs point-in-time inputs, settled outcomes, executable prices, costs and a predefined out-of-sample protocol.</p></section><div className="grid items-start gap-5 lg:grid-cols-2"><section className={panel}><h3 className="mb-4 text-lg font-semibold text-white">Create evaluation batch</h3><p className="mb-4 text-xs leading-relaxed text-slate-500">Uses the models, analysts, portfolio and per-run budgets configured in Research. Up to 4 tickers × 3 dates (12 cells).</p><div className="space-y-4"><Field label="Tickers" hint="Comma or space separated"><input className={input} value={batchTickers} placeholder="MSFT, AAPL, NVDA" onChange={event => setBatchTickers(event.target.value.toUpperCase())} /></Field><Field label="Research dates" hint="YYYY-MM-DD, separated by commas or new lines"><textarea className={`${input} h-24 resize-y`} value={batchDates} placeholder="2026-09-01, 2026-09-08" onChange={event => setBatchDates(event.target.value)} /></Field><JsonDetails title="Shared run configuration" value={{ models: { deep: draft.deep, quick: draft.quick }, selected_analysts: draft.analysts, debate_rounds: draft.debateRounds, risk_rounds: draft.riskRounds, max_calls: draft.maxCalls, max_tokens: draft.maxTokens, max_output_tokens: draft.maxOutput, max_duration_seconds: draft.maxSeconds, max_cost_usd: draft.maxCost || null }} /><button className={`${primary} w-full`} disabled={!!busy || !canRun} onClick={() => void reviewBatch()}>{busy === 'batch-estimate' ? 'Estimating…' : 'Review batch cost'}</button>{batchEstimate?.key === batchKey && <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4"><h4 className="mb-3 text-sm font-semibold text-cyan-200">Planning estimate · {batchEstimate.tickers.length * batchEstimate.dates.length} cells</h4><div className="grid grid-cols-2 gap-3"><Metric label="Expected total calls" value={batchEstimate.value.expected_calls * batchEstimate.tickers.length * batchEstimate.dates.length} /><Metric label="Estimated total USD" value={costText(batchEstimate.value.estimated_cost_usd === null ? null : batchEstimate.value.estimated_cost_usd * batchEstimate.tickers.length * batchEstimate.dates.length, batchEstimate.value.price_known)} /></div><p className="mt-3 text-xs leading-relaxed text-slate-500">Planning estimate for one cell multiplied by cell count. Actual usage varies. Budgets apply to each cell.</p>{batchEstimate.value.warnings.map((warning, index) => <p key={index} className="mt-2 text-xs text-amber-300">{warning}</p>)}{!batchEstimate.value.price_known && <p className="mt-3 text-xs text-amber-300">USD cost is unknown; provider charges may apply.</p>}<label className="my-4 flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-slate-300"><input type="checkbox" className="mt-0.5 accent-cyan-400" checked={confirmBatch} onChange={event => setConfirmBatch(event.target.checked)} /><span>I reviewed the total estimate and approve all cells in this evaluation batch.</span></label><button className={`${primary} w-full`} disabled={!!busy || !confirmBatch || !canRun} onClick={() => void startBatch()}>{busy === 'batch-start' ? 'Creating batch…' : 'Confirm and start evaluation'}</button></div>}</div></section><section className={panel}><h3 className="mb-4 text-lg font-semibold text-white">Resume or inspect a batch</h3><Field label="Batch ID"><input className={input} value={batchLookup} placeholder="Paste an existing batch ID" onChange={event => setBatchLookup(event.target.value)} /></Field><button className={`${button} mt-4`} disabled={!!busy || !batchLookup.trim()} onClick={() => void lookupBatch()}>Load batch</button><div className="mt-5 space-y-2">{[...new Set<string>(runs.map(run => run.batch_id).filter((id): id is string => !!id))].map(id => <button className="block w-full break-all rounded-xl border border-slate-800 p-3 text-left font-mono text-xs text-slate-400 hover:border-cyan-500/40" key={id} onClick={() => { setBatchLookup(id); setBusy('batch-lookup'); researchService.batch(id).then(setBatch).catch(error => setNotice({ kind: 'error', message: errorText(error) })).finally(() => setBusy(null)); }}>{id}</button>)}</div></section></div>{batch && <section className={panel}><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold text-white">Evaluation results</h3><p className="mt-2 break-all font-mono text-xs text-slate-500">{batch.id}</p></div><button className={button} disabled={!!busy || !canRun || !batch.runs.some(run => resumable(run.status) && run.error?.code !== 'RESEARCH_BUDGET_EXHAUSTED')} onClick={() => void resumeBatch()}>Resume incomplete cells</button></div><div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="Completed" value={batch.summary.completed} /><Metric label="Failed" value={batch.summary.failed} /><Metric label="Pending" value={batch.summary.pending} /><Metric label="Review / insufficient" value={batch.summary.review} /></div><div className="mb-5 flex flex-wrap gap-2">{Object.entries(batch.summary.by_rating).map(([rating, count]) => <Pill key={rating}>{rating}: {count}</Pill>)}</div>{batch.summary.limitations.map((limitation, index) => <p key={index} className="mb-2 text-xs leading-relaxed text-amber-300">{limitation}</p>)}<div className="mt-5 space-y-2">{batch.runs.map(run => <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 p-3"><div><p className="text-sm text-slate-200">{run.ticker} · {run.trade_date} <span className="ml-2 text-cyan-300">{run.decision?.rating || 'No decision'}</span></p><p className="mt-2 break-all font-mono text-[10px] text-slate-600">{run.id}</p>{run.error && <p className={`mt-2 text-xs ${run.error.code === 'RESEARCH_BUDGET_EXHAUSTED' ? 'text-amber-300' : 'text-rose-300'}`}>{run.error.message}</p>}</div><div className="flex items-center gap-3"><Status status={run.status} /><button className={button} onClick={() => { updateRun(run); setSelectedId(run.id); setTab('research'); }}>Open run</button></div></div>)}</div><div className="mt-5"><JsonDetails title="Full indicative evaluation metrics and limitations" value={batch.summary} /></div></section>}</div>}
        </>
      )}
    </div>
  );
};

export default GnoesisResearch;
