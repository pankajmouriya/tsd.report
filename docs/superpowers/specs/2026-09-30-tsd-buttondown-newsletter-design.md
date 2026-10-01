# The Security Diff — Buttondown newsletter design

Date: 2026-09-30

Status: Approved for implementation planning

Product specification: [original spec](../../../the-security-diff-implementation-spec.md)

Design baseline: [site design and architecture](2026-09-26-tsd-design.md)

Delivery baseline: [delivery plan](../plans/2026-09-26-tsd-delivery.md)

## 1. Purpose and decisions

Add a free-first email edition to The Security Diff without introducing accounts, a subscriber database, or a general runtime backend.

Confirmed decisions:

- Buttondown is the initial subscription and delivery provider.
- Readers must confirm their address before receiving email.
- Each eligible published edition produces one concise digest with a lead story, short summaries, relevant signals, and canonical links to `tsd.report`.
- TSD uses Buttondown's API from GitHub Actions instead of the paid RSS-to-email add-on.
- The first 100 active subscribers remain within Buttondown's current free tier. Reaching the provider limit pauses acquisition or triggers an explicit upgrade or migration decision; the application must not silently change providers or start billing.
- `tsd.report` remains the canonical publication and archive.

This design promotes the email digest portion of deferred Milestone H into a separately gated feature. Topic alerts, paid subscriptions, accounts, saved preferences, drip campaigns, referral programs, and multiple newsletters remain deferred.

## 2. Options considered

| Approach | Benefits | Costs and risks | Decision |
| --- | --- | --- | --- |
| Static form plus Buttondown API after deployment | Free for the initial audience, exact edition binding, no subscriber database, explicit publication gates | Requires a small renderer and sender script | Selected |
| Buttondown RSS-to-email | Provider-managed polling and scheduling | Paid add-on, weaker binding to deployment evidence, fewer duplicate-send controls | Rejected for the initial release |
| Cloudflare subscriber backend plus email API | Full control of UX and subscriber data | Requires storage, confirmation tokens, abuse prevention, suppression handling, webhook processing, and ongoing operations | Rejected until reader needs justify it |
| Substack as the primary newsletter | Free delivery and network discovery | Uncustomizable embedded form, duplicated publishing surface, Substack sender identity, and no documented API matching the TSD release flow | Deferred as a possible secondary channel |

## 3. Reader experience

### Placement

Placement refinement — 2026-10-02: keep the native email form only on the dedicated `/subscribe` page. Edition pages end with a compact ruled prompt linking there. Editor-original articles receive the same quiet invitation after the article body; briefs, research notes, and other story types do not. Edition and reading headers expose a small `Subscribe` link beside their existing utility controls. Hide the header links and compact prompts whenever signup is disabled.

Do not add a modal, entrance overlay, sticky banner, masthead takeover, subscriber count, urgency copy, or repeated inline prompts. The signup should feel like the final note of the newspaper rather than an advertisement.

### Form

The `/subscribe` form collects only `email`. Its visible contract is:

- Page heading and supporting explanation supplied by the dedicated route
- Email label, email input, and `Subscribe` submit button
- Consent note explaining that Buttondown processes the address, confirmation is required, and every email includes an unsubscribe link
- Links to the privacy page and existing RSS feed

Use a native HTML `POST` form whose action is Buttondown's `embed-subscribe` endpoint. Include `embed=1`. Do not intercept submission with `fetch`: Buttondown may require navigation for CAPTCHA, validation, or confirmation. The form works without JavaScript and uses browser email validation. Buttondown owns the confirmation and error screens.

The component uses existing paper, ink, rule, accent, focus, spacing, and typography tokens. It has square editorial geometry, a thin top rule, a readable label, a 44px minimum submit target, visible keyboard focus, and no decorative envelope or security icon. It must reflow at 320px without horizontal overflow and preserve dark-mode contrast.

### Confirmation and unsubscribe

Buttondown double opt-in remains enabled. Entering an address creates an unactivated subscriber and sends a confirmation message. Only confirmed subscribers receive editions. Buttondown owns unsubscribe, complaint, bounce, undeliverable, and suppression state. TSD never claims that an address is subscribed merely because the initial form POST succeeded.

Subscribers receive only editions sent after they confirm. The system does not backfill earlier editions. Buttondown's unsubscribe link is present in every email; TSD does not implement a competing local unsubscribe endpoint.

## 4. Privacy and reader trust

Add `/privacy` with a concise newsletter section that states:

- the only required subscriber field is an email address;
- the purpose is delivery of The Security Diff email edition;
- Buttondown is the processor used for confirmation, delivery, unsubscribe, bounce, and complaint handling;
- TSD does not sell subscriber information;
- subscribers can unsubscribe from any edition;
- requests to export or delete subscriber information use a monitored publication contact;
- retention and suppression records are governed by the provider configuration and legitimate delivery-abuse prevention needs;
- the effective date and material changes are recorded.

The monitored contact and sender identity are deployment configuration, not sample content. Newsletter enablement remains blocked until the user supplies and verifies a real sender/reply address in Buttondown. Do not invent or publish a contact address.

Do not add third-party analytics scripts, tracking pixels, advertising tags, or behavioral profiling to the site. Buttondown analytics add-ons are outside this design. The UI must not expose subscriber addresses, counts, provider diagnostics, API identifiers, or internal delivery states.

## 5. Configuration and secrets

| Name | Location | Secret | Purpose |
| --- | --- | --- | --- |
| `BUTTONDOWN_USERNAME` | GitHub repository variable and local environment | No | Builds the public form action |
| `BUTTONDOWN_API_KEY` | GitHub `production` environment secret | Yes | Lists and creates Buttondown emails |
| `TSD_NEWSLETTER_SIGNUP_ENABLED` | GitHub repository variable | No | Explicit standing gate for rendering the live signup form |
| `TSD_NEWSLETTER_SEND_ENABLED` | GitHub repository variable | No | Explicit standing gate for automatic sends |
| `TSD_PUBLICATION_CONTACT_URL` | GitHub repository variable and local environment | No | Monitored `mailto:` or HTTPS destination for privacy requests and replies |

The API key must never enter source, fixtures, logs, build output, browser bundles, pull-request workflows, or chat. Scope the key to the single Buttondown newsletter when the provider supports it. Rotate it after suspected exposure and verify that logs redact authorization headers.

When `TSD_NEWSLETTER_SIGNUP_ENABLED=true`, production builds require `BUTTONDOWN_USERNAME` and `TSD_PUBLICATION_CONTACT_URL` and render the live form. Fixture builds may receive the public values in CI so the form can be visually and semantically tested; they never receive the API key and never run a send job. When signup is disabled or configuration is absent in local development, omit the component instead of rendering an inert form. Validation reports missing or invalid configuration if signup was explicitly enabled.

Acquisition-pause ruling — 2026-09-30: `/privacy` resolves the publication contact independently of signup enablement and the provider username. Keep a valid `TSD_PUBLICATION_CONTACT_URL` configured during an acquisition pause so existing subscribers can request export or deletion. An absent contact is permitted before setup when signup is disabled; a configured invalid contact fails the privacy-page build in either gate state. Enabled signup continues to require both public values.

The signup and send flags are independent of `TSD_PRODUCTION_ENABLED` and each other. The site may collect confirmed subscribers before automatic sending is enabled. Sending requires all three production, signup, and send flags. Setting any flag never bypasses per-edition approval.

## 6. Edition contract

Add an optional newsletter object to the edition schema:

```json
{
  "newsletter": {
    "status": "approved",
    "subject": "The Security Diff — September 30, 2026",
    "preview_text": "Admission control, deployment evidence, and the security changes worth your attention.",
    "approved_by": "<operator-supplied real approver>",
    "approved_at": "2026-09-30T12:00:00Z"
  }
}
```

Rules:

- This example's approver placeholder and timestamp are illustrative, not recorded approval. Production requires the actual approving person and actual approval time.
- The object is optional. Its absence means “do not send.”
- `status` is either `draft` or `approved`.
- Production sending requires `approved`, a non-empty subject and preview text, a real approver, and an ISO timestamp.
- Approval is separate from article review because the subject, preview text, story selection, and email timing are reader-facing editorial decisions.
- Fixture editions may exercise both states but can never trigger delivery.
- The subject must not contain unsupported claims, urgency, or fabricated counts.
- One edition maps to one deterministic Buttondown slug: `tsd-edition-YYYY-MM-DD`.
- Corrections to an already sent edition update the canonical site but do not automatically resend email. A replacement email requires a new explicitly approved operational action outside this initial automation.

The first implementation must not silently add newsletter approval to an existing edition. The first real send requires a reviewed content change that adds the approved object.

## 7. Digest contract

Create a pure TypeScript renderer that accepts one validated production edition and returns a provider-neutral digest model plus deterministic Markdown. It performs no network calls and reads no secrets.

Digest order:

1. Masthead text and edition date
2. Preview sentence
3. Lead story: category, headline, short summary, security signal, and canonical link
4. Remaining unique stories in editorial order: headline, one short summary, relevant signal, and canonical link
5. Vulnerability Watch only when the edition contains real, sourced vulnerability entries; show identifiers and supplied action context without inventing missing values
6. `Read the complete edition` link
7. Brief provenance note and links to the editorial policy, privacy page, and RSS feed

The email is a digest, not a copy of complete articles. TSD-hosted story URLs use the canonical `/article/[slug]` route; a story with a reviewed `destination_url` links directly to that external original. The internal article route remains its stable identity and provenance record. The edition link uses the permanent dated route. Link construction reuses the shared destination and edition route helpers plus the configured site origin.

Buttondown receives Markdown with:

- `slug: tsd-edition-YYYY-MM-DD`
- `canonical_url` set to the dated TSD edition
- `status: about_to_send` only in the live send step
- explicit empty audience filters for all eligible subscribers (`filters: { filters: [], groups: [], predicate: 'and' }`); omit deprecated `email_type`
- Buttondown archive disabled so search engines and readers treat `tsd.report` as canonical
- metadata containing the edition date, source Git SHA, content digest, and schema version

The renderer also produces an HTML preview artifact during validation. That artifact contains no subscriber data and is safe to retain with the workflow run.

## 8. Delivery workflow

Add a `send-newsletter` job to the existing production workflow with this dependency:

```text
quality + secret scan
        ↓
production validation and build
        ↓
Cloudflare deployment
        ↓
production URL smoke check
        ↓
newsletter eligibility and duplicate check
        ↓
Buttondown queue request
```

The job runs only when all conditions hold:

1. The event is a push to `main`.
2. `TSD_PRODUCTION_ENABLED == true`.
3. `TSD_NEWSLETTER_SIGNUP_ENABLED == true`.
4. `TSD_NEWSLETTER_SEND_ENABLED == true`.
5. The Cloudflare production job and URL smoke check succeeded for the same SHA.
6. The selected corpus is production.
7. The newest edition contains an approved newsletter object.
8. The Buttondown API contains no email with the deterministic slug or matching edition metadata.

Pull requests run schema validation, digest rendering, snapshot assertions, link checks, and an email preview artifact. Pull requests never receive `BUTTONDOWN_API_KEY` and cannot send.

Use a serialized newsletter concurrency group. Pin the Buttondown API version header to the reviewed version. Set network timeouts and bounded retries for safe GET requests. Do not blindly retry the create/send POST after an ambiguous timeout: query Buttondown again by deterministic identity before deciding whether a retry is safe.

### Implementation rulings — 2026-09-30

The reviewed implementation pins `X-API-Version: 2026-04-01`, as documented by [Buttondown versioning](https://docs.buttondown.com/api-versioning). The earlier implementation plan's `X-Buttondown-API-Version` spelling is superseded. The [create-email contract](https://docs.buttondown.com/api-emails-create) derives the deprecated `email_type` from archive visibility and audience; `public` conflicts with a disabled archive. The sender therefore omits `email_type`, sets `archival_mode: disabled`, and supplies explicit empty audience filters. This preserves all-subscriber delivery and TSD's canonical archive without enabling a paid RSS add-on.

The whole workflow uses the existing per-ref group with `queue: max` and no cancellation, retaining pending eligible deployments rather than replacing them. The send job separately uses `newsletter-production` with `cancel-in-progress: false`. GitHub permits at most 100 pending runs in each group and cancels additional arrivals; waiting order is not guaranteed to match push order. Operators must monitor canceled/pending runs and reconcile edition identities rather than assume unlimited retention. See [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency). Local workflow tests cover the queue configuration; hosted queuing remains unverified.

## 9. Idempotency and failure behavior

Before creating an email, list Buttondown emails across all result pages and compare both the deterministic slug and stored edition metadata.

| Existing state | Action |
| --- | --- |
| No matching email | Create one email with `about_to_send` |
| `draft`, `about_to_send`, `scheduled`, `in_flight`, `throttled`, `resending`, or `sent` | Exit successfully as already accepted; never create another |
| Any matching nonaccepted state, including `paused`, `errored`, `partially_sent`, `suppressed`, `deleted`, `managed_by_rss`, `imported`, or `transactional` | Fail and require manual review |
| Conflicting slug or metadata | Fail closed and report the non-secret conflict |
| Buttondown unavailable before creation | Fail without sending |
| Ambiguous create response | Re-query; succeed only if exactly one matching email is in an accepted state with consistent identity, otherwise fail for manual review |

Identity matching uses the slug or edition date to find candidates, then requires exactly one result with matching slug, date, and rendered-body digest. Source SHA changes alone do not permit resending. A matching provider `draft` is considered already accepted and is not promoted to sending by the automation. An unknown state or malformed/incomplete provider listing fails closed.

A newsletter failure does not roll back a healthy site deployment. It marks the workflow unsuccessful and requires an operator to reconcile Buttondown before retrying. A site deployment failure prevents email delivery. A code-only deployment after an edition was sent becomes an idempotent no-op.

The GitHub job summary records edition date, canonical URL, source SHA, content digest, Buttondown message ID, and final non-sensitive state. It never records addresses, API keys, authorization headers, or full provider responses.

## 10. Operational setup

Before enabling acquisition:

1. Create the Buttondown newsletter under the user's account.
2. Enable double opt-in and keep it enabled.
3. Configure and verify the actual sender identity and monitored reply address.
4. Configure Buttondown's required DNS records without changing the existing Pages records.
5. Set the public `BUTTONDOWN_USERNAME` repository variable.
6. Set `TSD_PUBLICATION_CONTACT_URL` to the monitored `mailto:` or HTTPS contact destination.
7. Add `BUTTONDOWN_API_KEY` only to the GitHub `production` environment.
8. Confirm unsubscribe wording and the provider-hosted confirmation flow.
9. Publish the privacy page.
10. Set `TSD_NEWSLETTER_SIGNUP_ENABLED=true` only after the preceding checks pass.

Before enabling automatic delivery:

1. Send a provider test email to the owner.
2. Validate the generated digest in common desktop and mobile clients.
3. Add an approved newsletter object through a reviewed production-content pull request.
4. Set `TSD_NEWSLETTER_SEND_ENABLED=true`.
5. Merge the approved edition and verify the workflow and received email.

At 80 active subscribers, record a capacity review. Before 100 active subscribers, choose one of: pay Buttondown's then-current price, migrate with consent and suppression history preserved, or pause new signup while existing subscribers continue under the provider's allowed behavior. Do not delete confirmed subscribers merely to remain on a free tier.

## 11. Testing and acceptance criteria

### Unit and schema tests

- Newsletter schema accepts valid draft and approved metadata and rejects missing approval fields, invalid timestamps, extra fields, and unsupported states.
- Digest rendering preserves editorial order, includes the lead once, deduplicates stories, uses canonical routes, separates security signals, and omits empty optional sections.
- Long headlines, Unicode, Markdown-sensitive characters, unknown intelligence fields, and one-story editions render safely.
- Provider response parsing rejects unexpected or incomplete payloads.
- Idempotency decisions cover every state in the failure table and paginated results.

### Browser and accessibility tests

- Signup renders on the edition, article, and `/subscribe` routes only when configured.
- The form has an explicit label, email autocomplete, required validation, a 44px target, keyboard focus, and meaningful consent text.
- Submission remains a native POST and works with JavaScript disabled.
- The layout has no horizontal overflow at 320, 390, 768, 1024, and 1440px in light and dark themes.
- Fixture previews cannot access a secret or trigger an API send.

### Workflow tests

- Pull requests generate a preview and never send.
- Missing username, key, send flag, approval, or successful production dependency fails closed or skips with an explicit non-secret reason.
- A new approved edition queues once.
- Re-running the same SHA, rebuilding an old edition, and deploying code-only changes do not send again.
- Ambiguous responses reconcile before retry.
- Failed deployment prevents send; failed send leaves the deployed site intact and visible as a failed workflow.

### Launch acceptance

The feature is complete when:

1. A reader can discover the subscription path from edition and reading headers, edition prompts, and editor-original prompts, then submit an address from `/subscribe` and receive Buttondown's confirmation message.
2. An unconfirmed address receives no edition.
3. A confirmed test subscriber receives exactly one concise digest after an approved production edition deploys.
4. Every digest story link resolves to the deployed canonical route.
5. The unsubscribe link suppresses later sends to the test address.
6. The same edition cannot be sent twice by rerun, rebuild, or concurrent workflow.
7. No subscriber address or provider secret appears in source, build output, artifacts, browser bundles, or logs.
8. The privacy page, sender identity, reply path, Buttondown account ownership, and free-tier capacity process are documented and verified.

## 12. External references

- [Buttondown: building a subscriber base](https://docs.buttondown.com/building-your-subscriber-base)
- [Buttondown: double opt-in](https://docs.buttondown.com/double-opt-in)
- [Buttondown: creating a subscriber](https://docs.buttondown.com/api-subscribers-create)
- [Buttondown: creating an email](https://docs.buttondown.com/api-emails-create)
- [Buttondown: listing emails](https://docs.buttondown.com/api-emails-list)
- [Buttondown: API filtering](https://docs.buttondown.com/api-filtering)
- [Buttondown: API versioning](https://docs.buttondown.com/api-versioning)
- [Buttondown: template emails via API](https://docs.buttondown.com/creating-template-emails-via-api)
- [Buttondown pricing](https://buttondown.com/pricing)
