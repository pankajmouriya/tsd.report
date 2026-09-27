# Minimal GitHub and Cloudflare release process

Status: implemented locally; hosted workflows and the first production deployment remain unverified.

## Release flow

The first live version uses one workflow:

1. Every pull request runs Astro and TypeScript checks, unit tests, fixture validation, a fixture build, internal-link checks, and Gitleaks.
2. Same-repository pull requests optionally deploy the fixture build to a preview branch of the Cloudflare Pages project `tsd-report`.
3. A merge to `main` repeats validation.
4. When production deployment is enabled, the main-branch job validates and builds only the reviewed production corpus.
5. Wrangler uploads `dist/` to the Cloudflare Pages project `tsd-report`.
6. The workflow requests the production Pages URL and fails if it is not reachable.

Production never reads local seed content. An empty production corpus stops the deploy before Cloudflare credentials are used.

## Required Cloudflare project

Create one Direct Upload Pages project:

| Project | Purpose | Custom domain |
| --- | --- | --- |
| `tsd-report` | Pull request previews on `pr-<number>` branches and reviewed production content on `main` | `tsd.report` and optionally `www.tsd.report` |

Do not create a Git-integrated Cloudflare build. GitHub Actions builds the site and Wrangler uploads the generated directory. Preview branch uploads do not replace the production deployment. The deployment token needs Cloudflare Pages edit access for the account containing this project. DNS edit access is not required by the workflow.

Create the empty project from GitHub Actions so fixture content is never uploaded as the initial production deployment:

1. Push the workflow to GitHub.
2. Open **GitHub → Actions → Validate and deploy**.
3. Select **Run workflow**, keep the `main` branch selected, and run it.
4. The manual `setup-cloudflare` job creates the project named by `CLOUDFLARE_PROJECT_NAME` with `main` as its production branch. It exits successfully without changing the project when it already exists.

## GitHub environments and values

Create GitHub environments named `preview` and `production` so GitHub records preview and production deployments.

Add `CLOUDFLARE_API_TOKEN` as a repository secret. It must contain the restricted Cloudflare Pages API token, not the Cloudflare Global API Key.

Add these repository variables:

- `CLOUDFLARE_ACCOUNT_ID=<the account ID that owns the Pages project>`
- `CLOUDFLARE_PROJECT_NAME=tsd-report` before running the manual setup job.
- `TSD_PREVIEW_ENABLED=true` after the Pages project exists and a test preview succeeds.
- `TSD_PRODUCTION_ENABLED=true` only after the first reviewed production edition, production project, custom domain, and production environment secrets are ready.

## First publication checklist

1. Add the first reviewed JSON edition under `data/production/editions/`.
2. Add any reviewed long-form Markdown under `content/production/articles/`.
3. Record genuine `reviewed_by` and `reviewed_at` values. Never copy the temporary values used by automated tests.
4. Run `npm ci`, `npm run check`, `npm test`, `npm run test:content-environments`, `npm run validate:production`, `npm run build:production`, and `npm run check:links`.
5. Open a pull request and verify validation and secret scanning. If previews are enabled, inspect the `pr-<number>.tsd-report.pages.dev` URL.
6. Confirm the production Pages project has the intended custom domain and active TLS.
7. Set `TSD_PRODUCTION_ENABLED=true`.
8. Merge the reviewed pull request to `main`.
9. Verify the production job and visit both `https://tsd-report.pages.dev/` and `https://tsd.report/`.

## Rollback

For the first release, use Cloudflare Pages deployment history:

1. Open **Workers & Pages → tsd-report → Deployments**.
2. Select the last known-good production deployment.
3. Choose **Rollback to this deployment**.
4. Verify the Pages URL and `https://tsd.report/`.

Keep changes small and merge a corrective commit after recovery so `main` again represents the intended production state.

## Deferred until needed

- Automated SemVer and GitHub Release creation
- Scheduled content collection and candidate pull requests
- Separate staging and retained-artifact promotion
- Automated deployment inventory and rollback rehearsal
- Multi-step authorization and release evidence packages
- CodeQL and broader scheduled security workflows

These are not prerequisites for the first reviewed static edition.
