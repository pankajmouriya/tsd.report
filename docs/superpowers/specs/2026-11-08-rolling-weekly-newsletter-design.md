# Rolling weekly newsletter drafts

The editor requests automatic draft creation/update after an approved incident is published. Confirmed decisions: Sunday edition dates in Asia/Kolkata; final newsletter sending remains a separate manual action. Merging the weekly PR approves its exact edition selection and email copy for publication, never sending.

## Flow and boundaries

1. The trusted incident publisher explicitly dispatches weekly refresh after its immutable publication commit. Bot-generated events do not reliably trigger another workflow.
2. Refresh reads validated canonical publications and all finalized newsletter editions. A story ID or slug already present in any published approved newsletter is reserved, whether or not that email has been sent. Corrections to the same canonical identity do not automatically repeat it next week. Use the latest finalized letter’s collection time to exclude older unlettered archives while carrying pending publications after assembly/freeze; legacy letters fall back to their genuine approval time.
3. With unpublished stories, create/reuse one same-repository bot draft PR on `automation/newsletter-YYYY-MM-DD`, changing only `data/candidates/editions/YYYY-MM-DD.json`. Empty refreshes do not create empty editions. Sunday dates follow Asia/Kolkata; an already finalized Sunday rolls to the following Sunday. Reuse an existing open weekly PR even when overdue.
4. While draft, preserve the editor's subject, preview, lead and existing reading order; refresh canonical snapshots and append newly published stories. A ready-for-review PR is frozen. Further stories stay pending until finalization, when refresh collects them into the next edition. A manually closed unmerged draft is not silently reopened.
5. Validate only bounded regular JSON fetched from the PR. Run trusted main code; never execute a PR branch. Every story must exactly match a current validated canonical publication and be absent from finalized newsletters. Preserve all source/review metadata. Validate unique IDs, Sunday date, inert single-line subject/preview and section membership.
6. Render the exact Markdown and noindex unapproved HTML with the existing renderer. Put the exact email, head and candidate hash in the PR and retain artifacts. A named GitHub Actions check binds validation to the candidate hash and head. All writer jobs are serialized; non-force Git commits prevent concurrent work from being overwritten.
7. Only a real merge by `pankajmouriya` of a validated bot-owned candidate-only PR authorizes publication. Record the real merge actor/time and review provenance; never fabricate a GitHub Approve review. Derive production edition/newsletter approval metadata from that event. Commit the edition and review record atomically while deleting the candidate. Existing editions and their reservation history are immutable. Recovery reuses an identical record.
8. Explicitly dispatch the existing production validation/deployment workflow, then refresh pending stories for the next draft. Neither path invokes the sender or obtains Buttondown credentials. The existing manual send workflow, provider reconciliation and same-revision checks stay intact.

## Implementation

Reuse the existing TypeScript production story/edition contracts, incident snapshot conversion, newsletter renderer and GitHub CLI authentication. Add a weekly candidate contract and pure calendar/selection/validation helpers; isolate bounded GitHub REST operations and workflow orchestration. Python's incident publisher only dispatches refresh. Add no dependency, service, runtime API, model, or collector.

An activation variable gates trusted weekly automation. Enable it only after integration checks and a hosted reconciliation pass. The current November 8 edition already reserves its seven stories; activation must not regenerate that letter. Hosted creation/finalization requires a genuinely new approved incident; unit and workflow tests cover these paths without publishing synthetic content.

## Verification

Test week boundaries in Asia/Kolkata, Sunday finalization, overdue/frozen/closed PRs, revision/slug deduplication, pending carryover, empty runs, repeated refresh, one PR, preservation of human copy/order, immutable source matching, forged metadata, stale check/head, foreign author/repository, non-editor merge, extra/symlink paths, idempotent publication and non-force race failures. Verify explicit dispatches, trusted-main checkout, serialized writers, secret isolation and continued manual-only sending. Run relevant TypeScript/Python suites, schema generation, builds and existing publication gates. No live email is an acceptance test.

Reconciliation also runs hourly at minute 52 as recovery for missed event dispatches; the same activation gate applies. Candidate-only main merges are detected from their full changed-path set and defer production upload to the trusted content publisher. This prevents a competing deployment of the pre-promotion main revision without suppressing any real code or production-content deployment. Newsletter rendering now accepts its explicit minimal edition-copy input shape, allowing validated candidate previews without casting them to reviewed production editions.

Production loading/build validation also reconstructs each automated draft hash from its immutable edition and merge ledger, rejecting altered or orphaned records. Legacy manually approved editions remain valid without a new synthetic ledger.
