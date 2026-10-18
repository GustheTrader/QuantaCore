import express from 'express';
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { ProviderStore } from './provider-store';
import { WORKER_HARNESSES, type TrainingReview, type WorkerKnowledge, type WorkZone, type WorkflowDelivery } from '../lib/workzone-contract';

type PrivateDelivery = WorkflowDelivery & { tokenHash: string; expiresAt: string };
type HttpVerifierApproval = { companyId: string; agentId: string; profile: 'scoped_http_service'; approvedAt: string };
type Workspace = { companyId?: string; reviews: TrainingReview[]; knowledge: WorkerKnowledge[]; watchlist: string[]; deliveries?: PrivateDelivery[] };
const BASE = 'http://127.0.0.1:3210';
const text = (value: unknown, limit: number, label: string) => {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error(`${label} is required (up to ${limit} characters).`);
  return value.trim();
};
export function createWorkzoneRouter(root: string) {
  const secrets = new ProviderStore(path.join(root, '.quanta'));
  const router = express.Router();
  const file = path.join(root, '.quanta', 'operator-workzones.json');
  const records: Record<string, Workspace> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const approvalFile = path.join(root, '.quanta', 'workzone-trust-approvals.json');
  const trustApprovals: HttpVerifierApproval[] = existsSync(approvalFile) ? JSON.parse(readFileSync(approvalFile, 'utf8')).approvals || [] : [];
  const approvedHttpVerifier = (companyId: string | undefined, agentId: string) => trustApprovals.some(approval => approval.companyId === companyId && approval.agentId === agentId && approval.profile === 'scoped_http_service' && Number.isFinite(Date.parse(approval.approvedAt)));
  let queue = Promise.resolve();
  let boardCookie = '', boardCookieAt = 0;
  let boardSetCookies: string[] = [];
  let boardLogin: Promise<string> | undefined;
  async function boardSession() {
    if (boardCookie && Date.now() - boardCookieAt < 30 * 60 * 1000) return boardCookie;
    // One sign-in serves simultaneous state reads. Never recreate an existing
    // operator account because of a transient auth failure or expired session.
    if (!boardLogin) boardLogin = (async () => {
      const credentials = (await secrets.getOAuthCredentials('bootstrap')).paperclipAuth;
      if (!credentials?.email || !credentials?.password) throw new Error('Paperclip operator credentials are missing. Run node scripts/setup-paperclip.mjs after Paperclip starts.');
      const response = await fetch(BASE + '/api/auth/sign-in/email', { method: 'POST', headers: { Origin: BASE, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: credentials.email, password: credentials.password }), redirect: 'error', signal: AbortSignal.timeout(20000) });
      if (!response.ok) {
        if (response.status === 429) throw new Error('Paperclip sign-in is temporarily rate limited. Wait a minute, then refresh; your account and organization were preserved.');
        if (response.status >= 500) throw new Error(`Paperclip authentication service returned HTTP ${response.status}. Retry after the service recovers; your account was preserved.`);
        throw new Error(`Paperclip operator sign-in was rejected (HTTP ${response.status}). Reconcile the saved operator credentials; do not reset the organization.`);
      }
      boardSetCookies = response.headers.getSetCookie();
      boardCookie = boardSetCookies.map(cookie => cookie.split(';')[0]).join('; ');
      if (!boardCookie) throw new Error('Paperclip returned no operator session.');
      boardCookieAt = Date.now(); return boardCookie;
    })();
    try { return await boardLogin; } finally { boardLogin = undefined; }
  }
  const persist = () => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file + '.tmp', JSON.stringify(records, null, 2)); renameSync(file + '.tmp', file); };
  async function upstream(endpoint: string, method = 'GET', body?: unknown): Promise<any> {
    const send = async () => {
      // Resolve auth outside the transport catch so login failures retain their
      // diagnosis instead of being rewritten as an unavailable Docker service.
      const cookie = endpoint === '/health' ? undefined : await boardSession();
      return fetch(BASE + '/api' + endpoint, { method, redirect: 'error', signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json', Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).catch(() => { throw new Error('Paperclip is unavailable on port 3210. Start its Docker service, then refresh.'); });
    };
    let response = await send();
    if (response.status === 401 && endpoint !== '/health') {
      // An unauthorized request has not executed. Refresh once, never replay a
      // failed/ambiguous write, permission denial, timeout or provider action.
      await response.body?.cancel();
      boardCookie = ''; boardCookieAt = 0; boardSetCookies = [];
      response = await send();
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Paperclip ${response.status}: ${typeof result.error === 'string' ? result.error : 'Check local setup and company permissions.'}`);
    return result;
  }
  async function observeDeliveryRun(delivery: PrivateDelivery) {
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline) {
      try {
        const run = await upstream(`/heartbeat-runs/${delivery.runId}`);
        delivery.runStatus = String(run.status).slice(0, 40); persist();
        if (['succeeded', 'failed', 'cancelled', 'timed_out'].includes(run.status)) {
          if (run.status !== 'succeeded' || !['in_review', 'approved'].includes(delivery.status)) {
            delivery.status = 'error'; delivery.error ||= `Paperclip heartbeat ${run.status}; inspect its persisted run before starting a new workflow.`; persist();
          }
          await upstream(`/agents/${delivery.agentId}`, 'PATCH', { status: 'paused' });
          return;
        }
      } catch { /* The operator can see and pause the bounded worker in Paperclip. */ }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    delivery.error ||= 'Native heartbeat completion could not be verified within the bounded run window. Inspect Paperclip before retrying.';
    if (['queued', 'running'].includes(delivery.status)) delivery.status = 'error';
    persist();
    try { await upstream(`/agents/${delivery.agentId}`, 'PATCH', { status: 'paused' }); } catch {}
  }
  // This server-to-server callback receives no general model/tool credential.
  // Each short-lived capability authorizes one task for one specific worker.
  router.post('/runtime/verification', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    let authenticatedDelivery: PrivateDelivery | undefined;
    try {
      if (req.get('origin')) throw new Error('Verification callbacks are server-to-server only.');
      const token = req.get('authorization')?.match(/^Bearer (qverify_[A-Za-z0-9_-]{43})$/)?.[1];
      if (!token) throw new Error('A bounded verification capability is required.');
      const digest = createHash('sha256').update(token).digest();
      const entry = Object.entries(records).flatMap(([key, state]) => (state.deliveries || []).map(delivery => ({ key, state, delivery })))
        .find(({ delivery }) => /^[a-f0-9]{64}$/.test(delivery.tokenHash) && timingSafeEqual(digest, Buffer.from(delivery.tokenHash, 'hex')));
      if (!entry) throw new Error('Unknown verification capability.');
      const { state, delivery } = entry;
      if (Date.parse(delivery.expiresAt) < Date.now() || req.body?.agentId !== delivery.agentId || req.body?.taskId !== delivery.taskId || typeof req.body?.runId !== 'string' || !/^[a-f0-9-]{36}$/.test(req.body.runId)) throw new Error('Verification identity or expiry does not match its approved task.');
      authenticatedDelivery = delivery;
      if (delivery.runId && delivery.runId !== req.body.runId) throw new Error('Verification task is already bound to another run.');
      if (['in_review', 'approved'].includes(delivery.status)) { res.json({ status: delivery.status, deliveryId: delivery.id, replay: true }); return; }
      if (delivery.status !== 'queued') throw new Error('Verification is running or uncertain; review the existing result before retrying.');
      delivery.runId = req.body.runId; delivery.status = 'running'; persist();
      const [health, agent, issue, run] = await Promise.all([
        upstream('/health'), ownAgent(state, delivery.agentId), upstream(`/issues/${delivery.taskId}`), upstream(`/heartbeat-runs/${delivery.runId}`),
      ]);
      if (issue.companyId !== state.companyId || issue.assigneeAgentId !== agent.id || ['done', 'cancelled'].includes(issue.status) || run.companyId !== state.companyId || run.agentId !== agent.id) throw new Error('Task and heartbeat must belong to this operator organization and worker.');
      if (delivery.executionProfile === 'scoped_http_service' && !approvedHttpVerifier(state.companyId, agent.id)) throw new Error('The service-worker approval does not match this company and worker.');
      const visibleKnowledge = state.knowledge.filter(note => note.agentId === agent.id || note.agentId === 'master');
      delivery.checks = [
        { name: 'Authenticated Paperclip service is ready', passed: health.deploymentMode === 'authenticated' && health.bootstrapStatus === 'ready' },
        { name: 'Task and actual heartbeat belong to the selected worker and company', passed: true },
        { name: 'Verification harness uses no inference, shell, browser or external business tools', passed: agent.adapterType === 'http' && agent.metadata?.quantaVerification === true },
        { name: 'Worker has a private KB and explicitly shared master KB', passed: visibleKnowledge.some(n => n.agentId === agent.id) && visibleKnowledge.some(n => n.agentId === 'master') },
      ];
      if (delivery.checks.some(check => !check.passed)) throw new Error('One or more workflow checks failed. Inspect the persisted verification result.');
      delivery.output = `# First Work Zone delivery\n\nWorker: ${agent.name}\nTask: ${issue.identifier || issue.id}\nHarness: HTTP local verification (no LLM inference)\nExecution profile: ${delivery.executionProfile === 'scoped_http_service' ? 'Operator-approved standard HTTP service; no native sandbox' : 'Low-trust sandbox'}\n\n${delivery.checks.map(check => `- ${check.passed ? 'PASS' : 'FAIL'}: ${check.name}`).join('\n')}\n\nKnowledge available to this worker: ${visibleKnowledge.filter(n => n.agentId === agent.id).length} private note(s), ${visibleKnowledge.filter(n => n.agentId === 'master').length} shared master note(s). Other workers' private note content was not used.\n\nObserved heartbeat: ${run.id}\nInference calls: 0\nProvider spend: $0\nExternal business/financial actions: none\n\nThis report verifies the local organization → worker → HTTP task → persisted evidence path. It does not certify an LLM provider, model training, trading strategy or autonomous external operation. Human approval is required before the planning task is closed.\n`;
      delivery.evidenceSha256 = createHash('sha256').update(delivery.output).digest('hex');
      const evidenceDir = path.join(root, '.quanta', 'workzone-deliveries'); mkdirSync(evidenceDir, { recursive: true });
      writeFileSync(path.join(evidenceDir, delivery.id + '.json'), JSON.stringify({ ...delivery, tokenHash: undefined, expiresAt: undefined }, null, 2), { mode: 0o600 });
      await upstream(`/issues/${delivery.taskId}`, 'PATCH', { status: 'in_review', comment: delivery.output });
      delivery.status = 'in_review'; delivery.completedAt = new Date().toISOString(); persist();
      res.json({ status: 'in_review', deliveryId: delivery.id, inferenceCalls: 0, humanApprovalRequired: true });
    } catch (error) {
      // An ambiguous failed callback is not replayed automatically.
      if (authenticatedDelivery?.status === 'running') { authenticatedDelivery.status = 'error'; authenticatedDelivery.error = (error as Error).message; persist(); }
      res.status(400).json({ error: (error as Error).message });
    }
  });
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
      deliveries: (state.deliveries || []).map(({ tokenHash, expiresAt, ...delivery }) => delivery),
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
      if (action === 'verify-workflow') {
        if (zone !== 'build') throw new Error('The first verification workflow is for the build organization only.');
        const previous = state.deliveries?.at(-1);
        if (previous && previous.status !== 'error') return { status: previous.status, summary: 'This workflow already exists. Review its persisted delivery below.', artifacts: [previous.id] };
        const agents = await upstream(`/companies/${state.companyId}/agents`);
        let agent = agents.find((a: any) => a.metadata?.quantaVerification === true);
        if (!agent) {
          const company = await upstream(`/companies/${state.companyId}`);
          const hire = company.requireBoardApprovalForNewAgents;
          const created = await upstream(`/companies/${state.companyId}/${hire ? 'agent-hires' : 'agents'}`, 'POST', {
            name: 'Operations Verifier', title: 'Local organization, task and knowledge-scope verification', role: 'general', adapterType: 'http', adapterConfig: {},
            capabilities: 'Verify this operator workspace with local, read-only service checks. No inference, shell, browser, spending or external actions.',
            runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: true, wakeOnAssignment: false, intervalSec: 0 } },
            permissions: { canCreateAgents: false, canCreateSkills: false, trustPreset: 'low_trust_review' }, budgetMonthlyCents: 0,
            metadata: { quantaVerification: true, financialExecution: false },
          });
          agent = hire ? created.agent : created;
        }
        if (agent.status === 'pending_approval') throw new Error('The first worker hire awaits board approval in Paperclip. Existing approval rules were preserved.');
        if (!['paused', 'idle'].includes(agent.status)) throw new Error('Pause the verification worker before creating a new bounded workflow.');
        const serviceApproved = approvedHttpVerifier(state.companyId, agent.id);
        if (serviceApproved) {
          // A recorded human exception applies only to this deterministic HTTP
          // worker. Clear its low-trust boundary before creating the new issue.
          await upstream(`/agents/${agent.id}/permissions`, 'PATCH', { canCreateAgents: false, canCreateSkills: false, canAssignTasks: false, trustPreset: 'standard', authorizationPolicy: { trustPreset: 'standard' } });
        }
        const source = 'User-authorized first Work Zone setup; local verification v1';
        if (!state.knowledge.some(n => n.agentId === agent.id)) state.knowledge.push({ id: randomUUID(), agentId: agent.id, title: 'Operations Verifier private scope', text: 'Read only this assigned organization and task. Use this worker’s private notes and the shared master KB. Do not read other workers’ private note contents or use model/external tools.', source, createdAt: new Date().toISOString() });
        if (!state.knowledge.some(n => n.agentId === 'master')) state.knowledge.push({ id: randomUUID(), agentId: 'master', title: 'Operator work rules', text: 'Preserve evidence, use first principles and require human review. Worker-private knowledge is separate from explicitly shared master knowledge. No financial execution is authorized.', source, createdAt: new Date().toISOString() });
        const attempt = (state.deliveries?.length || 0) + 1;
        const issue = await upstream(`/companies/${state.companyId}/issues`, 'POST', { title: `First delivery: verify the operator workspace · attempt ${attempt}`, description: 'Produce a real local readiness report: authenticated Paperclip health, company/worker/task ownership, actual HTTP heartbeat, and private worker plus shared master KB. No inference, external tools or financial actions. Persist evidence and request human review before closing this planning task.', status: 'backlog', priority: 'medium', reviewPolicy: 'human_only', assigneeAgentId: agent.id, workMode: 'planning' });
        const token = 'qverify_' + randomBytes(32).toString('base64url');
        const delivery: PrivateDelivery = { id: randomUUID(), agentId: agent.id, taskId: issue.id, taskIdentifier: issue.identifier, status: 'queued', createdAt: new Date().toISOString(), harness: 'http', executionProfile: serviceApproved ? 'scoped_http_service' : 'low_trust_sandbox', inferenceCalls: 0, externalActions: false, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() };
        (state.deliveries ||= []).push(delivery); records[key] = state; persist();
        try {
          // Paperclip deliberately rejects permissions on its generic agent
          // PATCH route. Use the board-authorized permissions endpoint with a
          // concrete issue boundary and no task/agent creation permissions.
          if (!serviceApproved) await upstream(`/agents/${agent.id}/permissions`, 'PATCH', { canCreateAgents: false, canCreateSkills: false, canAssignTasks: false, trustPreset: 'low_trust_review', authorizationPolicy: { trustBoundary: { mode: 'low_trust_review', companyId: state.companyId, issueIds: [issue.id], allowedAgentIds: [agent.id], allowedSecretBindingIds: [], allowedToolClasses: [] } } });
          await upstream(`/agents/${agent.id}`, 'PATCH', {
            adapterConfig: { url: `http://host.docker.internal:${process.env.QUANTA_PORT || 3000}/api/work-zone/runtime/verification`, method: 'POST', headers: { Authorization: 'Bearer ' + token }, payloadTemplate: { taskId: issue.id }, timeoutMs: 120000 },
            runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: true, wakeOnAssignment: false, intervalSec: 0 } },
          });
          await upstream(`/agents/${agent.id}/resume`, 'POST', {});
        } catch (error) {
          delivery.status = 'error'; delivery.error = (error as Error).message; persist();
          try { await upstream(`/agents/${agent.id}`, 'PATCH', { status: 'paused' }); } catch {}
          throw error;
        }
        // Return before invoking so a callback never waits on the UI action's
        // queue. The native heartbeat is the actual execution evidence.
        void upstream(`/agents/${agent.id}/heartbeat/invoke`, 'POST', { reason: 'quanta_first_workflow', idempotencyKey: delivery.id, payload: { issueId: issue.id, taskId: issue.id } }).then(run => {
          if (!run.id) throw new Error('Paperclip skipped the manual verification heartbeat.');
          if (delivery.runId && delivery.runId !== run.id) throw new Error('Paperclip returned a different heartbeat identity.');
          delivery.runId = run.id; persist();
          void observeDeliveryRun(delivery);
        }).catch(async error => { delivery.status = 'error'; delivery.error = error.message; persist(); try { await upstream(`/agents/${agent.id}`, 'PATCH', { status: 'paused' }); } catch {} });
        return { status: 'queued', summary: 'Local Operations Verifier started one bounded task. No inference or external actions. Review its evidence before approval.', artifacts: [delivery.id] };
      }
      if (action === 'approve-delivery') {
        const delivery = (state.deliveries || []).find(item => item.id === body.deliveryId);
        if (!delivery || !['in_review', 'approved'].includes(delivery.status) || !delivery.output || delivery.checks?.some(check => !check.passed)) throw new Error('Select a delivered verification report awaiting human review.');
        if (delivery.status === 'approved') {
          await upstream(`/agents/${delivery.agentId}`, 'PATCH', { status: 'paused' });
          return { status: 'approved', summary: 'Existing approval and review preserved; worker paused.' };
        }
        const run = await upstream(`/heartbeat-runs/${delivery.runId}`);
        if (run.companyId !== state.companyId || run.agentId !== delivery.agentId || run.status !== 'succeeded') throw new Error('Wait for this worker’s actual Paperclip heartbeat to succeed before approving its delivery.');
        const issue = await upstream(`/issues/${delivery.taskId}`);
        if (issue.companyId !== state.companyId || issue.assigneeAgentId !== delivery.agentId) throw new Error('Delivery ownership changed. Review it in Paperclip.');
        await upstream(`/issues/${delivery.taskId}`, 'PATCH', { status: 'done', comment: 'Human operator approved the local verification delivery through Quanta Work Zone. Evidence SHA-256: ' + delivery.evidenceSha256 });
        delivery.status = 'approved'; delivery.reviewedAt = new Date().toISOString();
        state.reviews.push({ id: randomUUID(), agentId: delivery.agentId, caseName: 'First operator workflow: local verification', skillVersion: 'workzone-verification-v1', artifact: `Paperclip ${delivery.taskIdentifier}; heartbeat ${delivery.runId}; evidence ${delivery.evidenceSha256}`, verdict: 'pass', notes: 'Human approval of the displayed local verification report. This is not an LLM/provider, training or trading-performance certification.', reviewer: res.locals.owner, createdAt: delivery.reviewedAt, adapterType: 'http' });
        records[key] = state; persist();
        await upstream(`/agents/${delivery.agentId}`, 'PATCH', { status: 'paused' });
        return { status: 'approved', summary: 'Delivery approved, task closed, review recorded and worker paused.', artifacts: [delivery.id] };
      }
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
