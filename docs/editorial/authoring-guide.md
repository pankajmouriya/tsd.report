# Authoring The Security Diff

Start here when adding a brief, choosing a lead, writing an essay, or preparing an agent-assisted draft. You should customize content, not rebuild a page.

The fixture workflow was verified on 2026-09-28; newsletter authoring instructions were added on 2026-09-30. These templates prepare **fixture previews** under the fixture directories. The separate production corpus now contains the reviewed 2026-09-29 edition; see [content environments](../design/content-environments.md) for genuine production authoring. Keep `fixture: true` in the fixture workflow; removing it does not promote a fixture.

## 1. Choose your starting point

| What you want | Copy/use | What determines its presentation |
| --- | --- | --- |
| Short security brief | [story.json](templates/story.json) | JSON paragraphs; `news`, `advisory`, `cve`, `incident`, or `tool` as appropriate |
| Brief with sections and citations | Story JSON + [brief.md](templates/brief.md) | Markdown `structure: brief` |
| Original essay, explainer, research analysis | Story JSON + [essay.md](templates/essay.md) | Markdown `structure: essay`; select the correct story type |
| Lead story | Any suitable story + edition `lead_story` | Homepage placement; not a new type or route |
| New edition | [edition.json](templates/edition.json) | Date, lead ID, ordered section IDs, story records |
| A different editorial angle | [Content recipes](content-recipes.md) | Suggested questions and sections for all eight supported types |
| AI-assisted draft | [Agent workflow](agent-workflow.md) + [assignment](templates/agent-assignment.md) | Evidence-constrained draft; editor/integrator owns facts and placement |

The JSON templates are **schema-valid synthetic examples**, not current reporting. Their sample date, source, score, and prose demonstrate the shape only. `example.com` is an intentional placeholder, not evidence. The Markdown examples share the JSON story's identity so either one can be tried with it; choose one, never load both for the same story.

## 2. The mental model

```text
Edition JSON
  stories[]       → story identity, metadata, summary, facts, fallback body
  lead_story      → one story ID
  sections        → ordered story IDs for the rest of the edition

Optional Markdown → richer body, structure, references, related reading
                    matched to JSON by story_id + slug + title

One canonical page: /article/<slug>
```

JSON owns the headline, deck (`summary`), dates, category, signal, and intelligence. Markdown supplies the full article body when present. Keep a useful JSON `body` fallback even when adding Markdown: feeds and other consumers may use the story record rather than the rendered essay. Do not maintain contradictory claims in the two bodies.

Current source of truth: [story/edition schema](../../src/lib/schema.ts), [Markdown schema](../../src/content.config.ts), [identity/citation validation](../../src/lib/articles.ts), [edition loader](../../src/lib/content.ts). The [exported edition schema](../../schemas/edition.schema.json) covers edition JSON, not Markdown or the proposed agent output.

## 3. Add a brief to a local preview

1. Copy [story.json](templates/story.json) into a working draft outside `content/fixtures/articles/`, for example `/private/tmp/tsd-editorial-drafts/my-story.json`. Files in the templates folder are not loaded into the site.
2. Replace its ID, slug, headline, timestamps, category, tags, prose, and sources. Keep its explicit preview status. Use a stable ID and a lowercase hyphenated slug. Never reuse an existing story's identity for unrelated reporting.
3. Use a real source you inspected for sourced reporting. Record its actual retrieval time and publication time when known. For a wholly synthetic layout example, keep the synthetic label and do not attach invented vendor/CVE claims.
4. Insert the complete object into `stories` in a deliberately editable preview edition under `data/fixtures/editions/`. For a new edition, follow section 5. Do not rewrite an archived snapshot just to change today's coverage.
5. Add the story ID once to the appropriate `sections` array unless it is the lead. Stories omitted from sections can still appear in filters, routes, and feeds while missing from the unfiltered homepage.
6. Run the checks in section 9, then read the homepage card and `/article/<slug>` in the preview.

An entry is a complete JSON object, not a separate auto-discovered story file. Keep normal JSON syntax: quoted keys, no comments, no trailing commas.

### Story fields you customize

| Fields | Meaning and authoring rule |
| --- | --- |
| `id`, `slug` | Stable identity and route; preserve them for the same story |
| `title` | Specific editorial promise; keep identical in Markdown frontmatter |
| `type` | `news`, `cve`, `research`, `original`, `incident`, `explainer`, `tool`, `advisory` |
| `category` | One of the seven IDs below; independent of type |
| `published_at`, `updated_at` | ISO UTC timestamps such as `2026-09-27T06:00:00Z`; updates only when real |
| `summary` | Concise deck/card summary; suggested 35–70 words, not an enforced quota |
| `why_it_matters` | Practical consequence for a specific reader; avoid repeating the deck |
| `action` | Supported next step and limits; “verify scope” is valid when facts remain unknown |
| `affected_technologies` | Relevant technology names; no invented affected version ranges |
| `tags` | Lowercase hyphenated tags; reuse existing spelling when possible |
| `sources` | At least one usable source for the current UI; primary evidence first |
| `signal` | Score 0–100, label `standard` / `recommended` / `must-read`, reasons; current fixtures are manually assigned, not a working ranking engine |
| `vulnerabilities` | Empty if none. Add records only with verified identifiers and evidence; see section 7 |
| `body` | Array of paragraphs, plain text; JSON strings do not render Markdown |
| `author` | Real, appropriate attribution or `null`; never assign a person's name to generated prose without agreement |
| `illustration` | Currently accepted metadata but **not used to select the lead artwork** |
| `fixture` | Must remain `true` in the fixture authoring workflow |

Category IDs: `vulnerabilities`, `supply-chain`, `ai-security`, `appsec`, `cloud`, `research`, `security-engineering`. See [taxonomy](../../config/taxonomy.json). Tags are not restricted to that category list.

Some defaults are permissive in the schema. In particular `sources: []` passes schema validation but the lead accesses `sources[0]`. Use at least one source; schema acceptance alone is not editorial acceptance.

## 4. Add a full reading page

1. Start with the same JSON story record.
2. Copy either Markdown template to `content/fixtures/articles/<slug>.md` only when ready to expose it in the local preview. Every `.md` file in this fixture collection is loaded; there is no draft-exclusion status yet.
3. Match `story_id`, `slug`, and `title` exactly to the JSON. Set `structure: brief` or `essay` independently of type. For example, an incident investigation can be an essay.
4. Keep `status: unreviewed-fixture`, `fixture: true`, and an honest `credit`. The schema accepts `reviewed-fixture`, but does not verify a real review record; do not use it as a shortcut.
5. Add references in frontmatter **and** matching inline citations and footnote definitions. An entry with ID `vendor-advisory` uses `[^vendor-advisory]` in prose and a definition at the end. Use the same source URL and dates in both places. JSON story sources should include the relevant primary sources too.
6. Set `related_story_ids` to zero through three existing IDs. Do not invent related articles to fill space.

### Customization without page code

- `##` section headings, paragraphs, lists, links, emphasis, blockquotes, code fences, and tables work through Markdown. Do not add another `#` title; the page already renders its `h1`.
- Four or more qualifying headings produce the existing contents disclosure. Short articles do not need an outline.
- Briefs show the JSON `action` near the opening. Essays start with their narrative. Avoid duplicating that action paragraph verbatim in the body.
- Endnotes are authored in Markdown. Frontmatter references are validated metadata; they do not automatically produce the rich article's full bibliography. Do not omit the footnote definitions.
- For local original/licensed artwork, use a reviewed `<figure class="article-figure">` with an image, useful alt text, dimensions, and `<figcaption>`. Put the asset in `public/images/` and reference it as `/images/<file>`. Keep licensing and factual basis with the draft.
- Optional source notes use the existing `evidence-note` pattern in [the historical brief](../../content/fixtures/articles/patching-the-edge.md). Essential caveats stay in prose. Custom HTML/SVG is trusted repository code and requires review; agent/source HTML must not be pasted through automatically.
- Raw Markdown does not import Astro components. Do not paste `<ArticleFigure>` into `.md` and assume it is a registered component. Current templates do not require MDX or new CSS.

The `cve` story type currently displays the fixed “Historical fixture” opening label. Other rich articles use `credit`. Changing `author` does not automatically change the rich article's credit. Check the homepage byline and article attribution together.

## 5. Create an edition and place stories

Copy [edition.json](templates/edition.json) to a new `data/fixtures/editions/YYYY-MM-DD.json` preview file. Customize its date and generation time, replace the sample story, then add the other stories and their section IDs.

The loader discovers JSON files under `data/fixtures/editions/`, validates them, and sorts them by date in descending order. The newest edition supplies `/` and `/today`. Check date navigation and archive ordering after adding a file.

For example, with already-defined story IDs:

```json
{
  "lead_story": "vendor-boundary-change",
  "sections": {
    "daily-report": ["new-library-advisory", "cloud-permission-update"],
    "from-the-editor": ["agent-boundary-essay"],
    "research": ["parser-research-note"]
  }
}
```

This is a placement fragment, not a complete edition. Every referenced ID must exist in `stories`. Section keys do not control the visible section headings: the current view flattens the arrays in insertion order, removes the lead/duplicate IDs, then groups by story type/category. `original` goes to From the Editor; `research` type or research category goes to Research Worth Reading; the rest goes to Security Briefs. Avoid `type: original` together with `category: research`: the current view can include it in both groups. Use a suitable non-research category for originals until that overlap is resolved.

Lead placement is independent of the signal label. “Must Read” does not automatically become the lead, and changing `lead_story` does not change its article URL.

### Current lead artwork limitation

[LeadStory.astro](../../src/components/LeadStory.astro) embeds a patch-decision diagram and fixture-specific caption. The `illustration` field does not replace it. An unrelated lead therefore needs a scoped component change to supply appropriate original artwork or omit the figure. Do not promote an unrelated story and leave misleading artwork attached. General per-story artwork selection is a future authoring improvement, not supported by these templates yet.

### Reuse and corrections

Use stable identity and consistent content when reusing a story across editions. The loader rejects repeated story IDs or slugs across the selected corpus because it is not yet a corrections/versioning system. Do not rely on a new edition to update an old article implicitly. Correction records and immutable publication snapshots need the later editorial/versioning implementation.

## 6. Source hygiene

For each source, record `id`, `name`, `url`, `type`, `retrieved_at`, and optional nullable `published_at`. Types are `vendor`, `government`, `research`, `community`, `editorial`. Use HTTP(S) URLs; prefer the primary advisory/research over commentary. Retrieval time means an actual fetch/review, not the time the agent wrote the draft.

Preserve a local evidence record using [evidence-record.json](templates/evidence-record.json). It is an authoring sidecar, **not a field the frontend currently consumes**. Store it with a working draft or evidence snapshot and preserve conflicts, available source data versions, and unknowns. The existing fixture manifest is a small source list, not a complete claim-level evidence archive.

## 7. Vulnerabilities and unknowns

Use the exact current `vulnerabilities` shape from [the schema](../../src/lib/schema.ts): `cve`, optional `ghsa`, `cvss`, `cvss_version`, `epss`, `epss_percentile`, `kev`, `exploitation`, `affected`, `fixed_versions`, `evidence_date`.

- Only real, verified CVE identifiers belong here. A synthetic scenario keeps `vulnerabilities: []`; the template deliberately contains no fabricated CVE.
- Scores/probabilities/KEV and dates can be `null`. EPSS probability and percentile both use 0–1, not percentage integers. `0` and `false` mean observed values, not missing data.
- `exploitation` is `confirmed`, `not-confirmed`, or `unknown`. Missing evidence is `unknown`; absence of a PoC is not proof of no exploitation.
- `affected` and `fixed_versions` are arrays in the current schema. Use `[]` when unavailable and explain the unknown in prose; never read an empty array as unaffected/no fix. Preserve vendor branch/range semantics.
- There is no current PoC field, CVSS vector field, or per-field provenance object in this compact story schema. Preserve those facts in the evidence sidecar; do not assume adding arbitrary JSON keys makes them visible or validated.
- Adding a vulnerability can generate a CVE route and Vulnerability Watch entry. Verify both pages and their sources, not just the article.

## 8. Editorial review checklist

- [ ] Headline, deck, impact, and action each add information.
- [ ] Scope, chronology, historical/current context, and affected audience are explicit.
- [ ] Every material factual claim maps to evidence; interpretation and hypotheticals are labeled.
- [ ] Versions, scores, probabilities, dates, exploit/KEV claims, and identifiers are independently checked.
- [ ] Source claims retain actual retrieval dates; stale or conflicting evidence stays visible.
- [ ] Original authorship, generated drafts, reviewer identity, and preview status are honest.
- [ ] Lead artwork matches the story; figure rights, captions, and text alternatives are present.
- [ ] Story IDs, sections, Markdown identity, citations, and related routes agree.
- [ ] Homepage, article, mobile, dark mode, keyboard, and any CVE/source links have been inspected.

## 9. Validate and preview

From the repository root:

```sh
npm run validate:fixture
npm run check
npm test
npm run build:fixture
npm run check:links
npm run test:e2e
```

`validate:content` checks registered edition JSON and mode. `check` validates Astro/content types. The build exercises Markdown identity, citation-reference matching, related-story IDs, and route generation. Link checks inspect generated internal links. These checks do not independently prove source truth, external link freshness, licensing, or human review. Citation validation also does not currently prove that every inline citation has a proper rendered definition/backlink; inspect the rendered article.

Browser tests use the generated preview and expect port 4322 to be free. The current config launches installed Chrome. Some tests assert fixture-specific counts or paths; when intentionally changing that test corpus, update expectations from the actual new contents, preserving coverage of empty filters and historical routes.

For manual reading, run `npm run preview -- --host 127.0.0.1 --port 4324` after building. Inspect at 320/390/768/1024/1440px and both themes for layout-affecting changes. Preserve useful before/after screenshots locally.

For genuine production changes, validate the separate reviewed corpus:

```sh
npm run validate:production
```

Production validation rejects empty, fixture, draft, or unreviewed corpora. The reviewed 2026-09-29 edition resolved the earlier empty-corpus blocker. Run `npm run build:fixture` before further fixture previewing. Passing validation is not authorization to deploy or send email.

## Newsletter copy and approval

The optional `newsletter` object belongs to an edition JSON file. Absence means no email; `draft` permits preview only. Story/source review and newsletter approval are separate: the edition's `reviewed_by`/`reviewed_at` and article review establish content review, while `newsletter.approved_by`/`approved_at` record acceptance of the subject, preview, story selection, and send timing. Never copy a source reviewer into newsletter approval without their actual approval.

Start with this draft fragment, replacing its copy with the intended edition copy:

```json
{
  "newsletter": {
    "status": "draft",
    "subject": "The Security Diff — September 30, 2026",
    "preview_text": "The reviewed security changes worth your attention."
  }
}
```

This is illustrative metadata, not a complete edition or a publication instruction. Write nonempty, single-line copy; the schema limits subject to 120 characters and preview to 200. Draft metadata has no approval fields. Add it to the newest edition in the intended corpus, then review the digest before changing status:

```sh
npm run newsletter:preview -- --mode fixture --output /private/tmp/tsd-newsletter-preview.html
```

For a genuinely reviewed production working draft, use `--mode production` instead. Rendering is local and needs no provider key. It fails if the newest edition has no newsletter object. The renderer selects the lead once, then remaining unique stories from section order followed by otherwise unplaced stories; it does not provide a separate email-selection field. Review all included stories, ordering, concise summaries, unknown intelligence values, the subject/title, preview sentence, canonical `/article/[slug]` links, dated edition link, and policy/privacy/RSS links. Local HTML is an editorial preview; an owner-only Buttondown test must verify delivered-template appearance and unsubscribe behavior before launch.

Only after actual preview review and explicit approval, change to this approved shape:

```json
{
  "newsletter": {
    "status": "approved",
    "subject": "The Security Diff — September 30, 2026",
    "preview_text": "The reviewed security changes worth your attention.",
    "approved_by": "<operator-supplied real approver>",
    "approved_at": "2026-09-30T12:00:00Z"
  }
}
```

The approver placeholder and example timestamp are illustrative, **not a recorded review**. Replace both with the real approving person and actual UTC approval time before submitting a reviewed content pull request. Do not merge placeholders into production. Fixture approval examples never authorize delivery. The existing 2026-09-29 production edition has no newsletter approval; do not add it retroactively as part of feature setup.

Approval does not bypass production deployment, signup/send flags, the provider key, or duplicate checks. Follow the [newsletter runbook](../operations/newsletter.md) for launch timing and recovery. Only the newest production edition is considered; previous editions are not backfilled. Corrections require an explicit site correction record and never automatically resend an accepted edition. A separate operational decision is required for an exceptional replacement email.

## 10. Troubleshooting

| Symptom | Check |
| --- | --- |
| New edition absent | Selected content mode, correct environment directory, filename ending in `.json`, and schema errors |
| Story appears in filters, not the homepage | `sections` membership or `lead_story` |
| Wrong visible section | Story type/category; section key is not a layout override |
| Title/slug mismatch build error | Exact agreement between JSON and Markdown |
| Missing/unused reference error | Frontmatter ID, inline `[^id]`, and footnote definition |
| Related story error | Existing story IDs, not slugs; at most three |
| Lead crashes or shows wrong artwork | First source exists; embedded lead diagram still matches |
| Draft unexpectedly has a route | All collection Markdown is loaded; keep work-in-progress outside it |
| Duplicate story error | Story IDs and slugs must be unique across the selected edition corpus |
| Extra JSON field has no effect | It is not part of the runtime contract; do not rely on unknown-key stripping as agent validation |

For the next automation step, follow [the agent workflow](agent-workflow.md). It keeps the same authoring model and identifies the missing enforcement explicitly.
