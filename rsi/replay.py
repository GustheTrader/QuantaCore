"""Quanta's bounded recorded-tree replay. This is not official Dream-RSI code.

Only revealed node outcomes influence decisions. Unrecorded branches are never
invented. Training trees and replay validation trees are disjoint; final task
holdouts never enter this pool. Replay costs no provider calls.
"""
from __future__ import annotations

import hashlib
import json
from collections import deque


def replay(tree: dict, policy: dict) -> dict:
    nodes = {n["id"]: n for n in tree["nodes"]}
    root = nodes[tree["root"]]
    queue = deque(root.get("children", []))
    baseline = best = float(root["score"])
    spent = opened = 0
    batches = []
    support_limited = False
    while queue and opened < policy["maxNodes"]:
        batch = []
        for _ in range(min(policy["batchWidth"], policy["maxNodes"] - opened, len(queue))):
            node_id = queue.pop() if policy["order"] == "depth" else queue.popleft()
            if node_id not in nodes:
                support_limited = True
                continue
            # Realized outcome/cost becomes visible only AFTER the node is opened.
            node = nodes[node_id]
            opened += 1
            spent += max(0, int(node["tokens"]))
            best = max(best, float(node["score"]))
            queue.extend(node.get("children", []))
            batch.append(node_id)
        if batch:
            batches.append(batch)
        if best - baseline >= policy["stopGain"]:
            break
    gain = best - baseline
    return {"gain": gain, "bestScore": best, "opened": opened, "tokens": spent,
            "batches": batches, "supportedNodes": len(nodes) - 1,
            "supportLimited": support_limited or bool(queue),
            "utility": gain - 0.000001 * spent - 0.001 * opened - 0.0001 * len(batches)}


def dream(trees: list[dict], max_parallel: int = 1) -> dict:
    # Stable temporal split by completed experiment. A single tree cannot prove transfer.
    trees = sorted(trees, key=lambda t: (t["createdAt"], t["id"]))
    if len(trees) < 3:
        return {"status": "insufficient_history", "treeCount": len(trees), "required": 3,
                "providerCalls": 0, "policy": None,
                "limitation": "Collect three completed experiment trees before replay qualification."}
    train, validation = trees[:-1], trees[-1:]
    policies = [{"order": order, "batchWidth": width, "maxNodes": cap, "stopGain": gain}
                for order in ("breadth", "depth") for width in range(1, min(2, max_parallel) + 1)
                for cap in (1, 2, 4, 8) for gain in (0.05, 0.15, 1.0)]
    def average(pool, p):
        results = [replay(t, p) for t in pool]
        return sum(r["utility"] for r in results) / len(results), results
    ranked = sorted(((average(train, p)[0], p) for p in policies),
                    key=lambda x: (-x[0], json.dumps(x[1], sort_keys=True)))
    winner = ranked[0][1]
    baseline = {"order": "breadth", "batchWidth": 1, "maxNodes": 8, "stopGain": 1.0}
    score, results = average(validation, winner)
    base_score, _ = average(validation, baseline)
    improved = score > base_score + 1e-9
    digest = hashlib.sha256(json.dumps(trees, sort_keys=True).encode()).hexdigest()
    return {"status": "qualified" if improved else "no_validated_gain", "providerCalls": 0,
            "treeCount": len(trees), "poolHash": digest,
            "trainingIds": [t["id"] for t in train], "validationIds": [t["id"] for t in validation],
            "policy": winner if improved else baseline, "candidateCount": len(policies),
            "trainingUtility": ranked[0][0], "validationUtility": score,
            "baselineValidationUtility": base_score, "validation": results,
            "limitation": "Replay covers recorded branches and evaluation tokens only. Scheduling can transfer; stopping rules remain replay previews. No new-task gain or total search-cost saving is established."}
