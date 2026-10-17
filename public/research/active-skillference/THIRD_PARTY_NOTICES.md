# Third-Party Notices

This repository declares the Active Skillference code and authored documentation under
the MIT License in `LICENSE`, `CITATION.cff`, `.zenodo.json`, `codemeta.json`, and
`manuscript/config.yaml`. This notice file is an engineering inventory for public review;
it is not legal advice.

## Vendored Browser Bundle

`src/dashboard/assets/vendor/skills-client-js.esm.min.js` is a vendored browser bundle
for the SkillTree learner display used by the local dashboard. It is included so the
dashboard can serve a same-origin static asset during local review instead of relying on
runtime package installation.

Visible notices embedded in the bundle include:

- `js-logger` by Jonny Reeves, distributed under the MIT license.
- The exported SkillTree browser client symbols used by the dashboard (`SkillsConfiguration`,
  `SkillsDisplayJS`, `SkillsLevelJS`, and `SkillsReporter`).

Do not remove upstream license comments from this bundle when refreshing it. If the
bundle is replaced, refresh this notice file and confirm the new bundle's package
license and embedded notices.

## SkillTree Runtime

Active Skillference targets the open-source SkillTree runtime and local Docker wiring
described in `vendor/README.md`. The runtime is cited as an NSA-origin open-source
training platform for platform context only. That attribution is not an endorsement,
certification, deployment approval, or security assurance for this curriculum or any
downstream deployment.

## External Course And Knowledge-Base Links

The local dashboard Learn panels use `data/course_material_sources.yaml` to point to
external Active Inference Institute course and knowledge-base repositories by pinned
commit and path. Those records are links and provenance pointers only. Active Skillference
does not copy upstream prose into this repository and does not relicense upstream
materials.

## Remote Runtime Assets

The local dashboard may load third-party browser runtime assets such as MathJax from a
public CDN with integrity metadata. These assets are referenced for local rendering and
are not vendored into this repository.
