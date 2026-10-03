import express from 'express';
import type { BatchRequest, RunRequest } from '../lib/research-contract';
import { ResearchManager } from './research-manager';
import { failure, terminal } from './research-store';
const hosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
export function createResearchRouter(manager: ResearchManager) {
    const router = express.Router();
    router.use((req, res, next) => { const origin = req.get('origin'); if (!hosts.has(req.hostname) || req.get('X-Quanta-Client') !== 'local-ui' || (origin && origin !== `${req.protocol}://${req.get('host')}`))
        return res.status(403).json({ error: { message: 'Local research application access required.' } }); next(); });
    const route = (fn: (req: express.Request, res: express.Response) => unknown) => async (req: express.Request, res: express.Response) => { try {
        await fn(req, res);
    }
    catch (error: any) {
        if (!res.headersSent)
            res.status(error.status || 500).json({ error: { message: error.status ? error.message : 'Research operation failed. Review the run history.' } });
        else
            res.end();
    } };
    router.get('/health', route(async (_req, res) => res.json(await manager.health())));
    router.post('/estimate', route(async (req, res) => res.json(await manager.estimate(req.body as RunRequest))));
    router.get('/runs', route((_req, res) => res.json({ runs: manager.store.list().slice(0, 1000).map(run => run.status === 'error' ? manager.runView(run.id) : run) })));
    router.post('/runs', route(async (req, res) => { const run = await manager.submit(req.body as RunRequest, req.get('Idempotency-Key')); res.status(202).json({ run_id: run.id, run }); }));
    router.get('/decisions', route((req, res) => { let runs = manager.store.list().filter(r => r.decision !== null); for (const key of ['ticker', 'date', 'rating'])
        if (req.query[key] && typeof req.query[key] !== 'string')
            throw failure('Invalid decision filter.'); if (req.query.ticker)
        runs = runs.filter(r => r.ticker === req.query.ticker); if (req.query.date)
        runs = runs.filter(r => r.trade_date === req.query.date); if (req.query.rating)
        runs = runs.filter(r => r.decision?.rating === req.query.rating); res.json({ runs }); }));
    router.get('/runs/:id', route((req, res) => res.json(manager.runView(String(req.params.id)))));
    router.post('/runs/:id/cancel', route(async (req, res) => res.json(await manager.cancel(String(req.params.id)))));
    router.post('/runs/:id/resume', route(async (req, res) => res.json(await manager.resume(String(req.params.id)))));
    router.post('/runs/:id/settle', route(async (req, res) => res.json(await manager.settle(String(req.params.id)))));
    router.get('/runs/:id/events', route((req, res) => {
        const id = String(req.params.id), run = manager.store.get(id);
        const text = req.get('Last-Event-ID') || '0';
        if (!/^\d{1,12}$/.test(text))
            throw failure('Invalid replay cursor.');
        const cursor = Number(text), history = manager.store.events(id, cursor), last = manager.store.events(id).at(-1)?.seq || 0;
        if (cursor > last)
            throw failure('Replay cursor exceeds the journal.');
        res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        let sent = cursor, pumping = false;
        const queue = [...history];
        const drain = () => new Promise<void>(resolve => { const done = () => { res.off('drain', done); res.off('close', done); resolve(); }; res.once('drain', done); res.once('close', done); });
        const pump = async () => { if (pumping)
            return; pumping = true; try {
            while (queue.length && !res.destroyed && !res.writableEnded) {
                const event = queue.shift()!;
                if (event.seq <= sent)
                    continue;
                sent = event.seq;
                if (!res.write(`id: ${event.seq}\nevent: research\ndata: ${JSON.stringify(event)}\n\n`))
                    await drain();
            }
            if (!res.destroyed && terminal.has(manager.store.get(id).status) && !queue.length)
                res.end();
        }
        finally {
            pumping = false;
        } };
        const listener = (event: any) => { if (event.seq > sent) {
            queue.push(event);
            void pump();
        } };
        manager.store.on(id, listener);
        const heartbeat = setInterval(() => { if (!pumping && !res.writableEnded)
            res.write(': heartbeat\n\n'); }, 15000);
        req.on('close', () => { clearInterval(heartbeat); manager.store.off(id, listener); });
        void pump();
    }));
    router.get('/runs/:id/artifact.json', route((req, res) => { const id = String(req.params.id); if (!manager.store.verify(id))
        throw failure('Journal integrity check failed.', 409); res.setHeader('Content-Disposition', `attachment; filename="gnoesis-${id}.json"`); const storedRun=manager.store.get(id), viewedRun=manager.runView(id), diagnosis=storedRun.error?.code === viewedRun.error?.code ? null : { ...viewedRun.error, derived: true, source: 'persisted worker trace' }; res.json({ run: storedRun, diagnosis, engine: { version: '0.5.1', commit: '35543d0248bf89fcb92b17a15858ad0c0e940687' }, events: manager.store.events(id), frozen_routes: manager.store.routes(id) }); }));
    router.get('/runs/:id/artifacts', route((req, res) => { const run = manager.store.get(String(req.params.id)); const d = run.decision; res.type('text/markdown'); res.setHeader('Content-Disposition', `attachment; filename="gnoesis-${run.id}.md"`); res.send(`# Gnoesis Agenic Research\n\nResearch only.\n\nRun: ${run.id}\nTicker: ${run.ticker}\nDate: ${run.trade_date}\nStatus: ${run.status}\nConfiguration: ${run.configuration_hash}\n\n## Decision\n\n${d?.raw_text || 'No decision was produced.'}\n\n${Object.entries(d?.reports || {}).map(([name, report]) => `## ${name}\n\n${report}`).join('\n\n')}\n\n## Evidence\n\n${JSON.stringify(d?.evidence || [], null, 2)}\n\n## Usage\n\n${JSON.stringify(run.usage, null, 2)}\n\n## Settlement\n\n${JSON.stringify(run.settlement, null, 2)}\n`); }));
    router.post('/backtest', route(async (req, res) => res.status(202).json(await manager.batch(req.body as BatchRequest, req.get('Idempotency-Key')))));
    router.get('/backtest/:id', route((req, res) => res.json(manager.batchStatus(String(req.params.id)))));
    router.post('/backtest/:id/resume', route(async (req, res) => { const batch = manager.batchStatus(String(req.params.id)); for (const run of batch.runs)
        if (['error', 'cancelled'].includes(run.status) && run.error?.code !== 'RESEARCH_BUDGET_EXHAUSTED')
            try { await manager.resume(run.id); } catch (error: any) { if (error.status !== 409) throw error; } res.json(manager.batchStatus(batch.id)); }));
    return router;
}
