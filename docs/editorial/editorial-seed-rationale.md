# Editorial Seed Rationale

Updated: 2026-09-27. Scope: editorial inventory and article development backlog.

The example stories in The Security Diff were intentionally written as **editorial seeds**, rather than ordinary placeholder text. That is why they already resemble viable articles.

This document covers all 17 local story entries and adds 12 proposed article briefs. New proposals exist only in this document; they have not been added to editions, routes, or feeds. A strong headline, a source link, and a rendered route do not establish a researched or reviewed article.

## How the ideas were chosen

Each story had to satisfy four conditions.

### A clear security engineering thesis

For example, “A critical CVE count is not a vulnerability-management outcome” argues that raw totals are weaker than reachable exposure, remediation progress, and exception age.

### A decision the reader needs to make

“Patching the edge starts with knowing which evidence changed” asks what evidence justifies an emergency change: deployment, reachability, exploitation evidence, and vendor guidance.

### Enough substance for the homepage format

Every item has a headline, summary, why-it-matters statement, affected systems, and supported action. This allowed the initial implementation to test editorial hierarchy using meaningful material.

### Coverage across the publication taxonomy

The fixture deliberately spans vulnerabilities, supply chain, AppSec, cloud, AI agents, research, and security engineering.

The main examples are stored in [the September 26 fixture edition](../../data/fixtures/editions/2026-09-26.json). Two additional entries are in the [September 24](../../data/fixtures/editions/2026-09-24.json) and [September 25](../../data/fixtures/editions/2026-09-25.json) archive fixtures.

## What the current examples represent

The main edition has 15 unique entries: one historical demonstration, one source-linked explainer, three original theses, and ten synthetic scenarios. The two archive entries bring the local total to 17. All remain fixtures; existing bylines and signal labels do not establish authorship approval, completed review, or current urgency.

### 1. Historical evidence demonstration

“Patching the edge starts with knowing which evidence changed” uses Log4Shell as a historical fixture. It has a real vendor source, but the current article body is only a short demonstration and explicitly says it is not a current alert.

### 2. Original editorial theses

The following ideas were written as original positions that fit The Security Diff’s evidence-first identity:

- “A critical CVE count is not a vulnerability-management outcome”
- “Agent tool boundaries belong in the architecture, not only in the prompt”
- “From the editor: evidence before prose”

### 3. Synthetic layout scenarios

Several briefs use `TSD Fixture Lab` and `example.com` sources. Their underlying ideas are credible, but they are not researched or publishable articles yet.

### 4. Source-linked explainer

“EPSS is a probability estimate, not a patching deadline” links to FIRST and has a one-paragraph body. It is distinct from the historical Log4Shell demonstration and from synthetic scenarios, but still needs a complete worked example and review.

### 5. Archive/navigation fixtures

“The first fixture edition establishes the newspaper rhythm” and “Yesterday's edition: making evidence freshness visible” each contain a minimal fixture body. Their purpose is to test navigation and dated editions. They are not completed editorial articles or authentic launch announcements.

“Today’s Security Briefs” is the section title grouping the daily items, rather than an individual article.

## Candidates for complete articles

The strongest initial candidates are:

### 1. A critical CVE count is not a vulnerability-management outcome

A foundational opinion piece for the publication. It can propose a measurement framework based on reachable exposure, remediation progress, accountable ownership, and exception age.

### 2. Agent tool boundaries belong in the architecture, not only in the prompt

A timely technical article with room for capability, credential, approval, and telemetry diagrams.

### 3. Patching the edge starts with knowing which evidence changed

A practical vulnerability-triage guide using a historical case study to show how deployment, reachability, exploitation evidence, and vendor guidance affect prioritization.

## Requirements before publication

Before any editorial seed becomes a published article, it needs:

- A precise thesis and intended reader
- Primary sources and dated evidence
- Concrete technical examples
- Technical and editorial review
- Clear separation between sourced facts and editorial judgment
- A complete article body under `/article/[slug]`
- A reviewed production content record when the publishing workflow exists; preserve fixture editions and their labels rather than making them publishable by deleting flags or banners

The [evidence manifest](../../data/fixtures/evidence/manifest.json) currently records URLs and a retrieval time, not full immutable claim-level snapshots. Every authoritative claim still needs the source identity, URL, retrieval time, source data date/version, and supporting evidence. Existing fixture scores, version wording, and exploitation labels must not be assumed publication-ready.

Keep technical examples and measured results distinct from proposals. Record real reviewers and review dates only after review happens. The [delivery plan's publication and release gates](../superpowers/plans/2026-09-26-tsd-delivery.md) still apply; this documentation update does not complete Milestone E or authorize deployment.

## Editorial backlog

These examples should be treated as an initial editorial backlog. Their current summaries, impact statements, and actions can become article briefs. Many of the headlines are strong enough to retain through research and drafting, provided that the finished articles support every factual claim with appropriate evidence.

## What the local site currently renders

The [edition renderer](../../src/components/EditionView.astro) groups the main edition into one lead, nine daily briefs, three original-writing entries, and two research entries. Vulnerability Watch summarizes the lead's vulnerability; it is not an additional story. “From the Editor” and “Research Worth Reading” are also section labels.

The [Markdown agent article](../../content/fixtures/articles/monitoring-ai-agents.md) contains two short paragraphs and uses the existing `agent-tool-boundaries` slug. It does not create an eighteenth story. Its frontmatter title, “How I Would Monitor an AI Coding Agent,” is an alternate working title: the [article template](../../src/pages/article/[slug].astro) displays the JSON story title and substitutes the Markdown paragraphs for the body.

Routes below describe local content and generated pages, not public publication. Existing category and type labels are recorded accurately; the commissioned format may need to change when an article is researched. In particular, synthetic `news`, `advisory`, `incident`, and `research` labels do not establish real events or findings.

## Complete inventory of the existing seeds

Each numbered entry retains its current headline. The development suggestions describe work still to do.

### Lead and source-linked explainer

**E01 — Patching the edge starts with knowing which evidence changed**
`/article/patching-the-edge` · `cve` / Vulnerabilities · historical demonstration.

For vulnerability responders deciding whether an emergency change is justified, develop a dated inventory-to-action timeline around the historical Log4Shell case. Separate deployment, reachability, exploitation evidence, and vendor guidance. The existing body explicitly says it is not a current alert. Its broad fixed-version wording is not a substitute for advisory ranges: Apache distinguishes components, runtime branches, and vulnerability-specific fixes. Rebuild evidence from the [Apache advisory](https://logging.apache.org/security.html#CVE-2021-44228), and independently obtain CISA evidence before asserting KEV membership. A current page alone does not reconstruct what was known on a historical date.

**E02 — EPSS is a probability estimate, not a patching deadline**
`/article/epss-without-shortcuts` · `explainer` / Vulnerabilities · source-linked seed.

For analysts deciding how to prioritize, develop a labeled hypothetical table separating probability, percentile, observation date, KEV, and asset context. FIRST describes EPSS as estimating exploitation in the wild over the next 30 days; that forecast is distinct from asset impact and an organization's remediation policy. Research anchor: [FIRST EPSS](https://www.first.org/epss/). Do not attach invented scores to real CVEs.

### From the Editor

**E03 — Agent tool boundaries belong in the architecture, not only in the prompt**
`/article/agent-tool-boundaries` · `original` / AI & Agent Security · short Markdown-backed seed.

For agent-platform engineers, develop a capability map for shell execution, package installation, browsing, source control, and external tools. Show where authorization is enforced outside the model. Add a local allowed/denied operation demonstration and telemetry connecting intent, authorization, action, and result. The two existing Markdown paragraphs establish the topic but do not yet demonstrate its design or limitations.

**E04 — A critical CVE count is not a vulnerability-management outcome**
`/article/cve-priority-context` · `original` / Vulnerabilities · editorial thesis.

For program owners, build an example scorecard with reachable exposure, remediation progress, accountable ownership, and exception age. Show how an inventory change can alter counts without fixing an exposure. Include denominators, missing inventory, reopened findings, and cases where raw counts remain useful. Treat the framework as a proposed method until its effectiveness is supported by explicit evidence.

**E05 — From the editor: evidence before prose**
`/article/why-the-security-diff` · `original` / Security Engineering · editorial thesis.

Develop a concise editorial charter with a sourced fact, generated summary, interpretation, unknown, and correction shown side by side. Explain what readers can expect from attribution, dates, and review labels. Describe actual practices accurately; future editorial tooling must not appear as an already operating review process.

### Today’s Security Briefs

These eight synthetic scenarios appear alongside E02 in the nine-entry daily report.

**E06 — Signed builds are useful only when verification is part of deployment**
`/article/signed-build-evidence` · `explainer` / Supply Chain · synthetic scenario.

Develop a CI/CD walkthrough comparing stored attestations with enforced promotion checks. Demonstrate rejection of the wrong builder identity and show the source/artifact checks. Provenance describes production; it does not prove absence of vulnerabilities. Research anchor: [SLSA v1.1 artifact verification](https://slsa.dev/spec/v1.1/verifying-artifacts); pin the version used in the example.

**E07 — Admission policies need an exception path engineers can audit**
`/article/admission-guardrails` · `news` / Cloud & Kubernetes · synthetic scenario.

Develop a platform guide covering exception owner, rationale, scope, expiry, and review evidence. Demonstrate expired exceptions and an unavailable policy service in a disposable cluster. Without a real news trigger, commission this as an explainer or original design note.

**E08 — A leaked token is an incident until revocation and scope are verified**
`/article/secret-exposure-response` · `incident` / Security Engineering · synthetic incident.

Develop a response timeline separating removal of the visible secret, invalidation, session behavior, access review, and recovery. Use dummy credentials and document provider-specific semantics. An exposure does not by itself prove malicious use; a generic response sequence must not conceal evidence gaps or service-specific constraints.

**E09 — Tool watch: a small runtime observer for process and network context**
`/article/runtime-observation-tool` · `tool` / Security Engineering · synthetic tool profile.

No actual tool is established by this seed. Select a real project, pin its release, review privileges and collection boundaries, and measure overhead, event loss, and operational fit. Produce a tested limitations table before making a recommendation.

**E10 — Short-lived cloud credentials still need a clear issuer and audience**
`/article/short-lived-cloud-keys` · `advisory` / Cloud & Kubernetes · synthetic advisory.

Develop a provider-specific identity explainer showing allowed and rejected CI identities. Map issuer, subject, audience, repository, and environment constraints to controls that the selected provider actually supports. Include token lifetime and residual exposure. Without a real advisory, commission it as an explainer.

**E11 — Package maintainer tokens should not share the blast radius of a workstation**
`/article/maintainer-token-boundaries` · `news` / Supply Chain · synthetic scenario.

Develop a protected publishing workflow for a selected registry using its documented identity options. Include a compromised-workflow counterexample: moving credentials changes the trust boundary but does not eliminate release risk. A real announcement is required to present this as news.

**E12 — A fixed version needs a vendor source, not a guess from the latest release**
`/article/fixed-version-evidence` · `advisory` / Vulnerabilities · synthetic scenario.

Develop a remediation explainer using an attributed advisory with branch-specific fixes. Preserve package identity, version ordering, maintenance branches, backports, and original range semantics. Keep unsupported fixes unknown. E01 covers the triage decision; this article should explain how to construct its version evidence.

**E13 — Incident diagram: from a package install to a cloud API call**
`/article/package-incident-path` · `incident` / Supply Chain · synthetic incident.

Develop a labeled lab reconstruction with process lineage, credential access, and API telemetry using dummy credentials and an isolated destination. Distinguish observed events from inferred links. A real incident breakdown would instead require primary incident evidence and a sourced timeline before naming affected organizations.

### Research Worth Reading

**E14 — Authorization review should start from objects and relationships**
`/article/authorization-review` · `research` / AppSec · synthetic scenario.

Develop an actor/object/action matrix with cross-tenant denial cases, legitimate collaboration, asynchronous jobs, and bulk endpoints. [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) supports permission mapping and request-level checks. Commission as an original method or explainer unless a particular research work becomes its subject; no finding has yet been reproduced.

**E15 — Research notes should separate demonstrated results from editorial interpretation**
`/article/research-claims-and-interpretation` · `research` / Research · synthetic scenario.

Develop a reading template covering research question, threat model, prerequisites, result, limitations, and operational implications. Apply it to a selected primary paper and pinned artifact where available. Keep the authors' results, any local reproduction, and TSD's interpretation distinct. The current seed is not a review of an existing paper.

### Archive fixtures

**E16 — The first fixture edition establishes the newspaper rhythm**
`/article/first-edition` · `2026-09-24` · `original` / Security Engineering.

Keep this minimal navigation fixture for testing available-edition links. It is not a priority public article or an authentic launch announcement.

**E17 — Yesterday's edition: making evidence freshness visible**
`/article/previous-evidence` · `2026-09-25` · `explainer` / Security Engineering.

Keep the current entry as a dated-edition test. Evidence freshness could support a separate researched explainer, but the existing body contains only fixture text.

## Twelve additional article briefs

All new items are **proposed and unreviewed**, absent from the site's content data. Headlines are working theses. Examples and outputs are proposed work, not completed experiments. Sources support the named mechanisms; applying them to a particular system requires further evidence. Related existing seeds identify how each proposal extends the backlog.

### N01 — When a scanner finding disappears, what actually changed?

**Reader / category / format:** AppSec platform engineers · AppSec · original technical walkthrough.

**Decision:** Determine whether a removed finding represents a fix, a coverage change, or changed result identity. GitHub describes how SARIF fingerprints match results across scans. [GitHub SARIF support](https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support).

**Example to develop:** Compare a pinned scan with a file rename, a disabled rule, and a real fix. Preserve repository revision, analyzed-file coverage, tool/rule versions, raw reports, and matching decisions.

**Takeaway:** A scan-comparison ledger explaining fixed, coverage-changed, identity-changed, and unresolved results. This supplies technical evidence for E04's measurement framework. Ambiguous matches must remain explicit.

### N02 — The evidence behind a “not affected” decision

**Reader / category / format:** Product security and vulnerability analysts · Vulnerabilities · worked VEX explainer.

**Decision:** Assess whether a supplier statement applies to the deployed artifact. OpenVEX relates product, vulnerability, and status; `not_affected` requires a justification or impact statement. [OpenVEX specification v0.2.0](https://github.com/openvex/spec/blob/main/OPENVEX-SPEC.md).

**Example to develop:** Use a synthetic non-CVE issue identifier and two local builds with different features. Map the statements to exact products, author, evidence, and timestamps; change a build assumption and review applicability again.

**Takeaway:** An auditable applicability checklist. Revalidation triggers are a proposed TSD policy, not an invented VEX requirement. E12 asks which version fixes a vulnerability; this asks whether a particular product is affected.

### N03 — Follow the digest from scan to deployment

**Reader / category / format:** Release and platform engineers · Supply Chain · illustrated walkthrough.

**Decision:** Establish whether the promoted artifact is the one evaluated. Kubernetes distinguishes mutable tags from digests identifying particular image content. Identity is not proof of safety. [Kubernetes images](https://kubernetes.io/docs/concepts/containers/images/).

**Example to develop:** Move a local test tag between two builds. Compare tag-based and digest-based promotion, tracing scan report, attestation subject, deployment reference, and runtime identity. Handle image-index versus platform-manifest digests explicitly.

**Takeaway:** An artifact-identity trace and mismatch rejection. This extends E06 from checking the builder to preserving the evaluated artifact through deployment.

### N04 — The tenant boundary inside your cache key

**Reader / category / format:** Backend and AppSec engineers · AppSec · original design note.

**Decision:** Determine whether response caches and cached authorization decisions preserve access constraints. Request-level authorization is the baseline; the cache exercise is TSD's proposed application of it. [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

**Example to develop:** Give two synthetic tenants overlapping object IDs. Exercise cache miss, cache hit, permission change, and background export. Compare object-only keys with a design accounting for resource scope and authorization changes.

**Takeaway:** A cache-boundary diagram and denial tests. A tenant field alone is not a complete fix. This develops one execution path from E14's wider authorization review.

### N05 — Handling a valid webhook twice

**Reader / category / format:** API and product security engineers · AppSec · state-machine explainer.

**Decision:** Separate sender verification, replay handling, and business idempotency. Stripe documents duplicate deliveries, ordering considerations, and signature verification. [Stripe webhooks](https://docs.stripe.com/webhooks).

**Example to develop:** Use sandbox events for concurrent duplicates, delayed delivery, invalid signatures, and worker retries after a partial failure. Distinguish the provider event key from the business operation key.

**Takeaway:** A transition table showing which repeated actions are rejected or safely repeated. Avoid claiming exactly-once delivery or transferring one provider's guarantees to all webhook systems.

### N06 — Where an allowed URL goes next

**Reader / category / format:** Engineers building importers and previewers · AppSec · defensive lab walkthrough.

**Decision:** Define a fetch boundary that holds beyond initial URL parsing. OWASP covers redirect handling and application/network defenses. [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

**Example to develop:** Use controlled local destinations for a direct allowed fetch, a redirect to a disallowed destination, and changed hostname resolution. Record actual destination, protocol, redirect policy, timeout, and response-size bounds.

**Takeaway:** A fetch-policy diagram and bounded regression cases. No real cloud metadata endpoint or third-party internal service is needed for the demonstration.

### N07 — Bind an agent approval to the action that will execute

**Reader / category / format:** Agent-platform engineers · AI & Agent Security · original architecture article.

**Decision:** Specify what approval authorizes and when it becomes invalid. OWASP transaction guidance binds authorization to significant transaction data; applying this to agent tools is TSD's proposed design. [OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html).

**Example to develop:** Approve a harmless test operation, then change its target, arguments, identity, or relevant resource version. Enforce the authorization outside the model; cover expiry, replay, canonicalization, and renewed approval when scope changes.

**Takeaway:** An approval-to-execution sequence and invariant tests. E03 maps capabilities; this specifies authorization for one operation.

### N08 — Carry document permissions into retrieval

**Reader / category / format:** Enterprise search and RAG engineers · AI & Agent Security · technical walkthrough.

**Decision:** Determine which documents may enter a caller's model context. Microsoft's security-filter pattern is a useful reference, but its principal field is a filtering value, not caller authentication or authorization. [Azure AI Search security filters](https://learn.microsoft.com/en-us/azure/search/search-security-trimming-for-azure-search).

**Example to develop:** Index synthetic documents with different groups; change membership and test retrieval, cached answers, citations, and conversation reuse. Derive identity at a trusted service boundary and trace stale permissions.

**Takeaway:** An identity-to-document flow and leakage regression cases. Access control is a separate question from detecting malicious instructions inside retrieved content.

### N09 — Prove that access was revoked

**Reader / category / format:** Cloud security and incident responders · Cloud & Kubernetes · provider-specific operational guide.

**Decision:** Establish when containment became effective. Google Cloud documents eventual consistency for IAM changes; successful policy editing and observed denial are separate evidence. [IAM access-change propagation](https://docs.cloud.google.com/iam/docs/access-change-propagation).

**Example to develop:** In a disposable project, remove a test grant and record change time and subsequent access probes. Account for alternate grants, inheritance, identity changes, and service-specific sessions.

**Takeaway:** A containment timeline with uncertainty. One measured delay is not a universal guarantee. This develops the revocation proof required by E08's broader incident response.

### N10 — A detection test needs a quiet control case

**Reader / category / format:** Detection engineers · Security Engineering · lab report.

**Decision:** Evaluate both an expected alert and a similar benign case. Atomic Red Team supplies reproducible tests mapped to ATT&CK; the paired benign-case method is TSD's proposed extension. [Atomic Red Team](https://github.com/redcanaryco/atomic-red-team).

**Example to develop:** Review one bounded test for an isolated environment. Record execution, sensor collection, ingestion, rule evaluation, alert latency, and cleanup, alongside benign activity. Separate lost telemetry from a rule that evaluated an event without alerting.

**Takeaway:** A detection evidence matrix. A passing exercise does not prove complete coverage of a technique. This complements E09's tool evaluation and E13's telemetry chain.

### N11 — Restore the service, then test its security boundaries

**Reader / category / format:** SRE and recovery owners · Security Engineering · recovery exercise report.

**Decision:** Define acceptance criteria beyond successful data restoration. AWS Backup distinguishes restore testing from optional validation of restored resources. [AWS Backup restore testing](https://docs.aws.amazon.com/aws-backup/latest/devguide/restore-testing.html).

**Example to develop:** Restore a synthetic service in isolation. Check integrity, allowed access, expected denials, secret references, network exposure, and audit events. Disable outbound integrations during the exercise and verify cleanup.

**Takeaway:** A recovery checklist backed by observed results. The security checks are proposed TSD criteria; document service-specific limits. This adds recovery assurance to the current prevention and response themes.

### N12 — What a scanner benchmark can tell you about your application

**Reader / category / format:** AppSec evaluators and research readers · Research · methodology article.

**Decision:** Identify which conclusions a benchmark supports and which need application-specific evidence. OWASP Benchmark supplies detection test cases and scoring tools; transfer to a team's application is a separate question. [OWASP Benchmark](https://owasp.org/projects/benchmark).

**Example to develop:** Pin corpus revision, ground truth, scanner, rules, build configuration, and eligible cases. Report true/false positives and negatives by relevant class, plus excluded or failed cases. Compare a small independently labeled application sample.

**Takeaway:** A reproducibility card and interpretation guide, with limitations instead of an unsupported universal vendor ranking. This applies E15's research-reading discipline to a concrete evaluation.

## Suggested writing order

These are editorial priorities, not publication dates or assigned work.

| Order | Seed | Why start here | Required centerpiece |
| --- | --- | --- | --- |
| 1 | E05 — Evidence before prose | Establishes reader expectations | Annotated fact, interpretation, and correction |
| 2 | E04 — Vulnerability-management outcomes | Establishes the decision-oriented perspective | Worked measurement table with limitations |
| 3 | E03 — Agent tool boundaries | Provides an architectural foundation | Capability map and allowed/denied examples |
| 4 | E02 — EPSS | Explains a recurring intelligence field | Probability/percentile/exposure comparison |
| 5 | E01 — Patching the edge | Connects evidence to an operational decision | Sourced historical timeline |
| 6 | N03 — Follow the digest | Offers a focused supply-chain walkthrough | Scan-to-runtime identity trace |
| 7 | N04 — Tenant cache boundary | Adds a testable AppSec example | Cache-hit and permission-change tests |
| 8 | N07 — Agent approval binding | Deepens E03 through a distinct control | Approval/execution mismatch tests |

Develop other proposals according to evidence quality, useful experiments, and reader demand. An edition does not need an item from every category. Time-sensitive news requires an actual dated event; evergreen arguments can become original articles or explainers. Vary headline constructions and formats according to the material.

## Brief template for future seeds

Before drafting, record:

- Working headline, category, format, intended reader, and the reader's decision.
- One-sentence thesis and what it adds beyond existing TSD coverage.
- Technical example, diagram, experiment, or incident timeline to develop.
- Primary sources, versions/dates, and the exact claims each supports.
- Assumptions, counterexamples, unknowns, and claims awaiting verification.
- Expected reader takeaway and how its usefulness will be evaluated.
- Actual maturity: proposed, researching, drafting, technically reviewed, editorially reviewed, or approved for publication. Record actual authors, reviewers, and dates only when established.

## Review record

On 2026-09-27, this inventory was reconciled against all three fixture editions, the matching Markdown body, the source manifest, and the edition/article rendering paths. Apache, FIRST, and the inline primary-source research references were consulted for this update. They support research planning, not blanket validation of existing fixture claims. The 12 new briefs are editorial proposals; none of their suggested experiments was performed as part of this documentation work.
