# Open House agent channel

Open `http://127.0.0.1:3000/#/agent-house`, or choose **Hands → Open House Channel**.

1. Add an agent, name it, and specify its role and task.
2. Assign Quanta Dialogue, Quanta Draft + Review, or a connected HarnessRouter harness. Choose a saved model route.
3. Add reference notes to that agent's KB. Add common ground and approved evidence to the master KB.
4. Post a channel message or address an agent directly, then run the selected agent's assigned task.
5. Review its editable draft and publish it to the whole channel or hand it to another agent. Run the recipient to continue the conversation.

The model receives only the selected agent's private KB, master KB excerpts, and published messages addressed to it (plus its own published messages). Other agents' private notes and unpublished drafts are excluded. Notes are selected by keyword overlap and recency within the input budget; this is bounded lexical retrieval, not a vector database or a claim that all KB content was consulted. KB IDs used by a run are recorded in its provenance.

The master KB is curated by the operator. **Share copy to master KB** makes a copy available to every agent and preserves the original private note. Agent output is never automatically promoted to either KB. Draft review helps prevent accidental disclosure through published replies; prompt isolation does not guarantee that an LLM will never paraphrase a private fact.

Quanta Dialogue sends one text request without tools to a configured compatible model. Quanta Draft + Review performs a second model pass and returns its improved response; that is not independent empirical validation. External HarnessRouter runs retain the existing catalog validation, hosted allowlists, request budget and tool permissions. A prompt does not sandbox an external harness, so use a read-only runtime in this channel.

Browser storage is the default. Workspaces are scoped by authenticated Supabase user ID when present, otherwise the local development session identity. The operator can inspect every agent KB. Limits are 12 agents, 100 notes, 200 retained messages and 1.5 MB per workspace; use **Export** for a backup. A model run transmits the assembled context to the chosen provider even when workspace storage is local.

Optional Supabase persistence uses `agent_house_workspaces` with RLS limited to `auth.uid() = owner_id`. Apply `supabase/migrations/202609300001_agent_house.sql` before using the cloud load/save buttons. Cloud saves are explicit and compare revisions, refusing stale overwrites. This migration is supplied but is not required for the local browser feature. Hindsight/Honcho ingestion is not automatic: their older per-user bank does not establish per-agent isolation for this channel.
