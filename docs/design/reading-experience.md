# The Security Diff — reading experience

Date: 2026-09-27
Status: implemented locally and verified on 2026-09-27; pending editorial review and deployment.
Confirmed direction: quiet technical essays with contextual diagrams. The user also requested two representative reading samples.

References: [product specification](../../the-security-diff-implementation-spec.md), [design baseline](../superpowers/specs/2026-09-26-tsd-design.md), [delivery plan](../superpowers/plans/2026-09-26-tsd-delivery.md), [typography decision](typography-comparison.md), and [editorial seeds](../editorial/editorial-seed-rationale.md).

## 1. The experience we want

Opening an article should feel like settling into a well-edited technical essay. The reader encounters a clear question, follows an explanation, examines evidence when needed, and reaches a useful conclusion. The publication's identity remains recognizable while the story receives the strongest emphasis.

The audience includes security engineers reading between tasks, readers studying an original article closely, and responders looking for a supported action. Support those different reading speeds through content structure, rather than requiring a reader-mode switch.

The defining TSD feature is **evidence available without losing your place**. A source note sits near the passage it supports, with clear source dates and a path back to the sentence. Technical figures appear where the explanation needs them. Reading remains continuous and usable without JavaScript.

This is a shared reading-system design covering article, original-writing, CVE, and editorial-information pages. Archive/category/tag pages inherit the quieter navigation and typography but retain their browsing purpose.

## 2. Diagnosis of the current page

These observations come from the supplied screenshot and the current source files, not a new browser conformance audit.

- The full edition header repeats the homepage masthead, edition date, and story count on article pages. It consumes attention before the article begins; the date is obtained from the latest edition even when the reader opens older coverage.
- The large article headline competes with the nameplate, while the body and evidence text receive much less emphasis. On the supplied viewport, a short article presents a long entrance before the narrative.
- Every article begins with the same boxed “Why it matters / What to do” treatment. Original writing, explainers, and incident briefs therefore inherit the same rhythm regardless of their purpose.
- The fixture body has only two short paragraphs. Large panels around a small amount of prose cannot demonstrate sustained reading.
- The article body has larger reading typography, but the summary/evidence panels inherit smaller default text. Their content is still important enough to deserve comfortable reading sizes.
- The global article `h2` margin also affects headings inside panels, contributing to oversized internal gaps such as the Vulnerabilities block.
- `src/lib/articles.ts` splits Markdown into plain paragraphs. It does not yet render semantic section headings, lists, figures, code blocks, or footnotes.
- `EditionHeader` and the article template both emit an `h1`. The new reading header should use a brand link, leaving the article title as the page's primary heading.
- The visible grain supports the newspaper identity, but its intensity should be evaluated separately for long reading surfaces and outer paper margins.

The next pass should establish content rhythm, hierarchy, and evidence navigation together. Keep the selected Newsreader and blackletter faces; another font-selection round is unnecessary for this work.

## 3. Reference lessons

These are structural references, not assets or page designs to copy.

| Reference | Useful quality | Application to TSD |
| --- | --- | --- |
| [Tailscale: How NAT traversal works](https://tailscale.com/blog/how-nat-traversal-works) | An explanation develops through intermediate problems and diagrams | Introduce a trust boundary in prose, illustrate it, then explain the consequence |
| [Julia Evans: What happens when you press a key in your terminal?](https://jvns.ca/blog/2022/07/20/pseudoterminals/) | A concrete question leads to small experiments and observations | Make original articles feel like an engineer guiding the reader through evidence |
| [Distill: Feature Visualization](https://distill.pub/2017/feature-visualization/) | Figures, technical explanation, references, and limitations form one argument | Place evidence and illustrations at their point of use; make optional depth easy to explore |

Original prose and static figures are sufficient for the initial delivery. Add an interactive explanation only when manipulating it teaches something a static figure cannot communicate clearly.

## 4. One visual family, three reading structures

“Lead story” is homepage placement, not a separate article type. The same canonical article should retain its structure when it stops being the lead. All story types continue to use `/article/[slug]`.

| Structure | Used for | Reading sequence |
| --- | --- | --- |
| Essay | Original writing, substantial explainers, research commentary | Opening question → argument → examples/figures → limitations → conclusion → references |
| Brief | Concise news, vulnerability/advisory coverage, short incident updates | What changed → scope and dated evidence → explanation → supported action → sources |
| Reference | `/cve/[cve]` | Identifier and as-of date → independently labeled facts → affected/fixed information → sources/conflicts → coverage |

Research and incident essays can use the essay structure with appropriate sections such as methodology or timeline. Avoid forcing their content into a fixed number of blocks.

About and editorial-policy pages use the essay typography and compact header, without fabricated author metadata or unnecessary contents controls. Archive/category/tag pages remain compact lists rather than adopting essay panels.

Use the current type and actual content structure to establish defaults. A validated presentation override may be added to repository-authored article metadata when needed; do not infer length or presentation from homepage rank or title wording. Any new field must have backward-compatible behavior for existing fixtures and a documented contract.

## 5. The reading journey

### Arrival: compact publication identity

- Use a small blackletter nameplate, a clearly labeled edition/archive return link, and the existing theme control in a restrained header.
- Keep the large masthead on edition pages. On reading pages, the brand is a link rather than a heading.
- Omit the homepage story count and latest-edition date from the reading header. Article publication date, actual update date, and evidence dates belong to the article and must remain distinct.
- Preserve a prominent fixture-preview notice. Its presence must not depend on JavaScript or scroll position.
- Use ordinary navigation and browser scroll restoration. A direct visitor gets a valid edition/archive destination; a contextual return link must refer to a validated edition containing the story and must not change the canonical URL.
- Keep the header in normal document flow initially. A sticky navigation bar is not needed to make the article readable and would consume scarce mobile space.

### Opening: make the promise clear

The article opening contains a restrained category/type label, headline, short deck, and compact attribution/date line. Show a byline only when available and accurately attributed. Display an updated timestamp only when there was a real update; link to a correction note when one exists.

Give the title a wider measure than the prose where useful, and adjust its size so it does not overwhelm the body. Natural wrapping takes precedence over forced line breaks. Reading time is optional; if included, derive it from the actual rendered body and label it as an estimate. Do not display a long reading estimate for a two-paragraph seed.

An essay starts with its first paragraph after this opening. A brief may place a short supported-action summary near the top. Avoid repeating the same summary in the deck, a panel, and the opening paragraph.

### Middle: continuous prose with purposeful changes of pace

Use a stable prose column with section headings, paragraphs, selective lists, examples, and figures. A figure follows the question it answers. Captions explain what the reader should notice and distinguish an illustrative model from an observed result.

Support three related widths:

1. **Prose:** comfortable sustained reading, approximately 60–68 characters per line.
2. **Title and larger figures:** modestly wider where needed, without widening paragraphs.
3. **Evidence notes:** a narrow adjacent area on wide screens, flowing after the relevant passage on smaller screens.

This provides visual rhythm without turning every section into a box. Reserve tinted surfaces for meaningful distinctions such as a short decision summary or a worked example. Do not enforce a diagram, quotation, or callout every fixed number of paragraphs.

### Evidence at the point of use

- Give claims normal, keyboard-accessible numbered source links with stable anchors.
- On wide screens, show selected short source notes beside their associated section. Notes should identify the source, relevant date, and what it supports.
- On phones and at high zoom, notes follow the associated passage or section in normal reading order. Optional explanatory detail may use native `details`; the source link and decision-relevant uncertainty stay visible.
- Maintain a complete references section and return links to citing passages. A source used in several places needs an unambiguous way back to each reference.
- Essential qualifications, unknowns, and conflicting evidence remain in the main flow. A reader must not have to discover a hover interaction to understand a claim's limits.
- Do not create a permanent dashboard sidebar. Margin notes accompany individual passages, remain sparse, and yield to prose when width is insufficient.

Initial interaction uses anchors and native disclosures. Hover popovers, source drawers, and complicated scroll synchronization are deferred until a demonstrated reading problem warrants them.

### Ending: a deliberate close

End the argument before ancillary material. An essay gets a conclusion; a brief gets supported next steps and their limits. Then show references, actual correction history if any, and at most two or three existing related articles with a short explanation of relevance.

Use editorially selected existing story IDs for related coverage. Hide the section when nothing useful is available. Finish with a return-to-edition/archive link. Avoid a large card wall or automatic loading of another article.

## 6. Proposed layout

```text
Fixture preview notice
Small TSD nameplate       Return to edition / Archive       Theme
────────────────────────────────────────────────────────────────

              Type · Topic
              Article title with a natural reading measure
              A brief statement of the question or promise
              Attribution · Published · Updated, if applicable

              Opening paragraph
              Narrative continues at a stable prose width

              Section heading                 Source note
              Explanation                     Name · date
              Explanation                     What it supports

          ┌── Wider original technical figure ─────────┐
          └── Caption and text equivalent ─────────────┘

              Narrative resumes at the same measure
              Worked example / code when useful
              Limits and conclusion

              References with return links
              Relevant next reading · Return to edition
```

The diagram describes hierarchy, not fixed positioning. On mobile, the title, prose, figures, and notes form one continuous column with local scrolling only for genuinely wide code or tables.

## 7. Typography, paper, and navigation details

Use the current font assets and shared palette. Define any reading-specific tokens centrally rather than scattering new values among components. Proposed starting values to validate in the composition:

| Element | Starting treatment |
| --- | --- |
| Reader nameplate | Approximately 26–36px, preserving legibility of the fixed brand text |
| Article title | Approximately 36–44px on phones and 48–64px on desktop; 1.05–1.12 leading |
| Main prose | 18–20px Newsreader Text; 1.6–1.7 leading; maximum 68ch |
| Deck | Slightly larger than prose, limited to a short introductory statement |
| Source notes/captions | Approximately 14–16px with adequate contrast; never the only location of essential facts |
| Sections | Clear size/weight distinction with more space before than after; no oversized inherited panel margins |
| Code | System monospace, copyable text, contained overflow, a meaningful caption/context |

Keep paper texture understated in the reading column and more visible in the surrounding sheet. Prototype a quieter reader-surface texture without silently changing the selected homepage treatment. Preserve the existing high-contrast, forced-color, and print fallbacks.

For articles with at least four meaningful sections, provide a compact “In this article” disclosure near the opening. Generate it from actual headings, use stable section anchors, and omit it for short pieces. It must work without JavaScript. A full-height sticky contents sidebar and reading-progress decoration are not part of the first pass.

Let browser zoom, text selection, find-in-page, and native reader facilities work normally. Provide print styles that preserve the title, content, captions, and sources. Add optional controls only when they solve an observed need; the default page should already be comfortable to read.

## 8. Two representative samples

Both remain clearly labeled previews. Length ranges guide realistic layout testing; do not pad an article to reach a target. Adding source links is not proof of review, and no test result, reviewer identity, or historical fact may be invented.

### Sample A: original technical essay

**Seed:** “Agent tool boundaries belong in the architecture, not only in the prompt.”
**Route:** `/article/agent-tool-boundaries`.
**Target:** approximately 1,200–1,800 words of coherent preview copy, with sources and limitations.

Proposed narrative:

1. Open with a clearly hypothetical agent task that crosses an authorization boundary.
2. Explain the distinction between an instruction and an enforceable capability.
3. Walk through a capability map for a shell, repository, and external tool.
4. Introduce an original diagram at the point where the trust boundary matters.
5. Show a small illustrative policy/code example, clearly distinguished from a tested implementation.
6. Explain failure modes and what telemetry would be required to investigate them.
7. Close with practical design questions and limits.

The sample should exercise section navigation, paragraphs, a list, a figure/caption, code, emphasis, and source references. It must read as one essay rather than a component showcase. Confirm attribution for expanded copy; do not silently present newly generated prose as reviewed writing by the existing named author.

### Sample B: historical security brief

**Seed:** “Patching the edge starts with knowing which evidence changed.”
**Route:** `/article/patching-the-edge`.
**Target:** approximately 450–700 words, using historical evidence with an explicit as-of context.

Proposed sequence:

1. State the historical scope and reader decision.
2. Separate known vendor facts from unknown deployment information.
3. Explain how an inventory/reachability check changes the decision.
4. Show one compact evidence-to-action figure or table.
5. State supported next steps and remaining uncertainties.
6. Link claim-specific references and the existing CVE page.

Recheck Apache version-range semantics and obtain appropriate CISA evidence before repeating existing fixture exploitation/KEV claims as sourced facts. Where sufficient historical evidence is unavailable, state the gap and use clearly hypothetical decision inputs rather than inventing a timeline. Preserve the distinction between historical initial fixes and present-day remediation advice.

### Storage and fixture integrity

Draft sample bodies and their evidence under `design-explorations/reading-experience/` for the comparison. Do not rewrite archived JSON edition snapshots to make the design sample longer. During integration, move approved preview bodies into validated repository content with stable links to the existing story IDs and explicit fixture status. The existing Markdown agent sample is replaced only as an intentional, documented preview-content change.

## 9. Content and implementation boundaries

The current paragraph splitter is a substantive limitation. Use Astro's supported Markdown rendering and validated content facilities for repository-authored articles. Astro documents [Markdown rendering and heading IDs](https://docs.astro.build/en/guides/markdown-content/) and [content collections](https://docs.astro.build/en/guides/content-collections/). Confirm the exact APIs against the installed version before implementation.

The implementation should:

- Keep `/article/[slug]` stable and use one validated story index for routes and metadata.
- Render trusted local Markdown as semantic headings, paragraphs, lists, links, figures, code, and references; retain a plain-paragraph fallback for existing JSON briefs.
- Make title, slug, publication metadata, and fixture status consistent between content and story data. Fail on collisions or unexplained mismatches instead of silently choosing a different title.
- Model citation references explicitly: stable reference ID, source ID, claim/section association, and available dates. Validate missing sources, unsafe URL schemes, duplicate IDs, and broken return targets at build time.
- Keep source text and imported summaries as data. Do not render arbitrary external HTML or turn external content into executable MDX.
- Use native Markdown/static components first. Add an MDX integration only if a required authored component cannot be expressed adequately through the simpler route; explain any dependency and pin it.
- Show author, dates, unknowns, and corrections only from validated content. Do not fabricate review status to complete a layout.
- Preserve static output, fixture rejection, noindex, and the existing font/JavaScript budgets. No browser intelligence fetching or reading backend is needed.

This supplies the reading portion of Milestone A7 and a bounded part of the richer authoring capability anticipated in Milestone E. It does not complete author profiles, review workflows, corrections infrastructure, ingestion, or production publishing.

## 10. Delivery sequence

The implementation tasks below were completed inline while preserving the existing uncommitted Milestone A work.

### R1 — Establish the two reading samples and visual comparison

**Primary paths:** `design-explorations/reading-experience/`, this document.

- [x] Draft the two preview bodies with claim/source notes, explicit unknowns, and confirmed attribution.
- [x] Produce desktop and mobile compositions covering the opening, middle, and ending of each sample, plus a dark version of each.
- [x] Compare the supplied current page with the proposed compact header, narrative flow, and evidence-note behavior.
- [x] Record selected proportions, texture treatment, citation behavior, and any deviations in the design baseline.

**Review outcome:** a reader can understand the promise, follow the story, consult evidence, and return to the text. Choose the composition before changing shared application templates.

### R2 — Build the reading shell and semantic content path

**Expected create:** `src/components/ReaderHeader.astro`, `src/layouts/ArticleLayout.astro`, `src/components/ArticleBody.astro`, `src/styles/article.css`, content collection configuration appropriate to the installed Astro version.
**Expected modify:** `src/lib/articles.ts`, `src/pages/article/[slug].astro`, `src/layouts/BaseLayout.astro`, and only the required shared tokens in `src/styles/global.css`. Metadata validation changes belong in the content schema/loader, with schema regeneration if the serialized contract changes.

- [x] Introduce the compact header and one-primary-heading article layout without changing the edition header.
- [x] Replace the plain-text Markdown parsing path while retaining JSON body compatibility.
- [x] Render semantic headings, lists, figures, code, emphasis, and paragraph rhythm.
- [x] Validate metadata and fixture boundaries; keep sample routing stable.

**Verification:** content-level tests for metadata consistency, duplicate slugs, fallback bodies, and fixture rejection; generated-preview tests for semantic article structure and a single page `h1`. Do not preserve the old parser test merely because it mirrors the discarded implementation.

### R3 — Add evidence navigation and essay/brief composition

**Expected create:** `src/components/ArticleReferences.astro`, `src/components/ArticleContents.astro`, `src/components/ArticleFigure.astro`; a focused evidence-note component if needed.
**Expected modify:** article content schema, article styles, sample content, and tests.

- [x] Add validated citation anchors, source notes, full references, and return links.
- [x] Use sparse section-aligned margin notes at widths that support them, and inline flow on smaller screens.
- [x] Add a generated contents disclosure only to sufficiently sectioned articles.
- [x] Give essays a narrative opening and briefs a compact decision-oriented opening.
- [x] Add related reading only when validated editorial selections exist.

**Verification:** follow every citation and return link by keyboard, with JavaScript disabled, at narrow widths, and at 200% zoom. Confirm notes do not collide, disappear, or change the intended reading order.

### R4 — Extend the family to reference and secondary pages

**Expected modify:** `src/pages/cve/[cve].astro`, `about.astro`, `editorial-policy.astro`, `archive.astro`, `category/[category].astro`, `tag/[tag].astro`, and `404.astro` where the shared header applies.

- [x] Present CVE facts in a semantic definition list/table with independent labels, evidence dates, explicit unknowns, sources, and coverage links.
- [x] Do not collapse CVSS, EPSS probability/percentile, KEV, and known exploitation into a single severity badge.
- [x] Apply essay rhythm to editorial information pages and browsing rhythm to archive/category/tag pages.
- [x] Handle short bodies, missing bylines, missing figures, absent related stories, and empty lists naturally.

**Verification:** article → CVE → coverage and article → edition/archive journeys; no misleading latest-edition metadata on older articles. Do not assert claim-level provenance where the current data has not supplied it.

### R5 — Complete reading and regression checks

**Expected test paths:** `tests/unit/articles.test.ts`, focused content/schema tests, `tests/e2e/reading.spec.ts`, and relevant existing accessibility/route tests.
**Documentation:** update the design baseline and delivery ledger with actual paths, commands, screenshots, deviations, and remaining limitations.

- [x] Validate the matrix below against a generated fixture build.
- [x] Review both full sample narratives, not just their opening screens.
- [x] Run the type/unit/content/build/link/browser gates and confirm production fixture rejection.
- [x] Check loaded font/asset bytes and layout behavior after introducing the smaller header, figures, and richer Markdown.
- [x] Confirm homepage layout, filters, and theme persistence retain their existing behavior.

No milestone is marked complete until its evidence is recorded.

## 11. Acceptance and visual evidence

### Reading checks

- The article title is the page's primary heading, and the publication header does not visually dominate it.
- An essay reaches actual narrative after its headline, deck, and metadata without a stack of mandatory panels.
- Short briefs remain short; missing prose is not disguised by large empty surfaces.
- Prose stays comfortably readable and within the design's maximum measure. Figures can widen without widening paragraphs.
- Sources are reachable and returnable; critical qualifications remain visible in the main text.
- Contents links and citations work without JavaScript. Keyboard focus and anchor targets remain visible.
- Original writing, research commentary, historical fixtures, and advisory facts are labeled accurately.
- Related reading and contextual return destinations exist and are relevant.
- The end of an article feels complete rather than becoming an unrelated feed.

### Viewports and states

Capture both samples and the CVE reference page at 320, 390, 768, 1024, and 1440px in both themes. Inspect opening, middle, and ending. Include the supplied screenshot's approximately 1069px-wide composition as an additional desktop check; confirm the actual browser CSS viewport before treating image width as a viewport measurement.

Check the longest current headline, a short fixture, a missing author, unknown intelligence values, long source URLs, code/table overflow, and a page without section headings. Verify 200% zoom, effective 320px reflow, reduced motion, forced colors, print, and blocked font loading. Inspect representative archive/category/tag and editorial-information routes at mobile and desktop widths.

Save local captures and a manifest under `/private/tmp/tsd-reading-experience/{before,after}/`, recording route, sample version, viewport, theme, browser, zoom, and revision. Do not include browser chrome. Visual review covers composition and reading order; screenshots and automated checks alone do not establish accessibility conformance or reader immersion.

Use a short human reading exercise on the samples: identify the article's question, explain one key boundary, open a supporting source and return, then locate the practical next step. Record the difficulties observed. These outcomes are more useful than another generic design score.

### Commands during implementation

```sh
npm run check
npm test
CONTENT_MODE=fixture npm run validate:content
CONTENT_MODE=fixture npm run build
npm run check:links
npm run test:e2e
```

Use Playwright against the generated preview. After browser checks, `CONTENT_MODE=production npm run build` must reject remaining fixture content with the expected message; unrelated failures do not count. Rebuild the fixture output before any further preview inspection. Run the Impeccable detector once for the changed UI and record findings or the specific reason it could not run.

## 12. Scope of this planning pass

Confirmed and implemented locally: quiet technical essays, contextual diagrams, and two representative preview samples. No publication state was changed and no deployment was performed.

## 13. Implementation record

The selected system uses Astro's native content collection and Markdown rendering. Native footnotes provide stable citation and backlink anchors without JavaScript; the generated section is labeled “Footnotes” by the renderer. The two representative samples add four sparse, authored evidence notes next to their supporting passages at wide widths and in normal document flow below 1160px. Full references remain at the end, so the margin notes are an aid rather than the only evidence path.

The essay contains approximately 1,174 narrative words, six meaningful sections, an original contextual diagram, a code example, two references, limitations, and a conclusion. The historical brief contains approximately 528 narrative words, three sections, a decision diagram, two references, explicit provenance gaps, and supported next steps. Both are labeled unreviewed fixtures; the essay credit is “Editorial prototype,” and neither sample invents an author identity.

The reading shell uses one page `h1`, a compact blackletter brand link, a contextual edition/archive return, a 68-character prose measure, wider figures, a native contents disclosure for articles with at least four meaningful sections, and a short-article fallback for JSON fixtures. CVE facts use a semantic definition list. About and editorial-policy pages use the reading rhythm; archive, category, tag, 404, and other browsing views use the compact browsing shell.

Verification on 2026-09-27: Astro/TypeScript reported zero diagnostics; 19 unit tests and 34 Chromium journeys passed; fixture content validation covered 3 editions and 17 entries; 61 static pages built; internal links passed; the Impeccable detector returned `[]`; `git diff --check` passed; and a production-mode build failed with the required `Production builds reject fixture content` message. Browser tests cover citation/backlink keyboard navigation without JavaScript, evidence-note reflow, short fallback content, print, forced colors, reduced motion, blocked fonts, theme persistence, filtering, and responsive column thresholds.

Visual evidence is under `/private/tmp/tsd-reading-experience/`. The `after` manifest contains 36 full-page captures covering essay, brief, and CVE views at 320, 390, 768, 1024, 1069, and 1440px in both themes. Every capture loaded its fonts and reported zero page overflow. The `before` folder preserves the prior desktop dark and mobile light article compositions. Existing local font and texture assets total 238,087 bytes; this pass added no new font or texture asset.

Deliberate limits: rich Markdown is currently authored for the two representative samples while existing JSON stories retain the compatible fallback. Evidence notes are intentionally authored at the supported passage instead of being inferred from reference metadata. Native renderer wording is retained rather than adding a custom footnote transformation dependency. The short human comprehension exercise remains a reader-review activity; automated tests and screenshots do not claim to measure comprehension or accessibility conformance.
