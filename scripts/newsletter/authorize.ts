import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

const repository = 'pankajmouriya/tsd.report';
const runsSchema = z.object({ workflow_runs: z.array(z.object({
  id: z.number().int().positive(), head_sha: z.string(), head_branch: z.string().nullable(),
  event: z.string(), conclusion: z.string().nullable(),
})).max(100) });
const jobsSchema = z.object({ jobs: z.array(z.object({ name: z.string(), conclusion: z.string().nullable() })).max(100) });

export async function assertNewsletterRelease(input: {
  sha: string; editionDate: string; token: string; fetchImpl?: typeof fetch;
}): Promise<void> {
  if (!/^[a-f0-9]{40}$/.test(input.sha) || !/^\d{4}-\d{2}-\d{2}$/.test(input.editionDate) || !input.token) {
    throw new Error('Newsletter release identity is missing or invalid');
  }
  const request = input.fetchImpl ?? fetch;
  async function api(path: string): Promise<unknown> {
    const response = await request(`https://api.github.com/repos/${repository}/${path}`, {
      headers: { Authorization: `Bearer ${input.token}`, Accept: 'application/vnd.github+json' },
      redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('Newsletter deployment evidence is unavailable');
    return response.json();
  }
  let deployed = false;
  for (const [workflow, job] of [['validate.yml', 'deploy-production'], ['incident-deploy.yml', 'deploy']]) {
    const runs = runsSchema.parse(await api(`actions/workflows/${workflow}/runs?head_sha=${input.sha}&status=success&per_page=100`));
    for (const run of runs.workflow_runs) {
      if (run.head_sha !== input.sha || run.head_branch !== 'main' || run.conclusion !== 'success'
        || !['push', 'workflow_dispatch'].includes(run.event)) continue;
      const jobs = jobsSchema.parse(await api(`actions/runs/${run.id}/jobs?per_page=100`));
      if (jobs.jobs.some((entry) => entry.name === job && entry.conclusion === 'success')) {
        deployed = true;
        break;
      }
    }
    if (deployed) break;
  }
  if (!deployed) throw new Error('No successful production deployment exists for this newsletter revision');
  for (const path of ['/', `/${input.editionDate.replaceAll('-', '/')}/`]) {
    const response = await request(`https://tsd.report${path}`, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('Newsletter production pages are unavailable');
    const html = await response.text();
    const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
    const revision = tags.find((tag) => /name=["']tsd-revision["']/i.test(tag));
    const robots = tags.find((tag) => /name=["']robots["']/i.test(tag));
    if (!revision?.includes(`content="${input.sha}"`) || !robots || /noindex/i.test(robots)) {
      throw new Error('The served newsletter edition does not match the deployed production revision');
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.env.CONTENT_MODE = 'production';
    const { loadEditions } = await import('../../src/lib/content');
    const edition = loadEditions('production')[0];
    if (!edition || edition.date !== process.env.EXPECTED_EDITION_DATE || edition.newsletter?.status !== 'approved') {
      throw new Error('Select the newest approved production newsletter edition');
    }
    await assertNewsletterRelease({ sha: process.env.GITHUB_SHA ?? '', editionDate: edition.date, token: process.env.GH_TOKEN ?? '' });
    console.log('Approved edition and served production revision verified; no email sent');
  } catch {
    console.error('Newsletter release authorization failed; inspect edition approval and deployment evidence');
    process.exitCode = 1;
  }
}
