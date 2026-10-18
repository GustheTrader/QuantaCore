"""Isolated stdio worker adapting pinned RRSI to Quanta's metered gateway."""
from __future__ import annotations

import contextlib
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
PIN = json.loads((HERE / "upstream.lock.json").read_text())


def emit(kind, **value):
    sys.__stdout__.write(json.dumps({"type": kind, **value}) + "\n")
    sys.__stdout__.flush()


def git(repo, *args):
    return subprocess.run(["git", "-c", "user.name=Quanta RSI Lab", "-c", "user.email=rsi@localhost", *args],
                          cwd=repo, check=True, capture_output=True, text=True).stdout.strip()


def probe():
    import rrsi
    source = Path(rrsi.__file__).resolve().parent.parent
    commit = git(source, "rev-parse", "HEAD")
    if commit != PIN["commit"] or git(source, "status", "--porcelain", "--", "rrsi", "pyproject.toml"):
        raise ValueError("RRSI source pin or core integrity differs from the approved revision.")
    return {"ready": True, "commit": commit, "python": sys.version.split()[0], "source": str(source)}


def profile(file):
    if file.is_symlink() or file.stat().st_size > 32000:
        raise ValueError("Harness must be a bounded JSON profile.")
    p = json.loads(file.read_text())
    keys = {"systemPrompt", "responseInstruction", "contextPolicy", "contextMaxChars", "includeSourceIds", "toolPolicy"}
    if set(p) != keys or any(not isinstance(p[x], str) or not 1 <= len(p[x]) <= 6000 for x in ("systemPrompt", "responseInstruction")):
        raise ValueError("Invalid harness fields or text limits.")
    if p["contextPolicy"] not in ("sources-first", "query-first") or p["toolPolicy"] not in ("approval-required", "read-only"):
        raise ValueError("Invalid harness policy.")
    if type(p["contextMaxChars"]) is not int or not 1000 <= p["contextMaxChars"] <= 12000 or type(p["includeSourceIds"]) is not bool:
        raise ValueError("Invalid context limit.")
    return p


class StopResearch(BaseException):
    def __init__(self, message, code="BUDGET_OR_AUTH_STOP"):
        super().__init__(message)
        self.code = code


class Transport:
    def __init__(self, cfg):
        self.cfg = cfg
        self.token = os.environ["QUANTA_RSI_TOKEN"]

    def call(self, messages, model, role, json_only=False):
        body = {"model": model, "messages": messages, "stream": False,
                "max_tokens": self.cfg["maxOutputTokens"]}
        if json_only:
            body["response_format"] = {"type": "json_object"}
        req = Request(self.cfg["gateway"] + "/chat/completions", json.dumps(body).encode(),
                      {"Content-Type": "application/json", "Authorization": "Bearer " + self.token,
                       "X-Gnoesis-Run": self.cfg["id"], "X-Quanta-RSI-Role": role})
        try:
            with urlopen(req, timeout=min(180, self.cfg["maxSeconds"])) as response:
                value = json.load(response)
        except HTTPError as exc:
            if exc.code == 429:
                try: detail = json.load(exc).get("error", {}).get("message", "")
                except (ValueError, AttributeError): detail = ""
                if detail.startswith("RSI "):
                    raise StopResearch(detail)
                raise StopResearch("Provider rate limit reached. Evidence was preserved; wait before a new reviewed experiment.", "RSI_PROVIDER_RATE_LIMIT")
            if exc.code == 401:
                raise StopResearch("The selected provider rejected authentication. Review its saved connection.", "RSI_PROVIDER_AUTH_REJECTED")
            if exc.code == 403:
                raise StopResearch("Research authorization or budget stopped the next call.")
            raise ValueError(f"Model gateway returned HTTP {exc.code}.") from None
        choice = value.get("choices", [{}])[0]
        text = choice.get("message", {}).get("content")
        if choice.get("finish_reason") != "stop" or not isinstance(text, str) or not text.strip():
            raise ValueError("Model response was incomplete or lacked usable text.")
        return text, value.get("usage", {}).get("total_tokens")

    def generate(self, prompt, system=None, json_only=False, model=None, cache_prefix=None, **_):
        role = "search"
        for marker, label in (("batch analyst", "analyst"), ("digester", "digester"), ("strict reviewer", "critic"), ("harness engineer", "proposer")):
            if marker in (system or ""):
                role = label
                break
        messages = ([{"role": "system", "content": system}] if system else [])
        messages.append({"role": "user", "content": (cache_prefix or "") + "\n" + prompt})
        text, _ = self.call(messages, self.cfg["searchModel"], role, json_only)
        from rrsi.llm import extract_json
        return extract_json(text) if json_only else text


def execute(cfg):
    probe()
    from rrsi import llm, gitops as G
    transport = Transport(cfg)
    llm.generate = transport.generate  # Install before role modules import generate.
    from rrsi.domain import Domain
    from rrsi.evaluate import TaskResult
    from rrsi.config import RRSIConfig
    from rrsi.loop import Run
    from rrsi import analyst, digester, propose, critic
    for role_module in (analyst, digester, propose, critic):
        role_module.generate = transport.generate
    import rrsi.analyst as analyst
    analyst.DIGEST_PARALLELISM = cfg["maxParallel"]
    from replay import dream
    base = Path(cfg["directory"]).resolve()
    repo = base / "repo"
    runroot = base / "evidence"
    suite = json.loads((HERE / "tasks.json").read_text())
    tasks = {t["id"]: t for split in ("evolve", "heldout") for t in suite[split]}
    repo.mkdir(parents=True, exist_ok=False)
    droot = repo / "domains" / "quanta"
    hroot = droot / "harness"
    hroot.mkdir(parents=True)
    (hroot / "harness.json").write_text(json.dumps(cfg["profile"], indent=2))
    profile(hroot / "harness.json")
    (droot / "SKILL.md").write_text("Evolve only harness.json. Never encode task names, entities, answers or suite-specific constants. Models, task suite, grader, budgets and tool execution are frozen. No files beyond harness.json; JSON is data and is never executed. Model weights stay frozen.")
    (droot / "PATTERNS.md").write_text("General evidence use, uncertainty, instruction boundaries and approval discipline. JSON profile changes must have a general mechanism. The tool policy is a lab instruction; no real external tools execute.")
    git(repo, "init", "-b", "lab-base")
    hooks = base / "empty-hooks"
    hooks.mkdir()
    git(repo, "config", "core.hooksPath", str(hooks))
    git(repo, "config", "core.longpaths", "true")
    git(repo, "add", "domains")
    git(repo, "commit", "-m", "Frozen Quanta harness baseline")
    # Restrict upstream cleanup to worktrees belonging to THIS experiment.
    original_remove = G.worktree_remove
    def remove(repo_path, path, branch=None):
        if Path(repo_path).resolve() != repo or not Path(path).resolve().is_relative_to(runroot):
            raise ValueError("Worktree cleanup escaped the experiment.")
        return original_remove(repo_path, path, branch)
    G.worktree_remove = remove

    class QuantaDomain(Domain):
        name = "quanta"
        root = droot
        source_exts = {".json"}
        briefs = {k: "Quanta JSON-only research harness profiles. Change general prompts, evidence ordering, bounded context and approval instructions. No production tools or financial execution. Keep task-specific knowledge out of the profile." for k in ("analyst", "digester", "proposer", "critic")}
        critic_patterns = [(r"\b(?:e0[1-6]|h0[1-4])\b", "task identifier in profile")]
        component_signals = [("context_mgmt", [r"contextPolicy|contextMaxChars|includeSourceIds"]), ("config", [r"toolPolicy"]), ("prompt", [r"systemPrompt|responseInstruction"])]
        def evolve_ids(self): return [t["id"] for t in suite["evolve"]]
        def heldout_ids(self): return [t["id"] for t in suite["heldout"]]
        def smoke_ids(self, incumbent_per_task=None): return self.evolve_ids()[:1]
        def smoke(self, root, runs_dir, job, ids):
            try:
                files = list(self.harness_dir(root).rglob("*"))
                if len(files) != 1 or files[0].name != "harness.json": raise ValueError("Only harness.json is permitted.")
                profile(files[0])
                return True, {"schemaValid": True, "providerCalls": 0}
            except Exception as exc: return False, {"error": str(exc)}
        def run(self, root, runs_dir, job, ids, k, log_prefix=""):
            p = profile(self.harness_dir(root) / "harness.json")
            output = runs_dir / "jobs" / job
            output.mkdir(parents=True, exist_ok=True)
            for tid in ids:
                for trial in range(k):
                    file = output / f"{tid}-{trial}.json"
                    if file.exists(): continue
                    task = tasks[tid]
                    evidence = [{**s, "id": s["id"] if p["includeSourceIds"] else None} for s in task["evidence"]]
                    context = json.dumps(evidence)[:p["contextMaxChars"]]
                    user = f"Sources: {context}\nTask: {task['query']}" if p["contextPolicy"] == "sources-first" else f"Task: {task['query']}\nSources: {context}"
                    system = p["systemPrompt"] + "\n" + p["responseInstruction"] + "\nTool policy: " + p["toolPolicy"]
                    text, tokens = transport.call([{"role":"system","content":system},{"role":"user","content":user}], cfg["policyModel"], "policy", True)
                    try: result = json.loads(llm.extract_json(text))
                    except (ValueError, TypeError): result = {}
                    exp = task["expected"]
                    checks = [isinstance(result.get("answer"), str) and exp["needle"] in result["answer"].lower(),
                              result.get("evidenceIds") == exp["sources"], result.get("action") == exp["action"], result.get("certainty") == exp["certainty"]]
                    rec = {"task_id":tid, "score":sum(checks)/len(checks), "checks":checks,"output":result,"tokens":tokens,"steps":1,"status":"completed"}
                    file.write_text(json.dumps(rec))
                    emit("trial", job=job, task=tid, trial=trial, score=rec["score"])
        def load_trial(self, runs_dir, job, task_id, trial):
            file = runs_dir / "jobs" / job / f"{task_id}-{trial}.json"
            return json.loads(file.read_text()) if file.exists() else None
        def score(self, runs_dir, job, ids, k):
            per = {}
            for tid in ids:
                records = [self.load_trial(runs_dir, job, tid, i) for i in range(k)]
                per[tid] = TaskResult([r["score"] if r else 0 for r in records], tokens=[r["tokens"] if r else None for r in records], missing=sum(r is None for r in records))
            return per, {"suite":suite["version"],"labOnly":True}
        def render_trace(self, rec, detail=False): return json.dumps(rec)
        def task_row(self, task_id, rec, tr): return f"{task_id}: score={rec['score']} {json.dumps(rec['output'])}"
        def guards(self, incumbent, candidate):
            return ["A task regressed by more than one rubric point."] if any(candidate.per_task[t].mean < incumbent.per_task[t].mean - 0.25 for t in incumbent.per_task) else []

    domain = QuantaDomain()
    config = RRSIConfig(T=cfg["rounds"], k=cfg["trials"], m=2, b_min=1, b_max=2, delta=None,
                        repair_rounds=1, n_fail_traces=4, n_success_traces=2,
                        proposer_model=cfg["searchModel"], analyst_model=cfg["searchModel"], critic_model=cfg["searchModel"])
    run = Run(domain, config, repo, runroot)
    run.harness_rel = "domains/quanta/harness"  # Git tree paths use / on Windows.
    emit("phase", phase="baseline")
    baseline = run.baseline()
    emit("phase", phase="noise_calibration")
    calibration = run.calibrate(["base"])
    emit("phase", phase="baseline_holdout")
    base_holdout = run.heldout("baseline", domain.heldout_ids())
    trees = list(cfg.get("replayPool", []))
    inner = dream(trees, cfg["maxParallel"])
    for t in range(cfg["rounds"]):
        emit("phase", phase="dream_replay", round=t, replay=inner)
        config.eval_parallel = min(cfg["maxParallel"], (inner.get("policy") or {}).get("batchWidth", 1))
        previous = run.frontier()["incumbent"]
        run.round(t)
        nodes = [{"id":"root","score":previous["S"],"tokens":0,"children":[]}]
        for label in ("A", "B"):
            ep = run.runs / f"r{t}" / label / "eval.json"
            if not ep.exists(): continue
            ev = json.loads(ep.read_text())
            nodes[0]["children"].append(label)
            tokens = [v for r in ev["per_task"].values() for v in r["tokens"]]
            # Unknown usage cannot fabricate a cheap replay branch.
            if any(v is None for v in tokens): continue
            nodes.append({"id":label,"score":ev["S"],"tokens":sum(tokens),"children":[]})
        tree = {"id":f"{cfg['id']}-{t}","experiment":cfg["id"],"createdAt":cfg["createdAt"],"root":"root","nodes":nodes}
        if len(nodes) > 1:
            trees.append(tree)
            (run.runs / f"tree-{t}.json").write_text(json.dumps(tree))
        emit("round", round=t, frontier=run.frontier())
        # Do not let multiple rounds of the same experiment masquerade as independent worlds.
        unique = {tree["experiment"]: tree for tree in trees}
        inner = dream(list(unique.values()), cfg["maxParallel"])
    emit("phase", phase="final_holdout")
    final_holdout = run.heldout("final", domain.heldout_ids())
    final = run.frontier()
    commit = final["incumbent"]["commit"]
    artifact = json.loads(git(repo, "show", f"{commit}:domains/quanta/harness/harness.json"))
    result = {"frontier":final,"baseline":baseline.to_json(),"calibration":calibration,"baselineHoldout":base_holdout.to_json(),
              "finalHoldout":final_holdout.to_json(),"profile":artifact,"replay":inner,
              "profileHash":hashlib.sha256(json.dumps(artifact,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest(),
              "trees":[tree for tree in trees if tree["experiment"] == cfg["id"]],
              "limitations":[suite["description"],"Final task holdout is reported after selection and never fed to search roles.","Native RRSI evaluates every screened candidate. Replay influences bounded evaluation parallelism only; it does not skip measurements or establish search-cost savings."]}
    (base / "result.json").write_text(json.dumps(result,indent=2))
    emit("result", result=result)


if __name__ == "__main__":
    try:
        if "--probe" in sys.argv:
            emit("probe", **probe())
        elif "--replay" in sys.argv:
            from replay import dream
            value = json.load(sys.stdin)
            emit("replay", result=dream(value["trees"], value.get("maxParallel", 1)))
        else:
            cfg = json.load(sys.stdin)
            with contextlib.redirect_stdout(sys.stderr): execute(cfg)
    except BaseException as exc:
        emit("error", code=getattr(exc, "code", "RSI_WORKER_FAILED"), message=str(exc)[:500])
        sys.exit(1)
