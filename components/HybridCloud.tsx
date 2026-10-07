import React, { useEffect, useState } from 'react';
import { CLOUD_PROVIDERS, type CloudDomain, type CloudProvider, type CloudOperation, type CloudJob, type HybridView } from '../lib/hybrid-contract';
import { hybridRequest } from '../services/hybridService';
import SystemSetup from './SystemSetup';
import ZoMcpConnection from './ZoMcpConnection';
import GatewayPolicies from './GatewayPolicies';

const field = 'w-full rounded-xl border border-slate-700 bg-[#071124] px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 disabled:opacity-50';
const button = 'rounded-xl border border-cyan-600/50 bg-cyan-900/20 px-4 py-2 text-sm text-cyan-100 disabled:opacity-40';
const labels: Record<CloudProvider, string> = { zo: 'Zo Computer', abacus: 'Abacus.AI', fireworks: 'Fireworks.AI' };
const operations: Record<CloudOperation, string> = { zo_report: 'Zo operations report', abacus_forecast: 'Abacus forecast', fireworks_sft: 'Fireworks supervised fine-tuning', fireworks_infer: 'Fireworks model response' };
const templates: Record<CloudOperation, object> = { zo_report: { input: 'Summarize the approved operational evidence.' }, abacus_forecast: { queryData: { entity_id: 'replace-with-your-deployment-entity' } }, fireworks_sft: { dataset: 'accounts/YOUR_ACCOUNT/datasets/TRAIN', evaluationDataset: 'accounts/YOUR_ACCOUNT/datasets/VALIDATION', baseModel: 'accounts/fireworks/models/YOUR_BASE_MODEL', epochs: 1 }, fireworks_infer: { input: 'Extract structured facts from the approved evidence.' } };
const sha = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(x => x.toString(16).padStart(2, '0')).join('');

export default function HybridCloud() {
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname);
  const [view, setView] = useState<HybridView>();
  const [bridge, setBridge] = useState<{ paperclipReachable: boolean; localModelReachable: boolean; clients: { id: string; bound: boolean }[] }>();
  const checkBridge = async () => {
    const response = await fetch('/api/business-bridge/status', { headers: { 'X-Quanta-Client': 'local-ui' } });
    if (!response.ok) throw new Error('Business bridge status is unavailable.');
    setBridge(await response.json());
  };
  const [domain, setDomain] = useState<CloudDomain>('business'), [provider, setProvider] = useState<CloudProvider>('zo');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [apiKey, setApiKey] = useState(''), [clearKey, setClearKey] = useState(false);
  const [cloudModels, setCloudModels] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { setCloudModels([]); }, [domain, provider]);
  const [config, setConfig] = useState({ enabled: false, accountId: '', deploymentId: '', model: '', monthlyCapUsd: 0 });
  const [operation, setOperation] = useState<CloudOperation>('zo_report'), [payload, setPayload] = useState(JSON.stringify(templates.zo_report, null, 2));
  const [label, setLabel] = useState(''), [cost, setCost] = useState(''), [datasetHash, setDatasetHash] = useState('');
  const [schema, setSchema] = useState('v1'), [definition, setDefinition] = useState(''), [commit, setCommit] = useState('');
  const [availableAt, setAvailableAt] = useState(new Date().toISOString()), [expiresAt, setExpiresAt] = useState('');
  const [selected, setSelected] = useState(''), [approveExport, setApproveExport] = useState(false), [approveSpend, setApproveSpend] = useState(false), [approvePromotion, setApprovePromotion] = useState(false);
  const [metric, setMetric] = useState(''), [direction, setDirection] = useState<'higher' | 'lower'>('higher'), [baseline, setBaseline] = useState(''), [candidate, setCandidate] = useState(''), [holdout, setHoldout] = useState(''), [evidence, setEvidence] = useState(''), [evaluator, setEvaluator] = useState('');
  const refresh = async () => setView(await hybridRequest('/status'));
  useEffect(() => { if (local) void refresh().catch(e => setError(e.message)); }, []);
  useEffect(() => {
    const c = view?.policies[domain].connections[provider];
    if (c) setConfig({ enabled: c.enabled, accountId: c.accountId, deploymentId: c.deploymentId, model: c.model, monthlyCapUsd: view!.policies[domain].monthlyCapUsd });
    setApiKey(''); setClearKey(false);
  }, [view, domain, provider]);
  useEffect(() => { setSelected(''); }, [domain]);
  useEffect(() => { setApproveExport(false); setApproveSpend(false); setApprovePromotion(false); setMetric(''); setBaseline(''); setCandidate(''); setHoldout(''); setEvidence(''); setEvaluator(''); }, [selected]);
  const act = async (fn: () => Promise<unknown>, success: string) => {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try { await fn(); await refresh(); setMessage(success); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const jobs = view?.jobs.filter(j => j.domain === domain).slice().reverse() || [];
  const job = jobs.find(j => j.id === selected);
  const input = (title: string, value: string, onChange: (value: string) => void, type = 'text') => <label className="block space-y-1 text-sm text-slate-300"><span>{title}</span><input className={field} type={type} value={value} disabled={busy} onChange={e => onChange(e.target.value)} /></label>;
  if (!local) return <p className="text-slate-300">Open Hybrid Cloud from the local Quanta server on this computer. Cloud credential editing is available there.</p>;
  return <section className="space-y-6" aria-label="Hybrid Cloud operations">
    <div><h2 className="text-2xl font-semibold text-white">Hybrid Cloud</h2><p className="mt-2 text-sm text-slate-400">Local control · Zo operations · Abacus forecasting · Fireworks fine-tuning</p><a href="/hybrid.html" className="text-sm text-cyan-300">Open local operations panel</a></div>
    <p className="rounded-xl border border-cyan-700/40 p-4 text-sm text-cyan-100">Trading runs in paper mode. Each cloud job starts as a local draft; review its exact data and spending reservation before submitting. Local model routes remain available independently.</p>
    <div className="flex flex-wrap gap-3">{(['business', 'trading'] as const).map(d => <button key={d} disabled={busy} aria-pressed={domain === d} className={`${button} ${domain === d ? 'ring-2 ring-cyan-400' : ''}`} onClick={() => setDomain(d)}>{d === 'business' ? 'Business' : 'Trading'}</button>)}<button disabled={busy} className={button} onClick={() => act(refresh, 'Local status refreshed. No cloud call was sent.')}>Refresh local status</button></div>
    {domain === 'business' && <div className="space-y-3 rounded-2xl border border-slate-700 p-5">
      <h3 className="font-semibold text-white">Business model bridge</h3>
      <p className="text-sm text-slate-300">Paperclip coordinates planning work. Activepieces and Twenty can use separate server-side model connectors. Cloud requests enter the Business approval queue.</p>
      <div className="flex flex-wrap gap-3"><a className={button} href="http://127.0.0.1:3210" target="_blank" rel="noreferrer">Open Paperclip</a><button className={button} disabled={busy} onClick={() => act(checkBridge, 'Business connector health checked. No model request was sent.')}>Check business bridge</button></div>
      {bridge && <div className="text-sm text-slate-300" aria-live="polite"><p>Paperclip: {bridge.paperclipReachable ? 'Responding' : 'Unavailable'} · Local model catalog: {bridge.localModelReachable ? 'Responding · model response still needs testing' : 'Unavailable · start and configure a local model'}</p><p>Prepared connectors: {bridge.clients.map(c => `${c.id}${c.bound ? '' : ' (not bound)'}`).join(', ') || 'None'}</p></div>}
      <p className="text-xs text-slate-400">The Business Model Analyst is provisioned paused. Prepared connectors do not mean Activepieces or Twenty is installed. Model output is a proposal for review.</p>
    </div>}
    <SystemSetup />
    <details className="space-y-6 rounded-2xl border border-slate-700 p-5"><summary className="cursor-pointer font-semibold text-cyan-200">Advanced integrations and reviewed cloud jobs</summary>
    <ZoMcpConnection />
    <GatewayPolicies />
    <div className="grid gap-3 md:grid-cols-3">{CLOUD_PROVIDERS.map(p => <button key={p} disabled={busy} aria-pressed={provider === p} className={`rounded-xl border p-4 text-left ${provider === p ? 'border-cyan-400 bg-cyan-950/40' : 'border-slate-700'}`} onClick={() => setProvider(p)}><span className="block font-semibold text-white">{labels[p]}</span><span className="mt-2 block text-sm text-slate-400">{view?.policies[domain].connections[p].state || 'Loading'} · {view?.policies[domain].connections[p].enabled ? 'Enabled' : 'Disabled'}</span></button>)}</div>
    {view && <div className="space-y-4 rounded-2xl border border-slate-700 p-5">
      <h3 className="font-semibold text-white">{labels[provider]} · {domain === 'business' ? 'Business' : 'Trading'} connection</h3>
      {provider === 'zo' && <p className="text-sm text-slate-300">Zo Computer connects with an access token from Settings → Advanced. <a href="https://www.zo.computer/guide/api" target="_blank" rel="noreferrer" className="text-cyan-300">Official API setup</a></p>}
      {provider !== 'abacus' && <><button className={button} disabled={busy || !view.policies[domain].connections[provider].hasKey} onClick={() => act(async () => { const result = await hybridRequest<{ models: { id: string; name: string }[] }>(`/connections/${domain}/${provider}/models`); setCloudModels(result.models); }, 'Available cloud models loaded. No inference request sent.')}>Load {labels[provider]} models</button><label className="block text-sm text-slate-300">Available {labels[provider]} models<select className={field} value={config.model} disabled={busy} onChange={e => setConfig({ ...config, model: e.target.value })}><option value="">Provider default / choose a model</option>{config.model && !cloudModels.some(m => m.id === config.model) && <option value={config.model}>{config.model} · saved</option>}{cloudModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><p className="text-xs text-slate-400">Save this connection to pin your selection for future reviewed jobs.</p></>}
      <label className="flex gap-2 text-sm text-slate-200"><input type="checkbox" disabled={busy} checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} /> Enable this domain’s cloud connection</label>
      {input(provider === 'abacus' ? 'Deployment token' : 'API access token', apiKey, setApiKey, 'password')}
      <p className="text-xs text-slate-400">{view.policies[domain].connections[provider].hasKey ? 'A credential is encrypted locally. Leave blank to retain it.' : 'No credential configured.'} Business and Trading credentials are stored separately. Zo tokens grant full workspace access; use a dedicated workspace.</p>
      <label className="flex gap-2 text-sm text-slate-300"><input type="checkbox" checked={clearKey} disabled={busy} onChange={e => setClearKey(e.target.checked)} /> Remove credential when saving</label>
      {provider === 'fireworks' && <>{input('Fireworks account ID', config.accountId, v => setConfig({ ...config, accountId: v }))}{input('Baseline inference model ID', config.model, v => setConfig({ ...config, model: v }))}</>}
      {provider === 'abacus' && input('Pinned forecast deployment ID', config.deploymentId, v => setConfig({ ...config, deploymentId: v }))}
      {input('Monthly reservation cap for this domain (USD)', String(config.monthlyCapUsd), v => setConfig({ ...config, monthlyCapUsd: Number(v) }), 'number')}
      <p className="text-xs text-slate-400">Reserved this UTC month: ${view.reservedUsd[domain].toFixed(2)}. Reservations limit approved job estimates; they cannot enforce a provider invoice ceiling. Configure provider-side spending controls too.</p>
      <div className="flex flex-wrap gap-3"><button className={button} disabled={busy} onClick={() => act(() => hybridRequest(`/connections/${domain}/${provider}`, 'PUT', { ...config, apiKey, clearKey }), 'Connection saved locally. No job submitted.')}>Save cloud connection</button>{provider !== 'abacus' && <button className={button} disabled={busy || !view.policies[domain].connections[provider].hasKey} onClick={() => act(() => hybridRequest(`/connections/${domain}/${provider}/check`, 'POST', {}), 'Catalog authentication succeeded. Inference remains untested.')}>Check catalog authentication</button>}</div>
      {provider === 'abacus' && <p className="text-xs text-slate-400">Use an existing forecast deployment from your MLOps account. Training and deployment setup remain in Abacus; an approved forecast job verifies the local connection.</p>}
    </div>}
    <div className="space-y-4 rounded-2xl border border-slate-700 p-5">
      <h3 className="font-semibold text-white">Prepare a local job</h3>
      <label className="block space-y-1 text-sm text-slate-300"><span>Operation</span><select className={field} disabled={busy} value={operation} onChange={e => { const op = e.target.value as CloudOperation; setOperation(op); setPayload(JSON.stringify(templates[op], null, 2)); setDatasetHash(''); }}>{Object.entries(operations).map(([op, title]) => <option key={op} value={op}>{title}</option>)}</select></label>
      {input('Job label', label, setLabel)}
      <label className="block space-y-1 text-sm text-slate-300"><span>Exact payload (JSON)</span><textarea className={`${field} min-h-36 font-mono`} disabled={busy} value={payload} onChange={e => { setPayload(e.target.value); setDatasetHash(''); }} /></label>
      <p className="text-xs text-slate-400">Fine-tuning uses existing approved Fireworks training and validation dataset IDs. The final independent holdout stays local. Zo requests may invoke workspace tools; use a report-only workspace with approved integrations.</p>
      <div className="grid gap-4 md:grid-cols-2">{input('Dataset / source snapshot SHA-256', datasetHash, setDatasetHash)}{input('Upper-bound spending estimate (USD)', cost, setCost, 'number')}{input('Feature / payload schema version', schema, setSchema)}{input('Code commit or experiment version', commit, setCommit)}{input('Source available at (ISO timestamp)', availableAt, setAvailableAt)}{input('Expires at (required for Trading, ISO timestamp)', expiresAt, setExpiresAt)}</div>
      {operation !== 'fireworks_sft' && <button className={button} disabled={busy} onClick={() => act(async () => setDatasetHash(await sha(JSON.stringify(JSON.parse(payload)))), 'Exact JSON payload hashed. Use the canonical dataset hash if this payload references a separate dataset.')}>Hash this payload as source snapshot</button>}
      {input('Target / label definition', definition, setDefinition)}
      <button className={button} disabled={busy} onClick={() => act(async () => { const created = await hybridRequest<CloudJob>('/jobs', 'POST', { domain, operation, label, estimatedUpperBoundUsd: Number(cost), datasetHash, schemaVersion: schema, labelDefinition: definition, sourceAvailableAt: availableAt, codeCommit: commit, ...(expiresAt ? { expiresAt } : {}), payload: JSON.parse(payload) }, crypto.randomUUID()); setSelected(created.id); }, 'Draft stored locally. Review it below before approval.')}>Create local draft</button>
    </div>
    <div className="space-y-4 rounded-2xl border border-slate-700 p-5"><h3 className="font-semibold text-white">{domain === 'business' ? 'Business' : 'Trading'} jobs and model registry</h3>
      {!jobs.length && <p className="text-sm text-slate-400">No jobs yet. No cloud activity has been started.</p>}
      <div className="space-y-2">{jobs.slice(0, 50).map(j => <button key={j.id} disabled={busy} className={`w-full rounded-xl border p-3 text-left text-sm ${selected === j.id ? 'border-cyan-400' : 'border-slate-700'}`} onClick={() => setSelected(j.id)}><span className="text-white">{j.label}</span><span className="ml-3 text-slate-400">{j.status} · {operations[j.operation]} · ${j.estimatedUpperBoundUsd.toFixed(2)}</span></button>)}</div>
      {job && <div className="space-y-4">
        <pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-300">{JSON.stringify(job, null, 2)}</pre>
        {job.status === 'draft' && <><label className="flex gap-2 text-sm text-slate-200"><input type="checkbox" checked={approveExport} disabled={busy} onChange={e => setApproveExport(e.target.checked)} /> Approve exporting this exact payload / using these cloud dataset IDs</label><label className="flex gap-2 text-sm text-slate-200"><input type="checkbox" checked={approveSpend} disabled={busy} onChange={e => setApproveSpend(e.target.checked)} /> Approve the ${job.estimatedUpperBoundUsd.toFixed(2)} reservation</label><button className={button} disabled={busy || !approveExport || !approveSpend} onClick={() => act(() => hybridRequest(`/jobs/${job.id}/approve`, 'POST', { approveDataExport: approveExport, approveSpend }), 'Job approved locally. Submit when ready.')}>Approve job</button></>}
        {job.status === 'approved' && <button className={button} disabled={busy} onClick={() => act(() => hybridRequest(`/jobs/${job.id}/run`, 'POST', {}), 'Submission processed. Review the recorded job status and artifact.')}>Submit approved cloud job</button>}
        {['draft', 'approved'].includes(job.status) && <button className={button} disabled={busy} onClick={() => act(() => hybridRequest(`/jobs/${job.id}/cancel`, 'POST', {}), 'Unsubmitted job cancelled.')}>Cancel local job</button>}
        {job.status === 'submitted' && <button className={button} disabled={busy} onClick={() => act(() => hybridRequest(`/jobs/${job.id}/poll`, 'POST', {}), 'Remote training status checked. No training submission was retried.')}>Check training status</button>}
        {job.status === 'succeeded' && <div className="space-y-3"><h4 className="text-white">Record independent evaluation</h4><p className="text-xs text-slate-400">Record measured holdout results and evidence from an independent evaluation. Entered scores are operator records, not automatic proof of trading edge.</p><div className="grid gap-3 md:grid-cols-2">{input('Metric', metric, setMetric)}<label className="text-sm text-slate-300">Metric direction<select className={field} disabled={busy} value={direction} onChange={e => setDirection(e.target.value as 'higher' | 'lower')}><option value="higher">Higher is better</option><option value="lower">Lower is better</option></select></label>{input('Untuned / local baseline score', baseline, setBaseline, 'number')}{input('Candidate score', candidate, setCandidate, 'number')}{input('Independent holdout SHA-256', holdout, setHoldout)}{input('Evaluator version', evaluator, setEvaluator)}</div><label className="block text-sm text-slate-300">Evidence and limitations<textarea className={`${field} min-h-24`} disabled={busy} value={evidence} onChange={e => setEvidence(e.target.value)} /></label><button className={button} disabled={busy || !baseline || !candidate} onClick={() => act(() => hybridRequest(`/jobs/${job.id}/evaluate`, 'POST', { metric, direction, baselineScore: Number(baseline), candidateScore: Number(candidate), holdoutHash: holdout, evidence, evaluatorVersion: evaluator }), 'Evaluation recorded. Only an improving, independently evaluated tuned model can be promoted.')}>Record evaluation</button>
          {job.operation === 'fireworks_sft' && job.evaluationPassed && <><label className="flex gap-2 text-sm text-slate-200"><input type="checkbox" disabled={busy} checked={approvePromotion} onChange={e => setApprovePromotion(e.target.checked)} /> Approve this tuned model for {domain} Fireworks jobs</label><button className={button} disabled={busy || !approvePromotion} onClick={() => act(() => hybridRequest(`/jobs/${job.id}/promote`, 'POST', { approvePromotion }), 'Tuned model pinned for this domain’s future Fireworks response jobs.')}>Promote tuned model</button></>}
        </div>}
      </div>}
      <p className="text-sm text-slate-300">Active tuned model: {view?.registry[domain].fireworks?.model || 'None · configured baseline will be used'}</p>
      {view?.registry[domain].fireworks && <button className={button} disabled={busy} onClick={() => act(() => hybridRequest(`/registry/${domain}/rollback`, 'POST', {}), 'Model registry rolled back; default local routes were preserved.')}>Roll back tuned model</button>}
    </div>
    </details>
    <div aria-live="polite">{busy && <p className="text-cyan-300">Processing…</p>}{error && <p role="alert" className="text-rose-300">{error}</p>}{message && <p className="text-emerald-300">{message}</p>}</div>
  </section>;
}
