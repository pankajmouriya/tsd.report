# The Security Diff documentation

## Add or edit content

Start with the [authoring guide](editorial/authoring-guide.md): copyable templates for stories, briefs, essays, and editions; lead selection; source handling; customization; and exact local checks.

- [Editorial recipes](editorial/content-recipes.md) — adaptable outlines for all eight story types.
- [Agent-assisted workflow](editorial/agent-workflow.md) — constrained drafting, evidence handoff, proposed output schema, and automation gaps.
- [Editorial seed rationale](editorial/editorial-seed-rationale.md) — existing examples and future candidates.

## Product and implementation

Read in this order:

1. [Product specification](../the-security-diff-implementation-spec.md) — full product scope and V1 definition.
2. [Design and architecture](superpowers/specs/2026-09-26-tsd-design.md) — screenshot interpretation, visual system, interactions, data integrity, architecture, and proposed defaults.
3. [Agent rules](../AGENTS.md) — instructions for every agent working in the repository.
4. [Delivery plan](superpowers/plans/2026-09-26-tsd-delivery.md) — detailed prototype tasks, later milestones, release gates, and evidence ledger.
5. [Production deployment plan](superpowers/plans/2026-09-27-tsd-production-deployment.md) — provider decision, preview and production CI/CD, security headers, DNS, release approval, daily candidate automation, smoke checks, and rollback.
6. [Buttondown newsletter implementation plan](superpowers/plans/2026-09-30-tsd-buttondown-newsletter.md) — task requirements, implemented provider/workflow rulings, verification, and remaining live rollout gates; execution evidence is in the delivery ledger.
7. [Automated Vulnerability Watch design](superpowers/specs/2026-10-02-tsd-vulnerability-watch-automation-design.md) and [implementation plan](superpowers/plans/2026-10-02-tsd-vulnerability-watch-automation.md) — authoritative-source selection, independent snapshots, ranking, review promotion, and verification.

Supporting design notes:

- [Fixture and production content environments](design/content-environments.md) — keeps local seed content separate from reviewed production content and defines the fail-closed build contract.
- [Reading experience](design/reading-experience.md) — long-form article hierarchy and evidence placement.
- [Buttondown newsletter](superpowers/specs/2026-09-30-tsd-buttondown-newsletter-design.md) — double opt-in signup, concise digest contract, deployment-triggered delivery, privacy, and duplicate-send controls.
- [Typography comparison](design/typography-comparison.md) — typeface evaluation and adopted direction.

The canonical article route is `/article/[slug]`. Milestone A is implemented locally as a fixture prototype, including the reading pages. Live ingestion and production publication remain future work; see the delivery ledger for verification and limitations. No deployment is recorded.

## Operations

- [Release process and workflow setup](operations/release-process.md) — pull request validation and previews, main-branch Direct Upload, GitHub and Cloudflare settings, first-publication checks, and manual rollback.
- [Buttondown newsletter operations](operations/newsletter.md) — provider setup, configuration locations, approval and preview, independent rollout gates, identity reconciliation, pause/recovery, key rotation, privacy, and the 80/100 capacity decision.
- [Vulnerability Watch operations](operations/vulnerability-watch.md) — daily candidates, source authority, thresholds, replay, label approval, failure handling, and recovery.
- [Cloudflare account and `tsd.report` DNS setup](operations/cloudflare-domain-setup.md) — exact Cloudflare onboarding, GoDaddy nameserver migration, DNS verification, and DNSSEC steps.
