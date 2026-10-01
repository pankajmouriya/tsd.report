# The Security Diff Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement the authorized milestone task by task. Work inline by default. Steps use checkbox syntax for tracking; do not mark them complete without verification evidence.

**Goal:** Deliver a source-backed security newspaper, beginning with a coherent static prototype that can be reviewed before ingestion is built.

**Architecture:** Astro consumes validated JSON edition snapshots and trusted Markdown/MDX. A later Python pipeline collects and enriches evidence, applies optional editorial processing, and prepares editions for review. Publication remains independent of external API availability.

**Tech Stack:** Astro, TypeScript, plain CSS, Markdown/MDX, runtime content schemas, a compatible unit test runner, Playwright; later Python, Pydantic, httpx, feedparser, and GitHub Actions.

**Spec:** [design baseline](../specs/2026-09-26-tsd-design.md), [product specification](../../../the-security-diff-implementation-spec.md), [agent rules](../../../AGENTS.md).

**Status:** Milestone A implemented locally on 2026-09-26. No deployment has been performed. Milestones B–H remain dependency-ordered delivery definitions; expand each into its own executable plan against the code that exists when it starts.

## Global constraints

- `/article/[slug]` is the canonical route for every story type, including original writing.
- Use Astro static generation, TypeScript, plain CSS, and JSON plus Markdown/MDX for the frontend. Use Python and Pydantic for ingestion when that milestone begins.
- Unknown is `null`, never a default zero, false, or "safe".
- AI-generated data must never overwrite deterministically sourced vulnerability intelligence.
- Frontend rendering never calls security APIs.
- Public production builds reject fixture/synthetic content.
- No accounts, database, CMS, subscriptions, watchlists, or runtime backend in the initial release.
- Build the mobile and dark variants alongside the desktop components.
- Published editions retain snapshots and explicit correction history.
- A failed pipeline run preserves the last good publication.

## 1. Milestones and dependencies

| Milestone | Original spec phases | Deliverable | Depends on |
| --- | --- | --- | --- |
| A | 0–1; fixture route shells from 6 | Complete static fixture prototype | Design baseline |
| B | 2 | Reproducible collection, normalization, clustering | A contract |
| C | 3 | Field-level vulnerability enrichment and ranking | B |
| D | 4 | Optional evidence-constrained editorial provider | C |
| E | 5 | Complete original publishing and editorial review | A; publication joins C/D |
| F | 6 | Static search, related coverage, production indexes | A/C/E |
| G | V1 release | Reviewed daily generation, security CI, hosting, feeds, operations | A–F; D may run with provider none |
| H | 7–8 | Future intelligence and personalization proposals | Validated usage after G |

Milestone A is a reviewable prototype, not V1 acceptance. CVE pages and feeds initially use fixture data so later pipeline work does not require redesigning the site. Search implementation follows in F. Markdown support starts in A and expands in E.

## 2. Planned repository boundaries

```text
AGENTS.md                              Repository-wide rules
the-security-diff-implementation-spec.md Product scope
docs/superpowers/specs/                 Design decisions
docs/superpowers/plans/                 Milestone plans and evidence
config/taxonomy.json                    Canonical category and tag definitions
config/sources.yml                      Later: configured source registry
config/ranking.yml                      Later: versioned ranking rules
schemas/                               Generated interchange JSON Schema
data/fixtures/                         Labeled prototype editions
data/fixtures/evidence/                Attributed source snapshots
data/production/editions/              Reviewed production edition snapshots only
content/fixtures/articles/             Local fixture Markdown
content/production/articles/           Reviewed production Markdown
src/lib/schema.ts                     Runtime frontend content validation
src/lib/content.ts                    Validated loading and page indexes
src/lib/routes.ts                     Central canonical route helpers
src/lib/filter.ts                     Pure topic/signal selection
src/lib/format.ts                     Dates, numbers, unknown-value display
src/components/                       Reusable editorial components
src/layouts/                          Edition and article layouts
src/pages/                            Static routes and feeds
src/scripts/                          Progressive filter/theme enhancements
src/styles/                           Tokens, typography, layout, components
public/                               Original/licensed static assets
pipeline/                             Later: collection and publishing stages
tests/unit/                           Contract and pure-function tests
tests/e2e/                            Reader journeys and accessibility checks
scripts/                              Validation and build helpers
.github/workflows/                    CI added with milestone A; pipeline jobs later
```

Do not create empty future pipeline modules during A. Add files when their milestone produces behavior. The content storage directories do not determine public URLs; the canonical public route remains singular `/article/`.

## 3. Milestone A — implementation tasks

### A1. Establish a reproducible static project

**Create:** `package.json`, lockfile, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `README.md`, `.node-version`, `src/pages/index.astro`, test-runner config, and `.github/workflows/validate.yml`.

**Interface:** all later tasks use the scripts `dev`, `check`, `test`, `test:e2e`, `build`, and `preview`. Use npm unless an existing package-manager decision is discovered when implementation starts. Runtime versions and package versions are selected and pinned together after checking official compatibility documentation.

- [ ] Recheck repository state; initialize Git if still absent. Preserve the existing specification and planning files.
- [ ] Scaffold Astro with strict TypeScript, static output, plain CSS, and a minimal semantic page titled The Security Diff.
- [ ] Set site origin to `https://tsd.report`, canonical trailing-slash policy to never, and define explicit `CONTENT_MODE=fixture|production` handling. Unknown mode values fail validation.
- [ ] Set up unit tests and Playwright, document local setup, and ignore build output, dependencies, environment secrets, browser reports, and temporary artifacts.
- [ ] Add a read-only validation workflow with pinned actions that installs from the lockfile, checks types, runs tests, and builds the fixture preview. Do not deploy from this workflow.
- [ ] Run the available scaffold checks and production compilation in fixture mode. Record the exact runtime and package versions selected.

Expected Astro configuration shape; adapt imports only to the version actually installed:

```js
export default defineConfig({
  site: 'https://tsd.report',
  output: 'static',
  trailingSlash: 'never',
});
```

**Exit:** a fresh install can reproduce a static build; no dependency on APIs or secrets. Configure all named scripts before later tasks use them; until browser tests exist, document that gate as pending rather than claiming it passes.

### A2. Define and validate the content contract

**Create:** `src/lib/schema.ts`, `src/lib/content.ts`, `src/lib/routes.ts`, `src/lib/format.ts`, `config/taxonomy.json`, `schemas/edition.schema.json`, `tests/unit/content.test.ts`, `tests/unit/routes.test.ts`, `scripts/validate-content.ts`.

**Consumes:** the entities and rules in design sections 7–8.
**Produces:** runtime schemas and inferred `Story`, `Vulnerability`, `Source`, `SecuritySignal`, `Edition`; `loadContent(mode)`, `getLatestEdition(editions)`, `articlePath(slug)`, `editionPath(date)`, `cvePath(cve)`, and `formatProbability(value)`.

- [ ] Specify `Claim<T>`, evidence states, source provenance, content origin, review status, and edition snapshots. Distinguish a story's publication date from an edition date.
- [ ] Write failing tests for invalid CVE syntax, out-of-range scores, invalid dates, missing provenance, duplicate story ids/slugs, missing section references, and production fixtures.
- [ ] Implement validation and deterministic indexes. Only index real validated CVEs into `/cve/` routes; reject an edition whose lead id is missing.
- [ ] Make formatted zero display as zero, null as unavailable, and EPSS probability/percentile use separate labels. Validate strings before putting them into route paths.
- [ ] Export the versioned interchange schema. Document how it is regenerated; do not hand-edit generated output.
- [ ] Run unit tests and content validation on the positive and negative cases.

Contract tests should contain assertions such as:

```ts
expect(articlePath('monitor-ai-agents')).toBe('/article/monitor-ai-agents');
expect(editionPath('2026-09-26')).toBe('/2026/09/26');
expect(() => editionPath('2026-02-30')).toThrow();
expect(formatProbability(null)).toBe('Not available');
expect(formatProbability(0)).toBe('0%');
expect(() => articlePath('../archive')).toThrow();
```

**Exit:** malformed or fixture-contaminated production data fails before rendering. Historical edition loading requires no network calls.

### A3. Create an honest, representative fixture edition

**Create:** `data/fixtures/editions/2026/09/24.json`, `25.json`, `26.json` in the same directory; `data/fixtures/evidence/manifest.json`, attributed evidence snapshots, `content/fixtures/articles/monitoring-ai-agents.md`, and `tests/unit/fixtures.test.ts`.

**Consumes:** A2 schemas.
**Produces:** three deterministic preview editions; at least 15 unique stories across all categories and all types.

- [ ] Select a small real advisory sample from primary sources when implementing this task; record retrieval and effective dates, URLs, and fixture labeling. Never invent scores for a real CVE.
- [ ] Write clearly labeled synthetic briefs for layout coverage using example organizations/non-CVE ids; never imply a real vendor suffered an invented incident.
- [ ] Include zero/null scores, unknown fixes, differing source assessments, long titles, multiple vulnerabilities, an original article, research commentary, and an empty filter combination.
- [ ] Assign stable ids, slugs, category/tag values, references, deterministic signal reasons, and ordered edition sections.
- [ ] Validate coverage, uniqueness, source metadata, route eligibility, and all fixtures' preview flags.

**Exit:** fixture data can exercise the complete UI without pretending to be live intelligence. Future public publication cannot accidentally consume it.

### A4. Build the newspaper shell and visual system

**Create:** `src/styles/tokens.css`, `global.css`, `edition.css`, `article.css`; `src/layouts/BaseLayout.astro`, `EditionLayout.astro`; `src/components/EditionHeader.astro`, `EditionFooter.astro`, `ThemeToggle.astro`, `FixtureNotice.astro`; `src/scripts/theme.ts`; licensed font assets and license records if used.

**Consumes:** design tokens, A2 date/route helpers, A3 edition data.
**Produces:** shared accessible light/dark layouts and edition navigation.

- [ ] Implement the cream sheet, top metadata row, masthead, subtitle, double rule, semantic landmarks, and skip link.
- [ ] Load only the selected local fonts and reserve their intended fallback metrics where practical. Record font licenses.
- [ ] Implement theme preference, early application, storage-error fallback, and reduced-motion behavior.
- [ ] Implement available-edition navigation, ensuring the latest/oldest ends cannot link to nonexistent dates.
- [ ] Render a visible preview notice and `noindex` metadata for fixture mode. Production mode must omit the preview assets/data entirely.
- [ ] Inspect the shell at 320, 390, 768, 1024, and 1440 px in both themes. Check contrast, keyboard focus, and 200% zoom.

**Exit:** the shell has the screenshot's visual hierarchy and reads correctly at every review size. Capture local screenshots for the evidence record.

### A5. Render the lead, story grid, and evidence sections

**Create:** `src/components/LeadStory.astro`, `StorySummary.astro`, `SignalLabel.astro`, `VulnerabilityWatch.astro`, `EvidenceList.astro`, `OriginalWriting.astro`, `ResearchSection.astro`; an original SVG lead diagram in `public/images/`; homepage data integration.

**Consumes:** validated edition/story snapshots; ordered section ids.
**Produces:** full edition layout with derived counts and data-driven content.

- [ ] Render the wide headline, split illustration/summary lead, impact, affected technology, source links, and supported action.
- [ ] Render the ruled three/two/one-column grid with no duplicate lead or repeated section entries.
- [ ] Add a compact Vulnerability Watch keyed by unique CVE, with separate probability/percentile semantics and dated evidence links.
- [ ] Render original and research sections using the shared story model and explicit content labels.
- [ ] Create an original technical SVG with readable labels and equivalent text. Do not trace or copy the reference illustration.
- [ ] Inspect dense/long/null fixtures in both themes; confirm no clipped text or accidental page overflow.

**Exit:** all visible editorial content comes from data, and the newspaper remains readable without JavaScript.

### A6. Implement accessible topic and signal filters

**Create:** `src/lib/filter.ts`, `src/components/EditionFilters.astro`, `src/scripts/filters.ts`, `tests/unit/filter.test.ts`, `tests/e2e/filters.spec.ts`.

**Interface:** `filterStories(stories: Story[], filters: { topic: Category | 'all'; signal: 'all' | 'recommended' | 'must-read' }): Story[]`. Preserve input ordering; never mutate the edition.

- [ ] Write failing unit cases for All, topic-only, signal-only, combined selection, Recommended inclusion of Must Read, and zero matches.
- [ ] Implement the pure filter and URL parameter parsing with an allowlist of values.
- [ ] Add progressive controls, selected-state semantics, a polite result-count announcement, and an empty-state reset.
- [ ] On active filters, render one results list covering every section. Restore the full editorial layout when cleared.
- [ ] Verify direct URL loading, Back/Forward, reset, invalid parameters, keyboard operation, and focus retention.
- [ ] Disable JavaScript and confirm that the full edition plus category navigation remains usable.

Browser test shape:

```ts
await page.goto('/?topic=ai-security&signal=must-read');
await expect(page.getByRole('button', { name: 'Must Read', exact: true }))
  .toHaveAttribute('aria-pressed', 'true');
await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
await expect(page).not.toHaveURL(/topic=|signal=/);
await expect(page.getByRole('heading', { name: "Today's Vulnerability Watch" }))
  .toBeVisible();
```

**Exit:** filter combinations match validated fixture expectations and state survives browser history navigation.

### A7. Generate article, archive, and intelligence routes

**Create:** `src/pages/today.astro`, `archive.astro`, `[year]/[month]/[day].astro`, `article/[slug].astro`, `category/[category].astro`, `tag/[tag].astro`, `cve/[cve].astro`, `404.astro`, `about.astro`, `editorial-policy.astro`; `src/layouts/ArticleLayout.astro`; `src/components/ArticleBody.astro`; `tests/e2e/routes.spec.ts`; Astro content collection configuration appropriate to the installed version.

**Consumes:** A2 loader/indexes, A3 editions and Markdown article, A4–A5 components.
**Produces:** every initial route from the original implementation prompt, using the singular article route.

- [ ] Generate routes from validated content; centralize canonical URL creation and reject collisions before build.
- [ ] Render dated editions as snapshots, archive groups/counts, and category/tag indexes with chronological stable ordering.
- [ ] Render all story types through the singular article route; integrate trusted Markdown with the same metadata/provenance layout.
- [ ] Build CVE pages with dated intelligence, missing/conflict states, source references, affected/fixed ranges, and coverage links.
- [ ] Add title, description, canonical, social metadata, and appropriate structured article metadata derived from content. Do not fabricate author identities.
- [ ] Add editorial/about copy describing the preview, source policy, and correction behavior; defer unconfirmed biography/contact fields.
- [ ] Crawl generated internal links, check every fixture route, and check the missing-page state on the actual preview server.

**Exit:** readers can follow homepage → article → CVE → related article and archive → prior edition without dead ends.

### A8. Add feeds and close prototype validation

**Create:** `src/pages/rss.xml.ts`, `feed.json.ts`, `markdown.ts`; `src/lib/feeds.ts`; `tests/unit/feeds.test.ts`; `tests/e2e/accessibility.spec.ts`, `edition.spec.ts`; `scripts/check-links.ts`; extend `README.md` and CI.

**Consumes:** validated publication indexes and canonical route helpers.
**Produces:** well-formed escaped feeds, repeatable checks, visual evidence, and a prototype handoff.

- [ ] Produce RSS, JSON Feed, and Markdown representations with stable ids, correct dates, canonical article links, and clear preview labeling in fixture mode.
- [ ] Test feed escaping and source attribution; ensure summaries do not republish source articles. Test production rejection of fixture content independently of network access.
- [ ] Add internal-link checks and automated accessibility checks; complete manual keyboard/theme/zoom review.
- [ ] Run the full command sequence below after configuring the named scripts. Report failures, never silently skip a gate.
- [ ] Measure asset sizes and the performance target defined in the design; record settings, results, and justified deviations.
- [ ] Compare screenshots against the screenshot-derived composition and record any design changes. Complete the milestone evidence entry.

```sh
npm ci
npm run check
npm test
CONTENT_MODE=fixture npm run build
npm run test:e2e
```

Configure Playwright's web server to serve the fixture production build. The content-validation tests must explicitly exercise production mode rejection. A fixture build passing does not mean a production build can yet publish.

**Exit:** prototype checks pass, all required views have browser evidence, and the user has a concrete site to review. Do not label this V1 or enable publishing.

## 4. Milestone B — collection and event normalization

**Primary paths:** `pyproject.toml`, Python lockfile, `pipeline/models/`, `collectors/`, `processing/`, `validators/`, `main.py`, `config/sources.yml`, `tests/pipeline/`, `.github/workflows/ingest.yml`.

- [ ] Create a CLI accepting explicit edition date, source selection, output directory, and replay mode. Pin the Python environment and document reproducible installation.
- [ ] Implement configured RSS/API adapters with bounded requests, source-specific failure reporting, retrieval times, and retained original records.
- [ ] Normalize timestamps/URLs and extract CVE/GHSA identifiers; test tracking-parameter removal without changing meaningful URL parameters.
- [ ] Deduplicate exact records and cluster corroborated events. Preserve provenance, cluster reasons, and manual split/merge overrides.
- [ ] Persist each stage and a run manifest containing source status/counts, errors, durations, and schema/rule versions.
- [ ] Add recorded-response tests for timeouts, malformed payloads, rate limits, duplicates, related-but-distinct CVE stories, and replay determinism. Keep ordinary CI independent of live APIs.

**Gate:** replaying one captured input set produces the same normalized candidates; one failed source does not abort useful collection or delete existing editions. No editorial AI yet. Expand this milestone into a task-level plan before implementation.

## 5. Milestone C — vulnerability intelligence

**Primary paths:** `pipeline/collectors/{cisa_kev,epss,github_advisories,osv,nvd}.py`, `pipeline/enrichment/`, `pipeline/processing/rank.py`, `config/ranking.yml`, cross-language contract tests.

- [ ] Integrate CISA KEV, FIRST EPSS, GitHub advisories, OSV, NVD, and supported vendor advisory adapters using documented primary APIs and cached recorded tests.
- [ ] Preserve field provenance, effective dates, CVSS version/vector/issuer, package ecosystems and version-range semantics, and explicit unknown/conflict states.
- [ ] Implement per-field authority rules and documented staleness thresholds per source. Preserve prior values as dated evidence when refreshes fail.
- [ ] Compute explainable deterministic signals and deduplicated edition statistics; test zero/null distinctions and rule boundaries.
- [ ] Validate Python output against the interchange contract and load it through the frontend validator in CI.

**Gate:** a small reviewed advisory corpus agrees with its primary evidence; conflicting facts are visible; unavailable feeds cannot become false "not exploited" or fabricated fixes. No AI-produced facts enter the contract.

## 6. Milestone D — optional editorial assistance

**Primary paths:** `pipeline/editorial/`, `pipeline/validators/facts.py`, `config/editorial.yml`, recorded adversarial editorial fixtures.

- [ ] Implement a provider interface and a working `none` provider that can render a reviewed edition without a model.
- [ ] Define a strict editorial output schema and a minimal evidence input containing no secrets or executable instructions.
- [ ] Reject unexpected fields, invented advisory URLs, unsupported versions/scores, and attempts to mutate authoritative data. Validate factual claims inside prose, not only JSON field names.
- [ ] Add bounded retries, token/cost limits, failure fallback, prompt/version audit metadata, and explicit generated/unreviewed status.
- [ ] Test malicious source instructions, invalid structured output, hallucinated fixes, provider outages, and attempts to mark content reviewed.

**Gate:** both disabled and enabled modes build; unsupported claims are quarantined for review; model output cannot alter sourced facts. Select provider/cost ceiling only when this milestone is authorized.

## 7. Milestone E — original publishing and editorial controls

**Primary paths:** `content/{articles,research,explainers,incidents}/`, author/series data, `src/pages/authors/[slug].astro`, publication/override validation.

- [ ] Extend the initial Markdown collection to MDX, real author profiles, series, related articles, research commentary, and incident templates.
- [ ] Add publish/suppress, headline/summary, lead, category/tags, ordering, and cluster overrides with attributed changes.
- [ ] Keep authoritative fact changes separate and require provenance; render correction notes and actual review status.
- [ ] Implement preview → review → publish state transitions and validate that drafts cannot enter public routes or feeds.

**Gate:** an editor can add and review original work or a brief through repository files/PRs; generated copy and original authorship remain distinguishable. Confirm public author details before creating real biographies.

## 8. Milestone F — search and historical discovery

**Primary paths:** static search build integration, `src/components/SearchDialog.astro`, client search script, related-coverage indexes, browser tests.

- [ ] Choose Pagefind or an equivalent static engine against the built site size and content structure; record the decision.
- [ ] Index CVE/GHSA, package, technology, vendor, title, author, tags, and article text; exclude drafts, fixture production content, and duplicate aliases.
- [ ] Add keyboard-accessible search with Cmd/Ctrl+K, focus containment/restoration, Escape, meaningful empty results, and lazy-loaded assets.
- [ ] Prioritize exact advisory matches, and connect CVE pages to related coverage with clear dates.

**Gate:** reader journeys from search to a relevant article/CVE work with keyboard and mobile input; first-page budgets remain within the design targets. Package pages and watchlists stay in H.

## 9. Milestone G — release engineering and public V1

**Primary paths:** `.github/workflows/{publish-daily,deploy,security}.yml`, deployment configuration, `public/.well-known/security.txt`, publication CLI, operational documentation.

- [ ] Select hosting and confirm account/domain access; build a deployment preview before requesting any missing production authorization.
- [ ] Configure scheduled candidates and explicit editorial publication. Validate dates, concurrency locks, stable ids, and atomic promotion.
- [ ] Keep the last good edition during empty, partial, and failed runs; expose reader-relevant source dates without leaking diagnostics.
- [ ] Test replay, correction, and rollback using a previous verified edition/build. Preserve permanent editions and originals.
- [ ] Enable least-privilege workflows, dependency/secret checks, applicable static analysis, action pinning, provenance/SBOM generation, and documented repository protection settings.
- [ ] Configure HTTPS/canonical host, CSP and security headers, confirmed security contact, feed validation, SEO, and production fixture/draft rejection.
- [ ] Run end-to-end generation from fresh real source inputs through review and the deployed static site. Verify domain, assets, routes, feeds, dark mode, mobile rendering, and dated evidence.

**Public V1 release gate — all required:**

- [ ] Every item in original spec section 82 has corresponding evidence.
- [ ] Public content contains no fixture or synthetic records; evidence attribution is visible.
- [ ] Current source facts are deterministically sourced, with freshness and unknown states tested.
- [ ] Daily candidate generation requires no manual coding; editorial approval follows the chosen policy.
- [ ] All required checks pass at the revision being deployed.
- [ ] Public domain/HTTPS and site/feed navigation are verified after deployment.
- [ ] Failed-run retention and rollback have been exercised, with recovery steps recorded.

## 10. Milestone H — deferred proposals

EPSS history, vulnerability timelines, package/technology pages, watchlists, email digests, topic feeds, trend charts, saved preferences, and accounts require separate designs justified by actual reader needs. Do not let these delay V1 or introduce placeholders into its UI.

Newsletter update — 2026-09-30: the user approved the architecture for a free-first Buttondown integration with double opt-in, concise edition digests, and post-deployment API delivery. The [newsletter design](../specs/2026-09-30-tsd-buttondown-newsletter-design.md) and [implementation plan](2026-09-30-tsd-buttondown-newsletter.md) define its independent gates. Signup, schema, digest rendering, provider boundary, sender, workflow, and reader tests are now implemented locally on `feat/buttondown-newsletter`; the evidence ledger below records Tasks 7–9 verification. Provider configuration and live rollout remain unverified, no production edition has newsletter approval, and no email was sent during implementation. All other Milestone H proposals remain deferred.

## 11. Requirement coverage

| Requirement | Delivery |
| --- | --- |
| Screenshot-inspired newspaper, responsive, dark | A4–A5 |
| Typed/schema-validated content, truthful fixtures | A2–A3 |
| Topic and signal filters | A6 |
| Article/edition/archive/category/tag/CVE routes | A7 |
| Original articles | A3/A7, expanded E |
| Vulnerability Watch, evidence, unknown states | A5/A7, live facts C |
| RSS/JSON/Markdown and SEO | A7–A8, production G |
| Collection and clustering | B |
| CVSS/EPSS/KEV/fixes and provenance | C |
| Explainable ranking and editorial diversity | C; layout A5 |
| Optional AI and fact integrity | D |
| Research/incident/author/series publishing | E |
| Search and historical coverage | F |
| Scheduling, retention, telemetry, corrections | B/E/G |
| Security CI, hosting, rollback, daily publication | A1 baseline, G release |
| Future intelligence/accounts | H; explicitly outside V1 |

## 12. Evidence ledger

| Milestone | Status | Evidence |
| --- | --- | --- |
| Planning | Written; awaiting implementation review | Product spec, design baseline, AGENTS.md, this plan |
| A | Complete locally; reading system verified 2026-09-27 | 61 static pages; 19 unit tests and 34 generated-preview Chromium journeys pass; type/content/link checks pass; production build rejects fixtures with the required message. Unique four-story Vulnerabilities count, single filtered results list, invalid/history URL state, no-JavaScript fallback, theme persistence, content-sized paper sheets, Grenze Gotisch masthead and Newsreader editorial typography, compact semantic reading pages, citation return navigation, evidence-note reflow, short fallbacks, print/forced-color/blocked-font behavior, and 767/768/1099/1100px column thresholds are covered. Impeccable detector returned `[]`. Homepage evidence is under `/private/tmp/tsd-refinement-review/` and `/private/tmp/tsd-production-typography/`; the 36-capture reading matrix is under `/private/tmp/tsd-reading-experience/after/`. All recorded pages fit their viewports. Local font and texture assets total 238,087 bytes. Git commit remains unavailable because `.git` is read-only in this workspace. |
| B | Not started | Depends on content contract |
| C | Not started | Depends on recorded inputs and adapters |
| D | Not started | Provider none is an acceptable V1 mode |
| E | Not started | Initial Markdown covered in A |
| F | Not started | Depends on generated content |
| G | In progress — workflow definitions verified locally; production prerequisites blocked | SemVer release, security, candidate and Cloudflare deployment workflows added; see the 2026-09-28 workflow evidence below. No hosted deployment performed. |
| H | Deferred | Outside initial release |

At each completed milestone, append the date/revision, changed paths, exact commands and outcomes, screenshot paths and viewport/theme coverage, deviations, and remaining limitations. Check off only verified work.

### Milestone A homepage composition study

- [x] Record the reviewed direction and selection criteria in the design document.
- [x] Generate balanced and dense standalone concepts from identical validated edition data.
- [x] Capture each concept at 1440px and 390px in light mode, plus desktop dark-theme samples.
- [x] Review headline wrapping, story density, attribution, section order, overflow, and artwork treatment.
- [x] Select Composition B against the documented criteria before changing application components.

The study preserves the current uncommitted Milestone A implementation. Concept files remain separate under `design-explorations/homepage-compositions/`; deployment and application integration are outside this comparison step.

Comparison evidence is in `/private/tmp/tsd-homepage-compositions/`: six full-page captures and `report.json`. Each capture contains the lead plus 14 non-lead stories, has a semantic main region, a first-focus skip link, a labeled illustration, and no page-level horizontal overflow. Composition A gives more room to lead analysis; Composition B brings the daily report higher and is the primary implementation candidate. The Impeccable detector prompted darker metadata, 11px-or-larger mobile utility text, and removal of numbered section labels; its remaining tight-leading warnings refer to intentional display headlines rather than body copy.

Composition B was selected and integrated into `EditionView`, `LeadStory`, `StoryCard`, `VulnerabilityWatch`, and the shared stylesheet. The implementation adds a story-specific evidence diagram, wider lead measure, compact wide-screen controls, quiet source/date attribution, substantive first-row context, and distinct Daily Report, Vulnerability Watch, From the Editor, and Research Worth Reading sections without duplicating stories. Final built-preview captures and metrics are under `/private/tmp/tsd-homepage-integrated/` for 1440px and 390px in both themes; all four contain 15 editorial story instances and report no page overflow. `matrix-report.json` covers 320/390/768/1024/1440px in light and dark with no page overflow, plus a visually reviewed 200% zoom capture. The implemented typography passes all 10 Web Typography diagnostic rows. Verification: 17 unit tests, 19 Chrome journeys, Astro/TypeScript check with zero diagnostics, 61-page static build, and `git diff --check` pass.

A medium paper-grain pass adds a 399-byte local SVG tile behind the paper content at opacity `.30` with multiply blending in light mode and `.14` with soft-light blending in dark mode. The 512px rendered tile preserves visible surface variation at normal page scale. Increased-contrast, forced-color, and print modes omit it. Evidence under `/private/tmp/tsd-paper-grain-medium/` covers the homepage and canonical article route across mobile, desktop, both themes, and the 200% reflow proxy. All seven captures loaded the texture, retained the Newsreader faces, and reported no page overflow. Verification remained at 17 unit tests and 20 Chrome journeys, with an empty Impeccable detector result.

A modern blackletter nameplate pass confines Grenze Gotisch Bold to the fixed “The Security Diff” masthead while retaining Newsreader for headlines and prose. The lead headline uses a true Newsreader Medium face so its weight remains subordinate to the nameplate, while section, card, and article headings remain Semibold. The official sources were locally subset under SIL Open Font License 1.1; the six-face production payload is 226,872 bytes. Evidence under `/private/tmp/tsd-production-typography/` covers homepage and canonical article views at mobile and desktop sizes, both themes, and the 200% reflow proxy. All seven captures loaded the expected families, remained within their viewports, and measured cumulative layout shift from 0.00049 to 0.05145.

The paper sheet now follows document content instead of enforcing a viewport-height minimum. This prevents short pages from displaying a long textured-paper tail when the browser is heavily zoomed out. A 1440 × 4000 regression viewport verifies that the paper ends within 52px of the footer; remaining viewport space uses the surrounding canvas. Evidence is `/private/tmp/tsd-paper-content-height.png`.

### Milestone A reading experience

The reading system replaces the full edition masthead on article and reference pages with a compact nameplate and contextual return. Two validated Markdown samples exercise an essay and a historical brief at `/article/[slug]`: approximately 1,174 and 528 narrative words respectively, with semantic headings, contextual SVG figures, a code example, explicit limitations, native footnotes/backlinks, sparse authored evidence notes, and validated related-story IDs. Existing JSON stories continue through a compatible short-body fallback.

The article title is the only `h1`. Prose stays at 68 characters while figures may widen to 880px. Evidence notes float beside their supported sections when space permits and return to document flow below 1160px. A native contents disclosure appears only with at least four meaningful sections. CVE facts use a semantic definition list with independent CVSS, EPSS, KEV, known-exploitation, affected, fixed, date, uncertainty, source, and coverage treatment. About/editorial pages use the reading shell; archive/category/tag/404 views use its compact browsing variant.

Verification: Astro/TypeScript zero diagnostics, 19 unit tests, 34 Chromium journeys, 3 fixture editions/17 content entries, 61 static pages, internal-link pass, empty Impeccable result, and clean diff whitespace. Production mode rejects fixtures with the exact required message. Browser coverage includes JavaScript-disabled citation return, responsive evidence notes, short/missing-rich-content fallback, 320px reflow, print, forced colors, reduced motion, blocked fonts, existing homepage filtering, and theme persistence. The refreshed capture matrix contains 36 no-overflow screenshots across essay, brief, and CVE pages at 320/390/768/1024/1069/1440px in both themes under `/private/tmp/tsd-reading-experience/after/`; two prior article captures are retained in `before/`. Native footnote wording and authored placement were selected to avoid another Markdown transformation dependency. Human comprehension remains an editorial review activity rather than an automated claim.

### Milestone A filter toolbar refinement — 2026-09-27

Status: implemented and verified locally following the user's crowded-filter screenshot. Changes are scoped to `src/components/EditionFilters.astro`, filter rules in `src/styles/global.css`, `tests/e2e/filters.spec.ts`, and this ledger/design baseline. Existing unrelated changes remain intact.

- Replaced filled/outlined filter boxes with unboxed text and an accent underline for selection. Topic options wrap across the full available width; Signal occupies the next row with result/reset information alongside it on wider screens. Mobile groups stack. Removed the topic scroll hint because the controls no longer scroll horizontally.
- Reduced utility text weight and removed inherited uppercase styling from result text. Reset appears only with an active selection; resetting with keyboard focus moves focus to Topic All. Preserved existing labels, URL/history behavior, AND filtering, result announcements, and no-JavaScript category navigation.
- Verification: `npm run check` returned 0 errors/warnings/hints; `CONTENT_MODE=fixture npm run build` generated 61 pages. `npx playwright test --config /private/tmp/tsd-filter-refinement/playwright.config.mjs` passed 17 focused filter/accessibility tests against the generated preview on port 4324. The temporary configuration uses the repository tests and a separate output directory. An initial attempt against the earlier preview port failed because that server was no longer listening; all checks passed on the dedicated preview.
- Visual evidence: `/private/tmp/tsd-filter-refinement/before/` contains two original captures. `/private/tmp/tsd-filter-refinement/after/` contains 24 captures and `manifest.json`, covering 320/390/768/1024/1440px, both themes, default/active selections, and four surrounding-page views. No document or filter-group overflow; every filter button is at least 44 × 44px. Captures reviewed for wrapping, selected-state visibility, grouping, and theme contrast. Computed palette text contrasts against paper range from 6.07:1 to 15.41:1; these are token comparisons, not per-pixel texture measurements.
- `sh /Users/pankajmouriya/.codex/skills/impeccable/scripts/impeccable detect --json src/components/EditionFilters.astro src/styles/global.css` returned `[]`; `git diff --check` passed.
- Deviation: wrapping options supersedes the previous horizontally scrolling topic strip. Browser connector discovery returned no browser; verification used isolated local Chrome through the project's Playwright setup. No deployment or commit. Full publication and article suites were not rerun for this bounded filter change.

### Editorial authoring documentation — 2026-09-27

Status: documentation and reusable templates complete; no pipeline or publishing milestone completed. Added `docs/editorial/authoring-guide.md`, `content-recipes.md`, `agent-workflow.md`, and eight files under `docs/editorial/templates/` (story/edition JSON, brief/essay Markdown, evidence sidecar, agent assignment, output example, and strict proposed output schema). Linked the kit from `README.md` and `docs/README.md`; corrected the documentation index's stale pre-implementation status. Recorded the boundary in the design baseline.

The guide covers local preview authoring, all eight types, lead/section selection, Markdown customization, citation and attribution handling, unknown facts, edition registration, verification, and current limitations. Future agents receive an evidence-constrained drafting assignment; the proposed output schema does not give models control of authoritative facts or publication. No application logic, fixture editions, article bodies, dependencies, or publication state changed in this pass.

Verification: parsed story and edition examples with the current `storySchema`/`editionSchema` through `node --import tsx` and confirmed their shared record matches. Built brief and essay templates separately with the installed Astro in `/private/tmp/tsd-authoring-template-check/`, using unchanged copies of `src/content.config.ts` and `src/lib/articles.ts`. Both one-page builds passed collection and identity/reference validation; generated citation and backlink targets resolve. Python `jsonschema` validated the proposed draft schema/example and rejected extra `fixture`, `vulnerabilities`, `author`, and nested `claim_links.source_url` fields. All 43 local document links checked resolve; `git diff --check` passes. The local evidence report is `/private/tmp/tsd-authoring-template-check/report.json` with both rendered sample HTML files. No full application regression, browser visual audit, real-source verification, or production integration is claimed for this documentation-only pass. No commit or deployment.


### Milestone G workflow definitions and SemVer release policy — 2026-09-28

Status: requested workflow files implemented and locally verified; production deployment and ingestion remain blocked by missing content/environment and publication-control implementations. No release, commit, deployment, or DNS mutation performed in this task.

Changed paths: `.github/workflows/{validate,security,release,deploy,publish-daily}.yml`, `.github/dependabot.yml`, `.github/release/` (pinned tooling, configuration, runner and tests), `.github/scripts/release_control.py`, `tests/workflows/test_release_control.py`, `docs/operations/release-process.md`, documentation index, deployment plan, and design decision. The existing preview workflow is retained. The user-provided `docs/design/content-environments.md` is preserved and referenced as a production prerequisite.

Verified commands/results:

- `actionlint` 1.7.7: all six workflow definitions pass with no diagnostics.
- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/workflows -p 'test_*.py'`: 9 passed, including production-contract rejection and archive/source/content-manifest binding.
- `npm test --prefix .github/release`: 17 passed; repeated with pinned Node 24.21.0 through `npm exec --yes --package=node@24.21.0 -- node --test .github/release/config.test.mjs`, also 17 passed. Tests cover major/minor/patch/no-release decisions, breaking-change precedence over custom patch rules, and generated content/maintenance release notes.
- `npm test`: 19 application tests passed in 7 files.
- Both root and release-tool `npm audit --audit-level=high`: zero vulnerabilities.
- Missing `production-build`, `staging`, `release`, and `daily` prerequisites each return exit 1 with the missing commands listed; these are verified refusals, not completed deployment gates.
- `git diff --check`: passed. Local evidence: `/private/tmp/tsd-release-workflows-verification.md`. Visual evidence: not applicable; no reader UI changed.

Decisions/deviations: user selected semantic-release after eligible main merges instead of a separate release PR; first tag will be v1.0.0 without a historical baseline. Reviewed content commits can trigger patch releases. Automatic deployment is invoked through a reusable workflow to avoid GITHUB_TOKEN event suppression. Runtime/tooling are isolated from application dependencies. Production policies are compared after extraction rather than changed after packaging. GitHub Release assets supplement 90-day Actions retention. Initial public/DNS authorization remains explicit; subsequent unattended promotion requires a recorded policy. Preset 9.3.1 is pinned because the latest preset was incompatible with the release-notes writer.

Remaining blockers/unverified after the content-environment implementation below: the reviewed production content and minimal Cloudflare deployment workflow now exist locally; project setup and a pull-request preview are verified, while the production workflow, custom domain and TLS, and initial launch remain unverified. Required repository values are present except for the deliberately withheld production-enable variable. Semantic release, candidate automation, artifact inventories, extensive authorization evidence, and automated rollback rehearsal are deferred from the first publication path by the user's 2026-09-28 scope decision.

### Fixture and production content environments — 2026-09-28

Status: implemented and verified locally. This was the state on 2026-09-28, when genuine production content was intentionally empty and publication was blocked with `Production content requires at least one reviewed edition`. The first reviewed production edition was added locally on 2026-09-29 as recorded below.

Changed paths: separate `content/{fixtures,production}/articles` and `data/{fixtures,production}/editions` roots; strict fixture/production schemas and loader selection; mode-aware layouts, feeds, articles, CVE pages, and route generation; explicit fixture/production build and validation scripts; focused boundary tests; generated fixture schema; and updated authoring/design documentation.

Verification: `npm run check` reported zero diagnostics; `npm test` passed 25 tests in 7 files; `npm run validate:fixture` loaded 3 editions and 17 entries; `npm run build:fixture` generated 61 pages; `npm run check:links` passed; and `npm run test:e2e` passed 36 Chromium journeys. A temporary local production corpus passed validation and generated 10 pages, exposed only its own article/category/tag/date routes, used `index, follow`, and contained no fixture labels or fixture article route. The temporary corpus was removed and fixture output restored. Empty `npm run validate:production` returned the required nonzero result.

The empty-corpus blocker was resolved locally on 2026-09-29 with genuinely reviewed content and recorded source evidence. Commit, pull-request, and hosted deployment gates remain.

### First reviewed production edition — 2026-09-29

Status: exact copy approved by the user and implemented on a dedicated content branch; not deployed. The production corpus contains one edition and one editor original, “Admission control is where Kubernetes policy becomes executable.” The edition and article record `reviewed_by: Pankaj Mouriya` and `reviewed_at: 2026-09-29T16:19:11Z` from the user's approval.

Changed paths: `data/production/editions/2026-09-29.json`, `content/production/articles/admission-control-kubernetes-policy.md`, `src/components/EditionFilters.astro`, `src/components/EditionView.astro`, and the production environment, release-process, and delivery records. The essay is newly written from the author's 2024 noShellAccess guide and current official Kubernetes documentation; it credits and links the original post and does not reuse third-party illustrations. The production edition retains all source URLs and uses no CVE claims.

The filter components now receive the edition's available categories and render only valid category destinations. This fixes broken fallback links for a sparse production corpus while retaining every taxonomy choice in the full fixture corpus.

Verification: `npm run check` reported zero errors, warnings, or hints; `npm test` passed 25 tests in 7 files; `npm run test:content-environments` passed 15 tests in 4 files; production validation loaded 1 edition and 1 entry; `npm run build:production` generated 13 pages; internal links and `git diff --check` passed. Three Chromium checks against the generated production output passed: article structure and attribution, desktop and mobile rendering in both themes without horizontal overflow, and no-JavaScript category navigation. Four reviewed captures are stored under `/private/tmp/tsd-admission-controller-review/`.

Hosted evidence: GitHub has the Cloudflare account/project variables, API-token secret, `preview` and `production` environments, and a successful Pages setup run. The existing PR preview returns 200 with `X-Robots-Tag: noindex`. `TSD_PRODUCTION_ENABLED` is absent; the production Pages URL returns 404; and the custom domain does not yet complete HTTPS and returns 403 over HTTP.

Remaining gates: pass and merge the content pull request, complete the Cloudflare Pages custom-domain and TLS configuration, enable production deployment, and verify the Pages and custom-domain URLs. No release, DNS change, or deployment occurred during this work.

### Newsletter Task 7 reader-flow and visual review — 2026-09-30

Status: reader browser coverage and bounded visual review implemented on `feat/buttondown-newsletter`, based on Task 6 revision `eb18646`. Added `tests/e2e/newsletter.spec.ts`; no newsletter UI, stylesheet, configuration, or dependency changes were needed. `npm run test:e2e` passed all 55 journeys (54.5s); `npm run check` reported zero errors, warnings, or hints across 74 files; `git diff --check` passed. No configuration changed, so configuration-focused unit tests were not applicable.

- Built the fixture site with `TSD_NEWSLETTER_SIGNUP_ENABLED=true BUTTONDOWN_USERNAME=tsd-test TSD_PUBLICATION_CONTACT_URL=mailto:privacy@example.test npm run build:fixture`: 63 pages. `npm run newsletter:preview -- --mode fixture` generated the standalone digest. No production build or provider operation was performed.
- `npm run test:e2e -- tests/e2e/newsletter.spec.ts`: 19 passed after correcting test-only selectors and replacing the no-JavaScript click stability wait with native Enter submission. Coverage includes the homepage, dated edition, canonical article, Subscribe, Privacy, footer navigation, exact native form contract and consent links, forward/reverse keyboard focus, malformed-email rejection, and an intercepted form-encoded POST with JavaScript disabled. All external browser requests are blocked except the exact provider request, which is fulfilled locally.
- Both themes pass document-overflow checks at 320/390/768/1024/1440px on the five reader routes. Input/button dimensions are at least 44px, corners are square, and computed text/background contrast checks pass 4.5:1. These checks do not claim WCAG conformance or measure contrast against every grain-texture pixel.
- Visual evidence: `/private/tmp/tsd-newsletter-review/manifest.json`, 30 full-page PNGs covering homepage, article, Subscribe, Privacy, and digest at 320/768/1440px in both themes, plus 18 signup crops and six focus crops. Reviewed the five surface contact sheets and signup/focus detail sheets with image inspection. Findings: editorial hierarchy remains dominant; the single signup follows reading content; phone controls stack with readable consent wrapping; tablet/desktop controls stay on one row; light/dark focus rings remain visible; Privacy headings, contact, and footer links wrap within the viewport. The digest uses readable native browser typography and system light/dark colors; this is an editorial-content preview, not proof of Buttondown's delivered-email appearance. No visual defect justified changing production files.
- Environment/deviations: the browser connector returned no available browsers, so captures and journeys used the repository's Chrome/Playwright runner (Chrome 154.0.8037.59). Local server/Chrome execution required sandbox escalation. The Impeccable context launcher had already failed earlier in the session; it was not rerun. Existing publication design documents and components supplied visual context. No UI edit meant no UI detector or craft-floor edit pass was required. Initial failing test traces are retained outside the repository under `initial-test-results/`; those were harness failures, not evidence of an application defect. There was one batched visual inspection and no polish or recapture cycle.
- Remaining boundaries: no live signup, real confirmation/unsubscribe flow, provider sender settings, email-client rendering, production deployment, or WCAG conformance was verified.

### Newsletter Task 8 authoring and operations documentation — 2026-09-30

Status: documentation implemented and verified locally on `feat/buttondown-newsletter`, following Task 7 revision `1ad94ee`. Added the [operator runbook](../../operations/newsletter.md); documented separate newsletter approval, preview review, post-deployment delivery gates, identity reconciliation, pause/recovery, key rotation, privacy/export/suppression migration, and the 80/100 active-subscriber capacity process. No production edition was approved and no email was sent during this task. No application, workflow, provider configuration, deployment, or DNS changes were made.

Changed paths: `docs/operations/newsletter.md`, `docs/operations/release-process.md`, `docs/editorial/authoring-guide.md`, `docs/README.md`, `docs/superpowers/plans/2026-09-26-tsd-delivery.md`, `docs/superpowers/plans/2026-09-30-tsd-buttondown-newsletter.md`, and `docs/superpowers/specs/2026-09-30-tsd-buttondown-newsletter-design.md`.

Verification commands/results:

- `npm run check:links`: exit 0, `Internal links: PASS`, against the existing Task 7 generated fixture output. No rebuild was required for Markdown-only documentation changes.
- `python3 /private/tmp/tsd-newsletter-task8-check-doc-links.py`: exit 0; all local Markdown links and section anchors resolve. The helper checks documentation paths independently of the generated-site link check.
- `node --import tsx /private/tmp/tsd-newsletter-task8-check-examples.mjs`: exit 0; draft and approved authoring example shapes pass the current newsletter schema. The examples explicitly identify the real-approver placeholder and timestamp as illustrative, not actual approval.
- `npm run newsletter:preview -- --mode fixture --output /private/tmp/tsd-newsletter-preview.html`: exit 0; rendered fixture edition 2026-09-26 locally without provider access.
- `rg -n "BUTTONDOWN_API_KEY" . --glob '!node_modules/**' --glob '!dist/**' --glob '!.git/**'`: exit 0; references reviewed as configuration names, instructions, or code/test references only; no key value added. The brief's exact scan does not include hidden workflow files, which were separately read to verify that the key is confined to the send step.
- `git diff --check`: exit 0. Manual copy review found no fabricated account setup, reviewer approval, credentials, actual public configuration values, DNS values, or live-delivery claims in Task 8 changes.

Visual evidence: preserved Task 7's `/private/tmp/tsd-newsletter-review/manifest.json`, 30 full-page captures, 18 signup crops, six focus crops, and review contact sheets. Their browser/visual findings and limits remain in the preceding entry. No UI changed in Task 8; no new visual review or delivered-email rendering is claimed.

Current configuration: a names-only local process-environment check found all five newsletter values and `TSD_PRODUCTION_ENABLED` unset. No value was printed or changed. Hosted repository/environment values and provider account state were not inspected in this task. The reviewed production JSON remains without newsletter metadata, so feature implementation has not authorized delivery.

Decisions/deviations: recorded the actual `X-API-Version: 2026-04-01` header, omitted deprecated/derived `email_type`, disabled archives with explicit all-subscriber filters, all nonaccepted provider states requiring manual review, and workflow `queue: max` plus separate send serialization and GitHub's 100-pending-run limit in the newsletter design and implementation-plan ruling note. Kept original task evidence and unchecked rollout gates intact. Corrected the authoring guide's stale empty-production assertion against the existing reviewed 2026-09-29 edition; this correction adds no publication authorization.

Remaining blockers: owner-controlled Buttondown setup, double opt-in and sender/reply verification, required DNS coexistence with Pages, monitored privacy contact and retention settings, secure production key/public variables, provider test rendering, actual confirmation/unconfirmed-exclusion/unsubscribe checks, signup rollout before send enablement, a separately reviewed new production edition with actual newsletter approval, successful deployment/smoke/send workflow evidence, and received-email/canonical-link/duplicate-rerun checks. Capacity review reminders and suppression-preserving migration remain operator responsibilities. No release box is checked from documentation evidence alone.

### Newsletter Task 9 final verification and non-sending handoff — 2026-09-30

Status: all required local positive and negative gates verified on `feat/buttondown-newsletter` at implementation revision `dee362d`. Task 9 changes only this delivery ledger. No provider request, live subscription, email send, production approval, deployment, DNS change, push, or pull-request creation occurred.

Dependency isolation: removed only the task-created `/private/tmp/tsd-buttondown-newsletter/node_modules` symlink to the source checkout, then installed dependencies inside the worktree. The first `npm ci` installed 322 packages but warned that shell Node 25.9.0 is outside Vitest 5's supported range. Repeated `npm ci` under cached Node 24.21.0 with npm 11.12.1: exit 0, 322 packages installed, no engine warning. Every final gate below used that supported Node through `PATH=/Users/pankajmouriya/.npm/_npx/538786c08bcb9442/node_modules/node/bin:$PATH`; the lockfile and source checkout dependencies were unchanged.

Exact commands/results:

- `npm run check`: exit 0; 74 files, zero errors, warnings, or hints; TypeScript check passed.
- `npm test`: exit 0; 268 tests passed in 12 files.
- `npm run validate:fixture`: exit 0; 3 editions and 17 edition entries. `npm run validate:production`: exit 0; 1 edition and 1 edition entry.
- `npm run test:content-environments`: exit 0; 24 tests passed in 4 files.
- `TSD_NEWSLETTER_SIGNUP_ENABLED=true BUTTONDOWN_USERNAME=tsd-test TSD_PUBLICATION_CONTACT_URL=mailto:privacy@example.test npm run build:fixture`: exit 0; 63 pages.
- `npm run newsletter:preview -- --mode fixture`: exit 0; preview for 2026-09-26, 7,342 bytes. Retained a local copy at `/private/tmp/tsd-newsletter-task9/newsletter-preview.html` before subsequent builds replaced `dist/`.
- `npm run check:links`: exit 0, `Internal links: PASS`, for configured fixture output.
- `npm run test:e2e`: 55 Chromium journeys passed in 29.8s. Initial sandbox attempt exited 1 because binding `127.0.0.1:4322` returned `EPERM`; authorized execution with the localhost server and Chrome exited 0. Native newsletter POSTs were intercepted locally, and external requests were blocked by the newsletter tests.
- `npm run build:production`: exit 0; 15 pages from the existing reviewed production corpus. No newsletter approval was added.
- `TSD_NEWSLETTER_SIGNUP_ENABLED=true npm run build:fixture`: expected exit 1 with `Newsletter signup configuration: BUTTONDOWN_USERNAME is required and must contain only letters, numbers, underscores, or hyphens.` Public username and contact were unset.
- `npm run newsletter:send`: exit 0, `Newsletter skipped: not-configured`. The production edition has no newsletter metadata; the orchestration returns before constructing the provider client.
- Repeated `npm run build:production` after the intentional failed build to restore complete output: exit 0, 15 pages. `npm run check:links` on restored production output: exit 0, `Internal links: PASS`. Signup was omitted; the fixture-only article and fixture digest preview were absent.
- `git diff --check` and `git diff --check origin/main...HEAD`: exit 0. `git status --short` was empty before this ledger update. `git ls-files node_modules dist .astro test-results playwright-report` returned no tracked generated/dependency output.
- `git diff --stat origin/main...HEAD` at `dee362d`: 34 files changed, 3,495 insertions, 6 deletions. `git diff origin/main...HEAD -- data/production/editions/2026-09-29.json` was empty.
- `git grep -n "BUTTONDOWN_API_KEY"` and `git grep -n "api/emails/embed-subscribe"`: reviewed references. Executable secret-name references occur only in the server-side sender, the workflow's isolated send step, and workflow-policy tests; additional references are explanatory runbook/design/plan documentation. No browser-facing source, public asset, loaded content, or fixture references the API-key name. The public endpoint is constructed solely from the validated username. No credential value was supplied or added. Artifact scans found zero secret-name matches in 68 fixture text artifacts and 19 restored production text artifacts.

Evidence: gate logs and result JSON are under `/private/tmp/tsd-newsletter-task9/`; clean-install logs are `/private/tmp/tsd-newsletter-task9-npm-ci-node24.log` and the initial `/private/tmp/tsd-newsletter-task9-npm-ci.log`. Preserved and confirmed Task 7's existing visual evidence: `/private/tmp/tsd-newsletter-review/manifest.json`, 30 full-page PNGs, 18 signup crops, and six focus crops. No UI changed and no new visual inspection or delivered-email rendering is claimed by Task 9.

Configuration and rollout: all five newsletter process-environment names plus `TSD_PRODUCTION_ENABLED` were unset in a names-only check. Acquisition was disabled in the restored local production build and the production edition was ineligible for delivery; hosted values were not inspected or changed. Keep `TSD_NEWSLETTER_SIGNUP_ENABLED=false` and `TSD_NEWSLETTER_SEND_ENABLED=false` for rollout until merge and operator setup. Task 8's provider/account, confirmation/suppression, deployment, separately reviewed newsletter approval, first-send, duplicate-rerun, and capacity gates remain open.

Deviations: no implementation scope change. Verification used supported cached Node 24.21.0 and authorized local browser execution because of the observed environment limits. Task 9's pull-request step is deferred under the controller's explicit instruction not to push or open a pull request; the branch and this evidence are prepared for that later handoff. No live-rollout completion box is checked from local evidence.

### Newsletter final review fix — privacy contact during acquisition pause, 2026-09-30

Status: verified locally. Extracted publication-contact validation from the signup gate so `/privacy` retains a configured contact while acquisition is disabled; signup remains absent. Changed `src/lib/newsletter-config.ts`, `src/pages/privacy.astro`, `tests/e2e/newsletter-paused.spec.ts`, the newsletter operator runbook/design, and this ledger. The design/runbook clarify that a configured invalid contact fails the build in either gate state, while missing contact is permitted before signup setup.

RED: built fixtures with `TSD_NEWSLETTER_SIGNUP_ENABLED=false TSD_PUBLICATION_CONTACT_URL=mailto:privacy@example.test`, then ran `TSD_NEWSLETTER_SIGNUP_ENABLED=false npm run test:e2e -- tests/e2e/newsletter-paused.spec.ts`. Both themes failed specifically because the configured privacy contact link was absent. GREEN after the fix: the same build/test passed, 63 pages and 2 browser journeys. `npm test -- tests/unit/newsletter-config.test.ts` passed 41 tests; `npm run check` passed with 75 files and zero diagnostics. An enabled fixture build passed, and `npm run test:e2e -- tests/e2e/newsletter.spec.ts` passed all 19 existing newsletter journeys. A disabled fixture build with `TSD_PUBLICATION_CONTACT_URL=javascript:invalid` correctly exited 1 while rendering `/privacy`. `npm run build:production` then passed, restoring 15 pages with signup disabled and contact unset. `git diff --check` passed.

Visual evidence: `/private/tmp/tsd-newsletter-final-fix1/manifest.json`, ten full-page privacy captures at 320/390/768/1024/1440px in both themes, and two keyboard-focus captures. All ten were visually inspected; the contact remains readable, no signup form is present, and there is no horizontal overflow. Keyboard traversal reaches the contact with a visible outline in both themes. Command logs are `/private/tmp/tsd-newsletter-final-fix1-*.log`; the standalone local capture script is `/private/tmp/tsd-newsletter-final-fix1-visual.mjs`.

Execution adaptation: the first browser attempt hit sandbox `EPERM` on localhost; authorized Chrome/server execution succeeded. RED used the shell's Node 25.9.0; subsequent focused checks/builds/browser verification used cached Node 24.21.0. Browser tests block external traffic and fulfill native signup POSTs locally. No provider request, deployment, push, or pull request occurred. Hosted contact monitoring, provider flows, and all existing live-rollout gates remain unverified; no production newsletter approval was added.

### Newsletter signup placement refinement — 2026-10-02

Status: implemented locally on `feat/buttondown-newsletter` for PR #3 following user review of the original large embedded form. The native Buttondown form now appears only on `/subscribe`. Edition pages use a compact ruled prompt; editor-original articles use the same quiet endnote after the body; other article types omit it. Edition and reading headers expose a conditional `Subscribe` link. All promotional links and prompts disappear with the signup gate, while the independently configured privacy contact remains available.

Changed paths: `src/components/{EditionHeader,EditionView,NewsletterSignup,ReaderHeader,NewsletterNavLink,NewsletterPrompt}.astro`, `src/pages/article/[slug].astro`, newsletter styles in `src/styles/{global,article}.css`, newsletter browser tests, this ledger, and the newsletter design decision. No provider, schema, delivery, content, approval, or workflow behavior changed.

Verification used cached supported Node 24.21.0. `npm run check` reported zero diagnostics across 77 files; `npm test` passed 268 tests in 12 files. The configured fixture build generated 63 pages. The updated newsletter suite passed 22 journeys, and the full configured browser suite passed 58 with the two disabled-state-only cases skipped. A separate disabled fixture build passed its two light/dark acquisition-pause journeys, proving that forms, prompts, and header links are absent while the privacy contact remains. Production rebuilt 15 pages and `npm run check:links` passed.

Visual evidence is under `/private/tmp/tsd-newsletter-refinement/`: 12 full-page captures and `manifest.json` covering edition, editor original, and Subscribe at 390/1440px in both themes. All captures report document width equal to viewport width. Manual inspection found the editorial hierarchy intact, the editor-original invitation visually subordinate to the article, and the dedicated form free of its former repeated heading. `impeccable detect --json --scope layout` returned `[]`. No provider request, live signup, email send, deployment, merge, or newsletter approval occurred.

### External story destination implementation — 2026-10-02

Status: reusable feature implementation is in progress on `feat/external-story-destinations`, based on merged PR #3 at `origin/main` revision `e4545cb`. The approved design and implementation plan are committed. The story contract now accepts an optional HTTPS-only, credential-free `destination_url`; shared helpers preserve the internal `/article/[slug]` identity while resolving the reader destination. Cards, filters, related coverage, CVE coverage, the vulnerability table, research leads, provenance pages, RSS, JSON Feed, Markdown, and newsletter digests use the shared behavior. A synthetic fixture exercises the external path without introducing a production claim.

Changed paths so far: story schema and generated JSON Schema; route/feed/newsletter libraries; JSON Feed page; lead/card/destination-label/vulnerability components; article and CVE pages; reader styles; focused unit/browser tests; fixture research metadata and related coverage; external destination design/plan; authoring templates/guides; site and newsletter architecture documents; and this delivery ledger.

Verification so far used cached supported Node 24.21.0. Contract RED tests failed because the field/helpers were absent; GREEN passed 23 schema/route tests. Reader RED browser cases proved cards, provenance, and related coverage still used internal routes; GREEN external/provenance cases passed after implementation. `npm run check` reported zero errors, warnings, or hints across 78 files, and the fixture build generated 63 pages. Feed/newsletter RED tests proved all links still used internal routes; GREEN passed 77 feed/newsletter/send tests. Local Playwright required authorized execution because sandbox binding to `127.0.0.1:4322` returned `EPERM`.

Remaining work: final documentation validation, full fixture and production regression gates, source-backed GenRec copy review, an approved production record, production/browser visual evidence, final ledger evidence, push, and pull request. No GenRec production content, reviewer metadata, newsletter approval, provider call, email send, deployment, DNS change, merge, or publication is recorded by this entry.
