import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { BatchRequest, Decision, RunRequest, WorkerEvent } from '../lib/research-contract';
import { ProviderStore } from './provider-store';
import { ResearchStore, ENGINE, failure, validate, validateRequest, validDate, digest, terminal, type Route } from './research-store';
import { getProviderDefinition, type CompatibleProvider } from '../lib/inference-providers';
type Active = {
    id: string;
    attempt: number;
    started: number;
    abort: AbortController;
    calls: Set<AbortController>;
    settling?: boolean;
    effectiveDate?: string;
};
export type Admission = {
    id: string;
    runId: string;
    route: Route;
    input: number;
    output: number;
    controller: AbortController;
};
const events = new Set(['node.started', 'node.completed', 'tool.started', 'tool.completed', 'warning', 'memory.settled', 'usage', 'heartbeat', 'result', 'error']);
const nodes = new Set(['market_analyst', 'social_analyst', 'news_analyst', 'fundamentals_analyst', 'bull_researcher', 'bear_researcher', 'research_manager', 'trader', 'aggressive_analyst', 'conservative_analyst', 'neutral_analyst', 'portfolio_manager']);
export class ResearchManager {
    readonly store: ResearchStore;
    readonly testMode: boolean;
    readonly url: string;
    readonly serviceToken: string;
    readonly researchToken: string;
    readonly dataDir: string;
    private child?: ChildProcess;
    private active?: Active;
    private starting?: Promise<boolean>;
    private stopped = false;
    private dispatching = false;
    private prices?: {
        at: number;
        data: any[];
    };
    private state: {
        status: 'ready' | 'unavailable' | 'starting';
        message: string;
        port: number;
    };
    private owner = false;
    private readonly ownerId = randomUUID();
    private ownerTimer?: ReturnType<typeof setInterval>;
    constructor(readonly providers: ProviderStore, readonly root: string, options: {
        database?: string;
        testMode?: boolean;
        sidecarUrl?: string;
        serviceToken?: string;
    } = {}) {
        this.testMode = options.testMode ?? process.env.GNOESIS_TEST_MODE === '1';
        this.url = (options.sidecarUrl || process.env.GNOESIS_SIDECAR_URL || 'http://127.0.0.1:8788').replace(/\/$/, '');
        const url = new URL(this.url);
        if (!['127.0.0.1', 'localhost', '[::1]', 'trading-worker'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.protocol !== 'http:')
            throw Error('Sidecar must use the configured local service address.');
        this.serviceToken = options.serviceToken || process.env.GNOESIS_SERVICE_TOKEN || randomBytes(32).toString('hex');
        this.researchToken = process.env.GNOESIS_GATEWAY_TOKEN || `gnoesis_${randomBytes(32).toString('hex')}`;
        this.dataDir = process.env.GNOESIS_DATA_DIR || path.join(root, 'data', 'trading');
        this.state = { status: 'unavailable', message: 'Research worker has not started.', port: Number(url.port || 80) };
        this.store = new ResearchStore(options.database || path.join(this.dataDir, 'research.sqlite'));
    }
    async start() { this.store.claimOwner(this.ownerId); try {
        this.store.verifyAll();
        this.store.reconcile();
        this.owner = true;
        this.ownerTimer = setInterval(() => { try {
            this.store.renewOwner(this.ownerId);
        }
        catch {
            void this.stop();
        } }, 5000);
        this.ownerTimer.unref();
        await this.ensureWorker();
        void this.dispatch();
    }
    catch (error) {
        this.store.releaseOwner(this.ownerId);
        throw error;
    } }
    private async probe() { try {
        const r = await fetch(`${this.url}/health`, { headers: { Authorization: `Bearer ${this.serviceToken}` }, signal: AbortSignal.timeout(1800) });
        const value = await r.json();
        return r.ok && value.engine?.commit === ENGINE.commit;
    }
    catch {
        return false;
    } }
    async ensureWorker(): Promise<boolean> {
        if (await this.probe()) {
            this.state = { ...this.state, status: 'ready', message: 'Pinned TradingAgents research worker is ready.' };
            return true;
        }
        if (this.starting)
            return this.starting;
        this.starting = (async () => {
            if (process.env.GNOESIS_SIDECAR_URL) {
                this.state = { ...this.state, status: 'unavailable', message: 'Configured worker is unavailable or has a different source pin.' };
                return false;
            }
            if (this.child && !this.child.killed) {
                this.state = { ...this.state, status: 'unavailable', message: 'Worker started but health validation failed.' };
                return false;
            }
            const python = path.join(this.root, 'trading', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
            if (!existsSync(python)) {
                this.state = { ...this.state, status: 'unavailable', message: 'Install the locked Python runtime: cd trading; uv sync --frozen --python 3.11' };
                return false;
            }
            const env: NodeJS.ProcessEnv = {};
            for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME', 'LANG'])
                if (process.env[key])
                    env[key] = process.env[key];
            Object.assign(env, { PYTHONUNBUFFERED: '1', GNOESIS_OWNER_PID: String(process.pid), GNOESIS_SERVICE_TOKEN: this.serviceToken, GNOESIS_GATEWAY_TOKEN: this.researchToken, GNOESIS_GATEWAY_URL: process.env.GNOESIS_GATEWAY_URL || `http://127.0.0.1:${process.env.QUANTA_PORT || 3000}/v1`, GNOESIS_SIDECAR_URL: this.url, GNOESIS_DATA_DIR: this.dataDir, GNOESIS_TEST_MODE: this.testMode ? '1' : '0' });
            this.state = { ...this.state, status: 'starting', message: 'Loading the locked Python worker.' };
            const child = spawn(python, ['-m', 'uvicorn', 'svc.main:app', '--host', '127.0.0.1', '--port', String(this.state.port)], { cwd: path.join(this.root, 'trading'), env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
            this.child = child;
            // Never forward worker logs or environment secrets into browser-visible errors.
            const log=path.join(this.dataDir,'worker.log');
            child.stderr?.on('data',chunk=>{try{let text=String(chunk).split(this.serviceToken).join('[REDACTED]').split(this.researchToken).join('[REDACTED]').replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]');if(existsSync(log)&&readFileSync(log).length>65536)writeFileSync(log,'[Earlier startup log truncated]\n',{mode:0o600});appendFileSync(log,text.slice(0,16000),{mode:0o600});}catch{}});
            child.on('error', () => { if(this.child!==child)return; this.child = undefined; this.state = { ...this.state, status: 'unavailable', message: 'Worker process could not start.' }; });
            child.on('exit', () => { if(this.child!==child)return; this.child = undefined; this.state = { ...this.state, status: 'unavailable', message: 'Worker stopped. Retry health to restart it.' }; });
            const deadline=Date.now()+180000;
            while (Date.now()<deadline && !this.stopped) {
                if (await this.probe()) {
                    this.state = { ...this.state, status: 'ready', message: 'Pinned TradingAgents research worker is ready.' };
                    return true;
                }
                await new Promise(r => setTimeout(r, 500));
            }
            this.state = { ...this.state, status: 'unavailable', message: 'Worker failed its authenticated startup check.' };
            return false;
        })().finally(() => { this.starting = undefined; });
        return this.starting;
    }
    async catalog(): Promise<Array<Route & {
        label: string;
    }>> {
        const config = await this.providers.publicConfig();
        const available = config.connections.filter(c => c.model && (!getProviderDefinition(c.id)!.requiresKey || c.hasKey));
        if (available.some(c => c.id === 'openrouter') && (!this.prices || Date.now() - this.prices.at > 600000)) {
            try {
                const r = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(3000) });
                const data = await r.json();
                if (r.ok && Array.isArray(data.data))
                    this.prices = { at: Date.now(), data: data.data };
            }
            catch { }
        }
        return available.map(c => { const quote = this.prices?.data.find(m => m.id === c.model)?.pricing; const price = (v: unknown) => v !== undefined && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null; const local = c.id === 'local'; return { id: `${c.id}/${c.model}`, label: `${getProviderDefinition(c.id)!.label} · ${c.model}`, provider: c.id, model: c.model, baseUrl: c.baseUrl, input_rate: local ? 0 : quote && c.id === 'openrouter' ? price(quote.prompt) : null, output_rate: local ? 0 : quote && c.id === 'openrouter' ? price(quote.completion) : null }; });
    }
    async health() {
        if(this.owner&&!this.starting&&this.state.status==='ready'&&!await this.probe())this.state={...this.state,status:'unavailable',message:'Worker is not responding; attempting a local restart.'};
        if(this.owner&&!this.starting&&this.state.status!=='ready')void this.ensureWorker().then(ready=>{if(ready)void this.dispatch();});
        return {name:'Gnoesis Agenic Research',sidecar:this.state,engine:ENGINE,models:(await this.catalog()).map(({id,label,input_rate,output_rate})=>({id,label,input_rate,output_rate})),research_only:true};
    }
    async routes(request: RunRequest) { if (request.mode === 'fixture' && this.testMode)
        return []; const catalog = await this.catalog(); return [...new Set(Object.values(request.models))].map(id => { const route = catalog.find(r => r.id === id); if (!route)
        throw failure('Research requires a configured compatible model route. Configure it in Settings.'); const { label, ...frozen } = route; return frozen; }); }
    async estimate(request: RunRequest) { validateRequest(request, this.testMode); const routes = await this.routes(request); const count = request.selected_analysts.length * 3 + request.debate_rounds * 2 + request.risk_rounds * 3 + 5; const input = count * 6000, output = count * request.budget.max_output_tokens; const known = routes.length > 0 && routes.every(r => r.input_rate !== null && r.output_rate !== null); return { expected_calls: count, estimated_input_tokens: input, estimated_output_tokens: output, estimated_cost_usd: known ? input * Math.max(...routes.map(r => r.input_rate!)) + output * Math.max(...routes.map(r => r.output_rate!)) : null, price_known: known, warnings: ['Estimate assumes 6,000 input tokens per call; tool cycles and reflections can use more.', 'Hard admission limits may stop the pipeline before completion.', 'Historical online feeds may contain revised or later information; evaluation is indicative.', 'API price quotes exclude hardware, data vendor charges, and provider adjustments.'] }; }
    async submit(request: RunRequest, key?: string, batchId: string | null = null) {
        validateRequest(request, this.testMode);
        if (key) {
            const previous = this.store.submission(request, key);
            if (previous)
                return previous;
        }
        const routes = await this.routes(request);
        if (request.budget.max_cost_usd !== null && routes.some(r => r.input_rate === null || r.output_rate === null))
            throw failure('A USD cap requires known prices for both model routes. Use call, token and time limits or configure a priced model.');
        if (this.store.pending().length >= 50)
            throw failure('Queue limit reached.', 429);
        const run = this.store.create(request, routes, batchId, key);
        void this.dispatch();
        return run;
    }
    async batch(value: BatchRequest, key?: string) {
        validate<BatchRequest>('BatchRequest', value);
        if (value.tickers.length * value.dates.length > 50)
            throw failure('Evaluation grid is limited to 50 cells.');
        for (const date of value.dates)
            validDate(date);
        validateRequest(value.template, this.testMode);
        const hash = digest(value);
        if (key) {
            if (key.length > 200 || !key.trim())
                throw failure('Invalid idempotency key.');
            const previous = this.store.db.prepare('SELECT * FROM batch_submissions WHERE key=?').get(key);
            if (previous) {
                if (previous.hash !== hash)
                    throw failure('Idempotency key was used with another grid.', 409);
                const batch = this.batchStatus(String(previous.batch_id));
                return { batch_id: batch.id, run_ids: batch.runs.map(r => r.id) };
            }
        }
        const routes = await this.routes(value.template);
        if (value.template.budget.max_cost_usd !== null && routes.some(r => r.input_rate === null || r.output_rate === null))
            throw failure('A USD cap requires known model prices.');
        if (this.store.pending().length + value.tickers.length * value.dates.length > 50)
            throw failure('Queue limit reached.', 429);
        const id = randomUUID();
        const runIds = this.store.transaction(() => { this.store.db.prepare('INSERT INTO batches VALUES(?,?)').run(id, new Date().toISOString()); const ids: string[] = []; for (const ticker of value.tickers)
            for (const trade_date of value.dates) {
                const request: RunRequest = { ...value.template, ticker, trade_date, mode: value.template.mode === 'fixture' ? 'fixture' : 'evaluation' };
                validateRequest(request, this.testMode);
                ids.push(this.store.create(request, routes, id).id);
            } if (key)
            this.store.db.prepare('INSERT INTO batch_submissions VALUES(?,?,?)').run(key, hash, id); return ids; });
        void this.dispatch();
        return { batch_id: id, run_ids: runIds };
    }
    batchStatus(id: string) { if (!this.store.db.prepare('SELECT id FROM batches WHERE id=?').get(id))
        throw failure('Batch not found.', 404); const runs = this.store.batchRuns(id), by_rating: Record<string, number> = {}; for (const run of runs)
        if (run.decision)
            by_rating[run.decision.rating] = (by_rating[run.decision.rating] || 0) + 1; return { id, runs, summary: { completed: runs.filter(r => r.status === 'done').length, failed: runs.filter(r => r.status === 'error' || r.status === 'cancelled').length, pending: runs.filter(r => !terminal.has(r.status)).length, review: runs.filter(r => r.status === 'review' || r.status === 'data_insufficient').length, by_rating, limitations: ['Independent decision workflow, without portfolio fills, slippage or fees.', 'Failure and review cells remain in the grid.', 'No validated historical return or alpha claim.', 'Online historical feeds and current models are not point-in-time evidence.'] } }; }
    async resume(id: string) { const run = this.store.get(id); if (!['error', 'cancelled'].includes(run.status))
        throw failure('Only cancelled or failed runs can resume.', 409); if (run.usage.calls >= run.request.budget.max_calls || run.usage.total_tokens >= run.request.budget.max_tokens)
        throw failure('This run exhausted its budget. Submit a new run with explicit limits.', 409); const next = this.store.transition(id, 'queued', 'run.resumed', {}, { attempt: run.attempt + 1, error: null }); void this.dispatch(); return next; }
    async cancel(id: string) {
        let run = this.store.get(id);
        if (terminal.has(run.status))
            return run;
        if (run.status === 'queued')
            return this.store.transition(id, 'cancelled', 'run.cancelled', { reason: 'operator' });
        if (run.status === 'running')
            run = this.store.transition(id, 'cancelling', 'run.cancelling', { reason: 'operator' });
        const active = this.active, child = this.child;
        if (active?.id === id) {
            for (const c of active.calls)
                c.abort();
            try {
                const r = await fetch(`${this.url}/cancel/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${this.serviceToken}` }, signal: AbortSignal.timeout(5000) });
                if (!r.ok)
                    throw Error();
            }
            catch {
                if (this.active === active && this.child === child) {
                    child?.kill();
                    this.state = { ...this.state, status: 'unavailable', message: 'Worker was stopped after cancellation could not be acknowledged.' };
                }
            }
            active.abort.abort();
        }
        return this.store.get(id);
    }
    private past(request: RunRequest) {
        if (request.mode !== 'research')
            return [];
        const cutoff = `${request.trade_date}T23:59:59.999Z`;
        return this.store.memory(request.trade_date).map(r => ({ id: r.id, ticker: r.ticker, trade_date: r.trade_date, decision: r.decision, settlement: r.settlement && String(r.settlement.known_at || '') <= cutoff ? r.settlement : null }));
    }
    private async dispatch() {
        if (this.dispatching || this.stopped)
            return;
        this.dispatching = true;
        try {
            while (!this.stopped) {
                const run = this.store.pending().find(r => r.status === 'queued');
                if (!run)
                    break;
                if (!await this.ensureWorker()) {
                    if (this.store.get(run.id).status === 'queued')
                        this.store.transition(run.id, 'error', 'run.error', {}, { error: { code: 'WORKER_UNAVAILABLE', message: this.state.message, error_id: randomUUID() } });
                    break;
                }
                if (this.store.get(run.id).status !== 'queued')
                    continue;
                this.store.transition(run.id, 'running', 'run.started', {});
                const active: Active = { id: run.id, attempt: run.attempt, started: Date.now(), abort: new AbortController(), calls: new Set() };
                this.active = active;
                const timer = setTimeout(() => { void this.cancel(run.id); }, run.request.budget.max_duration_seconds * 1000);
                try {
                    await this.execute(run.id, active, 'execute');
                    if (this.store.get(run.id).status === 'running')
                        throw failure('Worker ended without a validated result.', 502);
                }
                catch (error) {
                    const now = this.store.get(run.id);
                    if (now.status === 'cancelling')
                        this.store.transition(run.id, 'cancelled', 'run.cancelled', { reason: 'operator or time limit' });
                    else if (now.status === 'running')
                        this.store.transition(run.id, 'error', 'run.error', {}, { error: { code: 'WORKER_FAILED', message: 'The research worker stopped. Review persisted events and retry with the same frozen configuration.', error_id: randomUUID() } });
                }
                finally {
                    clearTimeout(timer);
                    for (const c of active.calls)
                        c.abort();
                    this.active = undefined;
                }
            }
        }
        finally {
            this.dispatching = false;
        }
    }
    private async execute(id: string, active: Active, operation: 'execute' | 'settle') {
        const run = this.store.get(id), request = active.effectiveDate ? { ...run.request, trade_date: active.effectiveDate } : run.request;
        const response = await fetch(`${this.url}/${operation}`, { method: 'POST', headers: { Authorization: `Bearer ${this.serviceToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ run_id: id, attempt: active.attempt, request, past_decisions: this.past(request) }), signal: active.abort.signal });
        if (!response.ok || !response.body)
            throw failure('Worker rejected this run.', 502);
        let buffer = '';
        const decoder = new TextDecoder();
        for await (const chunk of response.body as any) {
            buffer += decoder.decode(chunk, { stream: true });
            if (Buffer.byteLength(buffer) > 2000000)
                throw failure('Worker line exceeded the maximum size.', 502);
            let split: number;
            while ((split = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, split).trim();
                buffer = buffer.slice(split + 1);
                if (line)
                    this.workerEvent(id, active, JSON.parse(line));
            }
        }
        if (buffer.trim())
            this.workerEvent(id, active, JSON.parse(buffer));
    }
    private workerEvent(id: string, active: Active, event: WorkerEvent) {
        validate<WorkerEvent>('WorkerEvent', event);
        if (!events.has(event.type) || (event.node_id !== null && !nodes.has(event.node_id)))
            throw failure('Unsupported worker event.', 502);
        const run = this.store.get(id);
        if (run.attempt !== active.attempt || (!active.settling && run.status !== 'running'))
            return;
        if (event.type === 'memory.settled') {
            const source = String(event.payload.source_run_id || '');
            const previous = this.store.get(source);
            const effectiveDate = active.effectiveDate || run.trade_date;
            if (run.request.mode !== 'research' || previous.request.mode !== 'research' || !previous.decision || previous.decision.data_status !== 'ready' || previous.trade_date >= effectiveDate || !this.past({ ...run.request, trade_date: effectiveDate }).some(p => p.id === source))
                throw failure('Invalid settlement source or experiment isolation.', 502);
            const raw = event.payload.settlement;
            if (!raw || typeof raw !== 'object' || Array.isArray(raw))
                throw failure('Invalid settlement outcome.', 502);
            const resolutionDate = String((raw as Record<string, unknown>).resolution_date || '');
            validDate(resolutionDate);
            if (resolutionDate > effectiveDate || resolutionDate <= previous.trade_date)
                throw failure('Settlement date exceeds the requested observation horizon.', 502);
            const settlement = { ...raw, source_run_id: source, settled_by: id, effective_date: effectiveDate, known_at: new Date().toISOString() };
            this.store.update(source, 'decision.settled', settlement, { settlement });
        }
        if (event.type === 'result') {
            if (active.settling)
                throw failure('Unexpected decision during settlement.', 502);
            validate<Decision>('Decision', event.payload);
            const decision = event.payload as unknown as Decision;
            if (run.request.mode !== 'fixture' && decision.source === 'fixture')
                throw failure('Fixture result rejected.', 502);
            if (decision.data_status === 'insufficient' && decision.rating !== 'REVIEW')
                throw failure('Insufficient evidence requires REVIEW.', 502);
            this.store.transition(id, decision.data_status === 'insufficient' ? 'data_insufficient' : decision.rating === 'REVIEW' ? 'review' : 'done', 'result', event.payload, { decision });
        }
        else if (event.type === 'error') {
            this.store.append(id, 'worker.error', { code: String(event.payload.code || 'WORKER_ERROR').slice(0, 80), message: 'Worker failed. Error details are retained by error identifier.', error_id: String(event.payload.error_id || randomUUID()).slice(0, 80) });
            throw failure('Worker reported an error.', 502);
        }
        else
            this.store.append(id, event.type, event.payload, event.node_id);
    }
    async settle(id: string) {
        const run = this.store.get(id), effectiveDate = new Date().toISOString().slice(0, 10);
        if (this.active || this.dispatching)
            throw failure('Wait until the research worker is idle.', 409);
        if (run.request.mode !== 'research' || run.decision?.data_status !== 'ready' || !terminal.has(run.status) || run.trade_date >= effectiveDate)
            throw failure('Settlement requires a ready completed research decision from an earlier date.', 409);
        this.dispatching = true;
        const active: Active = { id, attempt: run.attempt, started: Date.now(), abort: new AbortController(), calls: new Set(), settling: true, effectiveDate };
        this.active = active;
        const timer = setTimeout(() => active.abort.abort(), run.request.budget.max_duration_seconds * 1000);
        try {
            if (!await this.ensureWorker())
                throw failure(this.state.message, 503);
            this.store.append(id, 'settlement.started', { effective_date: effectiveDate, request: { ...run.request, trade_date: effectiveDate } });
            await this.execute(id, active, 'settle');
            this.store.append(id, 'settlement.completed', { effective_date: effectiveDate });
        }
        finally {
            clearTimeout(timer);
            for (const c of active.calls)
                c.abort();
            this.active = undefined;
            this.dispatching = false;
            void this.dispatch();
        }
        return this.store.get(id);
    }
    admit(req: Request, provider: string, model: string, baseUrl: string, body: Record<string, unknown>, controller: AbortController): Admission | undefined {
        const id = req.get('X-Gnoesis-Run');
        if (!id)
            return;
        const active = this.active, run = this.store.get(id);
        if (!active || active.id !== id || String(active.attempt) !== req.get('X-Gnoesis-Attempt') || (!active.settling && run.status !== 'running'))
            throw failure('Research run attempt is inactive.', 403);
        const route = this.store.routes(id).find(r => r.id === req.body.model);
        if (!route || route.provider !== provider || route.model !== model || route.baseUrl.replace(/\/$/, '') !== baseUrl.replace(/\/$/, ''))
            throw failure('Model route differs from the frozen run configuration.', 409);
        if (body.stream === true)
            throw failure('Research inference requires nonstream usage accounting.');
        body.max_tokens = run.request.budget.max_output_tokens;
        if (body.max_completion_tokens !== undefined) {
            body.max_completion_tokens = run.request.budget.max_output_tokens;
            delete body.max_tokens;
        }
        const input = Buffer.byteLength(JSON.stringify({ messages: body.messages, tools: body.tools, response_format: body.response_format }), 'utf8') + 512, output = run.request.budget.max_output_tokens, cost = route.input_rate !== null && route.output_rate !== null ? input * route.input_rate + output * route.output_rate : null;
        const usage = this.store.usage(id), limit = run.request.budget;
        if (Date.now() - active.started > limit.max_duration_seconds * 1000 || usage.calls + 1 > limit.max_calls || usage.total_tokens + input + output > limit.max_tokens || (limit.max_cost_usd !== null && (cost === null || usage.cost_usd === null || usage.cost_usd + cost > limit.max_cost_usd)))
            throw failure('Research budget exhausted before this inference call.', 429);
        const admission = { id: randomUUID(), runId: id, route, input, output, controller };
        this.store.transaction(() => { this.store.db.prepare('INSERT INTO calls VALUES(?,?,?,?)').run(admission.id, id, active.attempt, JSON.stringify({ input, output, cost: cost || 0, estimated: true })); const next = this.store.usage(id); this.store.append(id, 'llm.admitted', { call_id: admission.id, model: route.id, attempt: active.attempt, reserved_input_tokens: input, reserved_output_tokens: output, reserved_cost_usd: cost, request_sha256: digest(body) }); const run = this.store.get(id); run.usage = next; this.store.save(run); });
        active.calls.add(controller);
        return admission;
    }
    researchAuthorized(req: Request): boolean {
        const received = Buffer.from(req.get('authorization')?.replace(/^Bearer\s+/i, '') || ''), expected = Buffer.from(this.researchToken);
        return received.length === expected.length && timingSafeEqual(received, expected) && !!req.get('X-Gnoesis-Run') && !!req.get('X-Gnoesis-Attempt');
    }
    complete(admission: Admission | undefined, result: any) {
        if (!admission)
            return;
        this.active?.calls.delete(admission.controller);
        const raw = result?.usage;
        let input = admission.input, output = admission.output, estimated = true;
        const valid = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
        if (valid(raw?.prompt_tokens) && valid(raw?.completion_tokens)) {
            input = raw.prompt_tokens;
            output = raw.completion_tokens;
            estimated = false;
        }
        const cost = admission.route.input_rate !== null && admission.route.output_rate !== null ? input * admission.route.input_rate + output * admission.route.output_rate : null;
        this.store.transaction(() => { this.store.db.prepare('UPDATE calls SET value=? WHERE id=?').run(JSON.stringify({ input, output, cost: cost || 0, estimated }), admission.id); const run = this.store.get(admission.runId); run.usage = this.store.usage(run.id); this.store.append(run.id, 'llm.completed', { call_id: admission.id, input_tokens: input, output_tokens: output, cost_usd: cost, estimated, response_sha256: result ? digest(result) : null }); this.store.save(run); });
    }
    async stop() { this.stopped = true; if (this.active)
        await this.cancel(this.active.id); this.child?.kill(); if (this.ownerTimer)
        clearInterval(this.ownerTimer); if (this.owner)
        this.store.releaseOwner(this.ownerId); this.owner = false; }
}
