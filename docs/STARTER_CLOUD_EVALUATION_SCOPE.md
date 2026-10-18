# Proposed Starter cloud evaluation scope

Prepared October 17, 2026 at the operator's request. **Status: prepared for review; execution is not approved.** This is separate from the installed-local-model runner and local production adapter.

## Named scope

- Experiment: `starter-cloud-source-review-v1`.
- Objective: measure source summarization, option comparison and second-look review on six new frozen, privately generated case instances. No tools, memory, retrieval, user documents or financial action.
- Proposed single route: the already saved **Ollama Cloud** connection, exact saved model **`deepseek-v4.1-flash:cloud`**, endpoint `https://ollama.com/v1`. Model availability, entitlement, revision and inference authorization remain unverified. No provider catalog or model request was sent to prepare this scope.
- Do not use `openrouter/free`, automatic routing, fallback models or a substituted served model. If the exact model is unavailable, stop and revise the scope.
- Baseline only: six calls. A separately selected, frozen text instruction candidate permits six paired candidate calls, for **at most twelve** model requests total. No adaptive retries, tuning on the holdout or reusing an attempted holdout.

## Proposed hard limits and budget prerequisites

| Measure | Proposed limit |
| --- | --- |
| Calls | 6 baseline; at most 12 with one candidate |
| Input | At most 6,000 UTF-8 bytes per request, including system instructions and source/schema |
| Conservative input reservation | 6,512 tokens per call (one token per byte plus 512 overhead); do not use a cheap character-based estimate |
| Output | 512 tokens per call; at most 6,144 across twelve calls |
| Concurrency / retries | One / zero |
| Time | 30 seconds per request; six minutes total including routing checks |
| Proposed provider spend ceiling | **US$1 total, subject to explicit approval and enforceable billing/account limits** |
| Local data export | Only the reviewed fixed instruction and synthetic case payload; no profile, memory, filenames or credentials in prompts |

The spend ceiling is a proposal, not a claim that it is already enforceable. Provider billing/credit terms and current rates have not been verified. Before approval, establish either an enforceable provider/account limit for this scope or a verified rate schedule and conservative pre-request reservation. Unknown cost is not zero. A local reservation alone does not cap a vendor invoice. Stop before inference if that prerequisite cannot be met; do not silently substitute a subscription/quota assumption.

## Freeze and evidence

Before any approved execution, pin the exact request endpoint/model, available provider revision (or explicitly record that weights are provider-managed), instruction bytes, runner hash, rubric hash, candidate bytes if any and budget. Then generate **new** private holdout instances. Record the dataset hash and one correlation root; retain each call's model identity, output hash, quality, critical failures, usage/cost provenance and latency. Persist failures and timeouts without adaptive retry.

Report benchmark measurements and confidence limits together. Six generated cases are a narrow screening exercise, not demonstrated production improvement. Imported or operator-recorded counts do not become executed benchmark evidence.

## Approval and activation boundary

Approval must name this scope revision, exact model, any candidate artifact hash, approved export payload class, verified billing basis and total spend ceiling. This document does not grant that approval. No cloud execution adapter, credential change, provider activation or request is created by preparing it. A cloud result cannot activate the current local-only Starter production adapter; cloud production use would require a separately reviewed adapter and scope.

## Current local evaluation status

The local preparation has six private case instances but is blocked: no local model is configured and Ollama is not responding. It records zero model calls and no quality/cost/latency result. That bundle is not evidence that the Starter model workflow was evaluated.
