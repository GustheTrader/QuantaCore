# Agent operating modes

The shared setup screen has two choices: Single agent and Orchestrated workflow.
Selections are browser-local drafts, stored under `quanta_workflow_setup_v1`.
Saving a draft records metadata in the connection log. It does not configure an
execution engine, grant tool access or dispatch a task.

Single agent: one owner, one objective, selected model and explicitly selected
tools. The existing task workspace remains the execution entry point.

Orchestrated workflow: one shared objective and explicit role assignments.
Use-case presets suggest roles and an editable method:

| Use case | Suggested method | Roles |
| --- | --- | --- |
| Research | Sequential | Researcher, evidence reviewer, synthesizer |
| Development | Sequential | Planner, builder, reviewer |
| Business planning | Coordinator | Analyst, planner, reviewer |
| Trading research | Parallel | Data researcher, quant analyst, independent reviewer |

Sequential passes outputs and sources through ordered stages. Parallel gathers
independent analyses before synthesis. Coordinator delegates scoped work and
reviews outputs. Trading remains paper research.

## Execution integration proposal

Before applying a draft to a live orchestration engine, resolve real agent IDs,
verify each model route, check required tools and obtain approval for any new
permissions. Persist a run manifest with objective, roles, route identities,
tool scopes, budget, timeout, step limit and operator review points. Log stage
start, completion, failure and cancellation with a shared run ID. Do not equate
HTTP availability with a successful tool or agent task. Stop dependent stages
on failure; parallel synthesis must preserve disagreements and missing results.

The present change implements the setup draft and workspace navigation only.
Live scheduler/adapter integration is a separate major change requiring review.
