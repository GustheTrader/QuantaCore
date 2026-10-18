import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, appendFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import Ajv from 'ajv';
import { bindCurrentEntity } from './operating-evidence';
import { ProviderStore } from './provider-store';
import { getProviderDefinition, isCompatibleProvider, type CompatibleProvider } from '../lib/inference-providers';
import type { RsiRequest, RsiRun, RsiReview } from '../lib/rsi-contract';

const exec = promisify(execFile);
const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const failure = (message: string, status = 400) => Object.assign(new Error(message), { status });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const integer = (minimum: number, maximum: number) => ({ type: 'integer', minimum, maximum });
const validate = new Ajv().compile({
  type: 'object', additionalProperties: false,
  required: ['name', 'policyModel', 'searchModel', 'rounds', 'trials', 'maxParallel', 'budget', 'rates', 'systemPrompt'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 }, policyModel: { type: 'string', minLength: 3, maxLength: 300 }, searchModel: { type: 'string', minLength: 3, maxLength: 300 },
    rounds: integer(1, 3), trials: integer(1, 3), maxParallel: integer(1, 2), systemPrompt: { type: 'string', minLength: 1, maxLength: 6000 },
    rates: { type: 'array', maxItems: 2, items: { type: 'object', additionalProperties: false, required: ['model', 'inputPerMillion', 'outputPerMillion'], properties: { model: { type: 'string' }, inputPerMillion: { type: 'number', minimum: 0, maximum: 1000 }, outputPerMillion: { type: 'number', minimum: 0, maximum: 1000 } } } },
    budget: { type: 'object', additionalProperties: false, required: ['maxCalls', 'maxTokens', 'maxOutputTokens', 'maxSeconds', 'maxCostUsd'], properties: {
      maxCalls: integer(10, 600), maxTokens: integer(10000, 2000000), maxOutputTokens: integer(256, 8192), maxSeconds: integer(60, 3600), maxCostUsd: { type: ['number', 'null'], minimum: 0.01, maximum: 100 }
    } }
  }
});
type Connection = { baseUrl: string; model: string; apiKey: string };
type FrozenRoute = { id: string; provider: CompatibleProvider; model: string; connection: Connection; input: number | null; output: number | null };
type Admission = { id: string; runId: string; input: number; output: number; route: FrozenRoute; controller: AbortController; finished: boolean };
type Active = { run: RsiRun; token: string; routes: FrozenRoute[]; child?: ChildProcess; timer?: ReturnType<typeof setTimeout>; admissions: Map<string, Admission>; accepting: boolean; resultReceived: boolean; retainedEstimate?: boolean };

export class RsiManager {
  readonly dataDir: string;
  readonly upstreamRoot: string;
  readonly python: string;
  readonly pin: { commit: string; repository: string };
  private active?: Active;
  private reviews = new Map<string, { view: RsiReview; routes: FrozenRoute[] }>();
  private probeCache?: { at: number; value: any };
  private closed = false;
  private owner = false;
  private ownerId = randomUUID();
  private sequence = new Map<string, number>();
  constructor(readonly store: ProviderStore, readonly root: string, readonly port: number, dataDir?: string) {
    this.dataDir = dataDir || path.join(root, 'data', 'rsi');
    this.upstreamRoot = process.env.RRSI_ROOT || (process.platform === 'win32' ? 'C:\\QuantaRRSI' : path.resolve(root, '..', 'QuantaRRSI'));
    this.python = path.join(this.upstreamRoot, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    this.pin = JSON.parse(readFileSync(path.join(root, 'rsi', 'upstream.lock.json'), 'utf8'));
    mkdirSync(this.dataDir, { recursive: true });
  }
  initialize() {
    if (this.owner) return;
    const file = path.join(this.dataDir, '.owner.json');
    if (existsSync(file)) {
      const prior = JSON.parse(readFileSync(file, 'utf8'));
      let alive = true; try { process.kill(prior.pid, 0); } catch (e: any) { if (e.code === 'ESRCH') alive = false; }
      if (alive) throw failure('The RSI journal is owned by another live local controller.', 409);
      renameSync(file, path.join(this.dataDir, `stale-owner-${randomUUID()}.json`));
    }
    const fd = openSync(file, 'wx');
    try { writeFileSync(fd, JSON.stringify({ pid: process.pid, id: this.ownerId })); } finally { closeSync(fd); }
    this.owner = true;
    for (const run of this.list()) if (run.status === 'running') {
      run.status = 'interrupted'; run.error = 'Server restarted. Start a new reviewed experiment; the evidence remains available.';
      this.event(run, 'interrupted', {});
    }
  }
  private directory(id: string) { if (!uuid.test(id)) throw failure('Invalid experiment ID.'); return path.join(this.dataDir, id); }
  private save(run: RsiRun) {
    run.updatedAt = new Date().toISOString(); const directory = this.directory(run.id); mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, 'state.tmp'), JSON.stringify(run, null, 2)); renameSync(path.join(directory, 'state.tmp'), path.join(directory, 'state.json'));
  }
  private event(run: RsiRun, type: string, payload: unknown) {
    bindCurrentEntity('rsi',run.id);
    const directory = this.directory(run.id); mkdirSync(directory, { recursive: true });
    const log = path.join(directory, 'events.jsonl');
    let seq = this.sequence.get(run.id);
    if (seq === undefined) seq = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).length : 0;
    this.sequence.set(run.id, ++seq);
    appendFileSync(log, JSON.stringify({ seq, type, at: new Date().toISOString(), payload }) + '\n'); this.save(run);
  }
  list(): RsiRun[] {
    return readdirSync(this.dataDir).filter(id => uuid.test(id)).flatMap(id => { try { return [this.get(id)]; } catch { return []; } }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  get(id: string): RsiRun {
    if (this.active?.run.id === id) return structuredClone(this.active.run);
    const file = path.join(this.directory(id), 'state.json'); if (!existsSync(file)) throw failure('Experiment not found.', 404);
    const value = JSON.parse(readFileSync(file, 'utf8')); if (value.id !== id) throw failure('Experiment state identity differs.', 409); return value;
  }
  events(id: string, after = 0, limit = 500) {
    this.get(id); const file = path.join(this.directory(id), 'events.jsonl');
    const rows = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(e => e.seq > after) : [];
    return limit ? rows.slice(-limit) : rows;
  }
  private childEnv(extra: Record<string, string> = {}) {
    const env: Record<string, string> = { PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_TERMINAL_PROMPT: '0', ...extra };
    for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'PATHEXT', 'COMSPEC']) if (process.env[key]) env[key] = process.env[key]!;
    return env;
  }
  async probe(force = false) {
    if (!force && this.probeCache && Date.now() - this.probeCache.at < 30000) return this.probeCache.value;
    let value: any;
    try {
      const result = await exec(this.python, [path.join(this.root, 'rsi', 'worker.py'), '--probe'], { cwd: this.root, env: this.childEnv(), windowsHide: true, timeout: 30000, maxBuffer: 20000 });
      value = JSON.parse(result.stdout.trim());
      if (value.commit !== this.pin.commit || !value.ready) throw failure('Source pin differs.');
    } catch { value = { ready: false, commit: this.pin.commit, message: 'Install or repair the pinned local environment with scripts/install-rsi.ps1.' }; }
    this.probeCache = { at: Date.now(), value }; return value;
  }
  async status(force = false) {
    this.initialize();
    const engine = await this.probe(force); const connections = await this.store.publicConnectionSummaries();
    return { engine, activeRunId: this.active?.run.id || null, localOnly: true, models: connections.filter(c => c.model && (!getProviderDefinition(c.id)?.requiresKey || c.hasKey)).map(c => ({ id: `${c.id}/${c.model}`, label: `${getProviderDefinition(c.id)?.label} · ${c.model}` })),
      domain: { name: 'Quanta harness profiles', evolveTasks: 6, heldoutTasks: 4, editSpace: 'JSON prompts, evidence context and tool-policy instructions', tools: 'No real external tool executes in this suite.' },
      dream: { implementation: 'Quanta recorded-tree replay adaptation', officialCodeIncluded: false, minimumExperiments: 3 }, source: this.pin.repository };
  }
  async estimate(input: unknown): Promise<RsiReview> {
    if (!validate(input)) throw failure('Invalid research configuration or limits.');
    const request = structuredClone(input) as RsiRequest;
    if (!(await this.probe()).ready) throw failure('Pinned RRSI environment is unavailable.', 409);
    if (this.closed) throw failure('The lab is shutting down.', 409);
    const routes: FrozenRoute[] = [];
    for (const id of new Set([request.policyModel, request.searchModel])) {
      const slash = id.indexOf('/'); const provider = id.slice(0, slash); const model = id.slice(slash + 1);
      if (slash < 1 || !isCompatibleProvider(provider)) throw failure('Choose a configured model route.');
      const connection = await this.store.selectedConnection(provider);
      if (!model || connection.model !== model || (getProviderDefinition(provider)?.requiresKey && !connection.apiKey)) throw failure('This model is not the saved provider route. Refresh models.');
      const rate = request.rates.find(r => r.model === id);
      routes.push({ id, provider, model, connection: { ...connection }, input: rate?.inputPerMillion ?? null, output: rate?.outputPerMillion ?? null });
    }
    if (request.rates.some(r => !routes.some(route => route.id === r.model)) || new Set(request.rates.map(r => r.model)).size !== request.rates.length) throw failure('Rate quotes must match each selected model once.');
    const knownCost = routes.every(r => r.input !== null && r.output !== null);
    if (request.budget.maxCostUsd !== null && !knownCost) throw failure('A USD cap requires an input/output rate quote for every selected model. Unknown cost cannot be treated as zero.');
    const suiteHash = digest(readFileSync(path.join(this.root, 'rsi', 'tasks.json'), 'utf8'));
    const sourceHash = digest(['worker.py', 'replay.py', 'harness.json'].map(file => readFileSync(path.join(this.root, 'rsi', file), 'utf8')));
    const configurationHash = digest({ request, source: this.pin.commit, suiteHash, sourceHash, endpoints: routes.map(r => ({ id: r.id, url: r.connection.baseUrl, keyHash: digest(r.connection.apiKey) })) });
    const view: RsiReview = { id: randomUUID(), expiresAt: new Date(Date.now() + 600000).toISOString(), configurationHash, request, routes: routes.map(r => r.id), knownCost, sourceCommit: this.pin.commit, suiteHash, adapterHash: sourceHash,
      summary: [`${request.rounds} outer round(s), two candidates per round, ${request.trials} trial(s) per task.`, 'Baseline and final holdout measurements use 6 evolve tasks and 4 independent holdout tasks.', `${request.budget.maxCalls} calls, ${request.budget.maxTokens} tokens, ${request.budget.maxSeconds} seconds maximum. Every search-role retry is metered.`, knownCost ? 'USD accounting uses operator-supplied rate estimates; provider fees can differ.' : 'Provider cost is unknown. Calls, tokens and elapsed time are capped.', 'Replay uses completed experiment trees only. Cold start requires three independent worlds.'] };
    for (const [id, old] of this.reviews) if (Date.parse(old.view.expiresAt) < Date.now()) this.reviews.delete(id);
    this.reviews.set(view.id, { view, routes }); return view;
  }
  async start(reviewId: string, approved: boolean) {
    if (approved !== true) throw failure('Review the frozen configuration and explicitly approve the experiment.');
    this.initialize();
    if (this.active || this.closed) throw failure('Only one local experiment may run at a time.', 409);
    const review = this.reviews.get(reviewId); if (!review || Date.parse(review.view.expiresAt) < Date.now()) throw failure('The configuration review expired. Review again.', 409);
    const refreshed = await this.estimate(review.view.request); this.reviews.delete(refreshed.id);
    if (refreshed.configurationHash !== review.view.configurationHash) throw failure('The route or lab source changed. Review again.', 409);
    if (this.active || this.closed) throw failure('An experiment was started while this review was being checked.', 409);
    const id = randomUUID(); const now = new Date().toISOString();
    const run: RsiRun = { id, name: review.view.request.name, createdAt: now, updatedAt: now, status: 'running', configurationHash: review.view.configurationHash, request: review.view.request, sourceCommit: this.pin.commit, suiteHash: review.view.suiteHash, adapterHash: review.view.adapterHash, usage: { calls: 0, tokens: 0, costUsd: review.view.knownCost ? 0 : null, estimated: false }, phase: 'starting' };
    this.reviews.delete(reviewId);
    const active: Active = { run, token: randomBytes(32).toString('hex'), routes: review.routes, accepting: true, admissions: new Map(), resultReceived: false }; this.active = active;
    this.event(run, 'run.started', { sourceCommit: run.sourceCommit, configurationHash: run.configurationHash });
    const seed = JSON.parse(readFileSync(path.join(this.root, 'rsi', 'harness.json'), 'utf8')); seed.systemPrompt = run.request.systemPrompt;
    const pool = this.list().filter(r => r.status === 'completed' && r.suiteHash === run.suiteHash && r.adapterHash === run.adapterHash && r.sourceCommit === run.sourceCommit && r.request.policyModel === run.request.policyModel && r.result?.trees?.length && this.resultValid(r)).map(r => r.result.trees.at(-1)).slice(0, 30);
    const child = spawn(this.python, [path.join(this.root, 'rsi', 'worker.py')], { cwd: this.root, env: this.childEnv({ QUANTA_RSI_TOKEN: active.token }), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); active.child = child;
    active.timer = setTimeout(() => { if (this.active === active && run.status === 'running') this.cancel(id, 'The elapsed-time budget stopped this experiment.'); }, run.request.budget.maxSeconds * 1000);
    let buffer = ''; let pendingResult: any;
    child.stdout!.on('data', chunk => {
      if (this.active !== active || run.status !== 'running') return;
      buffer += chunk.toString(); if (buffer.length > 2000000) { this.cancel(id, 'Worker event exceeded the size limit.'); return; }
      let index; while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1); if (!line.trim()) continue;
        try {
          const event = JSON.parse(line); if (run.status !== 'running') continue;
          if (event.type === 'result') { pendingResult = event.result; active.resultReceived = true; }
          else if (event.type === 'error') { run.error = event.message || 'RRSI worker failed.'; this.event(run, 'worker.error', { code: event.code, message: run.error }); }
          else if (['phase', 'trial', 'round'].includes(event.type)) { if (event.phase) run.phase = event.phase; this.event(run, event.type, event); }
          else { this.cancel(id, 'Worker emitted an unsupported event.'); }
        } catch { this.cancel(id, 'Worker emitted malformed events.'); }
      }
    });
    child.stderr!.on('data', chunk => { const text = chunk.toString().slice(0, 50000).split(active.token).join('[REDACTED]'); appendFileSync(path.join(this.directory(id), 'worker.log'), text); });
    const finish = (code: number | null) => {
      if (active.timer) clearTimeout(active.timer); active.accepting = false;
      for (const admission of active.admissions.values()) admission.controller.abort();
      if (run.status === 'running') {
        run.status = code === 0 && active.resultReceived ? 'completed' : 'failed';
        if (run.status === 'completed') { run.result = pendingResult; run.resultHash = digest(pendingResult); }
        else run.error ||= 'RRSI worker stopped before producing a complete result.';
        run.phase = run.status; this.event(run, `run.${run.status}`, {});
      }
      if (this.active === active) this.active = undefined;
    };
    child.on('error', () => { run.error = 'The isolated Python worker could not start.'; finish(1); });
    child.on('close', finish);
    child.stdin!.on('error', () => {});
    child.stdin!.end(JSON.stringify({ id, createdAt: now, directory: this.directory(id), ...run.request, ...run.request.budget, profile: seed, replayPool: pool, gateway: `http://127.0.0.1:${this.port}/api/rsi/gateway` }));
    return structuredClone(run);
  }
  researchAuthorized(req: Request) {
    const a = this.active; const value = req.get('authorization')?.replace(/^Bearer /, '') || '';
    return Boolean(a?.accepting && a.run.status === 'running' && req.get('X-Gnoesis-Run') === a.run.id && !req.get('origin') && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') && value.length === a.token.length && timingSafeEqual(Buffer.from(value), Buffer.from(a.token)));
  }
  async connectionForRun(req: Request, provider: CompatibleProvider) {
    if (!this.researchAuthorized(req)) throw failure('Active RSI experiment authorization required.', 403);
    const route = this.active!.routes.find(r => r.provider === provider);
    if (!route) throw failure('Model route is outside the approved experiment.', 403); return route.connection;
  }
  admit(req: Request, provider: string, model: string, baseUrl: string, body: Record<string, unknown>, controller: AbortController): Admission {
    if (!this.researchAuthorized(req)) throw failure('Active RSI authorization required.', 403);
    const a = this.active!; const route = a.routes.find(r => r.provider === provider && r.model === model && r.connection.baseUrl.replace(/\/$/, '') === baseUrl);
    if (!route) throw failure('Model route differs from the frozen configuration.', 403);
    const limit = a.run.request.budget; const output = Number(body.max_tokens);
    if (body.stream !== false || body.tools || !Number.isInteger(output) || output < 1 || output > limit.maxOutputTokens) throw failure('This lab requires bounded, non-streaming text calls.', 403);
    const input = Buffer.byteLength(JSON.stringify(body), 'utf8') + 1024;
    const cost = route.input !== null && route.output !== null ? (input * route.input + output * route.output) / 1000000 : null;
    const usage = a.run.usage;
    const reason = usage.calls >= limit.maxCalls ? 'call limit' : usage.tokens + input + output > limit.maxTokens ? 'token limit' : limit.maxCostUsd !== null && (cost === null || usage.costUsd === null || usage.costUsd + cost > limit.maxCostUsd) ? 'estimated USD limit' : null;
    if (reason) { this.event(a.run, 'budget.blocked', { reason }); throw failure(`RSI ${reason} stopped the next call.`, 429); }
    usage.calls++; usage.tokens += input + output; if (usage.costUsd !== null && cost !== null) usage.costUsd += cost; usage.estimated = true;
    const admission: Admission = { id: randomUUID(), runId: a.run.id, input, output, route, controller, finished: false }; a.admissions.set(admission.id, admission);
    this.event(a.run, 'llm.admitted', { callId: admission.id, model: route.id, role: req.get('X-Quanta-RSI-Role') || 'search', inputReserved: input, outputReserved: output, costReserved: cost }); return admission;
  }
  complete(admission: Admission | undefined, result: any) {
    if (!admission || admission.finished) return; admission.finished = true;
    const active = this.active; if (!active || active.run.id !== admission.runId) return;
    const i = result?.usage?.prompt_tokens, o = result?.usage?.completion_tokens;
    const known = Number.isSafeInteger(i) && i >= 0 && Number.isSafeInteger(o) && o >= 0;
    if (known) {
      active.run.usage.tokens += i + o - admission.input - admission.output;
      if (active.run.usage.costUsd !== null) active.run.usage.costUsd += ((i - admission.input) * admission.route.input! + (o - admission.output) * admission.route.output!) / 1000000;
    }
    active.admissions.delete(admission.id);
    this.event(active.run, 'llm.completed', { callId: admission.id, tokens: known ? i + o : admission.input + admission.output, estimated: !known, responseHash: result ? digest(result) : null });
    // Estimated stays true if ANY call retained its reservation, including provider failures.
    active.retainedEstimate ||= !known;
    active.run.usage.estimated = Boolean(active.retainedEstimate || active.admissions.size > 0);
    this.save(active.run);
    if (active.run.usage.tokens > active.run.request.budget.maxTokens || (active.run.request.budget.maxCostUsd !== null && (active.run.usage.costUsd || 0) > active.run.request.budget.maxCostUsd)) this.cancel(active.run.id, 'Provider-reported usage exceeded the conservative reservation. The experiment was stopped.');
  }
  cancel(id: string, message = 'Cancelled by the operator.') {
    const active = this.active; if (!active || active.run.id !== id) throw failure('No active experiment matches this ID.', 409);
    if (active.run.status !== 'running') return this.get(id);
    active.accepting = false; active.run.status = 'cancelled'; active.run.error = message;
    for (const admission of active.admissions.values()) admission.controller.abort();
    this.event(active.run, 'run.cancelled', { message });
    if (active.child?.pid) {
      if (process.platform === 'win32') { const killer = spawn('taskkill', ['/PID', String(active.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); killer.on('error', () => active.child?.kill()); }
      else active.child.kill('SIGTERM');
    }
    return this.get(id);
  }
  async replay() {
    const cohort = this.list().filter(r => r.status === 'completed' && r.result?.trees?.length && this.resultValid(r));
    const latest = cohort[0];
    const trees = cohort.filter(r => r.suiteHash === latest?.suiteHash && r.adapterHash === latest?.adapterHash && r.sourceCommit === latest?.sourceCommit && r.request.policyModel === latest?.request.policyModel).map(r => r.result.trees.at(-1)).slice(0, 30);
    const child = spawn(this.python, [path.join(this.root, 'rsi', 'worker.py'), '--replay'], { env: this.childEnv(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    return await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(failure('Replay worker timed out.', 504)); }, 30000);
      let out = ''; child.stdout.on('data', c => { out += c; }); child.stderr.resume();
      child.on('error', () => { clearTimeout(timer); reject(failure('Replay environment unavailable.', 409)); });
      child.on('close', code => { clearTimeout(timer); try { const value = JSON.parse(out); if (code !== 0) throw Error(); resolve(value.result); } catch { reject(failure('Replay did not complete.', 502)); } });
      child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify({ trees, maxParallel: 2 }));
    });
  }
  async review(id: string, decision: string, note: string) {
    this.initialize();
    const run = this.get(id); if (run.status !== 'completed' || !run.result) throw failure('A complete experiment is required for review.', 409);
    if (!this.resultValid(run)) throw failure('The result evidence differs from its recorded hash.', 409);
    if (!['approve', 'reject'].includes(decision) || typeof note !== 'string' || note.trim().length < 10 || note.length > 2000) throw failure('Choose approve/reject and record a review note of 10–2000 characters.');
    const r = run.result;
    if (decision === 'approve' && (r.baselineHoldout.missing || r.finalHoldout.missing || r.finalHoldout.S < r.baselineHoldout.S || r.frontier.incumbent.S <= r.baseline.S)) throw failure('Approval requires measured evolve improvement, complete holdout evidence and no aggregate holdout regression.', 409);
    const commit = r.frontier.incumbent.commit;
    if (!/^[0-9a-f]{7,40}$/i.test(commit)) throw failure('Invalid candidate commit.', 409);
    const candidate = await exec('git', ['show', `${commit}:domains/quanta/harness/harness.json`], { cwd: path.join(this.directory(id), 'repo'), windowsHide: true, timeout: 10000, maxBuffer: 40000 });
    if (digest(JSON.parse(candidate.stdout)) !== digest(r.profile)) throw failure('Candidate artifact differs from the measured profile.', 409);
    run.review = { decision: decision as 'approve' | 'reject', note: note.trim(), commit, profileHash: digest(r.profile), at: new Date().toISOString() }; this.event(run, 'candidate.reviewed', run.review); return run;
  }
  artifact(id: string) {
    const run = this.get(id); if (run.review?.decision !== 'approve') throw failure('Approve the measured candidate review before exporting a deployable profile.', 409);
    if (!this.resultValid(run) || run.review.profileHash !== digest(run.result.profile)) throw failure('Reviewed evidence changed after approval.', 409);
    return { kind: 'quanta-reviewed-lab-profile', active: false, sourceCommit: run.sourceCommit, configurationHash: run.configurationHash, review: run.review, profile: run.result.profile, explorationPolicy: run.result.replay?.policy || null, replayQualification: run.result.replay?.status, limitations: run.result.limitations };
  }
  private resultValid(run: RsiRun) {
    try { return Boolean(run.resultHash && run.resultHash === digest(run.result) && run.resultHash === digest(JSON.parse(readFileSync(path.join(this.directory(run.id), 'result.json'), 'utf8')))); } catch { return false; }
  }
  close() {
    this.closed = true; if (this.active?.run.status === 'running') this.cancel(this.active.run.id, 'The local server is shutting down.');
    const file = path.join(this.dataDir, '.owner.json');
    if (this.owner && existsSync(file) && JSON.parse(readFileSync(file, 'utf8')).id === this.ownerId) unlinkSync(file);
    this.owner = false;
  }
}
