# Incident discovery and publication operations

Status: integrated and hosted first-article publication verified on 2026-10-30. The monitor and candidate preview were exercised; PR #23's real editor merge was recovered through the merged editor-merge gate and deployed at revision `8a561ba9afd84e40825fd3c45dc6af8522a93b64`. No model API, database, CMS or reader account is required.

## Workflows and data

| Workflow | Responsibility |
| --- | --- |
| `incident-monitor.yml` | Hourly source discovery, checkpoints, raw evidence and one rolling `TSD incident leads` issue |
| `incident-propose.yml` | Validate a content-only branch, open/reuse a bot PR, explicitly dispatch candidate validation |
| `incident-validate.yml` | Execute trusted `main` code, fetch only the candidate JSON, independently check source excerpts, run tests/contracts, build its actual production-context noindex preview and report a head/hash-bound check |
| `incident-publish.yml` | Re-evaluate editor authorization/checks, merge an approved current head when needed, commit its deterministic publication record and explicitly dispatch deployment |
| `incident-deploy.yml` | Verify the recorded review/main ancestry, scan secrets, validate/build the publication revision, deploy, verify the public article/homepage/served SHA and report the result |

The source registry is `config/incident-sources.json`: ten feeds, five public research indexes and two structured dataset change streams. `config/incident-overrides.json` can map related source URLs to an editor-chosen group and dismiss group/lead IDs. A shared package/CVE name never automatically joins two incidents. The rolling issue lists report links for investigation and summarizes each structured repository change stream separately. A `Publish Advisories` or `Ingest OSV - GHSA Malware` commit is a batch or ingestion event, not an incident report; inspect its individual records and original references before proposing a story. The retained state reserves at most 50 signals per structured source, 100 total, within its 500-entry limit so one busy stream cannot evict other signals or all report leads.

Candidates live under `data/candidates/incidents/`. Published records live under `data/production/incidents/<incident_id>/<revision>.json`; they contain the unchanged authorized candidate, content hash, actual GitHub Approve review or editor merge event, and publication time. The homepage includes the latest twenty incident identities plus the latest editorial edition; canonical article/category/tag/feed discovery includes the publication catalogue. Dated editions continue using their frozen snapshots. The same canonical incident identity may appear in multiple dated snapshots, while unrelated duplicate IDs/slugs still fail validation.

New incident identities use candidate schema version 2 with a validated `destination_source_id`. The source is an original or official report in the evidence packet. The homepage shows a short brief; its headline and other reader-facing links open that source. `/article/[slug]` remains a stable TSD provenance record, not a rewritten copy of the external report. Previously published version 1 incidents and their corrections remain readable without altering their immutable records. An unpublished version 1 first-revision candidate must be updated and revalidated before publication.

## Activation gates

Integrate and validate the feature-code PR normally. Do not use the content publisher to merge a feature-code PR. New workflow dispatches require the workflow definitions to exist on the default branch; a local or feature-branch test does not establish hosted acceptance.

1. Keep `TSD_INCIDENT_MONITOR_ENABLED` and `TSD_INCIDENT_PUBLISH_ENABLED` unset until their acceptance steps below are ready. Existing production/preview settings and Cloudflare credentials are reused. Do not enable repository-wide native auto-merge or relax protections.
2. Manually dispatch `incident-monitor.yml` after integration. Inspect its artifacts and lead issue. Verify checkpoint restoration, bounded repeat updates, source failure preservation and that no article PR or publication is created by discovery.
3. Use the [authoring guide](../editorial/incident-authoring.md) to prepare a genuine incident candidate and dispatch `incident-propose.yml`. Verify bot authorship, exact changed-path scope, independently fetched source evidence, the real noindex preview and successful `incident-candidate` check for the head/hash.
4. Set `TSD_INCIDENT_PUBLISH_ENABLED=true` when the trusted publication exercise is ready. Pankaj's real Approve review of the current head authorizes automatic merge and publication. If Pankaj directly merges a validated content PR, that GitHub merge event also authorizes publication. The record identifies which event occurred; it never fabricates a review. Do not use a synthetic fixture for the exercise.
5. Verify the reviewed copy remains identical through merge and the separate metadata/publication commit. Confirm the explicit deployment dispatch, exact served revision, article/homepage/feed presence, immutable archive behavior and source links. Inspect recovery results. This is the hosted approval-to-publication acceptance gate.
6. Enable `TSD_INCIDENT_MONITOR_ENABLED=true` after the manual discovery pass meets its acceptance criteria. The schedule runs at minute 41 hourly; GitHub scheduling delays mean it is not a timeliness guarantee.

No additional provider secret is needed. Candidate validation has no production publishing token or newsletter key. Publishing executes only trusted default-branch code; untrusted PR content is fetched through bounded JSON APIs, never checked out and executed.

## Local commands

```sh
uv run --locked pytest -q
uv run --locked ruff check pipeline tests/pipeline
npm run check
npm test
npm run generate:schema

uv run --locked python -m pipeline.incidents.cli discover \
  --state /tmp/tsd-incidents/state.json --run-dir /tmp/tsd-incidents/run
```

The local discovery command has no GitHub write action unless explicitly given `--update-queue` or `--queue-issue`. Run artifacts retain raw source responses and manifests. The hosted monitor restores its last successful state artifact before collection and fails rather than silently replacing an unavailable checkpoint. Its state is bounded to 500 leads and its issue to forty groups; old immutable publications are retained independently. Expired/missing checkpoint artifacts require deliberate recovery, not an empty fallback.

To inspect an actual candidate locally, copy its validated JSON to its candidate path and run:

```sh
CONTENT_MODE=production TSD_INCIDENT_PREVIEW=YOUR-INCIDENT-ID npm run build
npm run check:links
npm run preview
```

The selector accepts an incident name, not a fetch URL or filesystem path. This build is visibly unreviewed and `noindex`; its feeds also say preview. It does not forge reviewer metadata. Normal production builds omit the selector and never load candidates. Hosted production deployment explicitly clears it.

The separate browser suite uses a synthetic fixture only in a disposable local preview:

```sh
mkdir -p data/candidates/incidents
cp tests/fixtures/incidents/candidate.json data/candidates/incidents/synthetic-release-alert.json
CONTENT_MODE=production TSD_INCIDENT_PREVIEW=synthetic-release-alert npm run build
npx playwright test --config playwright.incidents.config.ts
rm data/candidates/incidents/synthetic-release-alert.json
```

Fixture promotion is prohibited. Rebuild normal fixture/production output before testing or publishing that output.

## Failure and recovery

- Discovery failure preserves previous leads and checkpoints. A completely failed collection cannot replace state or the queue. A successful old/unchanged feed is valid; the newest post does not need today's date.
- Candidate syntax, evidence or build failures stop the check. Source changes that remove a cited excerpt quarantine the candidate rather than silently changing its facts; inspect the retained original and new captures and prepare a corrected draft.
- Approval before validation waits; validation completion explicitly re-dispatches the approval gate. An old-head approval, active blocking review, fork, non-bot author, non-regular candidate file or extra changed path cannot publish.
- A direct editor merge triggers `incident-publish.yml` on PR close. If the PR was merged before this trigger existed, manually dispatch `incident-publish.yml` with that PR number after the fix reaches `main`. Only a merge by the configured editor, with GitHub's merge SHA and timestamp, can use this recovery path. The candidate check must still match the head and content hash.
- The merge uses GitHub's expected-head SHA. A normal single-parent Git ref update commits the derived publication record; a concurrent main update fails rather than overwriting work. If merge succeeds but promotion/dispatch fails, rerun `incident-publish.yml` for the same PR. It verifies the original candidate/review and reuses an existing identical publication instead of rewriting it.
- Production uploads share serialization with the existing deployment workflow. A superseded build is rejected before upload. Re-dispatch the publisher to deploy current main, including all committed approved records.
- Before uploading, the deployment workflow records the previous successful Cloudflare deployment ID. If upload or public revision verification fails, it attempts [Cloudflare's rollback API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/rollback/), only if the current deployment still belongs to the attempted SHA. A different deployment is never rolled back. Check rollback results; an unsuccessful API recovery requires the existing manual Pages rollback procedure.
- A failed publication verification is reported on the PR. A success comment is posted only after the public article and homepage contain the expected served revision. These checks do not prove global CDN convergence or accessibility conformance.
- For a version 2 external brief, live verification also checks the selected original-source link on the homepage and direct provenance page. For a version 1 incident, it checks the existing internal article link. A missing expected destination fails verification and enters the normal deployment recovery path.
- Unset `TSD_INCIDENT_PUBLISH_ENABLED` to stop further automatic content publication. Unset the monitor flag to stop scheduled discovery. Neither action deletes published history or recalls an email.

The publisher explicitly dispatches validation/deployment rather than relying on bot-generated `push`/PR events; [GitHub documents the event suppression and dispatch exceptions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow). It respects configured branch protections and may be blocked if direct trusted promotion commits are prohibited. Such a policy change needs its own reviewed integration, not a bypass.

No incident approval adds newsletter approval metadata or invokes newsletter sending.
