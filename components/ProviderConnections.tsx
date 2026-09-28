import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { COMPATIBLE_PROVIDERS, getProviderDefinition, type CompatibleProvider, type ProviderConnection, type ProviderModel } from '../lib/inference-providers';
import { copyLocalGatewayKey, loadProviderConnections, loadProviderModels, saveProviderConnection, setPreferredInferenceProvider } from '../services/inferenceService';
import type { ComputeProvider } from '../types';

type Draft = ProviderConnection & { apiKey: string; clearKey?: boolean };
const field = 'w-full rounded-xl border border-slate-700 bg-[#071124] px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15 disabled:opacity-60';

export default function ProviderConnections() {
  const [drafts, setDrafts] = useState<Partial<Record<CompatibleProvider, Draft>>>({});
  const [selected, setSelected] = useState<CompatibleProvider>(import.meta.env.PROD ? 'openrouter' : 'openai-compatible');
  const [preferred, setPreferred] = useState<ComputeProvider>('gemini');
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    loadProviderConnections().then(config => {
      if (!current) return;
      setDrafts(Object.fromEntries(config.connections.map(connection => [connection.id, { ...connection, apiKey: '' }])));
      setPreferred(config.preferredProvider);
    }).catch(error => current && setError(error.message));
    return () => { current = false; };
  }, []);
  const definition = getProviderDefinition(selected)!;
  const draft = drafts[selected];
  const providers = import.meta.env.PROD ? COMPATIBLE_PROVIDERS.filter(provider => provider.id === 'openrouter') : COMPATIBLE_PROVIDERS;
  const change = (value: Partial<Draft>) => setDrafts(previous => ({ ...previous, [selected]: { ...previous[selected]!, ...value } }));
  const run = async (action: 'save' | 'models' | 'use' | 'key') => {
    if (busy) return;
    setBusy(true); setMessage(''); setError('');
    try {
      if (action === 'key') {
        await copyLocalGatewayKey();
        setMessage('Local API key copied. Use it as the Bearer token in your client.');
      } else if (draft) {
        const config = await saveProviderConnection(selected, { baseUrl: draft.baseUrl, model: draft.model, apiKey: draft.apiKey, clearKey: draft.clearKey });
        const saved = config.connections.find(connection => connection.id === selected)!;
        setDrafts(previous => ({ ...previous, [selected]: { ...saved, apiKey: '', clearKey: false } }));
        if (action === 'models') {
          const catalog = await loadProviderModels(selected);
          setModels(catalog);
          setMessage(`${catalog.length} models loaded. Select a chat model from the list or enter its exact ID.`);
        } else if (action === 'use') {
          await setPreferredInferenceProvider(selected); setPreferred(selected);
          setMessage(`${definition.label} selected for text agents.`);
        } else setMessage('Connection saved. No inference request was sent.');
      }
    } catch (error: any) { setError(error.message); } finally { setBusy(false); }
  };
  return <section className="space-y-6" aria-label="Inference provider connections">
    <div className="flex items-start gap-3"><Server className="mt-1 text-cyan-400" size={22} /><div>
      <h2 className="text-xl font-semibold text-white">Model connections</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">Bring your model, choose its route. Discover the current catalog or use an exact model ID.</p>
    </div></div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {providers.map(provider => <button key={provider.id} disabled={busy} aria-pressed={selected === provider.id}
        onClick={() => { setSelected(provider.id); setModels([]); setMessage(''); setError(''); }}
        className={`rounded-2xl border p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${selected === provider.id ? 'border-cyan-400/70 bg-gradient-to-br from-cyan-500/15 to-blue-600/20 text-white' : 'border-slate-700 bg-[#081327] text-slate-300 hover:border-blue-400/60'}`}>
        <span className="block text-sm font-semibold">{provider.label}</span>
        <span className="mt-2 block truncate text-xs text-slate-400">{preferred === provider.id ? 'Default for agents' : drafts[provider.id]?.model || 'Set up connection'}</span>
      </button>)}
    </div>
    {draft && <div className="space-y-5 rounded-2xl border border-blue-400/20 bg-[#0a172d] p-5 sm:p-7">
      <div className="flex justify-between gap-4"><div><h3 className="font-semibold text-white">{definition.label}</h3><p className="mt-1 text-sm leading-6 text-slate-400">{definition.description}</p></div>
        <a href={definition.docs} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-xs text-cyan-300">Docs <ExternalLink size={13} /></a></div>
      <label className="block space-y-2 text-sm text-slate-300"><span>API base URL</span><input className={field} value={draft.baseUrl} readOnly={import.meta.env.PROD || !definition.editableEndpoint} disabled={busy} onChange={event => change({ baseUrl: event.target.value })} /></label>
      {!import.meta.env.PROD && <>
        <label className="block space-y-2 text-sm text-slate-300"><span>API key {draft.hasKey ? '· saved on this computer' : definition.requiresKey ? '· required' : '· optional for local servers'}</span><input type="password" autoComplete="off" className={field} value={draft.apiKey} disabled={busy} onChange={event => change({ apiKey: event.target.value, clearKey: false })} placeholder={draft.hasKey ? 'Leave blank to keep the saved key' : 'Enter the provider API key'} /></label>
        {draft.hasKey && <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={Boolean(draft.clearKey)} disabled={busy} onChange={event => change({ clearKey: event.target.checked, apiKey: '' })} /> Remove saved key when saving</label>}
      </>}
      <label className="block space-y-2 text-sm text-slate-300"><span>Chat model ID</span><input list="provider-model-catalog" className={field} value={draft.model} readOnly={import.meta.env.PROD} disabled={busy} onChange={event => change({ model: event.target.value })} placeholder={selected === 'local' ? 'Your installed Ollama model tag' : 'Exact model or deployment ID'} /><datalist id="provider-model-catalog">{models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</datalist></label>
      {!import.meta.env.PROD && <div className="flex flex-wrap gap-3">
        <button disabled={busy} onClick={() => run('save')} className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-white disabled:opacity-40">Save connection</button>
        <button disabled={busy} onClick={() => run('models')} className="flex items-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-200 disabled:opacity-40"><RefreshCw size={15} /> Save & load models</button>
        <button disabled={busy || !draft.model.trim()} onClick={() => run('use')} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"><Check size={15} /> Use for text agents</button>
      </div>}
      <p className="flex items-start gap-2 text-xs leading-5 text-slate-400"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-cyan-400" /> {import.meta.env.PROD ? 'The hosted demo uses the fixed OpenRouter free-model route. Provider credentials are held in server environment settings and never returned to the browser.' : 'New connector keys are encrypted by the local server and never returned in settings responses. Loading a model catalog does not run paid inference.'}</p>
      {selected === 'openrouter' && <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100/80">The <code>openrouter/free</code> demo route selects from free models whose availability and data policies can vary by model provider. Avoid sending confidential or sensitive data through this route. Hosted inference is limited to 10 requests per minute and 120 per day per signed-in user, 30 per minute per IP, and at most 800 output tokens per request.</p>}
      <p className="text-xs leading-5 text-slate-400">Ollama Local is restricted to this computer. Cloud providers receive your prompt and selected context when you submit a request. OmniRoute follows the upstream routes you configure in its gateway.</p>
    </div>}
    <div aria-live="polite" className="text-sm">{busy && <p className="text-cyan-300">Updating connection…</p>}{message && <p className="text-emerald-300">{message}</p>}{error && <p role="alert" className="text-rose-300">{error}</p>}</div>
    <p className="text-xs leading-5 text-slate-400">Default text route: <span className="text-slate-200">{getProviderDefinition(preferred)?.label || 'Gemini'}</span>. Realtime voice, image and video features retain their dedicated Gemini integration. Model capabilities vary; choosing a model does not enable every tool or modality.</p>
    {!import.meta.env.PROD && <div className="rounded-2xl border border-slate-700 bg-[#071124] p-5 space-y-3">
      <h3 className="font-semibold text-white">Quanta OpenAI compatible API</h3>
      <code className="block break-all text-sm text-cyan-300">{window.location.origin}/v1</code>
      <p className="text-xs leading-5 text-slate-400">Connect other clients to chat completions, streaming and the configured model list. Use a model alias such as <code>local/your-model</code> or <code>openrouter/author/model</code>. This API runs on loopback and requires its own local Bearer key.</p>
      <button disabled={busy} onClick={() => run('key')} className="flex items-center gap-2 rounded-xl border border-blue-400/40 px-4 py-2.5 text-sm text-blue-200 disabled:opacity-40"><Copy size={15} /> Copy local API key</button>
    </div>}
  </section>;
}
