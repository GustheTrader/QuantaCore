import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ConnectionSummary from './ConnectionSummary';
import { saveVerifiedSubscription, loadProviderConnections, loadLocalRuntime, completeWithProvider, setPreferredInferenceProvider, type ProviderConfigResponse, type LocalRuntime } from '../services/inferenceService';
import { getProviderDefinition } from '../lib/inference-providers';
import ModelsPanel from './ModelsPanel';

type SubscriptionModel = { agent: string; model: string; label: string };
const subscriptionLabels: Record<string, string> = { codex: 'Codex', claude: 'Claude', 'grok-native': 'Grok', gemini: 'Gemini' };
async function subscriptionRequest(path: string, body?: unknown) {
  const response = await fetch('/api/hermes/work/coding/' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Subscription request failed.');
  return data;
}
const button = 'rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-cyan-300';

export default function StartupConnection({ onContinue, prelaunch = false, onSetup }: { onContinue: () => void; prelaunch?: boolean; onSetup?: () => void }) {
  const [config, setConfig] = useState<ProviderConfigResponse>();
  const [subscriptions, setSubscriptions] = useState<SubscriptionModel[]>([]);
  const [subscription, setSubscription] = useState('');
  const [runtime, setRuntime] = useState<LocalRuntime>();
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tested, setTested] = useState('');
  const [reply, setReply] = useState('');
  const [checkedAt, setCheckedAt] = useState('');
  const refresh = async () => {
    setBusy(true); setError('');
    const results = await Promise.allSettled([loadProviderConnections(), loadLocalRuntime(), subscriptionRequest('subscription-models')]);
    if (results[0].status === 'fulfilled') { setConfig(results[0].value); setProvider(results[0].value.preferredProvider); }
    else setError(results[0].reason?.message || 'Backend unavailable. Run C:\\QuantaCore\\Start-Quanta.ps1.');
    if (results[1].status === 'fulfilled') setRuntime(results[1].value);
    if (results[2].status === 'fulfilled') {
      const models = results[2].value.models as SubscriptionModel[]; setSubscriptions(models);
      setSubscription(previous => models.some(m => m.agent + '/' + m.model === previous) ? previous : models[0] ? models[0].agent + '/' + models[0].model : '');
      if (results[2].value.warnings?.length) setError(results[2].value.warnings.join(' · '));
    } else setError(results[2].reason?.message || 'Subscription models unavailable.');
    setCheckedAt(new Date().toLocaleTimeString()); setBusy(false);
  };
  useEffect(() => { void refresh(); }, []);
  const routes = config?.connections.filter(c => c.model && (!getProviderDefinition(c.id)?.requiresKey || c.hasKey)) || [];
  const selected = routes.find(c => c.id === provider);
  const selectedSubscription = subscriptions.find(m => m.agent + '/' + m.model === subscription);
  const identity = selectedSubscription ? subscription : selected ? selected.id + '/' + selected.model : '';
  const verify = async () => {
    if (!selected && !selectedSubscription) return;
    setBusy(true); setError('');
    try {
      if (selectedSubscription) {
        const result = await subscriptionRequest('test-inference', { agent: selectedSubscription.agent, model: selectedSubscription.model });
        saveVerifiedSubscription(selectedSubscription);
        setTested(identity); setReply(result.reply); return;
      }
      if (!selected) return;
      const response = await completeWithProvider(selected.id, { model: selected.model, messages: [{ role: 'user', content: 'Connection check: reply READY.' }], max_tokens: 32 });
      const text = response.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new Error('The model returned no usable text.');
      await setPreferredInferenceProvider(selected.id);
      setTested(identity); setReply(text.slice(0, 200));
    } catch (e) { setError(e instanceof Error ? e.message : 'Model test failed.'); }
    finally { setBusy(false); }
  };
  const verified = Boolean(identity && tested === identity);
  if (prelaunch) return <div className="space-y-5"><ConnectionSummary onSetup={onSetup} /><p className="text-sm text-slate-300">Review the current connections above. Opening the workspace starts no model requests or tool jobs.</p><button className={button} disabled={busy} onClick={onContinue}>Open agent workspace</button></div>;
  return <section aria-label="Connect models and tools" className="space-y-6 pb-12">
    <header><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Step 1 · Connections</p><h1 className="mt-2 text-3xl font-bold text-white">Connect models & tools</h1><p className="mt-3 text-slate-300">Connect a model first. Google apps are optional. Then send a test reply before adding agents and workflows.</p></header>
    <ModelsPanel onChange={() => void refresh()} />
    <section className="space-y-4 rounded-2xl border border-cyan-300/30 bg-slate-900/50 p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Step 2 · Inference</p>
      <h2 className="text-xl font-bold text-white">Check your first reply</h2>
      <p className="text-sm text-slate-300">Choose a model from your connected subscriptions, then test a reply. No API key needed. Model access is confirmed by the test; your plan’s limits apply.</p>
      <label className="block text-sm text-slate-300">Subscription model<select aria-label="Subscription model" disabled={busy} value={subscription} onChange={e => { setSubscription(e.target.value); setTested(''); setReply(''); setError(''); }} className="mt-2 w-full rounded-xl bg-slate-950 p-3 text-white"><option value="">Choose a subscription model</option>{['codex', 'claude', 'grok-native', 'gemini'].filter(agent => subscriptions.some(m => m.agent === agent)).map(agent => <optgroup key={agent} label={subscriptionLabels[agent] + ' · subscription'}>{subscriptions.filter(m => m.agent === agent).map(m => <option key={m.agent + '/' + m.model} value={m.agent + '/' + m.model}>{m.label}</option>)}</optgroup>)}</select></label>
      {selectedSubscription && <p className="text-sm text-cyan-200">Model ID: <code>{selectedSubscription.model}</code> · {subscriptionLabels[selectedSubscription.agent]} subscription</p>}
      {!subscriptions.length && <p className="text-sm text-slate-400">Connect a subscription above, then refresh connections.</p>}
      <label className="block text-sm text-slate-300">API key / local model (optional)<select aria-label="Startup model route" disabled={busy} value={!subscription && selected ? provider : ''} onChange={e => { setProvider(e.target.value); setSubscription(''); setTested(''); setReply(''); setError(''); }} className="mt-2 w-full rounded-xl bg-slate-950 p-3 text-white"><option value="">Choose a configured model</option>{routes.map(c => <option key={c.id} value={c.id}>{getProviderDefinition(c.id)?.label} · {c.model}</option>)}</select></label>
      <div className="flex flex-wrap gap-3"><button className={button} disabled={busy || (!selected && !selectedSubscription)} onClick={verify}>{busy ? 'Checking…' : 'Test inference'}</button><button className={button} disabled={busy} onClick={() => void refresh()}>Refresh connections</button></div>
      <p role="status" className="text-sm text-emerald-300">{verified ? 'Inference works · ' + reply : 'No successful reply verified yet.'}</p>
      <p className="text-xs text-slate-400">The test sends one short prompt using your selected provider’s quota.</p>
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
    </section>
    <button className={verified ? button + ' bg-emerald-500/25 border-emerald-300 text-emerald-100 shadow-lg shadow-emerald-500/20' : button} disabled={!verified || busy} onClick={onContinue}>Continue to dashboard</button>
    <details className="rounded-xl border border-slate-700 p-4"><summary className="cursor-pointer text-sm text-slate-400">More setup options</summary><div className="mt-4 flex flex-wrap gap-3"><Link className={button} to="/settings">Local models and advanced settings</Link><button className={button} onClick={onContinue}>Open dashboard without a reply test</button></div></details>
  </section>;
}
