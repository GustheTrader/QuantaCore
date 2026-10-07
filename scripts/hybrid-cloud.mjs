import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const [command = 'help', id, ...flags] = process.argv.slice(2);
const base = new URL(process.env.QUANTA_LOCAL_URL || 'http://127.0.0.1:3000');
if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || base.username || base.password) throw new Error('Hybrid CLI requires a loopback HTTP server.');
async function request(endpoint, body, key) {
  const response = await fetch(new URL('/api/hybrid' + endpoint, base), { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Quanta-Client': 'local-ui', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(70000) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || `Local HTTP ${response.status}`); return result;
}
try {
  let result;
  if (command === 'help') {
    console.log('Local Hybrid Cloud\n  status\n  draft <request.json>\n  job <job-id>\n  approve <job-id> --data-export --spend\n  run <job-id>\n  poll <job-id>\n  cancel <job-id>\n  evaluate <job-id> --file <evaluation.json>\n  promote <job-id> --approve\n  rollback <business|trading>\nConfigure encrypted credentials and budgets at http://127.0.0.1:3000/hybrid.html');
  } else if (command === 'status' || command === 'job') {
    const view = await request('/status');
    if (command === 'job') { result = view.jobs.find(job => job.id === id); if (!result) throw new Error('Job not found.'); }
    else result = { executionMode: view.executionMode, policies: view.policies, reservedUsd: view.reservedUsd, jobs: view.jobs.map(({ id, domain, operation, label, status }) => ({ id, domain, operation, label, status })), registry: view.registry };
  } else if (command === 'draft') {
    const raw = await readFile(id, 'utf8'); result = await request('/jobs', JSON.parse(raw), createHash('sha256').update(raw).digest('hex'));
  } else if (command === 'approve') {
    if (!flags.includes('--data-export') || !flags.includes('--spend')) throw new Error('Review job inputs first; approval requires --data-export --spend.');
    result = await request(`/jobs/${encodeURIComponent(id)}/approve`, { approveDataExport: true, approveSpend: true });
  } else if (['run', 'poll', 'cancel'].includes(command)) {
    if (!id) throw new Error('A job ID is required.'); result = await request(`/jobs/${encodeURIComponent(id)}/${command}`, {});
  } else if (command === 'evaluate') {
    const index = flags.indexOf('--file'); if (index < 0 || !flags[index + 1]) throw new Error('An evaluation file is required.');
    const report = JSON.parse(await readFile(flags[index + 1], 'utf8')); result = await request(`/jobs/${encodeURIComponent(id)}/evaluate`, report.evaluation || report);
  } else if (command === 'promote') {
    if (!flags.includes('--approve')) throw new Error('Promotion requires --approve.'); result = await request(`/jobs/${encodeURIComponent(id)}/promote`, { approvePromotion: true });
  } else if (command === 'rollback') {
    if (!['business', 'trading'].includes(id)) throw new Error('Select business or trading.'); result = await request(`/registry/${id}/rollback`, {});
  } else throw new Error('Unknown command. Run help.');
  if (result) console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(`Hybrid Cloud: ${error.message}`); process.exitCode = 1; }
