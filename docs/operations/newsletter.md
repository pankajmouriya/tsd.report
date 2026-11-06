# Buttondown newsletter operations

Status, 2026-10-31: the first approved October 31 edition was published and Buttondown reports its email as `sent`. The hosted provider preflight found exactly one matching email; the production send job then returned `already-accepted` without creating another. Inbox receipt across subscribers was not independently checked. The editor authorized ongoing delivery for future approved editions, so the repository variable `TSD_NEWSLETTER_SEND_ENABLED` remains `true`. Keep separate editorial approval for every new edition.

The editor reported that the Buttondown account and sender are verified, an owner-only provider test passed, and the active subscriber count is under 80. GitHub holds `BUTTONDOWN_API_KEY` only in the `production` environment. The current key was verified against the provider and confirmed for sending during the first-send recovery. Do not copy a local `.env` key into source or logs.

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

Keep `TSD_NEWSLETTER_SEND_ENABLED` at repository scope: the job-level `if` gate reads it before the `production` environment starts. An environment variable with this name does not enable that gate; [GitHub makes environment-level variables available only after job start](https://docs.github.com/en/actions/reference/workflows-and-actions/variables#configuration-variable-precedence). The editor authorized a standing `true` value after the first send. A new edition still needs its own reviewed `approved` newsletter object; the flag alone cannot authorize email. Set it to `false` only for a concrete pause or unresolved delivery risk, then restore the intended standing state after reconciliation.

## Set up the provider before opening signup

1. Create the newsletter in the owner's Buttondown account through its signup UI. Retain account ownership and recovery access securely. Check the current plan before enabling any paid feature.
2. Keep [double opt-in](https://docs.buttondown.com/double-opt-in) enabled. An initial native form POST is a confirmation request; only a confirmed subscriber may receive an edition. Do not import contacts as confirmed without consent evidence.
3. In Buttondown's sending-domain settings, configure the operator-supplied sender identity and monitored reply destination. Complete the verification requested by the provider. Send an owner-only provider test, check the displayed sender, and reply to it to prove the reply reaches the monitored inbox. Keep real addresses out of issue bodies, screenshots, and logs.
4. Follow the account's [custom sending-domain instructions](https://docs.buttondown.com/sending-from-a-custom-domain) for its exact DNS records. Manual setup uses provider-supplied authentication records; managed setup delegates a dedicated sending subdomain. Keep the existing Pages hostname records, root nameservers, and mail service records intact. Inspect existing records first; do not create a second SPF policy at the same hostname or replace an existing MX record without resolving its mail-service impact. Choose a dedicated sending subdomain if records would collide. Add only the required provider records and wait for its verification. This does not require moving the Pages site or enabling a Buttondown web archive.
5. Set the public username and monitored publication contact in the repository variables. Verify the `/privacy` notice and its export/deletion contact, provider retention/suppression settings, and unsubscribe wording. TSD collects only email and maintains no subscriber database. No analytics add-on is part of this implementation.
6. Generate the API key in Buttondown's API settings and store it directly in the `production` environment secret UI. Use newsletter-limited scope if available. Do not paste it into chat, shell history, tracked source, builds, or artifacts. If a local `.env` copy exists, keep it untracked and restricted; the GitHub send job reads only the production environment secret.
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

For a PR that changes a production edition, the Pages preview at `https://pr-<number>.<project>.pages.dev` renders the proposed dated edition with an unpublished notice and `noindex, nofollow`; its workflow checks the dated route. It disables signup on that preview. The newsletter's exact Markdown still belongs in the PR description or review artifact, because the Pages route is the site edition and does not show Buttondown's delivered template.

For each new edition, arrange a reviewed content pull request with real newsletter approval. The new approval and timestamp authorize subject, preview, selection, audience, and timing; article/source review does not supply this authorization. The standing send flag can remain `true`: the sender acts only after the newest approved production edition deploys successfully and its identity has no accepted provider match. Leave other editions unapproved.

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
- **Pause acquisition:** set the signup flag to `false` and deploy the site to remove its forms. The flag also prevents future send-job eligibility, so this pauses automatic sending too. If all acquisition must stop, disable the provider-hosted signup entry points separately; removing site forms does not close Buttondown's endpoint. Keep `TSD_PUBLICATION_CONTACT_URL` configured and monitored: `/privacy` validates and displays it independently of the signup flag for existing subscribers' export/deletion requests. A configured invalid contact fails the build even during a pause.
- **Recover a failed newsletter job:** preserve the healthy Pages deployment. Inspect the non-sensitive job summary and provider UI before retrying. Compare edition date, slug, digest, message ID, and state; never delete or rename a message to bypass identity checks. For ambiguous or partial delivery, pause sending and reconcile with Buttondown before any mutation. A matching accepted identity makes a rerun a no-op; a missing identity is safe to create only after the operator establishes that no send was accepted and the original approval/timing still applies. Resolve provider errors before rerunning the failed job for its original SHA. Restore the intended standing send state after a temporary pause and record the outcome; do not redeploy or roll back a healthy site just to repair email.

For a read-only provider diagnosis, dispatch `Inspect newsletter provider` on `main` with `edition_date` set to the newest reviewed edition. The job refuses non-`main` refs. It uses the `production` environment key to list emails only and reports the HTTP error category or the number and states of records matching that edition; it does not log provider bodies, email IDs, subscriber data, or the key. It cannot prove mail was delivered. Reconcile any matching record in Buttondown before another send attempt; pause the standing send gate when the result is ambiguous or partial.

During the first send, Buttondown returned `sending_requires_confirmation` on the initial `about_to_send` create request. Its response required a one-time `X-Buttondown-Live-Dangerously` confirmation for that API key. After a read-only inventory found no matching email, a controlled send of the approved edition with that header was accepted. Do not add this broad guardrail-bypass header to routine sender requests. A replacement key may require its own one-time confirmation before it can create an email; establish provider state and editorial authorization before handling that response.

The job summary contains only edition date, canonical URL, source SHA, content digest, message ID, and operational state. Do not copy full provider responses, recipient lists, credentials, or authorization headers into evidence.

## Rotate the key

1. Record the intended gate state and set `TSD_NEWSLETTER_SEND_ENABLED=false` to pause new send jobs. Reconcile running, queued, and ambiguous edition requests in Buttondown; a gate change cannot recall an accepted email. Resolve any identity conflict or partial delivery before planning verification.
2. Create a replacement through Buttondown's secure UI, update `BUTTONDOWN_API_KEY` through the GitHub `production` environment secret UI, and revoke the old credential through the provider. If only one credential can exist, replace it while sending is paused. For suspected exposure, revoke promptly. Do not print keys or pass them as command-line arguments or shell-history literals.
3. Choose an authorized verification run whose reviewed production edition remains `approved` and exactly matches one already accepted provider identity, including its rendered-body digest. Prefer rerunning only the send job from an eligible production push run with a successful deployment/smoke dependency for the same SHA. Its provider inventory request verifies access and its `already-accepted` result must be an idempotent no-op. Confirm the provider identity still exists before running; the sender creates an email when no match exists. If an appropriate accepted edition/run is unavailable, keep sending paused and defer verification until a separately approved real edition is intentionally ready to send. Missing newsletter metadata or `draft` only skips and does not verify the key.
4. Before the chosen run, check other pending runs for unintended approved sends. Temporarily set `TSD_NEWSLETTER_SEND_ENABLED=true` only when this verification or real send is authorized and the production, signup, and successful-deployment gates also hold. There is no authentication-only command or provider-access check through a disabled send job. Run the chosen job and inspect its non-sensitive summary and provider state: expect `already-accepted` for verification, or the intended `queued` result for the separately approved real edition. Reconcile any failure or ambiguous result before another attempt.
5. Restore or retain the intended gate state after verification. Leave sending disabled if ongoing delivery is not authorized or verification failed; keep it enabled only when standing delivery authorization applies. Record the non-sensitive rotation outcome and any unresolved recovery work.

## Capacity, exports, and privacy requests

The [pricing page](https://buttondown.com/pricing), checked 2026-09-30, lists the first 100 active subscribers as free, including custom-domain sending. Its stated baseline assumes at most one full-list email per day. Recheck the current terms before launch and every capacity decision; no payment, paid RSS automation, or provider migration is authorized by this code.

Review the provider's active count regularly without publishing it. At **80 active subscribers**, record a dated capacity review and arrange an operator reminder; no automated count alert exists here. **Before 100**, record an explicit decision to upgrade at the then-current price, migrate, or pause acquisition. Account for pending confirmations that may increase the active count. If unresolved, pause site and provider acquisition and confirm with Buttondown whether existing delivery can continue within its current allowance; pause sending too if capacity is uncertain. Do not delete confirmed subscribers to evade the limit.

Before changing providers, pause acquisition and sends, export subscriber data and consent/confirmation evidence, and obtain unsubscribe, complaint, bounce, blocked, and other suppression history. Confirm what the provider export includes; obtain missing suppression data through the provider before switching. Store exports in restricted operator storage, never Git, Pages output, CI artifacts, or logs. Reconcile independent active/pending/suppressed totals. Load suppressions before eligible recipients, keep unconfirmed contacts unconfirmed, and prove unsubscribed or complained addresses cannot be reactivated or sent to. Preserve consent scope and the no-backfill policy; test confirmation, unsubscribe, sender authentication, privacy/contact copy, and duplicate prevention at the destination before an explicitly approved cutover. Keep the former delivery path disabled and dispose of temporary exports under the recorded retention policy.

Handle export/deletion requests through the monitored publication contact and provider tools. Verify the requester securely, disclose only their information, honor unsubscribe immediately, and resolve any retained suppression record needed to prevent renewed delivery. Record the actual retention configuration and material privacy-notice changes without publishing personal information. Buttondown [subscriber cleanup](https://docs.buttondown.com/subscriber-cleanup) preserves protections against accidental resubscription; do not assume a cleaned-up address is safe to import again.
