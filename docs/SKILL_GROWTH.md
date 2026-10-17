# SkillForge and Active Skillference in QuantaCore

This scoped integration adds Skills & Growth at `/#/rsi-lab/skills`, the supplied SkillForge paper, the pinned Active Skillference curriculum and a read-only Hermes staged-proposal review flow.

## Source identity

- **SkillForge:** Xingyan Liu et al., “SkillForge: Forging Domain-Specific, Self-Evolving Agent Skills in Cloud Technical Support,” arXiv:2604.08618v2. The user-supplied 19-page PDF is preserved at `public/papers/skillforge-2604.08618v2.pdf`; SHA-256 `4877d9e8e67782d4385d497f3de31c6be54c31519ee3fe7f940ddf6ffa7cd063`. [Primary record](https://arxiv.org/abs/2604.08618).
- **Active Skillference:** the Active Inference Institute / Daniel Ari Friedman project, [repository](https://github.com/ActiveInferenceInstitute/Active_Skillference), [archived paper and DOI](https://zenodo.org/records/21865644). This is the specific project requested by the user, not a generic name for skill selection.

The Active Skillference artifacts are pinned to commit `1f1030f053f2922f1c16ea7170e62635b511d603`. `public/research/active-skillference/` contains its unmodified SkillTree export, claim ledger, MIT license, third-party notices and a source/checksum manifest. The browser verifies the two JSON checksums before parsing them. It validates unique IDs, prerequisite resolution and acyclicity; displayed graph counts are computed from that validated data. Imported scientific claim values retain the upstream kernel-module reference and are labeled as imported. The upstream kernels, scientific claims and entire upstream test suite have not been rerun by this integration.

## Capability and limits

`SkillGrowthLab` has three sections: skill policy, the Active Skillference curriculum, and the SkillForge growth loop. It loads the actual pinned curriculum rather than a synthetic example. Learning reviews are local operator annotations tied to that source commit. Direct and transitive prerequisites must be reviewed before recording a dependent review. These records do not establish mastery, score quizzes or synchronize SkillTree. Live SkillTree deployment and learner accounts are not configured here.

The packaged skills at `skills/skillforge/SKILL.md` and `skills/active-skillference/SKILL.md` are Quanta adaptations. They are active starter procedures, not measured improvements over a baseline. Their content is available for local review. Request-time agent integration is not included in this release. “Active” means eligible for selection; it does not mean benchmarked or scientifically validated.

Skill revisions may use `{{claim:ID}}` tokens for imported ledger values or computed `curriculum.*` counts. Unknown tokens prevent adoption and inference selection. Resolved values include their origin and scope. This is a binding check for skill content, not a reproduction of the upstream project's complete bare-number prose, scholarship, quiz and publication gate set.

## Skill policy

The page stores local HNTL, bounded-selection and context-budget preferences. The library includes deterministic selection and prerequisite checks for future consumers, but this release does not connect them to agent requests. No automatic routing or learned selection is activated.

Skill definitions do not grant executable scripts, filesystem access, external tools, credentials or financial authority. Documents and reference exports are source data; embedded instructions do not authorize execution. Hermes-linked skills remain excluded from Quanta selection.

## Growth loop

1. Record a real failure against a specific skill version, with expected behavior and a source/evidence reference. Knowledge, tool, clarification and style are annotated separately. The paper's deterministic bad-case threshold is implemented: one high dimension or two medium dimensions, with knowledge/tool/clarification/style tie priority.
2. Group selected bad cases by dimension and propose a small additive refinement. The baseline is immutable and retained. Each candidate cites the development case IDs and optional Active Skillference prerequisite IDs.
3. Record a comparison from an external frozen evaluation: distinct holdout case IDs, baseline/candidate correct counts, critical failures, setup, report and reviewer. The form records operator assertions; it does not run an evaluator or certify the evidence. A minimum of five distinct holdout cases is a Quanta workflow screening rule, not a statistical guarantee.
4. Adoption requires an improved recorded result, zero recorded critical failures, disjoint development/holdout IDs, unchanged candidate/baseline text, a still-active baseline and satisfied curriculum reviews. It always requires an explicit operator decision note. Bounded automatic selection never auto-adopts changes.
5. Retain the prior version and journal. Operator rollback restores a prior local library version. Hermes rollback is blocked pending a write-back adapter. Rejecting a candidate preserves its evidence.

The loop runs one operator-triggered batch at a time; it has no unattended scheduler, recursive model execution or training job. Limits bound version, case, evaluation and journal storage. The browser profile owns its local library; a concurrent conflicting save is rejected rather than overwriting another view. Export preserves the whole library and journal. These are local preference and review records, not a multi-user authorization service or a signed evidence ledger.

## Validation

Focused offline checks cover the real artifact hashes and graph, malformed/cyclic graphs, claim schema, failure classification, isolation of candidates, frozen-evaluation gates, holdout separation, adoption, rollback, source-pinned prerequisite reviews and bounded inference selection. Skill-package frontmatter is validated separately. TypeScript and the production build cover UI integration. Model-driven optimization, provider response quality, live SkillTree scoring and learner efficacy are outside the evidence established by these checks.

Publication checks are run against the isolated checkout containing this exact scoped integration. Fixture-based unit and browser checks exercise local behavior only; they are not model evaluations, scientific reproductions or demonstrated production improvements.

See [HERMES_SKILL_BRIDGE.md](HERMES_SKILL_BRIDGE.md) for the read-only staged-proposal integration and its remaining write-back boundary.
