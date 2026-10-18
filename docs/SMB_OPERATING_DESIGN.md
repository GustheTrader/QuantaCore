# SMB Launchpad and system guide

Research checked 2026-10-09. This implementation is a planning UI and operating
guide, not a deployed autonomous company, CRM or ERP. No new external service
was installed, credentials created or recurring jobs activated.

## Research

Polsia's [pitch](https://polsia.com/deck) describes engineering, outreach,
advertising, research, monitoring, support and payments through agent operations.
These are vendor claims; the public main page did not yield a readable technical
API specification in this research. Do not assert official open-source code or
a Quanta-compatible integration contract from these materials.

[open-polsia](https://github.com/AI-Builder-Club/open-polsia) is a separate
MIT-licensed project. Its README describes a pi runtime, Postgres task queue,
planner, research and sandboxed engineering roles, a supervised mode and a
bounded task loop. It provides a reference for execution design, not evidence
that Polsia's commercial service is open source or that this project implements
accounting, payroll or a full ERP. Nothing from it was installed.

[Paperclip](https://github.com/paperclipai/paperclip) provides the organizational
agent control plane. Preserve the existing local deployment and credentials.
[ERPNext](https://github.com/frappe/erpnext) documents accounting, orders,
inventory and procurement features and uses GPL-3.0. It is a proposed system
of record, not currently installed or synchronized by this change.

## Proposed operating architecture

Quanta SMB UI → approved run manifest → Paperclip goals/tasks/budgets → scoped
agent adapters → CRM/ERP draft operations → operator review → reconciled records.

The form captures business name, problem, customer, offer, monthly budget,
milestone, starting point and proposed ERP. Saving records a local browser draft
and connection-log metadata. The budget is a planning field, not an enforced
spending limit. There is no company registration or Paperclip provisioning call.

Paperclip owns task lifecycle. CRM owns leads/opportunities; ERP owns customers,
orders, invoices and ledgers. Documents and source evidence belong in a scoped
KB; reviewed decisions belong in memory. Do not make task completion equivalent
to booked revenue, paid invoices or successful customer delivery.

GTM: ICP and offer hypotheses → channel experiment → approved content/outreach
→ attributed lead → qualified opportunity. RevOps: stable customer ID, pipeline
stage definitions, order/invoice linkage, renewals and independent reconciliation.
Back office: supplier onboarding, draft purchase requests, fulfillment,
inventory where applicable, finance reporting and exception review. Payroll,
tax filings, payments, legal commitments and sensitive people decisions retain
operator ownership and their applicable approvals.

## Adapter requirements before execution

- Map company, agent, customer, opportunity, order and invoice identifiers.
- Start with read-only API scopes; expose draft writes separately from posting.
- Idempotency keys, explicit retry limits and reconciliation before retrying writes.
- Run IDs connect plan, task, tool call, approval, artifact and record changes.
- Enforce budgets, timeouts, maximum steps, cancellation and operator stop.
- Preserve source timestamps, assumptions, disagreements and evidence hashes.
- Verify one task and one read-only record round trip before enabling a schedule.
- Prevent cross-company and personal/business KB or credential mixing.

## System guide

`/#/system-guide` inventories the existing startup modules plus OpenDots,
Open House, HarnessRouter and proposed ERPNext/open-polsia references. Every
entry has its Quanta setup route, reference and operational instructions.
Only known local web consoles have optional iframe previews, loaded on explicit
click. Embedding is not certified: a service can reject framing or require a
separate sign-in tab. No security headers, cookies or permissions are weakened.
Quanta authentication does not authenticate a user to another service.

Full production orchestration, ERP adapters, enforced SMB budgets and automated
GTM execution require a separate reviewed implementation. The new UI makes that
scope concrete without advertising it as already operational.
