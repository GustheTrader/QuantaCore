# Composability Copilot

The local setup interview is available from startup and directly at `/#/compose`. It asks four short questions, then presents a reviewable proposal:

1. Purpose and an optional goal in the client's words.
2. Two or three useful jobs.
3. Pasted context, explicitly selected documents, or documents plus separately governed private memory.
4. Conversation, plan/draft/review, or a separately configured tool workspace.

The proposal lists the selected jobs, each optional module, its reason and remaining setup. Applying it changes the current setup draft and opens the model-connection step. The normal setup save/review/launch flow remains authoritative; closing the interview discards its draft. Starter is recommended when no optional modules are requested. Current provider/model choice is preserved for review.

`lib/composability-copilot.ts` owns transparent composition rules over the existing catalog. This first version is a guided local interview, not a model-generated consultation, learned route selector or claim that an integration is ready. It sends no interview answers to a model. Free text supplies the proposal name; the client explicitly chooses the purpose and jobs. Unseen model evaluation is still required before learned selection is considered.

Selecting memory, Hermes, evidence views or the QS research bridge records preferences; it never admits records, grants tool authority, starts a service or authorizes cloud spend. QS is offered only for the explicitly chosen trading-research purpose, and its read-only boundary remains intact.

## Validation · October 17, 2026

All 45 focused and regression checks passed, including the composition rules, existing setup/skill rules, operating evidence, QS read contract, gateway, research storage and RSI gates. TypeScript and the production build passed; the existing large-chunk warning remains. An isolated browser verified a two-job Starter interview through apply into model connection, and a Custom interview with explicitly requested documents, memory, Hermes, evidence and QS. Neither review created a saved setup or submitted a model request. The 390-pixel mobile flow has no horizontal overflow or JavaScript console errors. The systems map now has 31 components and direct local launch links.
