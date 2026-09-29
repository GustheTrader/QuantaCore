import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import Ajv2020 from 'ajv/dist/2020';
import type { Run, RunRequest, RunStatus, Event, Usage } from '../lib/research-contract';
export const ENGINE = { version: '0.5.1', commit: '35543d0248bf89fcb92b17a15858ad0c0e940687' };
const schema = JSON.parse(readFileSync(new URL('../contracts/research.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addSchema(schema);
export const failure = (message: string, status = 400) => Object.assign(new Error(message), { status });
export function finite(value: unknown): boolean { return typeof value === 'number' ? Number.isFinite(value) : Array.isArray(value) ? value.every(finite) : value !== null && typeof value === 'object' ? Object.values(value).every(finite) : true; }
export function validate<T>(name: string, value: unknown): asserts value is T {
    const check = ajv.getSchema(`${schema.$id}#/$defs/${name}`)!;
    if (!finite(value) || !check(value))
        throw failure(`Invalid ${name}: ${ajv.errorsText(check.errors).slice(0, 400)}`);
}
export function validDate(date: string) {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date > new Date().toISOString().slice(0, 10) || date < '1900-01-01')
        throw failure('Use a valid historical calendar date.');
}
export function validateRequest(value: unknown, testMode = false): asserts value is RunRequest {
    validate<RunRequest>('RunRequest', value);
    const request = value as RunRequest;
    validDate(request.trade_date);
    if (request.mode === 'fixture' && !testMode)
        throw failure('Fixture mode is disabled.');
    if (!['deep', 'quick'].every(key => /^[a-z-]+\/.+/.test(request.models[key])))
        throw failure('Select qualified configured model IDs.');
}
export function canonical(value: unknown): string { if (Array.isArray(value))
    return `[${value.map(canonical).join(',')}]`; if (value !== null && typeof value === 'object')
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`; return JSON.stringify(value); }
export const digest = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export type Route = {
    id: string;
    provider: string;
    model: string;
    baseUrl: string;
    input_rate: number | null;
    output_rate: number | null;
};
export const terminal = new Set<RunStatus>(['done', 'error', 'cancelled', 'review', 'data_insufficient']);
const transitions: Record<RunStatus, RunStatus[]> = { queued: ['running', 'cancelled', 'error'], running: ['cancelling', 'done', 'review', 'data_insufficient', 'error'], cancelling: ['cancelled', 'error'], cancelled: ['queued'], error: ['queued'], done: [], review: [], data_insufficient: [] };
export class ResearchStore extends EventEmitter {
    db: DatabaseSync;
    private depth = 0;
    constructor(file: string) {
        super();
        if (file !== ':memory:')
            mkdirSync(path.dirname(file), { recursive: true });
        this.db = new DatabaseSync(file);
        this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, value TEXT NOT NULL, routes TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS events(run_id TEXT NOT NULL REFERENCES runs(id),seq INTEGER NOT NULL,value TEXT NOT NULL, PRIMARY KEY(run_id,seq));
   CREATE TABLE IF NOT EXISTS submissions(key TEXT PRIMARY KEY,hash TEXT NOT NULL,run_id TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS batches(id TEXT PRIMARY KEY,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS batch_submissions(key TEXT PRIMARY KEY,hash TEXT NOT NULL,batch_id TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,attempt INTEGER NOT NULL,value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS owner(singleton INTEGER PRIMARY KEY CHECK(singleton=1),pid INTEGER NOT NULL,instance TEXT NOT NULL,heartbeat TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS runs_status ON runs(json_extract(value,'$.status'));
   CREATE INDEX IF NOT EXISTS runs_batch ON runs(json_extract(value,'$.batch_id'));
   CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'Journal is append-only'); END;
   CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'Journal is append-only'); END;
   CREATE TRIGGER IF NOT EXISTS runs_no_identity_change BEFORE UPDATE OF id,routes ON runs BEGIN SELECT RAISE(ABORT,'Frozen run identity'); END;`);
    }
    close() { this.db.close(); }
    claimOwner(instance: string) { this.transaction(() => { const old = this.db.prepare('SELECT * FROM owner WHERE singleton=1').get(); if (old && old.instance !== instance) {
        let alive = true;
        try {
            process.kill(Number(old.pid), 0);
        }
        catch (error: any) {
            alive = error.code !== 'ESRCH';
        }
        if (alive)
            throw failure('Another live application owns this research database. Use its port or a separate data directory.', 409);
    } this.db.prepare('INSERT OR REPLACE INTO owner VALUES(1,?,?,?)').run(process.pid, instance, new Date().toISOString()); }); }
    renewOwner(instance: string) { if (this.db.prepare('UPDATE owner SET heartbeat=? WHERE singleton=1 AND instance=?').run(new Date().toISOString(), instance).changes !== 1)
        throw Error('Research database ownership was lost.'); }
    releaseOwner(instance: string) { this.db.prepare('DELETE FROM owner WHERE singleton=1 AND instance=?').run(instance); }
    verifyAll() { for (const row of this.db.prepare('SELECT id FROM runs').all())
        if (!this.verify(String(row.id)))
            throw Error(`Research journal integrity failed for ${row.id}. Preserve the database for inspection.`); }
    transaction<T>(fn: () => T): T { if (this.depth)
        return fn(); this.db.exec('BEGIN IMMEDIATE'); this.depth++; try {
        const out = fn();
        this.db.exec('COMMIT');
        return out;
    }
    catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
    }
    finally {
        this.depth--;
    } }
    get(id: string): Run { const row = this.db.prepare('SELECT value FROM runs WHERE id=?').get(id); if (!row)
        throw failure('Run not found.', 404); return JSON.parse(String(row.value)); }
    routes(id: string): Route[] { this.get(id); return JSON.parse(String(this.db.prepare('SELECT routes FROM runs WHERE id=?').get(id)!.routes)); }
    list(): Run[] { return this.db.prepare('SELECT value FROM runs ORDER BY rowid DESC LIMIT 1000').all().map(row => JSON.parse(String(row.value))); }
    pending(): Run[] { return this.db.prepare("SELECT value FROM runs WHERE json_extract(value,'$.status') IN ('queued','running','cancelling') ORDER BY rowid").all().map(row=>JSON.parse(String(row.value))); }
    batchRuns(id:string):Run[]{return this.db.prepare("SELECT value FROM runs WHERE json_extract(value,'$.batch_id')=? ORDER BY rowid").all(id).map(row=>JSON.parse(String(row.value)));}
    memory(date:string):Run[]{return this.db.prepare(`SELECT r.value FROM runs r WHERE json_extract(r.value,'$.request.mode')='research' AND json_extract(r.value,'$.decision.data_status')='ready' AND json_extract(r.value,'$.trade_date')<? AND EXISTS (SELECT 1 FROM events e WHERE e.run_id=r.id AND json_extract(e.value,'$.type')='result' AND json_extract(e.value,'$.at')<=?) ORDER BY json_extract(r.value,'$.trade_date') DESC,r.rowid DESC LIMIT 100`).all(date,`${date}T23:59:59.999Z`).map(row=>JSON.parse(String(row.value)));}
    create(request: RunRequest, routes: Route[], batchId: string | null = null, key?: string): Run {
        const hash = digest({ request, routes, engine: ENGINE });
        if (key) {
            const prior = this.submission(request, key);
            if (prior)
                return prior;
        }
        return this.transaction(() => {
            const now = new Date().toISOString(), id = randomUUID(), known = routes.length > 0 && routes.every(r => r.input_rate !== null && r.output_rate !== null);
            const run: Run = { id, ticker: request.ticker, trade_date: request.trade_date, status: 'queued', created_at: now, updated_at: now, configuration_hash: hash, request, batch_id: batchId, attempt: 1, decision: null, error: null, usage: { calls: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: known ? 0 : null, price_known: known, estimated: false }, settlement: null, artifact_url: `/api/trading/runs/${id}/artifacts` };
            this.db.prepare('INSERT INTO runs VALUES(?,?,?)').run(id, JSON.stringify(run), JSON.stringify(routes));
            this.append(id, 'run.created', { request, routes, engine: ENGINE, configuration_hash: hash, batch_id: batchId, snapshot: run });
            if (key)
                this.db.prepare('INSERT INTO submissions VALUES(?,?,?)').run(key, hash, id);
            return run;
        });
    }
    submission(request: RunRequest, key: string) { if (key.length > 200 || !key.trim())
        throw failure('Invalid idempotency key.'); const prior = this.db.prepare('SELECT * FROM submissions WHERE key=?').get(key); if (!prior)
        return; const run = this.get(String(prior.run_id)); if (digest(run.request) !== digest(request))
        throw failure('Idempotency key was used with another request.', 409); return run; }
    save(run: Run) { this.append(run.id, 'run.projection', { snapshot: run }); this.db.prepare('UPDATE runs SET value=? WHERE id=?').run(JSON.stringify(run), run.id); }
    append(id: string, type: string, payload: Record<string, unknown>, nodeId: string | null = null): Event {
        if (!finite(payload) || Buffer.byteLength(JSON.stringify(payload)) > 2000000)
            throw failure('Worker event is invalid or exceeds 2 MB.');
        const last = this.db.prepare('SELECT value FROM events WHERE run_id=? ORDER BY seq DESC LIMIT 1').get(id);
        const prior: Event | undefined = last ? JSON.parse(String(last.value)) : undefined;
        const value = { seq: (prior?.seq || 0) + 1, run_id: id, type, at: new Date().toISOString(), node_id: nodeId, payload, previous_hash: prior?.hash || '' };
        const event: Event = { ...value, hash: digest(value) };
        this.db.prepare('INSERT INTO events VALUES(?,?,?)').run(id, event.seq, JSON.stringify(event));
        queueMicrotask(() => this.emit(id, event));
        return event;
    }
    events(id: string, after = 0): Event[] { this.get(id); return this.db.prepare('SELECT value FROM events WHERE run_id=? AND seq>? ORDER BY seq').all(id, after).map(row => JSON.parse(String(row.value))); }
    verify(id: string) { let hash = '', seq = 0, snapshot: unknown; const history = this.events(id); for (const event of history) {
        const { hash: actual, ...value } = event;
        if (event.seq !== ++seq || event.previous_hash !== hash || digest(value) !== actual)
            return false;
        hash = actual;
        if (event.payload.snapshot)
            snapshot = event.payload.snapshot;
    } const run = this.get(id), created = history[0]; return !!created && digest(snapshot) === digest(run) && digest({ request: run.request, routes: this.routes(id), engine: ENGINE }) === run.configuration_hash; }
    transition(id: string, status: RunStatus, type: string, payload: Record<string, unknown>, patch: Partial<Run> = {}) {
        return this.transaction(() => { const run = this.get(id); if (!transitions[run.status].includes(status))
            throw failure(`Cannot transition ${run.status} to ${status}.`, 409); this.append(id, type, { ...payload, status, attempt: patch.attempt || run.attempt }); Object.assign(run, patch, { status, updated_at: new Date().toISOString() }); this.save(run); return run; });
    }
    update(id: string, type: string, payload: Record<string, unknown>, patch: Partial<Run> = {}) { return this.transaction(() => { const run = this.get(id); this.append(id, type, payload); Object.assign(run, patch, { updated_at: new Date().toISOString() }); this.save(run); return run; }); }
    reconcile() { for (const run of this.pending()) {
        if (run.status === 'running')
            this.transition(run.id, 'error', 'run.recovered', { reason: 'Owner process ended; resume requires an explicit request.' }, { error: { code: 'OWNER_RESTART', message: 'The owner stopped during this run. Review history and resume explicitly.', error_id: randomUUID() } });
        else if (run.status === 'cancelling')
            this.transition(run.id, 'cancelled', 'run.recovered', { reason: 'Cancellation completed during owner recovery.' });
    } }
    usage(id: string): Usage { const rows = this.db.prepare('SELECT value FROM calls WHERE run_id=?').all(id).map(row => JSON.parse(String(row.value))); const known = this.routes(id).every(r => r.input_rate !== null && r.output_rate !== null) && this.routes(id).length > 0; return { calls: rows.length, input_tokens: rows.reduce((n, r) => n + r.input, 0), output_tokens: rows.reduce((n, r) => n + r.output, 0), total_tokens: rows.reduce((n, r) => n + r.input + r.output, 0), cost_usd: known ? rows.reduce((n, r) => n + r.cost, 0) : null, price_known: known, estimated: rows.some(r => r.estimated) }; }
}
