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
npm run validate:content
CONTENT_MODE=fixture npm run build
npm run check:links
npx playwright install chromium
npm run test:e2e
```

`CONTENT_MODE=production npm run build` deliberately fails while fixture data is present. This prevents prototype stories from entering a public build.

## Routes

- `/`, `/today`, `/archive`, and `/YYYY/MM/DD`
- `/article/[slug]`
- `/category/[category]` and `/tag/[tag]`
- `/cve/[cve]`
- `/rss.xml`, `/feed.json`, and `/markdown`
- `/about` and `/editorial-policy`

The product specification, design decisions, execution plan, and repository rules live under [docs](docs/README.md) and [AGENTS.md](AGENTS.md).
