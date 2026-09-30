# Buttondown newsletter operations

Status: implemented and tested locally; provider setup and live rollout remain unverified. This runbook does not record account creation, sender verification, DNS changes, hosted workflow execution, confirmation, unsubscribe, delivery, or deployment. No production edition currently has newsletter approval.

The [newsletter design](../superpowers/specs/2026-09-30-tsd-buttondown-newsletter-design.md) defines the boundary. Buttondown handles subscriber data and delivery. TSD keeps the canonical dated editions and `/article/[slug]` archive. Follow the [release process](release-process.md) for site deployment and the [authoring guide](../editorial/authoring-guide.md#newsletter-copy-and-approval) for editorial approval.

## Configuration

Use GitHub **Settings → Secrets and variables → Actions → Variables** for repository variables. Use **Settings → Environments → production → Environment secrets** for the key. Supply actual public values through these UIs; keep usernames, addresses, sender identities, and DNS values out of source, documentation, and logs.

| Name | Exact location | Secret? | Purpose |
| --- | --- | --- | --- |
| `BUTTONDOWN_USERNAME` | GitHub repository variable; local environment for an enabled local signup preview | No | Public native form destination |
| `BUTTONDOWN_API_KEY` | GitHub `production` environment secret only | Yes | Provider access in the send job |
| `TSD_NEWSLETTER_SIGNUP_ENABLED` | GitHub repository variable; local environment for signup preview | No | Render signup only for the exact value `true` |
| `TSD_NEWSLETTER_SEND_ENABLED` | GitHub repository variable | No | Permit the post-deployment send job only for the exact value `true` |
| `TSD_PUBLICATION_CONTACT_URL` | GitHub repository variable; local environment for an enabled local signup preview | No | Operator-supplied monitored `mailto:` or HTTPS contact |

These five values supplement the existing `TSD_PRODUCTION_ENABLED` site gate and Cloudflare settings. An enabled signup build rejects a missing/invalid username or contact URL. Disabled signup omits the form. Builds and pull-request jobs never receive the provider key; CI fixture previews use explicitly synthetic public test configuration.

## Set up the provider before opening signup

1. Create the newsletter in the owner's Buttondown account through its signup UI. Retain account ownership and recovery access securely. Check the current plan before enabling any paid feature.
2. Keep [double opt-in](https://docs.buttondown.com/double-opt-in) enabled. An initial native form POST is a confirmation request; only a confirmed subscriber may receive an edition. Do not import contacts as confirmed without consent evidence.
3. In Buttondown's sending-domain settings, configure the operator-supplied sender identity and monitored reply destination. Complete the verification requested by the provider. Send an owner-only provider test, check the displayed sender, and reply to it to prove the reply reaches the monitored inbox. Keep real addresses out of issue bodies, screenshots, and logs.
4. Follow the account's [custom sending-domain instructions](https://docs.buttondown.com/sending-from-a-custom-domain) for its exact DNS records. Manual setup uses provider-supplied authentication records; managed setup delegates a dedicated sending subdomain. Keep the existing Pages hostname records, root nameservers, and mail service records intact. Inspect existing records first; do not create a second SPF policy at the same hostname or replace an existing MX record without resolving its mail-service impact. Choose a dedicated sending subdomain if records would collide. Add only the required provider records and wait for its verification. This does not require moving the Pages site or enabling a Buttondown web archive.
5. Set the public username and monitored publication contact in the repository variables. Verify the `/privacy` notice and its export/deletion contact, provider retention/suppression settings, and unsubscribe wording. TSD collects only email and maintains no subscriber database. No analytics add-on is part of this implementation.
6. Generate the API key in Buttondown's API settings and store it directly in the `production` environment secret UI. Use newsletter-limited scope if available. Do not paste it into chat, a shell command, a file, a build, or an artifact.
7. After these checks, enable `TSD_NEWSLETTER_SIGNUP_ENABLED=true` and deploy through the site gates, keeping sending disabled. With an operator-controlled address, test the native form, confirmation message, confirmation link, and provider state. Leave another controlled address unconfirmed for the first-send exclusion check. Record outcomes without addresses.

The provider screens own validation, CAPTCHA, confirmation, and unsubscribe. Test the actual navigation with and without JavaScript. A local intercepted POST is not evidence that these hosted flows work.

## Preview and approve an edition

No provider access or API key is needed:

```sh
npm run newsletter:preview -- --mode fixture --output /private/tmp/tsd-newsletter-preview.html
```

Open that HTML locally. It is a noindex fixture preview. For real copy, add a `draft` newsletter object to the newest reviewed production edition in a working content change, then run:

```sh
npm run validate:production
npm run newsletter:preview -- --mode production --output /private/tmp/tsd-newsletter-production-preview.html
```

The preview command selects the newest edition in the requested corpus and fails when it has no newsletter metadata. It does not change approval or send email. Inspect subject, preview, lead, unique story order, evidence/unknowns, canonical links, and mobile reading. Buttondown's `description` receives the preview text; the renderer also includes it in the digest body. Local HTML does not prove a particular email client's inbox preview or delivered layout. Use an owner-only provider test to inspect the actual template in desktop and mobile clients before live sending.

Enable acquisition before delivery. After provider tests and signup acceptance, arrange a separate reviewed content pull request with real newsletter approval. Enable `TSD_NEWSLETTER_SEND_ENABLED=true` only when the next approved merge is intended to send. The new approval and timestamp authorize subject, preview, selection, and timing; article/source review does not supply this authorization. Leave existing editions unapproved.

## Delivery, identity, and reruns

The workflow sends only on a push to `main`, after successful production deployment and its Pages URL smoke check for that SHA, with production, signup, and send flags all `true`. The sender loads only the newest production edition. Absent newsletter metadata or `draft` exits successfully without provider access; `approved` requires the key and source SHA. The CLI itself does not enforce the workflow flags or deployment gates, so routine operations use the gated job rather than running the send command locally.

Each edition has slug `tsd-edition-YYYY-MM-DD` and metadata `edition_date`, `source_sha`, `content_digest` (SHA-256 of rendered Markdown), and `schema_version`. All provider email pages are listed before creation. A match is found by slug **or** edition date; exactly one match must agree on slug, date, and content digest. A source SHA change alone does not permit another send.

| Provider result | Operator meaning |
| --- | --- |
| No match after a complete, consistent listing | One create request may queue the email |
| Matching `draft`, `about_to_send`, `scheduled`, `in_flight`, `throttled`, `resending`, or `sent` | Already accepted; rerun is a successful no-op. A provider draft is not proof of delivery and is not promoted by this sender |
| Matching `paused`, `errored`, `partially_sent`, `suppressed`, `deleted`, `managed_by_rss`, `imported`, or `transactional` | Manual review; no create request |
| Multiple matches, identity conflict, unknown state, invalid response, inconsistent pagination, or unavailable listing | Fail closed; reconcile before another attempt |
| Ambiguous create response | List again; accept only exactly one matching identity in an accepted state. Otherwise fail for manual review; never repeat the POST automatically |

Requests use `X-API-Version: 2026-04-01`. Creation sets `status: about_to_send`, `archival_mode: disabled`, and explicit empty audience filters (`filters: { filters: [], groups: [], predicate: 'and' }`) for all eligible subscribers. The deprecated derived `email_type` is omitted. See [API versioning](https://docs.buttondown.com/api-versioning) and [email creation](https://docs.buttondown.com/api-emails-create). GETs have three bounded attempts and 10-second request timeouts; creation has one attempt and no redirect retry. Queued/accepted means provider acceptance, not confirmed inbox delivery.

The workflow serializes each ref with `queue: max` and no cancellation; the send job separately uses `newsletter-production` with `cancel-in-progress: false`. GitHub retains up to **100 pending runs per concurrency group**, then cancels additional runs. Monitor pending/canceled runs and reconcile affected edition identities before recovery. Queue admission order need not equal push order. See [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency). This queue is not unlimited storage or a historical backfill service.

Subscribers receive future sends after confirmation. The sender does not iterate historical editions or automatically backfill missed dates. Corrections update the canonical site and require an explicit correction record; they never trigger an automatic replacement email. Changed rendered content for an accepted identity causes manual review. Any exceptional catch-up or replacement send needs a separate explicit editorial and operational decision outside this automation.

## Pause and recover

- **Pause future sending:** set the repository send flag to `false`. Inspect running/queued jobs and Buttondown immediately: changing the flag cannot recall an already accepted email or reliably stop a job already executing. Pause an outstanding provider send through its UI when needed and record the resulting state.
- **Pause acquisition:** set the signup flag to `false` and deploy the site to remove its forms. The flag also prevents future send-job eligibility, so this pauses automatic sending too. If all acquisition must stop, disable the provider-hosted signup entry points separately; removing site forms does not close Buttondown's endpoint. Maintain a monitored channel for existing subscribers' privacy requests.
- **Recover a failed newsletter job:** preserve the healthy Pages deployment. Keep sending paused while reviewing the non-sensitive job summary and provider UI. Compare edition date, slug, digest, message ID, and state; never delete or rename a message to bypass identity checks. For ambiguous or partial delivery, reconcile with Buttondown before any mutation. A matching accepted identity makes a rerun a no-op; a missing identity is safe to create only after the operator establishes that no send was accepted and the original approval/timing still applies. Resolve provider errors manually before rerunning the failed job for its original SHA. Re-enable the send flag only for the intended recovery. Record the outcome; do not redeploy or roll back a healthy site just to repair email.

The job summary contains only edition date, canonical URL, source SHA, content digest, message ID, and operational state. Do not copy full provider responses, recipient lists, credentials, or authorization headers into evidence.

## Rotate the key

Pause sending and reconcile any in-progress request. Create a replacement through Buttondown's secure UI, set `BUTTONDOWN_API_KEY` through the GitHub environment secret UI, and revoke the old credential through the provider. If only one credential can exist, schedule the replacement while sending is paused. Verify access using the next authorized gated job; it must first list/reconcile existing identities. Never create a duplicate message as a credential test. Re-enable sending after verifying access and reconciling pending work. For suspected exposure, revoke promptly and replace through the same UI flow. Do not print keys or pass them as command-line arguments or shell-history literals.

## Capacity, exports, and privacy requests

The [pricing page](https://buttondown.com/pricing), checked 2026-09-30, lists the first 100 active subscribers as free, including custom-domain sending. Its stated baseline assumes at most one full-list email per day. Recheck the current terms before launch and every capacity decision; no payment, paid RSS automation, or provider migration is authorized by this code.

Review the provider's active count regularly without publishing it. At **80 active subscribers**, record a dated capacity review and arrange an operator reminder; no automated count alert exists here. **Before 100**, record an explicit decision to upgrade at the then-current price, migrate, or pause acquisition. Account for pending confirmations that may increase the active count. If unresolved, pause site and provider acquisition and confirm with Buttondown whether existing delivery can continue within its current allowance; pause sending too if capacity is uncertain. Do not delete confirmed subscribers to evade the limit.

Before changing providers, pause acquisition and sends, export subscriber data and consent/confirmation evidence, and obtain unsubscribe, complaint, bounce, blocked, and other suppression history. Confirm what the provider export includes; obtain missing suppression data through the provider before switching. Store exports in restricted operator storage, never Git, Pages output, CI artifacts, or logs. Reconcile independent active/pending/suppressed totals. Load suppressions before eligible recipients, keep unconfirmed contacts unconfirmed, and prove unsubscribed or complained addresses cannot be reactivated or sent to. Preserve consent scope and the no-backfill policy; test confirmation, unsubscribe, sender authentication, privacy/contact copy, and duplicate prevention at the destination before an explicitly approved cutover. Keep the former delivery path disabled and dispose of temporary exports under the recorded retention policy.

Handle export/deletion requests through the monitored publication contact and provider tools. Verify the requester securely, disclose only their information, honor unsubscribe immediately, and resolve any retained suppression record needed to prevent renewed delivery. Record the actual retention configuration and material privacy-notice changes without publishing personal information. Buttondown [subscriber cleanup](https://docs.buttondown.com/subscriber-cleanup) preserves protections against accidental resubscription; do not assume a cleaned-up address is safe to import again.
