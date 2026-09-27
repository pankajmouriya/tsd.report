# The Security Diff

The Security Diff is a static security-engineering newspaper. Milestone A is a fixture-backed prototype for evaluating the editorial design, content contract, routes, filters, accessibility, and responsive behavior before live ingestion begins.

## Requirements

- Node.js 22.12 or newer on a supported even-numbered release
- npm 11 or compatible

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

## Authoring and automation

Use the [authoring guide and templates](docs/editorial/authoring-guide.md) to add briefs, essays, lead stories, and editions without relearning the content model. The [editorial recipes](docs/editorial/content-recipes.md) cover all supported story types. The [agent workflow](docs/editorial/agent-workflow.md) defines an evidence-constrained draft handoff and distinguishes the proposed automation contract from today's fixture-only publishing capabilities.
