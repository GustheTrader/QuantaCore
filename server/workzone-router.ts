import express from 'express';
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { WORKER_HARNESSES, type TrainingReview, type WorkerKnowledge, type WorkZone } from '../lib/workzone-contract';

type Workspace = { companyId?: string; reviews: TrainingReview[]; knowledge: WorkerKnowledge[]; watchlist: string[] };
const BASE = 'http://127.0.0.1:3210';
const text = (value: unknown, limit: number, label: string) => {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error(`${label} is required (up to ${limit} characters).`);
  return value.trim();
};
export function createWorkzoneRouter(root: string) {
  const router = express.Router();
  const file = path.join(root, '.quanta', 'operator-workzones.json');
  const records: Record<string, Workspace> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  let queue = Promise.resolve();
  let boardCookie = '', boardCookieAt = 0;
  let boardSetCookies: string[] = [];
  async function boardSession() {
    if (boardCookie && Date.now() - boardCookieAt < 30 * 60 * 1000) return boardCookie;
    const authFile = path.join(root, '.quanta', 'paperclip-auth.json');
    if (!existsSync(authFile)) throw new Error('Run node scripts/setup-paperclip.mjs after Paperclip starts.');
    const credentials = JSON.parse(readFileSync(authFile, 'utf8'));
    const response = await fetch(BASE + '/api/auth/sign-in/email', { method: 'POST', headers: { Origin: BASE, 'Content-Type': 'application/json' }, body: JSON.stringify(credentials), redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Paperclip operator login failed. Run the local setup script.');
    boardSetCookies = response.headers.getSetCookie();
    boardCookie = boardSetCookies.map(cookie => cookie.split(';')[0]).join('; ');
    if (!boardCookie) throw new Error('Paperclip returned no operator session.');
    boardCookieAt = Date.now(); return boardCookie;
  }
  const persist = () => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file + '.tmp', JSON.stringify(records, null, 2)); renameSync(file + '.tmp', file); };
  async function upstream(endpoint: string, method = 'GET', body?: unknown): Promise<any> {
    const response = await fetch(BASE + '/api' + endpoint, { method, redirect: 'error', signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json', Origin: BASE, ...(endpoint === '/health' ? {} : { Cookie: await boardSession() }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).catch(() => { throw new Error('Paperclip is unavailable on port 3210. Start its Docker service, then run node scripts/setup-paperclip.mjs.'); });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Paperclip ${response.status}: ${typeof result.error === 'string' ? result.error : 'Check local setup and company permissions.'}`);
    return result;
  }
  router.use(async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(req.hostname) || req.get('X-Quanta-Client') !== 'local-ui' || (origin && origin !== `http://${req.get('host')}`) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')) {
      res.status(403).json({ error: 'Use the local QuantaCore Work Zone. Hosted access requires an authenticated Paperclip deployment.' }); return;
    }
    try {
      let owner = 'local-operator';
      const authorization = req.get('authorization');
      if (authorization) {
        const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!url || !key || !authorization.startsWith('Bearer ')) throw new Error('Operator authentication is unavailable.');
        const endpoint = new URL(url);
        if (endpoint.protocol !== 'https:') throw new Error('Supabase identity endpoint must use HTTPS.');
        const response = await fetch(endpoint.origin + '/auth/v1/user', { headers: { Authorization: authorization, apikey: key }, redirect: 'error', signal: AbortSignal.timeout(8000) });
        const user = await response.json();
        if (!response.ok || typeof user.id !== 'string') throw new Error('Your operator session could not be verified. Sign in again.');
        owner = user.id;
      }
      res.locals.browserHost = req.hostname;
      res.locals.owner = owner;
      res.locals.scope = owner === 'local-operator' ? 'local-operator' : 'verified-operator';
      next();
    } catch (error) { res.status(401).json({ error: (error as Error).message }); }
  });
  const context = (zone: unknown, owner: string) => {
    if (zone !== 'build' && zone !== 'trade') throw new Error('Unknown Work Zone.');
    const key = createHash('sha256').update(owner).digest('hex') + ':' + zone;
    return { key, zone: zone as WorkZone, state: records[key] || { reviews: [], knowledge: [], watchlist: [] } as Workspace };
  };
  async function ownAgent(state: Workspace, id: unknown) {
    const workerId = text(id, 80, 'Worker');
    const agents = await upstream(`/companies/${state.companyId}/agents`);
    const agent = agents.find((item: any) => item.id === workerId);
    if (!agent) throw new Error('Select a worker in this operator organization.');
    return agent;
  }
  async function snapshot(state: Workspace, scope: string, browserHost = '127.0.0.1') {
    let company = null, agents: any[] = [], tasks: any[] = [];
    await upstream('/health');
    if (state.companyId) {
      [company, agents, tasks] = await Promise.all([upstream(`/companies/${state.companyId}`), upstream(`/companies/${state.companyId}/agents`), upstream(`/companies/${state.companyId}/issues`)]);
    }
    const prefix = company?.issuePrefix;
    const browserBase = BASE.replace('127.0.0.1', browserHost);
    const url = prefix ? `${browserBase}/${encodeURIComponent(prefix)}` : browserBase;
    return { reachable: true, scope, company: company ? { id: company.id, name: company.name, issuePrefix: prefix } : null,
      agents: agents.map(({ id, name, title, role, reportsTo, adapterType, status, budgetMonthlyCents, spentMonthlyCents }) => ({ id, name, title, role, reportsTo, adapterType, status, budgetMonthlyCents, spentMonthlyCents })),
      tasks: tasks.map(({ id, identifier, title, status, assigneeAgentId, updatedAt }) => ({ id, identifier, title, status, assigneeAgentId, updatedAt })),
      reviews: state.reviews, knowledge: state.knowledge, watchlist: state.watchlist,
      consoleUrl: url, links: { org: url + '/org', tasks: url + '/issues', training: url + '/skills/studio', agents: url + '/agents/all' } };
  }
  router.get('/:zone/state', async (req, res) => {
    try { const { state } = context(req.params.zone, res.locals.owner); res.json(await snapshot(state, res.locals.scope, res.locals.browserHost)); }
    catch (error) { res.status(503).json({ error: (error as Error).message }); }
  });
  router.post('/:zone/:action', async (req, res) => {
    const operation = queue.then(async () => {
      const { key, zone, state } = context(req.params.zone, res.locals.owner);
      const body = req.body || {};
      const action = req.params.action;
      if (action === 'console') {
        if (res.locals.scope !== 'local-operator') throw new Error('Sign into Paperclip with your own company membership. The shared local operator console session is not available to verified users.');
        if (!state.companyId) throw new Error('Create this organization first.');
        await boardSession();
        res.setHeader('Set-Cookie', boardSetCookies);
        return { status: 'success', summary: 'Local operator console session connected.' };
      }
      if (action === 'provision') {
        if (!state.companyId) {
          // Recover a company after an interrupted response instead of duplicating it.
          const marker = `Quanta workspace ${key}`;
          const companies = await upstream('/companies');
          const company = companies.find((item: any) => item.description === marker) || await upstream('/companies', 'POST', { name: `${zone === 'trade' ? 'QuantaTrade' : 'Quanta Work Zone'} · ${key.slice(0, 6)}`, description: marker, budgetMonthlyCents: 0 });
          state.companyId = company.id; records[key] = state; persist();
        }
        return snapshot(state, res.locals.scope, res.locals.browserHost);
      }
      if (!state.companyId) throw new Error('Create this operator organization first.');
      if (action === 'workers') {
        const name = text(body.name, 80, 'Name'), role = text(body.role, 1500, 'Role');
        if (!WORKER_HARNESSES.includes(body.adapterType)) throw new Error('Select a supported harness.');
        if (body.reportsTo) await ownAgent(state, body.reportsTo);
        const budget = Number(body.budgetMonthlyCents);
        if (!Number.isSafeInteger(budget) || budget < 0 || budget > 1000000) throw new Error('Budget must be between 0 and 1,000,000 cents.');
        const company = await upstream(`/companies/${state.companyId}`);
        const hire = company.requireBoardApprovalForNewAgents;
        const created = await upstream(`/companies/${state.companyId}/${hire ? 'agent-hires' : 'agents'}`, 'POST', { name, title: role.slice(0, 100), role: 'general', reportsTo: body.reportsTo || null, capabilities: role, adapterType: body.adapterType,
          adapterConfig: {}, runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: false, intervalSec: 0 } },
          permissions: { canCreateAgents: false, canCreateSkills: false, trustPreset: 'low_trust_review' }, budgetMonthlyCents: budget,
          metadata: { quantaZone: zone, training: 'needs_review', knowledgeScope: 'quanta_private_and_master', financialExecution: false } });
        const agent = hire ? created.agent : created;
        if (agent.status !== 'pending_approval') await upstream(`/agents/${agent.id}`, 'PATCH', { status: 'paused' });
        return { status: 'success', summary: agent.status === 'pending_approval' ? 'Hire submitted for board approval. No worker was activated.' : 'Worker onboarded and paused. Configure its adapter and review it before execution.', artifacts: [agent.id], next_actions: ['Open Paperclip agent settings', 'Record an evaluation review'] };
      }
      if (action === 'tasks') {
        if (body.agentId) await ownAgent(state, body.agentId);
        const issue = await upstream(`/companies/${state.companyId}/issues`, 'POST', { title: text(body.title, 200, 'Task title'), description: text(body.description, 12000, 'Task brief'), status: 'backlog', priority: 'medium', reviewPolicy: 'human_only', assigneeAgentId: body.agentId || null, workMode: 'planning' });
        return { status: 'success', summary: 'Planning task saved to Paperclip backlog. No worker was activated.', artifacts: [issue.id], next_actions: ['Review task and adapter in Paperclip'] };
      }
      if (action === 'reviews') {
        const agent = await ownAgent(state, body.agentId);
        if (!['pass', 'revise'].includes(body.verdict)) throw new Error('Choose pass or revise.');
        const review: TrainingReview = { id: randomUUID(), agentId: agent.id, caseName: text(body.caseName, 200, 'Evaluation case'), skillVersion: text(body.skillVersion, 100, 'Skill version'), artifact: text(body.artifact, 1000, 'Evidence reference'), verdict: body.verdict, notes: text(body.notes, 3000, 'Review notes'), reviewer: res.locals.owner, createdAt: new Date().toISOString(), adapterType: agent.adapterType };
        if (state.reviews.length >= 1000) throw new Error('Export reviews before adding more than 1,000 records.');
        state.reviews.push(review);
      } else if (action === 'knowledge') {
        if (body.agentId !== 'master') await ownAgent(state, body.agentId);
        const note: WorkerKnowledge = { id: randomUUID(), agentId: body.agentId, title: text(body.title, 160, 'Knowledge title'), text: text(body.text, 12000, 'Knowledge text'), source: text(body.source, 1000, 'Source'), createdAt: new Date().toISOString() };
        if (state.knowledge.length >= 500) throw new Error('Export KB notes before adding more than 500 records.');
        state.knowledge.push(note);
      } else if (action === 'watchlist' && zone === 'trade') {
        if (!Array.isArray(body.symbols) || body.symbols.length > 30 || body.symbols.some((s: unknown) => typeof s !== 'string' || !/^[A-Z][A-Z0-9.-]{0,15}$/.test(s))) throw new Error('Provide up to 30 uppercase stock symbols.');
        state.watchlist = [...new Set<string>(body.symbols)];
      } else throw new Error('Unknown workspace action.');
      records[key] = state; persist();
      return { status: 'success', summary: 'Operator workspace saved.', next_actions: ['Refresh workspace'], artifacts: [state.companyId] };
    });
    queue = operation.then(() => undefined, () => undefined);
    try { res.json(await operation); }
    catch (error) { res.status(400).json({ error: (error as Error).message }); }
  });
  return router;
}
