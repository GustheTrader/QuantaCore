"""Synthetic mechanics tests. No network, model inference or performance claims."""
import contextlib
import io
import json
import tempfile
import unittest
import os
from urllib.error import HTTPError
from pathlib import Path
from unittest.mock import patch

import worker
from replay import dream, replay


class ReplayTests(unittest.TestCase):
    def world(self, i):
        return {"id":str(i), "createdAt":str(i), "root":"root", "nodes":[
            {"id":"root","score":0.4,"tokens":0,"children":["a","b"]},
            {"id":"a","score":0.5,"tokens":100,"children":[]},
            {"id":"b","score":0.8,"tokens":100,"children":[]}]}
    def test_cold_start_never_fabricates_scores(self):
        result = dream([self.world(0)])
        self.assertEqual(result["status"], "insufficient_history")
        self.assertIsNone(result["policy"])
        self.assertEqual(result["providerCalls"], 0)
    def test_outcomes_do_not_affect_unrevealed_order(self):
        tree = self.world(0)
        p = {"order":"breadth","batchWidth":1,"maxNodes":1,"stopGain":1}
        first = replay(tree, p)
        tree["nodes"][2]["score"] = 100
        second = replay(tree, p)
        self.assertEqual(first, second)
        self.assertEqual(first["batches"], [["a"]])
    def test_training_and_validation_worlds_are_disjoint(self):
        r = dream([self.world(i) for i in range(4)], 2)
        self.assertFalse(set(r["trainingIds"]) & set(r["validationIds"]))
        self.assertEqual(r["validationIds"], ["3"])
        self.assertEqual(r["providerCalls"], 0)
    def test_missing_support_never_invents_a_branch(self):
        tree = self.world(0); tree["nodes"][0]["children"] = ["unrecorded"]
        r = replay(tree, {"order":"breadth","batchWidth":1,"maxNodes":3,"stopGain":1})
        self.assertEqual(r["gain"], 0)
        self.assertEqual(r["tokens"], 0)
        self.assertTrue(r["supportLimited"])


class HarnessTests(unittest.TestCase):
    def test_provider_rate_limit_is_distinct_from_local_budget_stop(self):
        cfg = {"gateway":"http://127.0.0.1:1/fixture","maxOutputTokens":256,"maxSeconds":60,"id":"fixture"}
        with patch.dict(os.environ,{"QUANTA_RSI_TOKEN":"fixture"}):
            transport = worker.Transport(cfg)
        rate = HTTPError(cfg["gateway"],429,'fixture',{},io.BytesIO(b'{"error":{"message":"Provider quota limit"}}'))
        with patch.object(worker,'urlopen',side_effect=rate):
            with self.assertRaises(worker.StopResearch) as caught: transport.call([],"fixture/model","policy")
        self.assertEqual(caught.exception.code,'RSI_PROVIDER_RATE_LIMIT')
        budget = HTTPError(cfg["gateway"],429,'fixture',{},io.BytesIO(b'{"error":{"message":"RSI token limit stopped the next call."}}'))
        with patch.object(worker,'urlopen',side_effect=budget):
            with self.assertRaises(worker.StopResearch) as caught: transport.call([],"fixture/model","policy")
        self.assertEqual(caught.exception.code,'BUDGET_OR_AUTH_STOP')
    def test_schema_rejects_generated_code_and_unbounded_context(self):
        with tempfile.TemporaryDirectory(prefix="quanta-rsi-test-") as temp:
            root = Path(temp).resolve()
            self.assertTrue(root.is_relative_to(Path(tempfile.gettempdir()).resolve()))
            p = json.loads((worker.HERE / "harness.json").read_text()); p["code"] = "exec(...)"
            f = root / "harness.json"; f.write_text(json.dumps(p))
            with self.assertRaises(ValueError): worker.profile(f)
            del p["code"]; p["contextMaxChars"] = 999999; f.write_text(json.dumps(p))
            with self.assertRaises(ValueError): worker.profile(f)
    def test_actual_rrsi_worktrees_selection_and_holdout_boundaries(self):
        import rrsi.loop as loop
        import rrsi.gitops as G
        import rrsi.llm as llm
        from rrsi import analyst, digester, propose as proposer_module, critic
        role_generators = {module: module.generate for module in (analyst, digester, proposer_module, critic)}
        suite = json.loads((worker.HERE / "tasks.json").read_text())
        calls, analyzed = [], []
        def fake_call(transport, messages, model, role, json_only=False):
            task = next(t for split in ("evolve","heldout") for t in suite[split] if t["query"] in messages[-1]["content"])
            calls.append(task["id"])
            expected = task["expected"]
            structured = "structured evidence validation" in messages[0]["content"]
            return json.dumps({"answer":expected["needle"],"evidenceIds":expected["sources"],"action":expected["action"],
                               "certainty":expected["certainty"] if structured else "supported"}), 100
        def analyze(domain, traces, *_args, **_kw):
            analyzed.extend(traces)
            return {"failure_modes":[],"success_habits":[],"capability_gaps":[]}
        def propose(domain, harness_dir, *_args, **_kw):
            file = harness_dir / "harness.json"; p = json.loads(file.read_text())
            p["systemPrompt"] += "\nUse structured evidence validation."; file.write_text(json.dumps(p,indent=2))
            return {"status":"done","n_edits":1,"mechanism":"General evidence validation","edits":[{"id":"C1","component":"prompt","hypothesis":"General validation reduces uncertainty errors.","predicted_affected":[]}]}
        remove, generate = G.worktree_remove, llm.generate
        with tempfile.TemporaryDirectory(prefix="quanta-rsi-test-") as temp:
            root = Path(temp).resolve()
            self.assertTrue(root.is_relative_to(Path(tempfile.gettempdir()).resolve()))
            cfg = {"id":"fixture", "directory":str(root),"createdAt":"2026-10-12", "profile":json.loads((worker.HERE/"harness.json").read_text()),
                   "rounds":1,"trials":1,"maxParallel":1,"policyModel":"fixture/policy","searchModel":"fixture/search"}
            events = []
            try:
                with patch.object(worker, 'probe', return_value={"ready":True}), patch.object(worker.Transport, '__init__', return_value=None), patch.object(worker.Transport, 'call', fake_call), patch.object(worker.Transport, 'generate', return_value='{}'), patch.object(worker, 'emit', side_effect=lambda kind, **value: events.append({"type":kind,**value})), patch.object(loop,'analyze',analyze), patch.object(loop,'propose',propose), patch.object(loop,'review',return_value={"verdict":"accept","reasons":[]}):
                    with contextlib.redirect_stdout(io.StringIO()): worker.execute(cfg)
                result = events[-1]["result"]
                self.assertTrue(all(module.generate == llm.generate for module in role_generators))
                self.assertGreater(result["frontier"]["incumbent"]["S"], result["baseline"]["S"])
                self.assertEqual(result["finalHoldout"]["S"], 1)
                self.assertTrue(analyzed)
                self.assertTrue(all(t.startswith('e') for t in analyzed))
                self.assertTrue(any(t.startswith('h') for t in calls))
                self.assertTrue((root/'evidence'/'quanta'/'r0'/'A'/'critic.json').exists())
                self.assertEqual(result["replay"]["status"], "insufficient_history")
                self.assertEqual(worker.git(root/'repo','branch','--show-current'), 'lab-base')
                self.assertIn('structured evidence validation', result["profile"]["systemPrompt"])
            finally:
                G.worktree_remove, llm.generate = remove, generate
                for module, original in role_generators.items(): module.generate = original


if __name__ == '__main__': unittest.main()
