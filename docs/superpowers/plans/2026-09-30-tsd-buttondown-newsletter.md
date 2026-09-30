# The Security Diff Buttondown Newsletter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let readers join a double opt-in Buttondown newsletter and automatically receive one approved, concise digest only after its matching production edition is successfully deployed to `tsd.report`.

**Architecture:** Astro renders a progressively enhanced, JavaScript-independent signup form that posts directly to Buttondown. A pure TypeScript digest renderer turns a validated edition into deterministic Markdown and a safe HTML preview. A separate GitHub Actions job, gated by production deployment, explicit repository variables, edition approval, and deterministic provider identity, queues the email through Buttondown's API. Buttondown owns subscriber confirmation, unsubscribe, bounce, complaint, and suppression state; TSD stores no subscriber records and adds no runtime backend.

**Tech Stack:** Astro 7 static output, TypeScript 6, Zod 4, Node.js 22 built-in `fetch` and `crypto`, Vitest 5, Playwright 1.63, GitHub Actions, Buttondown API version `2026-04-01`, Cloudflare Pages.

**Spec:** [newsletter design](../specs/2026-09-30-tsd-buttondown-newsletter-design.md), [product specification](../../../the-security-diff-implementation-spec.md), [site design baseline](../specs/2026-09-26-tsd-design.md), [delivery plan](2026-09-26-tsd-delivery.md), [content environments](../../design/content-environments.md), [repository rules](../../../AGENTS.md).

## Global constraints

- Keep `tsd.report` as the canonical archive. Every story link uses `/article/[slug]`; every edition link uses its permanent dated route.
- Add no account system, subscriber database, runtime API, server adapter, paid Buttondown RSS automation, analytics script, tracking pixel, or duplicated Buttondown archive.
- Collect only an email address. Buttondown remains responsible for double opt-in, unsubscribe, bounce, complaint, and suppression state.
- Keep `BUTTONDOWN_API_KEY` only in the GitHub `production` environment. Never expose it to builds, pull requests, browser code, fixtures, artifacts, logs, or documentation.
- Treat `TSD_NEWSLETTER_SIGNUP_ENABLED` and `TSD_NEWSLETTER_SEND_ENABLED` as independent exact-value gates. Neither one replaces `TSD_PRODUCTION_ENABLED` or per-edition approval.
- Omit the signup component when acquisition is disabled. If acquisition is explicitly enabled, fail the build when its public configuration is missing or invalid.
- Absence of edition newsletter metadata means do not send. `draft` means preview only. Only a valid `approved` object is eligible for delivery.
- Do not add approval metadata to the already published production edition. The first live email requires a separate reviewed content change.
- Generate digest content from validated edition data. Do not invent security facts, CVEs, scores, exploitation state, fixes, counts, contacts, or claims.
- Never retry an ambiguous create request blindly. Reconcile by deterministic slug and metadata before any further mutation.
- Newsletter failure may fail the workflow after the site is healthy; it must not roll the site back. Site deployment or smoke-check failure must prevent email delivery.
- Pin GitHub Actions to full commit SHAs and preserve the repository's existing least-privilege permissions.
- Keep changes scoped. Stage explicit paths and commit after each coherent task.

---

### Task 1: Extend the edition contract with explicit newsletter approval

**Files:**

- Modify: `src/lib/schema.ts`
- Modify: `data/fixtures/editions/2026-09-26.json`
- Modify: `docs/editorial/templates/edition.json`
- Regenerate: `schemas/edition.schema.json`
- Test: `tests/unit/schema.test.ts`

**Interfaces:**

```ts
export const newsletterSchema = z.discriminatedUnion('status', [draftSchema, approvedSchema]);
export type Newsletter = z.infer<typeof newsletterSchema>;
```

- [ ] **Step 1: Write failing schema tests**

Add cases to `tests/unit/schema.test.ts` that prove:

```ts
it('accepts draft newsletter copy without approval metadata', () => {
  const result = schemas.fixtureEditionSchema.safeParse({
    ...fixtureEdition,
    newsletter: {
      status: 'draft',
      subject: 'The Security Diff — September 26, 2026',
      preview_text: 'The security changes worth your attention.',
    },
  });
  expect(result.success).toBe(true);
});

it('requires approver and timestamp for an approved newsletter', () => {
  const result = schemas.fixtureEditionSchema.safeParse({
    ...fixtureEdition,
    newsletter: {
      status: 'approved',
      subject: 'The Security Diff — September 26, 2026',
      preview_text: 'The security changes worth your attention.',
    },
  });
  expect(result.success).toBe(false);
});
```

Also reject blank and overlong subjects, blank and overlong preview text, invalid timestamps, unsupported statuses, approval fields on `draft`, and unknown object keys.

Run:

```sh
npm test -- tests/unit/schema.test.ts
```

Expected: the new newsletter tests fail because the schema does not recognize the field.

- [ ] **Step 2: Add the discriminated schema**

In `src/lib/schema.ts`, define strict variants and add `newsletter: newsletterSchema.optional()` to the common edition fields:

```ts
const newsletterCopyFields = {
  subject: z.string().trim().min(1).max(120),
  preview_text: z.string().trim().min(1).max(200),
};

export const newsletterSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('draft'),
    ...newsletterCopyFields,
  }).strict(),
  z.object({
    status: z.literal('approved'),
    ...newsletterCopyFields,
    approved_by: z.string().trim().min(1),
    approved_at: z.iso.datetime(),
  }).strict(),
]);
```

Export `Newsletter` beside the existing inferred content types.

- [ ] **Step 3: Add preview-only fixture metadata**

Add a `draft` newsletter object to `data/fixtures/editions/2026-09-26.json`. Use fixture-safe copy that describes the fixture edition and does not imply delivery. Mirror the object shape in `docs/editorial/templates/edition.json` with `status: "draft"`.

Do not modify `data/production/editions/2026-09-29.json`.

- [ ] **Step 4: Regenerate the checked-in JSON Schema**

Run:

```sh
npm run generate:schema
npm run validate:fixture
npm run validate:production
npm test -- tests/unit/schema.test.ts
git diff --check
```

Expected: schema generation changes only the edition contract; both corpora validate; all schema tests pass; the current production edition still has no newsletter approval.

- [ ] **Step 5: Commit the contract**

```sh
git add src/lib/schema.ts tests/unit/schema.test.ts data/fixtures/editions/2026-09-26.json docs/editorial/templates/edition.json schemas/edition.schema.json
git commit -m "feat(newsletter): add edition approval contract"
```

---

### Task 2: Build the public configuration boundary and signup experience

**Files:**

- Create: `src/lib/newsletter-config.ts`
- Create: `src/components/NewsletterSignup.astro`
- Create: `src/pages/subscribe.astro`
- Create: `src/pages/privacy.astro`
- Modify: `src/components/EditionView.astro`
- Modify: `src/pages/article/[slug].astro`
- Modify: `src/components/EditionFooter.astro`
- Modify: `src/styles/global.css`
- Modify if article-specific spacing is needed: `src/styles/article.css`
- Test: `tests/unit/newsletter-config.test.ts`

**Interfaces:**

```ts
export interface NewsletterSignupConfig {
  username: string;
  action: string;
  contactUrl: string;
}

export function resolveNewsletterSignupConfig(
  env: Record<string, string | undefined>,
): NewsletterSignupConfig | null;
```

- [ ] **Step 1: Write failing configuration tests**

Create `tests/unit/newsletter-config.test.ts` covering:

- disabled or absent `TSD_NEWSLETTER_SIGNUP_ENABLED` returns `null`;
- only the exact value `true` enables acquisition;
- enabled configuration requires `BUTTONDOWN_USERNAME` and `TSD_PUBLICATION_CONTACT_URL`;
- usernames accept only letters, numbers, underscore, and hyphen;
- the contact accepts monitored `mailto:` and `https:` URLs and rejects other schemes;
- the action is exactly `https://buttondown.com/api/emails/embed-subscribe/{encoded username}`.

Run:

```sh
npm test -- tests/unit/newsletter-config.test.ts
```

Expected: fail because the resolver does not exist.

- [ ] **Step 2: Implement the resolver without reading secrets**

Implement `resolveNewsletterSignupConfig`. Throw a descriptive configuration error only when acquisition is explicitly enabled and the public values are absent or invalid. Do not accept or reference `BUTTONDOWN_API_KEY` in browser-facing code.

Run the focused unit test and expect it to pass.

- [ ] **Step 3: Create the reusable native form**

`NewsletterSignup.astro` resolves `import.meta.env` through the helper and emits nothing when disabled. When enabled, render:

```html
<form method="post" action="https://buttondown.com/api/emails/embed-subscribe/tsd-test">
  <input type="hidden" name="embed" value="1">
  <label for="newsletter-email">Email address</label>
  <input id="newsletter-email" name="email" type="email" autocomplete="email" required>
  <button type="submit">Subscribe</button>
</form>
```

The real action comes from configuration. Visible copy must match the design:

- `Receive the email edition`
- `A concise digest when a reviewed edition is published.`
- Buttondown processes the address, confirmation is required, and each email includes an unsubscribe link
- links to `/privacy` and `/rss.xml`

Do not use client-side JavaScript or intercept submission.

- [ ] **Step 4: Place the form and add information pages**

- In `EditionView.astro`, place one signup after editorial content and before `EditionFooter`.
- In `src/pages/article/[slug].astro`, place one signup after references and related reading, before return navigation.
- Create `/subscribe` using `ArticleLayout` with the same component and a short explanation of frequency and confirmation.
- Create `/privacy` using `ArticleLayout`. State the data, purpose, Buttondown processing, no-sale policy, unsubscribe path, contact link, retention/suppression purpose, and effective date defined by the approved design.
- Add `Subscribe` and `Privacy` links to `EditionFooter.astro`.

- [ ] **Step 5: Style the component from existing tokens**

Use square editorial geometry, a thin top rule, existing paper/ink/accent/focus tokens, a readable label, and a submit target at least 44px high. At narrow widths, stack the input and button. Do not add new isolated colors, rounded cards, icons, overlays, sticky elements, or subscriber counts.

- [ ] **Step 6: Verify build-time behavior**

Run:

```sh
npm test -- tests/unit/newsletter-config.test.ts
npm run build:fixture
TSD_NEWSLETTER_SIGNUP_ENABLED=true BUTTONDOWN_USERNAME=tsd-test TSD_PUBLICATION_CONTACT_URL=mailto:privacy@example.test npm run build:fixture
```

Expected: the ordinary fixture build succeeds with the component omitted; the configured build succeeds with the form and privacy contact rendered.

Then run:

```sh
TSD_NEWSLETTER_SIGNUP_ENABLED=true npm run build:fixture
```

Expected: nonzero exit with a clear missing-public-configuration error.

- [ ] **Step 7: Commit the reader experience**

```sh
git add src/lib/newsletter-config.ts tests/unit/newsletter-config.test.ts src/components/NewsletterSignup.astro src/pages/subscribe.astro src/pages/privacy.astro src/components/EditionView.astro 'src/pages/article/[slug].astro' src/components/EditionFooter.astro src/styles/global.css src/styles/article.css
git commit -m "feat(newsletter): add verified signup experience"
```

Stage `src/styles/article.css` only if it changed.

---

### Task 3: Render a deterministic edition digest and preview artifact

**Files:**

- Create: `src/lib/newsletter.ts`
- Create: `scripts/newsletter/render.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `tests/unit/newsletter.test.ts`

**Interfaces:**

```ts
export interface NewsletterDigest {
  editionDate: string;
  subject: string;
  previewText: string;
  canonicalUrl: string;
  lead: NewsletterDigestStory;
  stories: NewsletterDigestStory[];
  vulnerabilities: NewsletterDigestVulnerability[];
}

export function buildNewsletterDigest(
  edition: Edition,
  origin?: string,
): NewsletterDigest;

export function renderNewsletterMarkdown(digest: NewsletterDigest): string;
export function renderNewsletterPreviewHtml(digest: NewsletterDigest): string;
```

- [ ] **Step 1: Write failing renderer tests**

Create `tests/unit/newsletter.test.ts` with validated fixture objects. Prove that the renderer:

- preserves editorial order;
- includes the lead story once even if referenced by a section;
- deduplicates remaining stories by slug;
- uses `/article/[slug]` and the dated edition route through existing route helpers;
- includes a security signal only when supplied;
- includes Vulnerability Watch only for real supplied entries;
- preserves unknown values instead of converting them to zero or false;
- escapes Markdown-sensitive and HTML-sensitive text;
- handles Unicode, long headlines, and a one-story edition;
- produces identical output for identical input;
- fails when newsletter metadata is absent.

Run:

```sh
npm test -- tests/unit/newsletter.test.ts
```

Expected: fail because the renderer does not exist.

- [ ] **Step 2: Implement the provider-neutral digest model**

Build URLs with `new URL(route, origin)`, `articlePath`, and `editionPath`. Default the origin to `https://tsd.report`. Keep the digest concise: category, headline, short summary, supplied signal, and canonical link. Do not reproduce article bodies.

End the Markdown with links to the complete edition, editorial policy, privacy page, and RSS feed. Render preview HTML from the same digest model and escape every data-derived string before insertion.

- [ ] **Step 3: Add the preview CLI**

Implement `scripts/newsletter/render.ts` so it:

1. accepts `--mode fixture|production` and optional `--output`;
2. loads editions through the existing content boundary;
3. selects the latest edition;
4. requires newsletter metadata;
5. writes standalone HTML to `dist/newsletter-preview.html` by default;
6. reads no API key and performs no network request.

Add:

```json
{
  "scripts": {
    "newsletter:preview": "node --import tsx scripts/newsletter/render.ts"
  }
}
```

No new dependency is required.

- [ ] **Step 4: Verify deterministic preview output**

Run:

```sh
npm test -- tests/unit/newsletter.test.ts
npm run build:fixture
npm run newsletter:preview -- --mode fixture
test -s dist/newsletter-preview.html
rg -n "https://tsd.report/article/|https://tsd.report/edition/|privacy|rss.xml" dist/newsletter-preview.html
```

Expected: tests pass; a nonempty standalone preview exists; links use the canonical origin and routes; no complete article body is copied.

- [ ] **Step 5: Commit the renderer**

```sh
git add src/lib/newsletter.ts scripts/newsletter/render.ts tests/unit/newsletter.test.ts package.json package-lock.json
git commit -m "feat(newsletter): render deterministic edition digest"
```

---

### Task 4: Implement the Buttondown boundary and duplicate-send policy

**Files:**

- Create: `scripts/newsletter/buttondown.ts`
- Test: `tests/unit/buttondown.test.ts`

**Interfaces:**

```ts
export interface ButtondownEmailRecord {
  id: string;
  slug: string;
  status: ButtondownEmailStatus;
  metadata: Record<string, unknown>;
}

export type DeliveryDecision =
  | { kind: 'create' }
  | { kind: 'already-accepted'; email: ButtondownEmailRecord }
  | { kind: 'manual-review'; email: ButtondownEmailRecord; reason: string };

export function parseButtondownEmailPage(value: unknown): ButtondownEmailPage;
export function decideButtondownDelivery(
  emails: ButtondownEmailRecord[],
  identity: NewsletterIdentity,
): DeliveryDecision;

export class ButtondownClient {
  constructor(apiKey: string, fetchImpl?: typeof fetch);
  listAllEmails(): Promise<ButtondownEmailRecord[]>;
  createEmail(payload: ButtondownCreateEmail): Promise<ButtondownEmailRecord>;
}
```

- [ ] **Step 1: Write failing provider tests with an injected fetch**

Cover:

- `Authorization: Token ...` and `X-Buttondown-API-Version: 2026-04-01` headers;
- pagination until accumulated results reach the provider `count`;
- bounded GET retry for transient status and timeout;
- strict parsing that rejects missing IDs, slugs, metadata, counts, and unknown states;
- `create` when no identity matches;
- successful no-op for `draft`, `about_to_send`, `scheduled`, `in_flight`, `throttled`, `resending`, and `sent`;
- manual failure for `paused`, `errored`, `partially_sent`, and `suppressed`;
- failure for multiple matches, matching slug with conflicting metadata, or matching metadata with conflicting slug;
- exactly one POST with `status: about_to_send`, public email type, canonical URL, disabled Buttondown archive, and deterministic metadata;
- error text never contains the API key or complete provider response.

Run:

```sh
npm test -- tests/unit/buttondown.test.ts
```

Expected: fail because the provider boundary does not exist.

- [ ] **Step 2: Implement strict parsing and identity decisions**

Use a deterministic identity:

```ts
{
  slug: `tsd-edition-${edition.date}`,
  metadata: {
    edition_date: edition.date,
    source_sha: sourceSha,
    content_digest: contentDigest,
    schema_version: edition.schema_version,
  },
}
```

Compare slug plus edition date and digest. Treat an existing accepted state as success even when a later code-only deployment has a different source SHA, provided the edition date and content digest match. Treat inconsistent identity as manual review.

- [ ] **Step 3: Implement HTTP safety**

Use Node's built-in `fetch` and `AbortSignal.timeout`. GET retries must be bounded. POST happens at most once per invocation. Return parsed, allowlisted fields only. Never log request headers or raw responses.

For an ambiguous POST timeout or 5xx, return an explicit ambiguous result to the orchestration layer; do not issue a second POST inside the client.

- [ ] **Step 4: Run provider tests**

```sh
npm test -- tests/unit/buttondown.test.ts
git diff --check
```

Expected: all mocked provider and identity cases pass without network access.

- [ ] **Step 5: Commit the provider boundary**

```sh
git add scripts/newsletter/buttondown.ts tests/unit/buttondown.test.ts
git commit -m "feat(newsletter): add Buttondown delivery boundary"
```

---

### Task 5: Orchestrate fail-closed production delivery

**Files:**

- Create: `scripts/newsletter/send.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `tests/unit/newsletter-send.test.ts`

**Interfaces:**

```ts
export type DeliveryResult =
  | { kind: 'skipped'; reason: 'not-configured' | 'draft' }
  | { kind: 'queued'; editionDate: string; emailId: string; contentDigest: string }
  | { kind: 'already-accepted'; editionDate: string; emailId: string; contentDigest: string };

export async function deliverLatestNewsletter(input: {
  edition: Edition;
  apiKey: string | undefined;
  sourceSha: string;
  fetchImpl?: typeof fetch;
  summaryPath?: string;
}): Promise<DeliveryResult>;
```

- [ ] **Step 1: Write failing orchestration tests**

Prove that:

- absent newsletter metadata and `draft` return an explicit skip without any HTTP call;
- `approved` requires an API key and source SHA;
- content digest is SHA-256 over deterministic Markdown bytes;
- no match queues exactly one email;
- an accepted match returns idempotent success;
- provider conflict and manual-review states fail closed;
- an ambiguous create re-lists all emails and succeeds only when exactly one consistent identity appears;
- an unresolved ambiguous create fails without retrying POST;
- the job summary contains only edition date, canonical URL, source SHA, digest, provider message ID, and final state;
- neither API key nor subscriber data can appear in the summary or thrown error.

Run:

```sh
npm test -- tests/unit/newsletter-send.test.ts
```

Expected: fail because delivery orchestration does not exist.

- [ ] **Step 2: Implement injectable orchestration**

Use `buildNewsletterDigest`, `renderNewsletterMarkdown`, `createHash('sha256')`, `ButtondownClient`, and `decideButtondownDelivery`. The function must not inspect `CONTENT_MODE`; it receives an already validated edition so unit tests remain pure.

The CLI entry point must always call `loadEditions('production')`, select the latest production edition, and then invoke `deliverLatestNewsletter`. It must never fall back to fixtures, regardless of ambient `CONTENT_MODE`.

- [ ] **Step 3: Add the send command**

Add:

```json
{
  "scripts": {
    "newsletter:send": "node --import tsx scripts/newsletter/send.ts"
  }
}
```

Read only `BUTTONDOWN_API_KEY`, `GITHUB_SHA`, and `GITHUB_STEP_SUMMARY` at the CLI boundary. A production edition with no newsletter object or a draft object exits zero with an explicit non-sensitive skip message. An approved object without a key fails.

- [ ] **Step 4: Verify without contacting Buttondown**

Run against the current unapproved production edition:

```sh
npm test -- tests/unit/newsletter-send.test.ts
npm run newsletter:send
```

Expected: unit tests pass; the CLI exits zero as `not-configured`; no network call occurs because the current production edition has no newsletter metadata.

- [ ] **Step 5: Commit orchestration**

```sh
git add scripts/newsletter/send.ts tests/unit/newsletter-send.test.ts package.json package-lock.json
git commit -m "feat(newsletter): gate production email delivery"
```

---

### Task 6: Add preview artifacts and post-deployment sending to GitHub Actions

**Files:**

- Modify: `.github/workflows/validate.yml`
- Create: `tests/unit/newsletter-workflow.test.ts`

**Workflow contract:**

```text
quality + secret-scan
        ↓
deploy-production + production smoke
        ↓
send-newsletter
```

- [ ] **Step 1: Write failing workflow-policy tests**

Create `tests/unit/newsletter-workflow.test.ts` that reads `.github/workflows/validate.yml` as text and parses the relevant job boundaries. Assert:

- `send-newsletter` depends on `deploy-production`;
- it is restricted to a push on `main`;
- it requires exact `true` values for production, signup, and send gates;
- it uses the GitHub `production` environment;
- only the send job references `secrets.BUTTONDOWN_API_KEY`;
- pull-request jobs never run `newsletter:send`;
- the send job uses a serialized concurrency group with cancellation disabled;
- `quality` builds a fixture email preview and uploads it as an artifact;
- the preview job receives only public newsletter values.

Run:

```sh
npm test -- tests/unit/newsletter-workflow.test.ts
```

Expected: fail because the workflow does not contain these jobs and steps.

- [ ] **Step 2: Add public build configuration and preview generation**

In `quality`, provide test-only public values:

```yaml
env:
  TSD_NEWSLETTER_SIGNUP_ENABLED: 'true'
  BUTTONDOWN_USERNAME: tsd-test
  TSD_PUBLICATION_CONTACT_URL: mailto:privacy@example.test
```

After the fixture build, run `npm run newsletter:preview -- --mode fixture`. Upload `dist/newsletter-preview.html` with the repository's approved pinned `actions/upload-artifact` SHA. Do not upload secrets or provider responses.

The deployed fixture preview may include this file so reviewers can open it directly.

- [ ] **Step 3: Pass public production values into the production build**

Map repository variables only:

```yaml
TSD_NEWSLETTER_SIGNUP_ENABLED: ${{ vars.TSD_NEWSLETTER_SIGNUP_ENABLED }}
BUTTONDOWN_USERNAME: ${{ vars.BUTTONDOWN_USERNAME }}
TSD_PUBLICATION_CONTACT_URL: ${{ vars.TSD_PUBLICATION_CONTACT_URL }}
```

Do not expose `BUTTONDOWN_API_KEY` to validation, build, preview, deploy, browser tests, or Cloudflare steps.

- [ ] **Step 4: Add the serialized send job**

Add a job shaped as follows, preserving existing job names and production smoke checks:

```yaml
send-newsletter:
  needs: deploy-production
  if: >-
    github.event_name == 'push' &&
    github.ref == 'refs/heads/main' &&
    vars.TSD_PRODUCTION_ENABLED == 'true' &&
    vars.TSD_NEWSLETTER_SIGNUP_ENABLED == 'true' &&
    vars.TSD_NEWSLETTER_SEND_ENABLED == 'true' &&
    needs.deploy-production.result == 'success'
  environment: production
  concurrency:
    group: newsletter-production
    cancel-in-progress: false
```

Use checkout and Node setup actions already pinned in the workflow, run `npm ci`, then:

```yaml
- name: Queue approved newsletter
  env:
    BUTTONDOWN_API_KEY: ${{ secrets.BUTTONDOWN_API_KEY }}
    GITHUB_SHA: ${{ github.sha }}
  run: npm run newsletter:send
```

Keep job permissions at `contents: read`.

- [ ] **Step 5: Verify workflow policy locally**

```sh
npm test -- tests/unit/newsletter-workflow.test.ts
npm run check
npm test
npm run build:fixture
git diff --check
```

Expected: the policy test proves the secret boundary and deployment dependency; no local or pull-request command contacts Buttondown.

- [ ] **Step 6: Commit workflow integration**

```sh
git add .github/workflows/validate.yml tests/unit/newsletter-workflow.test.ts
git commit -m "ci(newsletter): send after production deployment"
```

---

### Task 7: Verify the reader flow, no-JavaScript behavior, and visual quality

**Files:**

- Create: `tests/e2e/newsletter.spec.ts`
- Modify only if required for test selection: `playwright.config.ts`
- Modify only to fix discovered defects: newsletter UI files from Task 2

- [ ] **Step 1: Write browser tests against the generated fixture build**

Cover the homepage or current edition, one article, `/subscribe`, and `/privacy`. Assert:

- the prompt appears once in each intended context;
- footer links reach Subscribe and Privacy;
- the form uses `method="post"`, the configured Buttondown action, hidden `embed=1`, and an email input with `name="email"`, `autocomplete="email"`, and `required`;
- consent copy names Buttondown, confirmation, unsubscribe, privacy, and RSS;
- keyboard tab order is logical and focus remains visible;
- browser validation rejects a malformed address;
- a JavaScript-disabled browser context can submit the form; intercept the Buttondown request locally and assert a form-encoded POST without sending a real address;
- no page has horizontal document overflow at 320, 390, 768, 1024, or 1440 pixels;
- light and dark themes preserve readable text and controls.

Use `reader@example.test` only inside the intercepted browser test. Never submit to Buttondown.

- [ ] **Step 2: Run the focused browser test**

Build with safe public fixture values:

```sh
TSD_NEWSLETTER_SIGNUP_ENABLED=true BUTTONDOWN_USERNAME=tsd-test TSD_PUBLICATION_CONTACT_URL=mailto:privacy@example.test npm run build:fixture
npm run test:e2e -- tests/e2e/newsletter.spec.ts
```

Expected: all semantic, no-JavaScript, route, keyboard, and responsive assertions pass.

- [ ] **Step 3: Capture the review matrix**

Save screenshots outside the repository under:

```text
/private/tmp/tsd-newsletter-review/
```

Capture homepage, article, subscribe, privacy, and digest preview at 320, 768, and 1440 pixels in both themes. Inspect browser output for overflow, duplicate prompts, awkward line breaks, weak focus, and contrast. Record findings in the delivery ledger only after inspection.

- [ ] **Step 4: Fix only evidenced defects and rerun the focused test**

Keep the signup visually subordinate to article content and consistent with the newspaper system. Repeat only the failing viewport or theme until the concrete defect is resolved, then run the whole newsletter spec once.

- [ ] **Step 5: Commit browser coverage**

```sh
git add tests/e2e/newsletter.spec.ts playwright.config.ts src/components/NewsletterSignup.astro src/pages/subscribe.astro src/pages/privacy.astro src/styles/global.css src/styles/article.css
git commit -m "test(newsletter): cover reader signup flow"
```

Stage only paths that changed.

---

### Task 8: Document authoring, operations, privacy, and the free-tier boundary

**Files:**

- Create: `docs/operations/newsletter.md`
- Modify: `docs/operations/release-process.md`
- Modify: `docs/editorial/authoring-guide.md`
- Modify: `docs/README.md`
- Modify: `docs/superpowers/plans/2026-09-26-tsd-delivery.md`

- [ ] **Step 1: Write the operator runbook**

Document in `docs/operations/newsletter.md`:

- Buttondown account creation, double opt-in, sender/reply verification, and required DNS records without changing Pages records;
- the five configuration names, their exact locations, and which one is secret;
- local digest preview without provider access;
- acquisition enablement before delivery enablement;
- deterministic identity, accepted states, manual-review states, ambiguous-create reconciliation, and safe rerun behavior;
- API-key rotation without printing or copying it into shell history;
- monitoring at 80 active subscribers and the hard decision before 100 active subscribers;
- export and suppression-list migration expectations before changing providers;
- how to pause acquisition, pause sending, and recover from a failed newsletter job without rolling back a healthy site;
- no retroactive send and no automatic correction resend.

- [ ] **Step 2: Document the editorial workflow**

In `docs/editorial/authoring-guide.md`, add the newsletter metadata examples for `draft` and `approved`. Explain that the approver is accepting the subject, preview, selection, and timing. Require preview review before changing to `approved`. Keep source review and newsletter approval distinct.

- [ ] **Step 3: Connect release and docs indexes**

Update `docs/operations/release-process.md` with the post-deployment send job and its independent gates. Add the new runbook to `docs/README.md`; keep the existing implementation-plan entry accurate.

- [ ] **Step 4: Record implementation evidence in the delivery ledger**

Update the newsletter note in `docs/superpowers/plans/2026-09-26-tsd-delivery.md` with:

- status;
- changed paths;
- exact validation commands and results;
- `/private/tmp/tsd-newsletter-review/` visual evidence;
- current configuration state;
- confirmation that no production edition was approved and no email was sent;
- remaining provider setup and rollout gates.

Do not check a delivery box until the named evidence exists.

- [ ] **Step 5: Check documentation integrity and commit**

```sh
npm run check:links
rg -n "BUTTONDOWN_API_KEY" . --glob '!node_modules/**' --glob '!dist/**' --glob '!.git/**'
git diff --check
```

Expected: internal links pass; API-key references are variable names and instructions only; no key value, fabricated contact, or claim of live delivery appears.

```sh
git add docs/operations/newsletter.md docs/operations/release-process.md docs/editorial/authoring-guide.md docs/README.md docs/superpowers/plans/2026-09-26-tsd-delivery.md
git commit -m "docs(newsletter): add publishing runbook"
```

---

### Task 9: Run final verification and prepare a non-sending rollout handoff

**Files:**

- Verify: all newsletter implementation paths
- Update evidence only: `docs/superpowers/plans/2026-09-26-tsd-delivery.md`

- [ ] **Step 1: Prove the full repository gates**

Run from a clean dependency installation:

```sh
npm ci
npm run check
npm test
npm run validate:fixture
npm run validate:production
npm run test:content-environments
TSD_NEWSLETTER_SIGNUP_ENABLED=true BUTTONDOWN_USERNAME=tsd-test TSD_PUBLICATION_CONTACT_URL=mailto:privacy@example.test npm run build:fixture
npm run newsletter:preview -- --mode fixture
npm run check:links
npm run test:e2e
npm run build:production
git diff --check
git status --short
```

Expected:

- Astro and TypeScript report zero errors;
- unit and browser tests pass;
- fixture and production content validate;
- environment isolation passes;
- the configured fixture site and digest preview build;
- links pass;
- production builds only reviewed production content;
- no generated output is accidentally tracked;
- the working tree contains only the intended evidence-ledger update, if any.

- [ ] **Step 2: Re-prove the fail-closed edges**

Run:

```sh
TSD_NEWSLETTER_SIGNUP_ENABLED=true npm run build:fixture
```

Expected: nonzero because enabled signup lacks required public configuration.

Run:

```sh
npm run newsletter:send
```

Expected: zero with `not-configured` because the current production edition is not approved; no provider request occurs.

- [ ] **Step 3: Review the final diff and secret boundary**

```sh
git status --short
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
git grep -n "BUTTONDOWN_API_KEY"
git grep -n "api/emails/embed-subscribe"
```

Expected: the secret name exists only in server-side script, workflow send job, tests, and runbook; the public form contains only the provider username endpoint; no credential value exists.

- [ ] **Step 4: Update and commit final evidence**

Record exact counts and commands in the delivery ledger, then:

```sh
git add docs/superpowers/plans/2026-09-26-tsd-delivery.md
git commit -m "docs(newsletter): record implementation evidence"
```

Skip this commit if the ledger was already complete and unchanged.

- [ ] **Step 5: Prepare rollout without enabling or sending**

Create a pull request containing the implementation and evidence. Keep these values disabled until the reviewed branch is merged and Buttondown setup is complete:

```text
TSD_NEWSLETTER_SIGNUP_ENABLED=false
TSD_NEWSLETTER_SEND_ENABLED=false
```

No API call, live subscription, or email send belongs in implementation verification.

---

## Post-merge rollout checklist

These are operator actions after the implementation pull request merges. They require the real Buttondown account and monitored publication identity. They are not part of automated tests.

- [ ] Create the Buttondown newsletter, enable double opt-in, and verify the real sender and monitored reply address.
- [ ] Add Buttondown's required DNS records without altering the Cloudflare Pages apex or `www` records.
- [ ] Store the API key through the prompt-based command so it does not enter source or shell history:

```sh
gh secret set BUTTONDOWN_API_KEY --env production
```

- [ ] Store `BUTTONDOWN_USERNAME` and `TSD_PUBLICATION_CONTACT_URL` as GitHub repository variables using the actual reviewed values.
- [ ] Keep `TSD_NEWSLETTER_SEND_ENABLED=false`; set `TSD_NEWSLETTER_SIGNUP_ENABLED=true` and deploy the form and privacy page.
- [ ] Submit one controlled address, complete confirmation, inspect the Buttondown subscriber state, then unsubscribe and confirm suppression behavior.
- [ ] Review the generated digest preview for the first eligible edition. Add `newsletter.status: approved` in a separate content pull request with the real approver and timestamp.
- [ ] Confirm the production environment secret, branch protection, post-deployment smoke dependency, and Buttondown sender state are healthy.
- [ ] Set `TSD_NEWSLETTER_SEND_ENABLED=true` only after the controlled signup and first digest are approved.
- [ ] Merge the approved edition, observe one post-deployment queue request, verify the received email and canonical links, and record non-sensitive release evidence.
- [ ] Rerun the same SHA once and confirm the delivery job reports `already-accepted` without creating another message.
- [ ] Add a subscriber-capacity alert or calendar review at 80 active subscribers; pause acquisition or approve a paid/migration decision before 100 active subscribers.

## Completion criteria

The feature is complete only when:

1. readers can subscribe without JavaScript and must confirm through Buttondown;
2. privacy, RSS, and unsubscribe expectations are visible and accurate;
3. the site stores no subscriber data and exposes no API key;
4. a deterministic digest preview is reviewable before approval;
5. only an approved production edition can reach the provider;
6. delivery runs after the matching production deployment and smoke check;
7. repeated and ambiguous runs cannot blindly create duplicate messages;
8. fixture, production, unit, browser, link, responsive, dark-mode, and workflow-policy checks pass;
9. operations, authoring, capacity, recovery, and migration procedures are documented;
10. the first real subscriber and first real send are recorded as separate post-merge rollout evidence.
