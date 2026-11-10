import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { z } from 'zod';
import { loadIncidentPublications, incidentStory } from '../../src/lib/incidents';
import { productionEditionSchema, weeklyNewsletterCandidateSchema, type Edition, type Story, type WeeklyNewsletterCandidate } from '../../src/lib/schema';
import { buildNewsletterDigest, renderNewsletterMarkdown, renderNewsletterPreviewHtml } from '../../src/lib/newsletter';
import { buildWeeklyDraft, validateWeeklyDraft, finalizeWeeklyDraft, weeklyHash, WEEKLY_CHECK, WEEKLY_EDITOR } from '../../src/lib/weekly-newsletter';
import { NewsletterGitHub } from './github';
export interface WeeklyGitHub {
  repository: string;
  api(path: string, method?: string, data?: unknown): unknown;
  pages(path: string): unknown[];
  jsonFile(path: string, ref: string): unknown | undefined;
  regularFile(path: string, ref: string): void;
  writeCommit(branch: string, parent: string, changes: Record<string, unknown | null>, message: string): string;
  dispatch(workflow: string, inputs: Record<string, string>): void;
}
export interface WeeklyCatalog {
  sha: string;
  stories: Story[];
  editions: Edition[];
}
const sha = z.string().regex(/^[a-f0-9]{40}$/);
const user = z.object({ login: z.string() });
const prSchema = z.object({
  number: z.number().int().positive(),
  state: z.enum(['open', 'closed']),
  draft: z.boolean().default(false),
  merged: z.boolean().default(false),
  merged_by: user.nullable().optional(),
  merged_at: z.iso.datetime().nullable().optional(),
  merge_commit_sha: sha.nullable().optional(),
  html_url: z.url(),
  user,
  changed_files: z.number().int().nonnegative(),
  head: z.object({ ref: z.string(), sha, repo: z.object({ full_name: z.string() }) }),
  base: z.object({ ref: z.string() }),
});
const candidatePath = (date: string) => `data/candidates/editions/${date}.json`;
const branchName = (date: string) => `automation/newsletter-${date}`;
const mainSha = (gh: WeeklyGitHub) => z.object({ object: z.object({ sha }) }).parse(gh.api('git/ref/heads/main')).object.sha;
function assertCurrent(gh: WeeklyGitHub, catalog: WeeklyCatalog) {
  if (mainSha(gh) !== catalog.sha)
    throw new Error('Main changed; rerun using current trusted main');
}
function inlineMarkdown(value: string): string {
  return value.replace(/([\\`*_{}\[\]()<>#@!|])/g, '\\$1');
}
function reviewBody(candidate: WeeklyNewsletterCandidate, head: string): string {
  const body = [
    `# Weekly newsletter — ${candidate.date}`,
    'This bot-maintained draft collects newly published incidents. Mark ready for review to freeze it. **Merging this PR as the editor approves the exact edition and newsletter copy below for publication. Sending remains a separate manual action.**',
    `Edition: ${candidate.date} (Sunday, Asia/Kolkata). Audience: existing eligible subscribers.`,
    `Head: \`${head}\`. Candidate SHA-256: \`${weeklyHash(candidate)}\`. Validation and artifacts apply only to this revision.`,
    `Subject: **${inlineMarkdown(candidate.newsletter.subject)}**`,
    `Preview: ${inlineMarkdown(candidate.newsletter.preview_text)}`,
    'The dated edition link becomes live after publication. Original story snapshots, sources and reviews are preserved. Stories already in any finalized newsletter are excluded, including unsent editions. Pending additions after a frozen/finalized edition roll forward.',
    '## Exact newsletter Markdown',
    renderNewsletterMarkdown(buildNewsletterDigest(candidate)),
  ].join('\n\n');
  if (body.length > 60000)
    throw new Error('Weekly review exceeds the PR body limit');
  return body;
}
export function loadWeeklyPr(gh: WeeklyGitHub, number: number) {
  const pr = prSchema.parse(gh.api(`pulls/${number}`));
  const match = /^automation\/newsletter-(\d{4}-\d{2}-\d{2})$/.exec(pr.head.ref);
  if (!match || pr.head.repo.full_name !== gh.repository || pr.base.ref !== 'main' || pr.user.login !== 'github-actions[bot]')
    throw new Error('Not an eligible same-repository bot weekly PR');
  const path = candidatePath(match[1]);
  const files = z.array(z.object({ filename: z.string(), status: z.string() })).parse(gh.pages(`pulls/${number}/files`));
  if (pr.changed_files !== 1 || files.length !== 1 || files[0].filename !== path || !['added', 'modified'].includes(files[0].status))
    throw new Error('Weekly PR must change only its candidate JSON');
  gh.regularFile(path, pr.head.sha);
  const candidate = weeklyNewsletterCandidateSchema.parse(gh.jsonFile(path, pr.head.sha));
  if (candidate.date !== match[1])
    throw new Error('Weekly candidate date differs from its branch');
  return { pr, candidate, path };
}
export function refreshWeeklyDraft(gh: WeeklyGitHub, catalog: WeeklyCatalog, now = new Date()) {
  assertCurrent(gh, catalog);
  const initial = buildWeeklyDraft(catalog.stories, catalog.editions, now);
  if (!initial)
    return { status: 'no-unpublished-stories' };
  const open = gh.pages('pulls?state=open&base=main')
    .map(value => z.object({ number: z.number(), state: z.string(), head: z.object({ ref: z.string() }) }).parse(value))
    .filter(p => p.state === 'open' && p.head.ref.startsWith('automation/newsletter-'));
  if (open.length > 1)
    throw new Error('Multiple open weekly PRs require editorial reconciliation');
  const existing = open.length ? loadWeeklyPr(gh, open[0].number) : undefined;
  if (existing && !existing.pr.draft)
    return { status: 'frozen-for-review', pr: existing.pr.number };
  let previous = existing?.candidate;
  let parent = existing?.pr.head.sha;
  const targetDate = previous?.date ?? initial.date;
  const path = candidatePath(targetDate), branch = branchName(targetDate);
  if (!existing) {
    const history = gh.pages(`pulls?state=all&head=${encodeURIComponent(gh.repository.split('/')[0] + ':' + branch)}`);
    if (history.length)
      return { status: 'closed-draft-requires-editor' };
    const orphan = gh.jsonFile(path, branch);
    if (orphan !== undefined) {
      gh.regularFile(path, branch);
      parent = z.object({ object: z.object({ sha }) }).parse(gh.api(`git/ref/heads/${branch}`)).object.sha;
      const comparison = z.object({ files: z.array(z.object({ filename: z.string(), status: z.string() })) }).parse(gh.api(`compare/main...${parent}`));
      if (comparison.files.length !== 1 || comparison.files[0].filename !== path || !['added', 'modified'].includes(comparison.files[0].status))
        throw new Error('Orphan weekly branch has unrelated changes');
      previous = weeklyNewsletterCandidateSchema.parse(orphan);
      if (previous.date !== targetDate)
        throw new Error('Orphan weekly date differs from branch');
    }
  }
  const candidate = buildWeeklyDraft(catalog.stories, catalog.editions, now, previous)!;
  if (existing && isDeepStrictEqual(candidate, existing.candidate)) {
    if (!weeklyCheckSucceeded(gh, existing.pr.head.sha, weeklyHash(candidate)))
      gh.dispatch('weekly-newsletter.yml', { operation: 'validate', pr_number: String(existing.pr.number) });
    return { status: 'unchanged', pr: existing.pr.number };
  }
  if (existing) {
    const fresh = prSchema.parse(gh.api(`pulls/${existing.pr.number}`));
    if (!fresh.draft || fresh.state !== 'open')
      return { status: 'frozen-for-review', pr: fresh.number };
    if (fresh.head.sha !== existing.pr.head.sha || fresh.base.ref !== 'main')
      throw new Error('Weekly head or base changed during refresh');
  }
  const head = previous && isDeepStrictEqual(candidate, previous) && parent
    ? parent
    : gh.writeCommit(branch, parent ?? catalog.sha, { [path]: candidate }, `content: update weekly newsletter ${candidate.date}`);
  let number = existing?.pr.number;
  if (number)
    gh.api(`pulls/${number}`, 'PATCH', { body: reviewBody(candidate, head) });
  else
    number = z.object({ number: z.number().int().positive() }).parse(gh.api('pulls', 'POST', { head: branch, base: 'main', draft: true, title: `Weekly newsletter: ${candidate.date}`, body: reviewBody(candidate, head) })).number;
  gh.dispatch('weekly-newsletter.yml', { operation: 'validate', pr_number: String(number) });
  return { status: 'draft-updated', pr: number, head, date: candidate.date };
}
export function prepareWeeklyPreview(gh: WeeklyGitHub, catalog: WeeklyCatalog, number: number, directory: string) {
  const { pr, candidate } = loadWeeklyPr(gh, number);
  validateWeeklyDraft(candidate, catalog.stories, catalog.editions);
  const digest = buildNewsletterDigest(candidate);
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, 'candidate.json'), JSON.stringify(candidate, null, 2) + '\n');
  writeFileSync(resolve(directory, 'email.md'), renderNewsletterMarkdown(digest));
  writeFileSync(resolve(directory, 'email.html'), renderNewsletterPreviewHtml(digest).replace('<p>Email preview</p>', '<p><strong>Unapproved weekly draft — not published or sent.</strong></p>'));
  writeFileSync(resolve(directory, 'manifest.json'), JSON.stringify({ date: candidate.date, head: pr.head.sha, candidate_sha256: weeklyHash(candidate) }, null, 2) + '\n');
  gh.api(`pulls/${number}`, 'PATCH', { body: reviewBody(candidate, pr.head.sha) });
  return { head: pr.head.sha, date: candidate.date, hash: weeklyHash(candidate) };
}
export function reportWeeklyCheck(gh: WeeklyGitHub, catalog: WeeklyCatalog, number: number, head: string, conclusion: 'success' | 'failure') {
  const loaded = loadWeeklyPr(gh, number);
  if (head !== loaded.pr.head.sha)
    throw new Error('Weekly head changed during validation');
  if (conclusion === 'success')
    validateWeeklyDraft(loaded.candidate, catalog.stories, catalog.editions);
  const run = process.env.GITHUB_RUN_ID;
  gh.api('check-runs', 'POST', { name: WEEKLY_CHECK, head_sha: head, external_id: weeklyHash(loaded.candidate), status: 'completed', conclusion, ...(/^\d+$/.test(run ?? '') ? { details_url: `https://github.com/${gh.repository}/actions/runs/${run}` } : {}), output: { title: `Weekly newsletter: ${conclusion}`, summary: `Head ${head}; candidate SHA-256 ${weeklyHash(loaded.candidate)}. Exact email and noindex HTML are retained in the workflow artifacts.` } });
  if (conclusion === 'success' && loaded.pr.merged)
    gh.dispatch('weekly-newsletter.yml', { operation: 'publish', pr_number: String(number) });
}
function weeklyCheckSucceeded(gh: WeeklyGitHub, head: string, digest: string): boolean {
  const checks = z.object({ check_runs: z.array(z.object({ id: z.number().int().positive(), name: z.string(), head_sha: z.string(), external_id: z.string().nullable().optional(), status: z.string(), conclusion: z.string().nullable(), app: z.object({ slug: z.string() }) })).max(100) })
    .parse(gh.api(`commits/${head}/check-runs?check_name=${WEEKLY_CHECK}&filter=latest&per_page=100`));
  const latest = checks.check_runs.filter(c => c.name === WEEKLY_CHECK && c.head_sha === head && c.app.slug === 'github-actions').sort((a, b) => b.id - a.id)[0];
  return latest?.external_id === digest && latest.status === 'completed' && latest.conclusion === 'success';
}
export function publishWeeklyDraft(gh: WeeklyGitHub, catalog: WeeklyCatalog, number: number) {
  const { pr, candidate, path } = loadWeeklyPr(gh, number);
  if (!pr.merged || pr.state !== 'closed' || pr.draft || pr.merged_by?.login !== WEEKLY_EDITOR || !pr.merged_at || !pr.merge_commit_sha)
    throw new Error('Waiting for the editor to merge the validated weekly PR');
  const reviews = gh.pages(`pulls/${number}/reviews`).map(r => z.object({ id: z.number(), state: z.string(), user }).parse(r));
  const latest = new Map<string, string>();
  for (const r of reviews.sort((a, b) => a.id - b.id))
    if (r.state !== 'PENDING')
      latest.set(r.user.login, r.state);
  if ([...latest.values()].includes('CHANGES_REQUESTED'))
    throw new Error('Weekly review requests changes');
  if (!weeklyCheckSucceeded(gh, pr.head.sha, weeklyHash(candidate)))
    throw new Error('Waiting for the head/hash-bound weekly validation check');
  assertCurrent(gh, catalog);
  const ancestry = z.object({ status: z.string() }).parse(gh.api(`compare/${pr.merge_commit_sha}...${catalog.sha}`));
  if (!['ahead', 'identical'].includes(ancestry.status))
    throw new Error('Weekly merge is not an ancestor of main');
  const expected = finalizeWeeklyDraft(candidate, { actor: pr.merged_by.login, merged_at: pr.merged_at, head_sha: pr.head.sha, merge_sha: pr.merge_commit_sha, pr_number: number });
  const editionPath = `data/production/editions/${candidate.date}.json`, recordPath = `data/production/newsletter-reviews/${candidate.date}.json`;
  const existing = gh.jsonFile(editionPath, catalog.sha), record = gh.jsonFile(recordPath, catalog.sha);
  let commit = catalog.sha;
  if (existing !== undefined || record !== undefined) {
    if (!isDeepStrictEqual(existing, expected.edition) || !isDeepStrictEqual(record, expected.record))
      throw new Error('Finalized weekly newsletter is immutable');
  }
  else {
    validateWeeklyDraft(candidate, catalog.stories, catalog.editions);
    const stored = weeklyNewsletterCandidateSchema.parse(gh.jsonFile(path, catalog.sha));
    if (weeklyHash(stored) !== weeklyHash(candidate))
      throw new Error('Merged weekly candidate changed after review');
    commit = gh.writeCommit('main', catalog.sha, { [editionPath]: expected.edition, [recordPath]: expected.record, [path]: null }, `content: publish weekly newsletter ${candidate.date}`);
  }
  gh.dispatch('validate.yml', { operation: 'deploy-production' });
  gh.dispatch('weekly-newsletter.yml', { operation: 'refresh' });
  return { status: 'deployment-queued', date: candidate.date, sha: commit };
}
async function loadCatalog(): Promise<WeeklyCatalog> {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  process.env.CONTENT_MODE = 'production';
  const { loadEditions } = await import('../../src/lib/content');
  const editions = loadEditions('production').map(e => productionEditionSchema.parse(e));
  const publications = loadIncidentPublications();
  if (publications.some(p => p.candidate.fixture))
    throw new Error('Weekly catalog rejects fixture publications');
  return { sha, editions, stories: publications.map(p => incidentStory(p.candidate, p)) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { positionals, values } = parseArgs({ allowPositionals: true, options: { pr: { type: 'string' }, head: { type: 'string' }, conclusion: { type: 'string' }, 'run-dir': { type: 'string', default: 'artifacts/weekly-newsletter' } } });
    const operation = positionals[0], github = new NewsletterGitHub(process.env.GITHUB_REPOSITORY ?? 'pankajmouriya/tsd.report'), catalog = await loadCatalog();
    const number = values.pr ? z.coerce.number().int().positive().parse(values.pr) : undefined;
    let result: unknown;
    if (operation === 'refresh')
      result = refreshWeeklyDraft(github, catalog);
    else if (operation === 'validate' && number) {
      const preview = prepareWeeklyPreview(github, catalog, number, values['run-dir']!);
      result = preview;
      if (process.env.GITHUB_OUTPUT)
        appendFileSync(process.env.GITHUB_OUTPUT, `head=${preview.head}\ndate=${preview.date}\n`);
    }
    else if (operation === 'check' && number && values.head && ['success', 'failure'].includes(values.conclusion ?? ''))
      result = reportWeeklyCheck(github, catalog, number, values.head, values.conclusion as 'success' | 'failure');
    else if (operation === 'publish' && number)
      result = publishWeeklyDraft(github, catalog, number);
    else
      throw new Error('Invalid weekly operation or arguments');
    console.log(JSON.stringify(result ?? { status: 'check-recorded' }));
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : 'Weekly operation failed');
    process.exitCode = 1;
  }
}
