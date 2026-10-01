# External Story Destinations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a reviewed TSD story participate in every publication surface while normal reader clicks can open a validated external original, beginning with the GenRec arXiv paper.

**Architecture:** Add an optional HTTPS-only `destination_url` to the shared story schema and centralize the identity/destination split in route helpers. UI, feeds, and newsletter rendering consume the destination helper, while static `/article/[slug]` routes, RSS GUIDs, and JSON Feed IDs retain internal TSD identity. External research leads and provenance pages use existing newspaper tokens with content-aware markup and no copied artwork.

**Tech Stack:** Astro 7.3.5, TypeScript 6.0.3, Zod 4.6.5, plain CSS, Vitest 5.0.2, Playwright 1.63.0, JSON content.

**Spec:** [external story destinations design](../specs/2026-10-02-tsd-external-story-destinations-design.md)

## Global Constraints

- `/article/[slug]` remains the canonical internal record for every story type.
- `destination_url` is optional, absolute, HTTPS-only, and may not contain URL credentials.
- Story source records, production review metadata, fixture boundaries, and immutable edition identity remain required.
- Reader-facing external links open in the current tab and expose a visible, accessible external cue.
- Feeds and newsletters carry only TSD-written summaries; do not mirror paper text or figures.
- No new dependency, runtime fetch, redirect service, database, CMS, analytics, or deployment action.
- Exact production copy and newsletter approval remain separate editorial decisions.

---

### Task 1: Add the story destination contract

**Files:**
- Modify: `src/lib/schema.ts`
- Modify: `src/lib/routes.ts`
- Modify: `tests/unit/schema.test.ts`
- Modify: `tests/unit/routes.test.ts`
- Modify: `public/schema/edition.schema.json`

**Interfaces:**
- Consumes: existing `Story`, `articlePath(slug)` and generated edition schema.
- Produces: optional `Story.destination_url`; `storyIdentityPath(story: Pick<Story, 'slug'>): string`; `storyDestination(story: Pick<Story, 'slug' | 'destination_url'>): string`; `isExternalStory(story): boolean`.

- [ ] **Step 1: Write failing schema and route tests**

Add assertions that fixture and production stories accept `https://example.com/research-paper`, reject HTTP, relative, credential-bearing, JavaScript, and data URLs, and preserve omission. Add route assertions:

```ts
expect(storyIdentityPath({ slug: 'paper' })).toBe('/article/paper');
expect(storyDestination({ slug: 'paper' })).toBe('/article/paper');
expect(storyDestination({ slug: 'paper', destination_url: 'https://example.com/paper' })).toBe('https://example.com/paper');
expect(isExternalStory({ slug: 'paper', destination_url: 'https://example.com/paper' })).toBe(true);
```

- [ ] **Step 2: Run focused tests and confirm the missing contract fails**

Run: `npm test -- tests/unit/schema.test.ts tests/unit/routes.test.ts`  
Expected: FAIL because `destination_url` and destination helpers do not exist.

- [ ] **Step 3: Implement the HTTPS-only field and route helpers**

Define one reusable schema:

```ts
const externalDestinationSchema = z.url().superRefine((value, context) => {
  const url = new URL(value);
  if (url.protocol !== 'https:') context.addIssue({ code: 'custom', message: 'Story destination must use HTTPS', input: value });
  if (url.username || url.password) context.addIssue({ code: 'custom', message: 'Story destination must not contain credentials', input: value });
});
```

Add `destination_url: externalDestinationSchema.optional()` to `storyFields`. Implement helpers by returning `articlePath(story.slug)` for internal stories and the already validated external string otherwise.

- [ ] **Step 4: Regenerate the checked-in schema and rerun focused tests**

Run: `npm run generate:schema && npm test -- tests/unit/schema.test.ts tests/unit/routes.test.ts`  
Expected: PASS; generated JSON Schema exposes the optional field and HTTPS refinement description.

- [ ] **Step 5: Commit the contract**

```bash
git add src/lib/schema.ts src/lib/routes.ts tests/unit/schema.test.ts tests/unit/routes.test.ts public/schema/edition.schema.json
git commit -m "feat(content): add external story destinations"
```

### Task 2: Apply destinations to reader surfaces

**Files:**
- Create: `src/components/StoryDestinationLabel.astro`
- Modify: `src/components/LeadStory.astro`
- Modify: `src/components/StoryCard.astro`
- Modify: `src/pages/article/[slug].astro`
- Modify: `src/pages/cve/[cve].astro`
- Modify: `src/styles/global.css`
- Modify: `src/styles/article.css`
- Modify: `tests/e2e/edition.spec.ts`
- Modify: `tests/e2e/reading.spec.ts`

**Interfaces:**
- Consumes: `storyDestination`, `storyIdentityPath`, and `isExternalStory` from Task 1.
- Produces: consistent current-tab external links, `External research ↗` cue, research lead layout, and internal provenance page.

- [ ] **Step 1: Add browser assertions for external and internal stories**

Use a fixture external research story with `https://example.com/research-paper`. Assert its lead/card/filtered/related link has that exact `href`, no `target`, and visible `External research ↗` text. Assert an ordinary story retains `/article/<slug>`. Direct navigation to the internal route must expose `Read original research ↗` and the source metadata.

- [ ] **Step 2: Run the focused browser tests and confirm failure**

Run: `npm run build:fixture && npm run test:e2e -- tests/e2e/edition.spec.ts tests/e2e/reading.spec.ts`  
Expected: FAIL because the fixture and components still use internal destinations.

- [ ] **Step 3: Implement shared link labeling and content-aware lead markup**

`StoryDestinationLabel.astro` derives its text from story type/category and renders only for external stories. `LeadStory.astro` uses `storyDestination(story)` and, for an external research story, replaces the vulnerability SVG with a typographic source panel containing source name, paper version/title context, source publication date when available, and `Read the paper ↗`. Other leads keep the existing supported treatment.

- [ ] **Step 4: Implement cards, related coverage, CVE coverage, and provenance**

Use `storyDestination` for every reader-facing story anchor. On `/article/[slug]`, keep the internal canonical URL and show the TSD summary, rationale/action, exact source link, retrieval date, review state, and primary external CTA. Do not render source text or imagery. Preserve internal article rendering for stories without a destination.

- [ ] **Step 5: Style with existing tokens and verify responsive behavior**

Add square, ruled external-research treatments using `--paper`, `--surface`, `--ink`, `--muted`, `--rule`, and `--accent`. Keep touch targets, focus rings, current-tab behavior, and 320px containment.

- [ ] **Step 6: Rerun focused browser tests and commit**

Run: `npm run build:fixture && npm run test:e2e -- tests/e2e/edition.spec.ts tests/e2e/reading.spec.ts`  
Expected: PASS for internal and external navigation, provenance, keyboard-visible anchors, and no horizontal overflow.

```bash
git add src/components/StoryDestinationLabel.astro src/components/LeadStory.astro src/components/StoryCard.astro 'src/pages/article/[slug].astro' 'src/pages/cve/[cve].astro' src/styles/global.css src/styles/article.css tests/e2e/edition.spec.ts tests/e2e/reading.spec.ts data/fixtures/editions/2026-09-26.json
git commit -m "feat(reader): render external research destinations"
```

### Task 3: Preserve feed identity and update newsletter destinations

**Files:**
- Modify: `src/lib/feeds.ts`
- Modify: `src/pages/feed.json.ts`
- Modify: `src/lib/newsletter.ts`
- Modify: `tests/unit/feeds.test.ts`
- Modify: `tests/unit/newsletter.test.ts`

**Interfaces:**
- Consumes: `storyIdentityPath` and `storyDestination` from Task 1.
- Produces: RSS external `<link>` plus internal `<guid>`; JSON Feed external `url` plus internal `id`; Markdown/newsletter external links.

- [ ] **Step 1: Write failing serialization tests**

Build one internal and one external story and assert:

```ts
expect(rss).toContain('<link>https://example.com/research-paper</link>');
expect(rss).toContain('<guid>https://tsd.report/article/external-paper</guid>');
expect(json.items[0]).toMatchObject({
  id: 'https://tsd.report/article/external-paper',
  url: 'https://example.com/research-paper',
});
expect(digest.lead.url).toBe('https://example.com/research-paper');
```

- [ ] **Step 2: Run tests and confirm identity/destination failures**

Run: `npm test -- tests/unit/feeds.test.ts tests/unit/newsletter.test.ts`  
Expected: FAIL because all links currently use the internal article route.

- [ ] **Step 3: Implement shared serialization semantics**

Expand the feed story type to include `destination_url`. Resolve absolute external destinations directly; resolve internal identity/destination paths against `https://tsd.report`. Keep XML/Markdown/HTML escaping. In newsletters, external story URLs ignore the preview origin while internal story paths use the configured origin; edition and policy links remain at the configured origin.

- [ ] **Step 4: Rerun tests and commit**

Run: `npm test -- tests/unit/feeds.test.ts tests/unit/newsletter.test.ts tests/unit/newsletter-send.test.ts`  
Expected: PASS, including deterministic escaping and existing no-send behavior.

```bash
git add src/lib/feeds.ts src/pages/feed.json.ts src/lib/newsletter.ts tests/unit/feeds.test.ts tests/unit/newsletter.test.ts
git commit -m "feat(feeds): separate story identity from destination"
```

### Task 4: Document reusable authoring and reconcile architecture

**Files:**
- Modify: `docs/editorial/authoring-guide.md`
- Modify: `docs/editorial/content-recipes.md`
- Modify: `docs/editorial/templates/story.json`
- Modify: `docs/superpowers/specs/2026-09-26-tsd-design.md`
- Modify: `docs/superpowers/specs/2026-09-30-tsd-buttondown-newsletter-design.md`
- Modify: `docs/superpowers/plans/2026-09-26-tsd-delivery.md`

**Interfaces:**
- Consumes: verified behavior from Tasks 1–3.
- Produces: author instructions that distinguish internal identity, external destination, source attribution, lead suitability, and newsletter behavior.

- [ ] **Step 1: Update authoring examples and architecture wording**

Document this exact reusable rule: omit `destination_url` for TSD-hosted stories; use an absolute HTTPS URL for curated external originals; always retain source metadata and an internal slug; never use the field to bypass attribution or review. Replace newsletter claims that every click uses `/article/[slug]` with the internal identity/external destination split.

- [ ] **Step 2: Record implementation evidence in the delivery ledger**

Add a dated milestone entry with actual changed paths and verification results. State explicitly that feature implementation does not authorize the GenRec production record, deployment, or email delivery.

- [ ] **Step 3: Validate documentation and commit**

Run: `git diff --check && rg -n "destination_url|story identity|external destination" docs/editorial docs/superpowers/specs`  
Expected: no whitespace errors; authoring and architecture documents contain the reconciled model.

```bash
git add docs/editorial/authoring-guide.md docs/editorial/content-recipes.md docs/editorial/templates/story.json docs/superpowers/specs/2026-09-26-tsd-design.md docs/superpowers/specs/2026-09-30-tsd-buttondown-newsletter-design.md docs/superpowers/plans/2026-09-26-tsd-delivery.md
git commit -m "docs: explain external story authoring"
```

### Task 5: Prepare and review the GenRec production edition

**Files:**
- Create after exact-copy approval: `data/production/editions/2026-10-02.json`
- Modify after verification: `docs/superpowers/plans/2026-09-26-tsd-delivery.md`
- Local review artifact: `/private/tmp/tsd-genrec-editorial-review.md`

**Interfaces:**
- Consumes: official arXiv v2 source, production story contract, external reader surfaces, and real user approval.
- Produces: a reviewed production edition whose lead destination is `https://arxiv.org/html/2608.10257v2`.

- [ ] **Step 1: Draft source-backed copy outside the production corpus**

Record the exact title, source URL, arXiv version/date, a concise original summary, why it matters, a reading action, affected technology labels, tags, editorial signal, source retrieval timestamp, and proposed newsletter omission in `/private/tmp/tsd-genrec-editorial-review.md`. Do not add `reviewed_by` or `reviewed_at` yet.

- [ ] **Step 2: Complete feature verification before requesting editorial approval**

Run: `npm run check && npm test && npm run validate:fixture && npm run build:fixture && npm run check:links`  
Expected: zero diagnostics, all unit tests pass, fixtures validate/build, internal links pass.

- [ ] **Step 3: Request approval of the exact draft**

Present the complete draft to the user. Approval must cover the exact headline, summary, rationale, action, signal, section placement, and visible source attribution. Record the actual UTC approval time only after that response.

- [ ] **Step 4: Add the approved edition and verify production**

Create `data/production/editions/2026-10-02.json` using the approved text, exact arXiv URL, `status: "published"`, real reviewer, and real approval time. Omit `newsletter` metadata. Then run:

```bash
npm run validate:production
npm run build:production
npm run check:links
```

Expected: two production editions validate; the latest homepage is 2026-10-02; GenRec appears on the homepage/date/archive/research/tag/feed surfaces; its normal links point to arXiv; its internal provenance route is generated; no newsletter is eligible to send.

- [ ] **Step 5: Perform the visual matrix and commit content**

Use Playwright against the generated production preview at 320, 390, 768, 1024, and 1440px in light and dark themes. Inspect the homepage lead and provenance page for overflow, focus, source clarity, misleading security framing, and absence of copied artwork. Save captures and a manifest under `/private/tmp/tsd-genrec-review/`.

```bash
git add data/production/editions/2026-10-02.json docs/superpowers/plans/2026-09-26-tsd-delivery.md
git commit -m "content: feature GenRec research paper"
```

### Task 6: Final verification and pull request

**Files:**
- Modify: `docs/superpowers/plans/2026-09-26-tsd-delivery.md` only if final evidence differs from Task 5.

**Interfaces:**
- Consumes: all feature and approved content commits.
- Produces: a pushed `feat/external-story-destinations` branch and a new GitHub pull request based on merged `main`.

- [ ] **Step 1: Run final gates once**

```bash
npm run check
npm test
npm run validate:fixture
npm run build:fixture
npm run check:links
npm run validate:production
npm run build:production
npm run check:links
git diff --check origin/main...HEAD
```

Expected: all commands pass; fixture and production artifacts stay separated; production includes no newsletter approval for GenRec.

- [ ] **Step 2: Review branch scope**

Run: `git status --short && git log --oneline origin/main..HEAD && git diff --stat origin/main...HEAD`  
Expected: clean tree; only the approved design, implementation plan, feature, documentation, tests, and reviewed content are present.

- [ ] **Step 3: Push and open the PR**

Push `feat/external-story-destinations`, then create a pull request targeting `main`. The PR body must summarize identity/destination behavior, the GenRec content review record, test and visual evidence, and state that merge does not authorize deployment or newsletter delivery.

