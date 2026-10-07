import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePilot } from './evaluate-hybrid-pilot.mjs';
const row = { id: 'one', availableAt: '2026-01-02T00:00:00Z', decisionAt: '2026-01-02T00:15:00Z', resolvedAt: '2026-01-02T00:30:00Z', baseline: 0.5, candidate: 0.8, target: 1, settlementSource: 'official fixture' };
const options = { domain: 'trading', trainingEnd: '2026-01-01T00:00:00Z', embargoHours: 1 };
test('paired Brier scoring reports improvement without claiming profitability', () => { const r = scorePilot(JSON.stringify(row), options); assert.equal(r.evaluation.baselineScore, 0.25); assert.ok(Math.abs(r.evaluation.candidateScore - 0.04) < 1e-12); assert.match(r.evaluation.evidence, /not statistical significance/); });
test('leaked availability, overlapping holdout and unbounded probabilities fail', () => { assert.throws(() => scorePilot(JSON.stringify({ ...row, availableAt: row.resolvedAt }), options), /chronology/); assert.throws(() => scorePilot(JSON.stringify(row), { ...options, embargoHours: 25 }), /cutoff/); assert.throws(() => scorePilot(JSON.stringify({ ...row, candidate: 1.1 }), options), /bounded probabilities/); });
test('duplicate observations cannot inflate evidence', () => { assert.throws(() => scorePilot(`${JSON.stringify(row)}\n${JSON.stringify(row)}`, options), /unique ID/); });
