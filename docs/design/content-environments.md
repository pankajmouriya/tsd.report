# Fixture and production content environments

Status: implemented locally on 2026-09-28; first reviewed production edition added locally on 2026-09-29

## Goal

Keep the editorial seed corpus available for local development and visual testing while ensuring that production can load only genuine, reviewed publication content. Production must never fall back to fixture data.

## Recommended directory structure

```text
data/
  fixtures/
    editions/
  production/
    editions/
      2026-09-29.json

content/
  fixtures/
    articles/
  production/
    articles/
      admission-control-kubernetes-policy.md
```

The existing examples belong under `fixtures`. The production roots now contain the first reviewed edition and its original essay. Future production records follow the same review and provenance contract.

## Build contract

| Command | Content source | Expected behavior |
| --- | --- | --- |
| `npm run dev` | Fixtures | Local development with the fixture banner and `noindex` |
| `npm run build:fixture` | Fixtures | Preview, interaction, and visual testing |
| `npm run build:production` | Production only | Build genuine published content |
| Production with no content | No content | Block a normal publication release |

The production site should not publish a fake edition simply to make the build pass. If `tsd.report` needs to be available before the first edition, deploy a deliberately separate holding page.

## Implementation

- `src/lib/content.ts` selects one JSON root from `CONTENT_MODE`, validates the selected schema, rejects cross-environment fixture records, and rejects an empty production corpus.
- `src/lib/schema.ts` provides strict fixture and production schemas. Production editions and stories require published status plus real review metadata and reject the fixture field.
- `src/content.config.ts` defines independent fixture and production Markdown collections.
- Layouts, articles, vulnerability pages, and feeds derive fixture labels and indexing behavior from the selected mode.
- `build:fixture`, `build:production`, `validate:fixture`, `validate:production`, and `test:content-environments` expose the boundary to developers and CI.

## Required design changes

### 1. Select one content source

Introduce a content source resolver that selects either `data/fixtures` or `data/production` from `CONTENT_MODE`. A build must load exactly one source and must never merge or fall back between environments.

Local development may default to fixture mode. CI and release workflows must set `CONTENT_MODE` explicitly.

### 2. Separate fixture and production schemas

Fixture records must require `fixture: true`. Production records must reject the `fixture` field and require publication metadata such as:

```yaml
status: published
reviewed_by: <actual reviewer>
reviewed_at: 2026-09-27T12:00:00Z
```

The source directory determines whether a record is fixture or production. Changing one Boolean must not be sufficient to promote fixture content.

### 3. Separate article collections

Expose independent Astro collections for fixture and production articles. The application selects one collection according to the resolved content mode.

Production articles should remain stored as reviewed Markdown in the repository. This keeps publication changes visible in pull requests and makes builds and rollbacks reproducible.

### 4. Make rendering mode aware

Fixture output must show the fixture banner and use `noindex, nofollow`.

Production output removes fixture wording. Search indexing is enabled only after the production corpus passes validation. An empty production corpus fails before route generation.

### 5. Fail closed during production validation

A production build or release must reject:

- Fixture records or fixture-only wording
- Draft or unreviewed articles
- Missing source or review metadata
- Duplicate story identifiers or slugs
- Editions that reference missing stories or articles
- An empty corpus during a normal publication release

An initial holding-page deployment, if needed, must be an explicit release path rather than a fixture build relabeled as production.

### 6. Keep tests independent

Fixture tests continue using the local seed stories. Production tests should create a small temporary reviewed corpus rather than reading the fixture files.

At minimum, automated tests must prove that:

- Fixture builds continue to render the seed edition and fixture banner.
- Production builds cannot load a known fixture slug such as `patching-the-edge`.
- Production rejects draft, fixture, and incomplete records.
- Production generates only routes present in its selected corpus.
- A normal production release rejects an empty corpus.

## Production content workflow

For the current static Astro application, reviewed production JSON and Markdown should be committed to the repository. Each publication then has:

- Pull request review
- An exact Git history
- A reproducible static build
- A simple rollback target
- No database or CMS dependency

A later ingestion process may prepare a pull request containing new production content. Evidence collection and drafting may be automated, but human review and merge remain the publication boundary.

## Acceptance criteria

The implementation is complete when:

1. Local development displays the existing fixture corpus without copying it into production directories.
2. A production build cannot access fixture editions or fixture Markdown.
3. Tests can exercise an empty production corpus without weakening the content boundary.
4. Normal release automation refuses to publish an empty production corpus.
5. Adding the first reviewed production edition requires adding production records, not changing fixture flags.

## Local verification

Run `npm run test:content-environments`, `npm run check`, `npm run validate:fixture`, `npm run build:fixture`, and `npm run check:links`. Then run `npm run validate:production`, `npm run build:production`, and `npm run check:links` for the reviewed corpus.

The focused environment tests must still prove that a temporary empty production corpus exits nonzero with `Production content requires at least one reviewed edition`. The checked-in production corpus itself must validate and build successfully.

Verification on 2026-09-28: 25 unit tests passed, including 15 focused environment tests; Astro and TypeScript reported zero diagnostics; the fixture validator loaded 3 editions and 17 entries; the fixture build generated 61 pages; internal links passed; and all 36 fixture browser journeys passed. An isolated temporary production record generated 10 production pages with `index, follow`, only its selected category/article/date/tag routes, and no fixture labels or `patching-the-edge` route. The temporary record was removed, the fixture output was rebuilt, and empty production validation returned the required error.

Verification on 2026-09-29: the first approved production edition and original essay passed the 15 environment tests, 25 application tests, Astro and TypeScript checks with zero diagnostics, production validation with 1 edition and 1 entry, a 13-page production build, internal-link checks, and three generated-preview browser checks. The browser checks covered the article structure, attribution, source links, desktop and mobile layouts in both themes, horizontal overflow, and the no-JavaScript category path. Review captures are stored under `/private/tmp/tsd-admission-controller-review/`.
