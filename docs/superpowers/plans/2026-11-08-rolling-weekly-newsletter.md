# Rolling Weekly Newsletter Implementation Plan

Use `superpowers:executing-plans` inline; do not delegate.

**Goal:** Maintain one weekly draft from newly published incidents, finalize through a genuine editor merge, and never repeat a prior newsletter's stories.
**Architecture:** Pure TypeScript candidate/calendar/eligibility helpers, bounded GitHub REST orchestration, trusted-main validation/publication workflow, explicit incident-publisher dispatch. Existing manual sender remains unchanged.
**Spec:** [confirmed design](../specs/2026-11-08-rolling-weekly-newsletter-design.md).

- [x] Add failing pure tests for week boundaries, reservation/identity deduplication, draft preservation and immutable canonical facts; implement candidate contract and helpers.
- [x] Add failing mock-GitHub tests for draft create/update/freeze, head/hash-bound validation, editor-merge publication, reruns and races; implement orchestration and bounded REST adapter.
- [x] Add failing integration/policy tests; explicitly dispatch refresh from the incident publisher and add trusted weekly workflow, preview artifacts and serialized writer gates. Keep sender manual and provider-free.
- [ ] Generate schema, update operator/authoring/design/delivery records, run relevant suites and builds, review diff and prepare a code PR.
- [ ] Integrate after hosted checks, exercise trusted-main no-content reconciliation, enable the authorized automation, and report the remaining future-content acceptance gates. Do not publish synthetic content or send email.

Record actual paths, commands, outcomes and hosted evidence in this plan and the parent delivery ledger. A checked task means verified work.

Local evidence: tests were observed failing before each new unit/behavior. Pure helpers and mock lifecycle tests now pass; 381 TypeScript tests and 107 Python tests passed before final review additions. Production build/content/internal links passed, and Astro/TypeScript reported zero diagnostics. The mutation experiment weakened candidate-only ownership from exactly one path to multiple paths; mixed code/production regressions failed as intended, and the original was restored. A live-corpus dry selection found 14 canonical incidents: 13 already reserved by prior letters and one older archive entry before the latest collection boundary, leaving no eligible next-week content. Next Sunday is November 15 in Asia/Kolkata. No publisher/provider writes were performed by this dry selection.

Scope refinement: use collection time to avoid archive backfill while carrying frozen late additions; verify immutable weekly merge records during production loading/builds; delegate candidate-only uploads to the actual publisher to prevent known pre-promotion deployment races. These preserve the confirmed approval and manual-send boundaries. No reader layout, dependency, provider or data-store change is introduced.
