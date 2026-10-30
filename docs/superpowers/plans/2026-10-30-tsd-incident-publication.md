# Incident Publication Implementation Plan

> Execute inline with the executing-plans workflow, as required by repository instructions. Preserve unrelated edition and newsletter changes. Do not delegate.

**Goal:** Discover incident leads, prepare evidence-backed summary PRs on demand, and publish the exact content approved by the editor.

**Architecture:** Versioned JSON incident packets contain attributed facts and constrained editorial Markdown sections. Immutable publication records feed the existing article, homepage and feed presentation independently of frozen editions. Trusted GitHub workflows validate content-only bot PRs, derive review metadata from GitHub, merge the approved head, commit its deterministic publication record, and explicitly dispatch deployment.

**Tech stack:** Existing Python/Pydantic/httpx/jsonschema/pytest and Astro/TypeScript/Zod/Playwright; no additional runtime service or model provider.

**Spec:** [Approved design](../specs/2026-10-30-tsd-incident-publication-design.md).

## Constraints

- `/article/[slug]` remains canonical. Existing editions are immutable.
- Candidate data, source content and PR metadata are untrusted; only trusted default-branch code executes with credentials.
- Unknown facts remain null. Model output cannot set review identities or publish flags.
- Bind approval, validation, preview and promotion to the same candidate hash and reviewed head. Do not auto-publish code changes.
- Monitoring is gated until hosted acceptance. Article approval never approves newsletter sending.

## Task 1 — Incident contract and immutable records

Files: `src/lib/incident-schema.ts`, `pipeline/incidents/contracts.py`, `schemas/incident.schema.json`, `scripts/generate-schema.ts`, `tests/{unit,pipeline}` and shared `tests/fixtures/incidents`.

- [ ] Write shared synthetic candidate fixtures and tests rejecting forged review fields, unknown claims, unsafe links, synthetic publication, unsupported version claims and invalid correction chains.
- [ ] Run focused Vitest/pytest tests to demonstrate failures.
- [ ] Implement strict versioned schemas, semantic validation, deterministic content hashing, publication construction and immutable storage.
- [ ] Verify valid/invalid fixtures in both languages and byte-stable generated schema.

Interfaces: `validate_candidate(payload) -> dict`, `content_hash(payload) -> str`, `make_publication(candidate, review, published_at) -> dict`; TypeScript exports equivalent candidate/publication schemas and types.

## Task 2 — Canonical stories, live homepage and real candidate previews

Files: `src/lib/{incidents,content}.ts`, article/home/today/feed routes, `src/components/IncidentBody.astro`, `src/layouts/BaseLayout.astro`, content validation and focused unit/browser tests.

- [ ] Test two same-day publications, revision selection, immutable archive rendering, candidate exclusion and preview noindex/unreviewed labeling.
- [ ] Add canonical publication loading and a homepage view model without changing legacy edition JSON.
- [ ] Render incident Markdown sections as escaped semantic headings/paragraphs; retain source and real review attribution and correction notes.
- [ ] Build a candidate overlay against the actual production corpus using an explicit preview-only environment flag. Never create fictional reviewer metadata.
- [ ] Verify routes, feed inclusion, category/tag aggregation, unknown values and a populated preview at the required viewport/theme matrix.

Interfaces: `loadIncidentPublications(root)`, `getHomepageEdition()`, `getIncidentForStory(id)`. All normal production builds reject preview packets.

## Task 3 — Bounded discovery and on-demand authoring

Files: `config/incident-sources.json`, `pipeline/incidents/{sources,discovery,cli}.py`, `docs/editorial/incident-authoring.md`, recorded tests and source workflow.

- [ ] Test RSS/Atom/HTML/structured source parsing, source failures, unchanged/changed posts, withdrawals, stable IDs and checkpoint retention with deterministic recorded responses.
- [ ] Implement allowlisted HTTPS fetching with timeouts, size limits, no unsafe redirects, conditional requests and persisted raw evidence/manifests.
- [ ] Implement a bounded deduplicated triage queue and manual lead grouping overrides. Shared project/CVE names alone never merge incidents.
- [ ] Add CLI validation/scaffolding/preview commands and an authoring recipe for Codex, with no model API in CI.
- [ ] Verify recorded replay and a bounded live discovery pass without enabling the schedule.

## Task 4 — Trusted PR validation, approval and deployment

Files: `pipeline/incidents/{github,publisher}.py`, `.github/workflows/incident-{monitor,propose,validate,publish,deploy}.yml`, shared production serialization in `validate.yml`, adversarial publisher/workflow tests.

- [ ] Test wrong actor, fork, non-bot PR, unexpected changed paths, stale approval, blocking review, missing/failed checks, changed head, duplicate events and expected-head merge races.
- [ ] Open a bot-authored PR through trusted manual dispatch after validating its content-only branch; explicitly dispatch validation because token-created events may not run CI automatically.
- [ ] Build/check the exact candidate against trusted code, retain a real preview and post a head-bound check. Re-evaluate publication after checks finish if approval arrived first.
- [ ] Merge only the approved head; construct a publisher-owned record from the original candidate and review event. Commit that record atomically on `main` and remove the dormant candidate, with immutable revision/CAS checks.
- [ ] Explicitly dispatch production validation/deployment of the resulting publication commit; serialize uploads and reject obsolete revisions before upload. Verify the actual article and homepage and keep newsletter gates separate.
- [ ] Keep monitor/publisher activation gated until a hosted acceptance exercise is possible. Respect branch protections; do not bypass them or change repository-wide auto-merge settings.

## Task 5 — Verification and completion record

- [ ] Run Python lint/format/tests, Astro/type checks, Vitest, generated-contract drift, production/fixture validation/builds/link checks and relevant Playwright journeys.
- [ ] Review screenshots at 320/390/768/1024/1440 px in both themes, keyboard navigation, source links, unknowns, long headlines, filtering and overflow.
- [ ] Review the final diff for security boundaries and preservation of unrelated work.
- [ ] Record changed paths, results, local evidence, deviations and hosted acceptance limitations in the delivery ledger and operator runbook.

Runtime commands use `UV_CACHE_DIR=/private/tmp/tsd-uv-cache uv run --locked ...` in this development sandbox; repository/CI commands retain normal `uv run --locked` behavior. Use a feature branch for review. A feature-code PR is never eligible for automatic content publication.
