# SkillForge and Active Skillference in QuantaCore

Implemented October 17, 2026. The welcome page uses the requested actionable-work / autonomous / Human Near the Loop (HNTL) wording. Research links lead to the supplied SkillForge PDF, the official Active Skillference project and `/#/rsi-lab/skills`.

## Source identity

- **SkillForge:** Xingyan Liu et al., “SkillForge: Forging Domain-Specific, Self-Evolving Agent Skills in Cloud Technical Support,” arXiv:2604.08618v2. The user-supplied 19-page PDF is preserved at `public/papers/skillforge-2604.08618v2.pdf`; SHA-256 `4877d9e8e67782d4385d497f3de31c6be54c31519ee3fe7f940ddf6ffa7cd063`. [Primary record](https://arxiv.org/abs/2604.08618).
- **Active Skillference:** the Active Inference Institute / Daniel Ari Friedman project, [repository](https://github.com/ActiveInferenceInstitute/Active_Skillference), [archived paper and DOI](https://zenodo.org/records/21865644). This is the specific project requested by the user, not a generic name for skill selection.

The Active Skillference artifacts are pinned to commit `1f1030f053f2922f1c16ea7170e62635b511d603`. `public/research/active-skillference/` contains its unmodified SkillTree export, claim ledger, MIT license, third-party notices and a source/checksum manifest. The browser verifies the two JSON checksums before parsing them. It validates unique IDs, prerequisite resolution and acyclicity; displayed graph counts are computed from that validated data. Imported scientific claim values retain the upstream kernel-module reference and are labeled as imported. The upstream kernels, scientific claims and entire upstream test suite have not been rerun by this integration.

## Capability and limits

`SkillGrowthLab` has three sections: skill policy, the Active Skillference curriculum, and the SkillForge growth loop. It loads the actual pinned curriculum rather than a synthetic example. Learning reviews are local operator annotations tied to that source commit. Direct and transitive prerequisites must be reviewed before recording a dependent review. These records do not establish mastery, score quizzes or synchronize SkillTree. Live SkillTree deployment and learner accounts are not configured here.

The packaged skills at `skills/skillforge/SKILL.md` and `skills/active-skillference/SKILL.md` are Quanta adaptations. They are active starter procedures, not measured improvements over a baseline. Their content is loaded progressively when relevant and explicitly enabled in the agent workspace. “Active” means eligible for selection; it does not mean benchmarked or scientifically validated.

Skill revisions may use `{{claim:ID}}` tokens for imported ledger values or computed `curriculum.*` counts. Unknown tokens prevent adoption and inference selection. Resolved values include their origin and scope. This is a binding check for skill content, not a reproduction of the upstream project's complete bare-number prose, scholarship, quiz and publication gate set.

## Skill policy

Starter setups remain simple. Custom setup can add **Skills & growth**. The agent workspace also exposes an explicit approved-skills toggle, a preview of matching versions, and a link to policy settings.

HNTL is the default. The operator can choose bounded automatic selection or turn skill context off. Both enabled modes select only active, relevant versions within the configured skill count and character limit. Candidate and rejected versions cannot enter requests. A skill with curriculum prerequisites is ineligible until the pinned prerequisite reviews exist. Skill text and a small relevant curriculum excerpt share the character allowance. Selection is deterministic keyword routing; this increment does not implement an Active Inference planning algorithm.

At request submission the agent freezes the selected definitions for all stages of that request and saves their IDs/version IDs in the current thread. Later adoption affects future requests. Skill definitions do not grant executable scripts, filesystem access, external tools, credentials or financial authority. Existing backend permission and risk controls retain their role. Documents and reference exports are source data; embedded instructions do not authorize execution.

## Growth loop

1. Record a real failure against a specific skill version, with expected behavior and a source/evidence reference. Knowledge, tool, clarification and style are annotated separately. The paper's deterministic bad-case threshold is implemented: one high dimension or two medium dimensions, with knowledge/tool/clarification/style tie priority.
2. Group selected bad cases by dimension and propose a small additive refinement. The baseline is immutable and retained. Each candidate cites the development case IDs and optional Active Skillference prerequisite IDs.
3. Record a comparison from an external frozen evaluation: distinct holdout case IDs, baseline/candidate correct counts, critical failures, setup, report and reviewer. The form records operator assertions; it does not run an evaluator or certify the evidence. A minimum of five distinct holdout cases is a Quanta workflow screening rule, not a statistical guarantee.
4. Adoption requires an improved recorded result, zero recorded critical failures, disjoint development/holdout IDs, unchanged candidate/baseline text, a still-active baseline and satisfied curriculum reviews. It always requires an explicit operator decision note. Bounded automatic selection never auto-adopts changes.
5. Retain the prior version and journal. Operator rollback restores a prior version for future selection. Rejecting a candidate preserves its evidence.

The loop runs one operator-triggered batch at a time; it has no unattended scheduler, recursive model execution or training job. Limits bound version, case, evaluation and journal storage. The browser profile owns its local library; a concurrent conflicting save is rejected rather than overwriting another view. Export preserves the whole library and journal. These are local preference and review records, not a multi-user authorization service or a signed evidence ledger.

Completed agent requests can open a feedback record using skill/version metadata. Task text and model output are not automatically copied into feedback. The operator supplies the observed failure and reference evidence.

## Validation

Focused offline checks cover the real artifact hashes and graph, malformed/cyclic graphs, claim schema, failure classification, isolation of candidates, frozen-evaluation gates, holdout separation, adoption, rollback, source-pinned prerequisite reviews and bounded inference selection. Skill-package frontmatter is validated separately. TypeScript and the production build cover UI integration. Model-driven optimization, provider response quality, live SkillTree scoring and learner efficacy are outside the evidence established by these checks.

October 17 checks: 17 focused skill/setup checks passed; TypeScript, production build and both skill-package validators passed. The local app serves the current bundle on port 3000, and the served PDF/curriculum/claim bytes match their pinned hashes. Browser review confirmed the welcome copy and source links, the real curriculum counts and blocked dependent review, plus candidate creation, evaluation recording, adoption and rollback using explicitly labeled synthetic fixtures in an isolated browser context. Those fixture counts are UI checks only, not model or scientific results. Navigation out of the local RSI workspace was also checked after fixing a hash-route transition race.

For the wider composition and separate memory, skill and harness feedback paths, see [the systems map](AGENTIC_SYSTEMS_MAP.md) and [interactive component map](../design/agentic-systems-map.html).

## Common evidence and bounded release

The latest recorded skill evaluation can now export as a common evidence package. It preserves aggregate operator counts and frozen text hashes; route, runner, rubric, per-case scores, cost, latency and unseen status remain unknown or unattested. Export does not execute a benchmark or activate the separate Starter pilot. That pilot requires its own measured paired comparison and exact release review. See [the operating evidence contract](OPERATING_EVIDENCE.md) and [prepared cloud evaluation scope](STARTER_CLOUD_EVALUATION_SCOPE.md).
