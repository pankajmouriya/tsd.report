import { describe, expect, it, vi } from 'vitest';
import { assertNewsletterRelease } from '../../scripts/newsletter/authorize';

const sha = 'a'.repeat(40);
const runUrl = 'https://api.github.com/repos/pankajmouriya/tsd.report/actions/runs/123/jobs?per_page=100';
const workflowUrl = 'https://api.github.com/repos/pankajmouriya/tsd.report/actions/workflows/validate.yml/runs?head_sha='+sha+'&status=success&per_page=100';
function transport(change = '') {
  return vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    const value = String(url);
    if (value === workflowUrl && change === 'incident') return Response.json({ workflow_runs: [] });
    if (value === workflowUrl || (change === 'incident' && value.includes('incident-deploy.yml/runs?'))) return Response.json({ workflow_runs: [{ id: 123, head_sha: change === 'sha' ? 'b'.repeat(40) : sha, head_branch: change === 'branch' ? 'untrusted' : 'main', event: change === 'event' ? 'pull_request' : 'push', conclusion: 'success' }] });
    if (value === runUrl) return Response.json({ jobs: [{ name: change === 'incident' ? 'deploy' : 'deploy-production', conclusion: change === 'job' ? 'skipped' : 'success' }] });
    if (value.includes('api.github.com')) return Response.json({ workflow_runs: [] });
    expect(options?.headers ?? {}).not.toHaveProperty('Authorization');
    if (change === 'edition' && value.includes('/2026/11/07/')) return new Response('', { status: 404 });
    return new Response(`<meta name="tsd-revision" content="${change === 'served' ? 'b'.repeat(40) : sha}"><meta name="robots" content="${change === 'preview' ? 'noindex, nofollow' : 'index, follow'}">`);
  });
}

describe('manual newsletter deployment authorization', () => {
  it('requires a successful production deployment and the exact served revision', async () => {
    await expect(assertNewsletterRelease({ sha, editionDate: '2026-11-07', token: 'test', fetchImpl: transport() })).resolves.toBeUndefined();
  });
  it('accepts the same-SHA trusted incident deployment path', async () => {
    await expect(assertNewsletterRelease({ sha, editionDate: '2026-11-07', token: 'test', fetchImpl: transport('incident') })).resolves.toBeUndefined();
  });
  it.each(['sha','job','served','preview','branch','event','edition'])('rejects %s disagreement before provider access', async (change) => {
    await expect(assertNewsletterRelease({ sha, editionDate: '2026-11-07', token: 'test', fetchImpl: transport(change) })).rejects.toThrow();
  });
  it('fails closed on unavailable deployment evidence', async () => {
    await expect(assertNewsletterRelease({ sha, editionDate: '2026-11-07', token: 'test', fetchImpl: async () => new Response('', { status: 503 }) })).rejects.toThrow();
  });
});
