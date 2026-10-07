import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { CLOUD_PROVIDERS, type CloudProvider, type CloudDomain, type CloudJob, type CloudJobRequest, type CloudPolicy, type CloudEvaluation, type HybridView } from '../lib/hybrid-contract';
import { ProviderStore } from './provider-store';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });
const text = (value: unknown, name: string, max = 256): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw fail(`${name} is required (maximum ${max} characters).`);
  return value.trim();
};
const sha = (value: unknown, name: string) => { const result = text(value, name, 64); if (!/^[a-f0-9]{64}$/.test(result)) throw fail(`${name} must be a SHA-256 hex digest.`); return result; };
const date = (value: unknown, name: string) => { const result = text(value, name, 40); if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(result) || !Number.isFinite(Date.parse(result))) throw fail(`${name} must be an ISO timestamp with a timezone.`); return new Date(result).toISOString(); };
const money = (value: unknown, zero = false) => { if (typeof value !== 'number' || !Number.isFinite(value) || value < (zero ? 0 : 0.01) || value > 100000 || Math.abs(Math.round(value * 100) - value * 100) > 0.000001) throw fail('Use a USD amount with at most two decimal places.'); return value; };
const defaults = (): CloudPolicy => ({ monthlyCapUsd: 0, connections: Object.fromEntries(CLOUD_PROVIDERS.map(id => [id, { enabled: false, accountId: '', deploymentId: '', model: '', hasKey: false, state: 'unconfigured' }])) as CloudPolicy['connections'] });
const providerFor = { zo_report: 'zo', abacus_forecast: 'abacus', fireworks_sft: 'fireworks', fireworks_infer: 'fireworks' } as const;
type Data = Omit<HybridView, 'localOnly' | 'executionMode' | 'reservedUsd'>;

export class HybridManager {
  private data: Data;
  private queue = Promise.resolve();
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;
  private readonly file: string;
  constructor(private credentials: ProviderStore, root: string, private request: typeof fetch = fetch) {
    this.file = path.join(root, '.quanta', 'hybrid-cloud.json');
    try { this.data = JSON.parse(readFileSync(this.file, 'utf8')); }
    catch (error: any) { if (error.code !== 'ENOENT') throw new Error('Cannot read hybrid cloud state; existing data was preserved.'); this.data = { policies: { business: defaults(), trading: defaults() }, jobs: [], registry: { business: {}, trading: {} }, registryHistory: { business: [], trading: [] } }; }
    this.data.registryHistory ||= { business: [], trading: [] };
    // A lost POST response may have created a billable resource. Never replay it automatically.
    for (const job of this.data.jobs) if (job.status === 'running') { job.status = 'uncertain'; job.error = 'Local server restarted during submission. Reconcile the provider account before creating another job.'; }
    this.persist();
  }
  private persist() { mkdirSync(path.dirname(this.file), { recursive: true }); writeFileSync(this.file + '.tmp', JSON.stringify(this.data, null, 2), { mode: 0o600 }); renameSync(this.file + '.tmp', this.file); }
  private async serial<T>(fn: () => Promise<T> | T): Promise<T> {
    const next = this.queue.catch(() => {}).then(fn); this.queue = next.then(() => undefined, () => undefined); return next;
  }
  private domain(value: unknown): CloudDomain { if (value !== 'business' && value !== 'trading') throw fail('Select Business or Trading.'); return value; }
  private provider(value: unknown): CloudProvider { if (!CLOUD_PROVIDERS.includes(value as CloudProvider)) throw fail('Unknown cloud provider.'); return value as CloudProvider; }
  private get(id: string) { const job = this.data.jobs.find(j => j.id === id); if (!job) throw fail('Job not found.', 404); return job; }
  private reserved(domain: CloudDomain) {
    const month = new Date().toISOString().slice(0, 7);
    return Math.round(this.data.jobs.filter(j => j.domain === domain && j.approvedAt?.slice(0, 7) === month && j.status !== 'cancelled').reduce((total, j) => total + j.estimatedUpperBoundUsd, 0) * 100) / 100;
  }
  async view(): Promise<HybridView> {
    const copy = structuredClone(this.data);
    for (const domain of ['business', 'trading'] as const) for (const provider of CLOUD_PROVIDERS) {
      const connection = copy.policies[domain].connections[provider]; connection.hasKey = await this.credentials.cloudConfigured(domain, provider);
      if (!connection.hasKey) connection.state = 'unconfigured';
    }
    return { ...copy, localOnly: true, executionMode: 'paper', reservedUsd: { business: this.reserved('business'), trading: this.reserved('trading') } };
  }
  async configure(domainValue: unknown, providerValue: unknown, body: any) {
    const domain = this.domain(domainValue), provider = this.provider(providerValue);
    return this.serial(async () => {
      const cap = money(body.monthlyCapUsd, true);
      if (cap < this.reserved(domain)) throw fail('The cap cannot be lower than this month’s existing reservations.', 409);
      const strings: Record<string, string> = {};
      for (const field of ['accountId', 'deploymentId', 'model']) { if (typeof body[field] !== 'string' || body[field].length > 256 || /[\r\n]/.test(body[field])) throw fail(`Invalid ${field}.`); strings[field] = body[field].trim(); }
      if (strings.accountId && !/^[a-zA-Z0-9_-]+$/.test(strings.accountId)) throw fail('Invalid Fireworks account ID.');
      if (typeof body.enabled !== 'boolean') throw fail('Enabled must be a boolean.');
      if (body.apiKey !== undefined && (typeof body.apiKey !== 'string' || body.apiKey.length > 4096 || /[\r\n]/.test(body.apiKey))) throw fail('Invalid key format.');
      if (body.clearKey === true || body.apiKey?.trim()) await this.credentials.setCloudKey(domain, provider, body.clearKey === true ? '' : body.apiKey.trim());
      this.data.policies[domain].monthlyCapUsd = cap;
      const connection = this.data.policies[domain].connections[provider];
      Object.assign(connection, strings, { enabled: body.enabled, state: await this.credentials.cloudKey(domain, provider) ? 'configured' : 'unconfigured', checkedAt: undefined, revision: randomUUID() });
      this.persist(); return this.view();
    });
  }
  async authenticate(domainValue: unknown, providerValue: unknown) {
    const domain = this.domain(domainValue), provider = this.provider(providerValue);
    return this.serial(async () => {
      const key = await this.credentials.cloudKey(domain, provider), connection = this.data.policies[domain].connections[provider];
      if (!key) throw fail('Save the provider credential first.');
      if (provider === 'abacus') throw fail('Abacus deployment tokens are verified by an approved forecast job; no paid probe is sent.');
      const endpoint = provider === 'zo' ? 'https://api.zo.computer/models/available' : 'https://api.fireworks.ai/inference/v1/models';
      try {
        const result = await this.json(endpoint, key, undefined);
        if (!Array.isArray(provider === 'zo' ? result.models : result.data)) throw fail('Provider catalog format was not recognized.', 502);
        connection.state = 'authenticated'; connection.checkedAt = new Date().toISOString(); this.persist();
      } catch (error) { connection.state = 'degraded'; connection.checkedAt = new Date().toISOString(); this.persist(); throw error; }
      return this.view();
    });
  }
  async catalog(domainValue: unknown, providerValue: unknown) {
    const domain = this.domain(domainValue), provider = this.provider(providerValue);
    if (provider === 'abacus') throw fail('Abacus uses your pinned deployment ID.');
    return this.serial(async () => {
      const key = await this.credentials.cloudKey(domain, provider); if (!key) throw fail('Save the provider credential first.');
      const result = await this.json(provider === 'zo' ? 'https://api.zo.computer/models/available' : 'https://api.fireworks.ai/inference/v1/models', key, undefined);
      const list = provider === 'zo' ? result.models : result.data;
      if (!Array.isArray(list)) throw fail('Provider catalog format was not recognized.', 502);
      return { models: list.map((m: any) => ({ id: provider === 'zo' ? m.model_name : m.id, name: provider === 'zo' ? m.label : m.name || m.id })).filter((m: any) => typeof m.id === 'string') };
    });
  }
  async draft(input: CloudJobRequest, keyValue: unknown) {
    return this.serial(() => {
      if (!input || typeof input !== 'object' || !Object.hasOwn(providerFor, input.operation)) throw fail('Unknown cloud operation.');
      const domain = this.domain(input.domain), provider = providerFor[input.operation];
      const key = text(keyValue, 'Idempotency-Key', 128);
      const payload = input.payload;
      if (!payload || Array.isArray(payload) || typeof payload !== 'object' || JSON.stringify(payload).length > 100000) throw fail('Payload must be a JSON object under 100 KB.');
      const request: CloudJobRequest = { domain, operation: input.operation, label: text(input.label, 'Job label'), estimatedUpperBoundUsd: money(input.estimatedUpperBoundUsd), datasetHash: sha(input.datasetHash, 'Dataset hash'), schemaVersion: text(input.schemaVersion, 'Schema version'), labelDefinition: text(input.labelDefinition, 'Label definition', 2000), sourceAvailableAt: date(input.sourceAvailableAt, 'Source availability time'), codeCommit: text(input.codeCommit, 'Code commit'), payload: structuredClone(payload), ...(input.expiresAt ? { expiresAt: date(input.expiresAt, 'Expiry') } : {}) };
      if (Date.parse(request.sourceAvailableAt) > Date.now()) throw fail('Source availability time cannot be in the future.');
      if (domain === 'trading' && (!request.expiresAt || Date.parse(request.expiresAt) <= Date.now())) throw fail('Trading jobs require a future expiry.');
      this.validatePayload(request);
      const requestHash = hash(request), existing = this.data.jobs.find(j => j.domain === domain && j.idempotencyKey === key);
      if (existing) { if (existing.requestHash !== requestHash) throw fail('Idempotency-Key already belongs to different inputs.', 409); return structuredClone(existing); }
      const job: CloudJob = { ...request, id: randomUUID(), provider, requestHash, payloadHash: hash(payload), idempotencyKey: key, createdAt: new Date().toISOString(), status: 'draft' };
      this.data.jobs.push(job); this.persist(); return structuredClone(job);
    });
  }
  private validatePayload(job: CloudJobRequest) {
    const p = job.payload;
    const fields = job.operation === 'zo_report' ? ['input'] : job.operation === 'abacus_forecast' ? ['queryData'] : job.operation === 'fireworks_infer' ? ['input'] : ['dataset', 'evaluationDataset', 'baseModel', 'epochs', 'learningRate', 'loraRank'];
    if (Object.keys(p).some(k => !fields.includes(k))) throw fail('Payload contains an unsupported field.');
    if (job.operation === 'zo_report' || job.operation === 'fireworks_infer') text(p.input, 'Input', 50000);
    if (job.operation === 'abacus_forecast' && (!p.queryData || typeof p.queryData !== 'object' || Array.isArray(p.queryData))) throw fail('queryData must be an object matching the Abacus deployment schema.');
    if (job.operation === 'fireworks_sft') {
      for (const field of ['dataset', 'evaluationDataset', 'baseModel']) {
        const id = text(p[field], field);
        if (!/^accounts\/[a-zA-Z0-9_-]+\/(datasets|models)\/[a-zA-Z0-9_.-]+$/.test(id) || !id.includes(field === 'baseModel' ? '/models/' : '/datasets/')) throw fail(`Invalid Fireworks ${field} resource name.`);
      }
      if (p.dataset === p.evaluationDataset) throw fail('Training and validation datasets must be distinct.');
      if (p.epochs !== undefined && (!Number.isInteger(p.epochs) || Number(p.epochs) < 1 || Number(p.epochs) > 10)) throw fail('Epochs must be between 1 and 10.');
      if (p.learningRate !== undefined && (typeof p.learningRate !== 'number' || !Number.isFinite(p.learningRate) || p.learningRate <= 0 || p.learningRate > 0.01)) throw fail('Invalid learning rate.');
      if (p.loraRank !== undefined && (typeof p.loraRank !== 'number' || ![4, 8, 16, 32, 64].includes(p.loraRank))) throw fail('Invalid LoRA rank.');
    }
  }
  async approve(id: string, body: any) {
    return this.serial(async () => {
      const job = this.get(id);
      if (job.status !== 'draft') throw fail('Only draft jobs can be approved.', 409);
      if (hash(job.payload) !== job.payloadHash) throw fail('Job payload integrity check failed.', 409);
      if (body.approveDataExport !== true || body.approveSpend !== true) throw fail('Approve the exact payload export and estimated spending reservation.');
      const config = this.data.policies[job.domain], route = config.connections[job.provider];
      if (!route.enabled || !await this.credentials.cloudKey(job.domain, job.provider)) throw fail('Enable and configure this domain’s provider first.', 409);
      if (job.expiresAt && Date.parse(job.expiresAt) <= Date.now()) throw fail('Job has expired.', 409);
      if (config.monthlyCapUsd <= 0 || this.reserved(job.domain) + job.estimatedUpperBoundUsd > config.monthlyCapUsd) throw fail('Monthly spending reservation exceeds the configured cap.', 409);
      if (job.provider === 'abacus' && !route.deploymentId) throw fail('Configure an Abacus forecast deployment ID.');
      if (job.operation === 'fireworks_sft' && !route.accountId) throw fail('Configure a Fireworks account ID.');
      if (job.operation === 'fireworks_infer' && !route.model && !this.data.registry[job.domain].fireworks) throw fail('Configure a Fireworks inference model.');
      const tuned = this.data.registry[job.domain].fireworks;
      if (job.operation === 'fireworks_infer' && tuned && !tuned.model.startsWith(`accounts/${route.accountId}/models/`)) throw fail('The active tuned model belongs to another Fireworks account. Roll it back or restore the original account configuration.', 409);
      job.route = { accountId: route.accountId, deploymentId: route.deploymentId, model: job.operation === 'fireworks_infer' ? tuned?.model || route.model : route.model, revision: route.revision };
      job.approvedAt = new Date().toISOString(); job.status = 'approved'; this.persist(); return structuredClone(job);
    });
  }
  private async json(url: string, key: string, body?: unknown): Promise<any> {
    const response = await this.request(url, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'error', signal: AbortSignal.timeout(60000) });
    if (!response.ok) { await response.body?.cancel(); throw fail(`Cloud request returned HTTP ${response.status}. Check the provider account and entitlement.`, 502); }
    const raw = await response.text();
    if (raw.length > 1000000) throw fail('Cloud result exceeds the local artifact limit.', 502);
    try { return JSON.parse(raw.split(JSON.stringify(key).slice(1, -1)).join('[redacted]')); } catch { throw fail('Cloud result was not valid JSON.', 502); }
  }
  async run(id: string) {
    return this.serial(async () => {
      const job = this.get(id);
      if (job.status !== 'approved') throw fail('Only an approved job can be submitted; submissions are never replayed.', 409);
      if (hash(job.payload) !== job.payloadHash) throw fail('Job payload integrity check failed.', 409);
      if (job.expiresAt && Date.parse(job.expiresAt) <= Date.now()) { job.status = 'stale'; this.persist(); return structuredClone(job); }
      if (job.approvedAt?.slice(0, 7) !== new Date().toISOString().slice(0, 7)) throw fail('Approval belongs to a prior budget month. Cancel and create a new draft.', 409);
      const config = this.data.policies[job.domain].connections[job.provider];
      if (job.route?.revision !== config.revision) throw fail('Provider configuration changed after approval. Cancel this unsubmitted job and create a new reviewed draft.', 409);
      const key = await this.credentials.cloudKey(job.domain, job.provider);
      if (!config.enabled || !key) throw fail('This provider is disabled or missing credentials.', 409);
      job.status = 'running'; this.persist();
      try {
        let result: any;
        if (job.operation === 'zo_report') {
          result = await this.json('https://api.zo.computer/zo/ask', key, { input: job.payload.input, ...(job.route?.model ? { model_name: job.route.model } : {}) });
          if (typeof result.output !== 'string' || !result.output.trim()) throw fail('Zo returned no report.', 502);
        } else if (job.operation === 'abacus_forecast') {
          // Deployment token is sent in the body, never in logged URLs or browser code.
          result = await this.json('https://api.abacus.ai/api/v0/getForecast', key, { deploymentToken: key, deploymentId: job.route!.deploymentId, queryData: job.payload.queryData });
          if (result.success === false || !result.result || typeof result.result !== 'object' || !Object.keys(result.result).length) throw fail('Abacus returned no forecast.', 502);
        } else if (job.operation === 'fireworks_sft') {
          result = await this.json(`https://api.fireworks.ai/v1/accounts/${job.route!.accountId}/supervisedFineTuningJobs`, key, { ...job.payload, displayName: `quanta-${job.domain}-${job.id}`, epochs: job.payload.epochs || 1 });
          if (typeof result.name !== 'string' || !new RegExp(`^accounts/${job.route!.accountId}/supervisedFineTuningJobs/[a-zA-Z0-9_.-]+$`).test(result.name)) throw fail('Fireworks returned no recognizable training job ID.', 502);
          job.remoteName = result.name; job.status = 'submitted';
        } else {
          result = await this.json('https://api.fireworks.ai/inference/v1/chat/completions', key, { model: job.route!.model, messages: [{ role: 'user', content: job.payload.input }], max_tokens: 512, stream: false });
          if (typeof result.choices?.[0]?.message?.content !== 'string' || !result.choices[0].message.content.trim()) throw fail('Fireworks returned no model response.', 502);
        }
        this.result(job, result);
        if (job.status !== 'submitted') { job.status = job.expiresAt && Date.parse(job.expiresAt) <= Date.now() ? 'stale' : 'succeeded'; job.completedAt = new Date().toISOString(); config.state = 'tested'; }
        else config.state = 'authenticated';
        config.checkedAt = new Date().toISOString();
      } catch (error: any) {
        job.status = 'uncertain'; job.error = `${error.status ? error.message : 'Cloud response was interrupted.'} Verify provider activity before submitting another paid job.`; config.state = 'degraded';
      }
      this.persist(); return structuredClone(job);
    });
  }
  private result(job: CloudJob, result: unknown) { job.result = result; job.resultHash = hash(result); }
  async poll(id: string) {
    return this.serial(async () => {
      const job = this.get(id);
      if (job.operation !== 'fireworks_sft' || job.status !== 'submitted' || !job.remoteName) throw fail('Only submitted Fireworks training jobs can be polled.', 409);
      const config = this.data.policies[job.domain].connections.fireworks;
      const key = await this.credentials.cloudKey(job.domain, 'fireworks');
      if (!config.enabled || !key) throw fail('Enable Fireworks and configure credentials to poll.', 409);
      if (config.accountId !== job.route?.accountId) throw fail('Restore the submitted training job’s Fireworks account before polling.', 409);
      try {
        const result = await this.json(`https://api.fireworks.ai/v1/${job.remoteName}`, key);
        if (result.name !== job.remoteName) throw fail('Training result identity does not match the submitted job.', 502);
        this.result(job, result); job.error = undefined;
        if (result.state === 'JOB_STATE_COMPLETED') {
          if (typeof result.outputModel !== 'string' || !/^accounts\/[a-zA-Z0-9_-]+\/models\/[a-zA-Z0-9_.-]+$/.test(result.outputModel)) throw fail('Completed job has no valid output model.', 502);
          job.status = job.expiresAt && Date.parse(job.expiresAt) <= Date.now() ? 'stale' : 'succeeded'; job.completedAt = new Date().toISOString(); config.state = 'tested';
        } else if (['JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_DELETED', 'JOB_STATE_ARCHIVED'].includes(result.state)) { job.status = 'error'; job.error = `Remote training ended: ${result.state}.`; job.completedAt = new Date().toISOString(); }
        config.checkedAt = new Date().toISOString();
      } catch (error: any) { job.error = error.status ? error.message : 'Training status is unavailable. Submission was not retried.'; config.state = 'degraded'; }
      this.persist(); return structuredClone(job);
    });
  }
  async cancel(id: string) {
    return this.serial(() => { const job = this.get(id); if (!['draft', 'approved'].includes(job.status)) throw fail('Only unsubmitted jobs can be cancelled locally. Manage remote resources in the provider console.', 409); job.status = 'cancelled'; this.persist(); return structuredClone(job); });
  }
  async evaluate(id: string, input: CloudEvaluation) {
    return this.serial(() => {
      const job = this.get(id);
      if (job.status !== 'succeeded') throw fail('A successful, non-stale job is required for evaluation.', 409);
      if (input.direction !== 'higher' && input.direction !== 'lower') throw fail('Metric direction must be higher or lower.');
      if (![input.baselineScore, input.candidateScore].every(value => typeof value === 'number' && Number.isFinite(value))) throw fail('Scores must be finite numbers.');
      const evaluation: CloudEvaluation = { metric: text(input.metric, 'Metric'), direction: input.direction, baselineScore: input.baselineScore, candidateScore: input.candidateScore, holdoutHash: sha(input.holdoutHash, 'Independent holdout hash'), evidence: text(input.evidence, 'Evaluation evidence', 10000), evaluatorVersion: text(input.evaluatorVersion, 'Evaluator version') };
      if (evaluation.holdoutHash === job.datasetHash) throw fail('The independent holdout cannot equal the training/input dataset.');
      job.evaluation = evaluation; job.evaluationPassed = evaluation.direction === 'higher' ? evaluation.candidateScore > evaluation.baselineScore : evaluation.candidateScore < evaluation.baselineScore;
      this.persist(); return structuredClone(job);
    });
  }
  async promote(id: string, approval: unknown) {
    return this.serial(() => {
      const job = this.get(id);
      if (approval !== true || job.status !== 'succeeded' || !job.evaluationPassed || !job.resultHash || hash(job.result) !== job.resultHash) throw fail('Promotion requires explicit approval, a successful job, intact result and a passing independent evaluation.', 409);
      if (job.expiresAt && Date.parse(job.expiresAt) <= Date.now()) throw fail('This candidate has expired.', 409);
      if (job.operation !== 'fireworks_sft') throw fail('Only tuned Fireworks model artifacts can be promoted. Reports and forecasts remain evidence.', 409);
      const model = (job.result as any).outputModel;
      const previous = this.data.registry[job.domain].fireworks;
      if (previous?.jobId === job.id) throw fail('This model is already active.', 409);
      if (previous) this.data.registryHistory[job.domain].push(structuredClone(previous));
      this.data.registry[job.domain].fireworks = { jobId: job.id, provider: 'fireworks', model, promotedAt: new Date().toISOString(), previousJobId: previous?.jobId };
      this.persist(); return this.view();
    });
  }
  async rollback(domainValue: unknown) {
    return this.serial(() => {
      const domain = this.domain(domainValue), current = this.data.registry[domain].fireworks;
      if (!current) throw fail('No active tuned model.', 409);
      const snapshot = this.data.registryHistory[domain].at(-1);
      if (current.previousJobId && (!snapshot || snapshot.jobId !== current.previousJobId)) throw fail('Rollback history is missing or inconsistent. Registry was preserved.', 409);
      if (snapshot) {
        const previous = this.get(snapshot.jobId), config = this.data.policies[domain].connections.fireworks;
        if (previous.domain !== domain || previous.operation !== 'fireworks_sft' || previous.status !== 'succeeded' || !previous.evaluationPassed || !previous.resultHash || hash(previous.result) !== previous.resultHash || (previous.result as any).outputModel !== snapshot.model || previous.route?.accountId !== config.accountId) throw fail('Rollback candidate failed integrity, evaluation or account checks. Registry was preserved.', 409);
        if (previous.expiresAt && Date.parse(previous.expiresAt) <= Date.now()) throw fail('Rollback candidate has expired. Registry was preserved; evaluate a fresh replacement.', 409);
        this.data.registry[domain].fireworks = { ...snapshot, promotedAt: new Date().toISOString() };
        this.data.registryHistory[domain].pop();
      } else delete this.data.registry[domain].fireworks;
      this.persist(); return this.view();
    });
  }
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => { if (this.polling) return; this.polling = true; void (async () => { for (const job of this.data.jobs.filter(j => j.status === 'submitted')) { if (this.data.policies[job.domain].connections.fireworks.enabled) await this.poll(job.id).catch(() => {}); } })().finally(() => { this.polling = false; }); }, 60000);
    this.timer.unref();
  }
  stop() { if (this.timer) clearInterval(this.timer); }
}
