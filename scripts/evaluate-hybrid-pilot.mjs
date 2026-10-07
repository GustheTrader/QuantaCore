import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Independent local scoring of paired predictions. This is not an executable P&L backtest. */
export function scorePilot(raw, { domain, trainingEnd, embargoHours }) {
  if (!['business', 'trading'].includes(domain)) throw new Error('Select business or trading.');
  const cutoff = Date.parse(trainingEnd);
  if (!Number.isFinite(cutoff) || typeof embargoHours !== 'number' || !Number.isFinite(embargoHours) || embargoHours < 0) throw new Error('A training cutoff and nonnegative embargo hours are required.');
  const rows = raw.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
  if (!rows.length) throw new Error('Holdout contains no records.');
  const ids = new Set(); let lastDecision = -Infinity, baselineLoss = 0, candidateLoss = 0;
  for (const row of rows) {
    if (typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error('Each holdout row needs a unique ID.'); ids.add(row.id);
    const available = Date.parse(row.availableAt), decision = Date.parse(row.decisionAt), resolved = Date.parse(row.resolvedAt);
    if (![available, decision, resolved].every(Number.isFinite) || available > decision || resolved <= decision) throw new Error('Point-in-time chronology failed: available <= decision < resolved is required.');
    if (decision < lastDecision || decision <= cutoff + embargoHours * 3600000) throw new Error('Holdout must be time-ordered and strictly after the training cutoff plus embargo.'); lastDecision = decision;
    if (![row.target, row.baseline, row.candidate].every(v => typeof v === 'number' && Number.isFinite(v))) throw new Error('Targets and paired predictions must be finite numbers.');
    if (domain === 'trading') {
      if (![0, 1].includes(row.target) || row.baseline < 0 || row.baseline > 1 || row.candidate < 0 || row.candidate > 1 || typeof row.settlementSource !== 'string' || !row.settlementSource.trim()) throw new Error('Binary trading evaluation needs bounded probabilities, a binary outcome and settlement provenance.');
      baselineLoss += (row.baseline - row.target) ** 2; candidateLoss += (row.candidate - row.target) ** 2;
    } else { baselineLoss += Math.abs(row.baseline - row.target); candidateLoss += Math.abs(row.candidate - row.target); }
  }
  const baselineScore = baselineLoss / rows.length, candidateScore = candidateLoss / rows.length;
  return {
    version: 'hybrid-pilot-v1', domain, rows: rows.length, trainingEnd: new Date(cutoff).toISOString(), embargoHours,
    firstDecisionAt: rows[0].decisionAt, lastDecisionAt: rows.at(-1).decisionAt,
    evaluation: { metric: domain === 'trading' ? 'Brier score' : 'MAE', direction: 'lower', baselineScore, candidateScore, holdoutHash: createHash('sha256').update(raw).digest('hex'), evaluatorVersion: 'hybrid-pilot-v1', evidence: `Paired local holdout evaluation on ${rows.length} rows; training cutoff ${new Date(cutoff).toISOString()}, embargo ${embargoHours} hours. Chronology and finite predictions checked. Settlement provenance is recorded but not fetched or independently verified. Improvement is a descriptive metric, not statistical significance, calibration acceptance or executable profitability.` },
    limitations: ['No uncertainty/significance test.', 'Does not prove the holdout was never used in prior optimization.', 'No executable quotes, costs, fills or P&L replay.', 'No automated deployment acceptance for financial execution.']
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [domain, inputFile, outputFile, trainingEnd, embargo] = process.argv.slice(2);
  try {
    if (!inputFile || !outputFile || !trainingEnd || embargo === undefined) throw new Error('Usage: node scripts/evaluate-hybrid-pilot.mjs <business|trading> <holdout.jsonl> <report.json> <training-end-ISO> <embargo-hours>');
    const report = scorePilot(await readFile(inputFile, 'utf8'), { domain, trainingEnd, embargoHours: Number(embargo) });
    await writeFile(outputFile, JSON.stringify(report, null, 2), { flag: 'wx' });
    console.log(`Local ${report.evaluation.metric}: baseline=${report.evaluation.baselineScore}, candidate=${report.evaluation.candidateScore}, rows=${report.rows}. Report: ${path.resolve(outputFile)}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
