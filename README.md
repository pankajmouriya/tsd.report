# The Security Diff

The Security Diff is a static security-engineering newspaper. Milestone A is a fixture-backed prototype for evaluating the editorial design, content contract, routes, filters, accessibility, and responsive behavior before live ingestion begins.

## Requirements

- Node.js 22.12 or newer on a supported even-numbered release
- npm 11 or compatible
- Python 3.13 and uv 0.12.21 for the Vulnerability Watch pipeline

## Local development

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4321/`. Every page is visibly marked as a fixture preview and carries `noindex` metadata.

## Verification

```sh
npm run check
npm test
npm run validate:fixture
npm run build:fixture
npm run check:links
npx playwright install chromium
npm run test:e2e
uv sync --locked
npm run lint:pipeline
npm run test:pipeline
```

`npm run validate:production` and `npm run build:production` deliberately fail until at least one reviewed production edition exists. Production reads only `data/production/editions` and `content/production/articles`; it never falls back to local fixtures.

## Routes

- `/`, `/today`, `/archive`, and `/YYYY/MM/DD`
- `/article/[slug]`
- `/category/[category]` and `/tag/[tag]`
- `/cve/[cve]`
- `/rss.xml`, `/feed.json`, and `/markdown`
- `/about` and `/editorial-policy`

The product specification, design decisions, execution plan, and repository rules live under [docs](docs/README.md) and [AGENTS.md](AGENTS.md).

## Vulnerability Watch automation

Vulnerability Watch is an independent dated snapshot built from recent CISA KEVs that meet both the configured EPSS probability and percentile thresholds. The daily workflow prepares a candidate pull request; an authorized reviewer label records approval metadata before merge can publish it. See the [operator runbook](docs/operations/vulnerability-watch.md) for replay, live collection, review, rerun, and failure procedures.

## Authoring and automation

Use the [authoring guide and templates](docs/editorial/authoring-guide.md) to add briefs, essays, lead stories, and editions without relearning the content model. The [editorial recipes](docs/editorial/content-recipes.md) cover all supported story types. The [agent workflow](docs/editorial/agent-workflow.md) defines an evidence-constrained draft handoff and distinguishes the proposed automation contract from today's fixture-only publishing capabilities.
