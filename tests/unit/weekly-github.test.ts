import { describe, it, expect } from 'vitest';
import { NewsletterGitHub, WeeklyGitHubError } from '../../scripts/newsletter/github';
const parent = 'a'.repeat(40), next = 'b'.repeat(40), blob = 'c'.repeat(40), tree = 'd'.repeat(40);
class Api extends NewsletterGitHub {
  calls: {
    path: string;
    method: string;
    data: any;
  }[] = [];
  current: string | undefined = parent;
  mode = '100644';
  truncated = false;
  size = 2;
  constructor() { super('example/newspaper'); }
  override api(path: string, method = 'GET', data?: unknown): unknown {
    this.calls.push({ path, method, data });
    if (path.startsWith('git/ref/heads/')) {
      if (!this.current)
        throw new WeeklyGitHubError(404);
      return { object: { sha: this.current } };
    }
    if (path === `git/commits/${parent}`)
      return { sha: parent, tree: { sha: tree } };
    if (path === 'git/blobs')
      return { sha: blob };
    if (path === 'git/trees')
      return { sha: tree };
    if (path === 'git/commits')
      return { sha: next };
    if (path.startsWith('git/refs'))
      return {};
    if (path.startsWith('git/trees/'))
      return { truncated: this.truncated, tree: [{ path: 'data/candidates/editions/2026-11-15.json', mode: this.mode, type: 'blob' }] };
    if (path.startsWith('contents/'))
      return { type: 'file', encoding: 'base64', size: this.size, content: Buffer.from('{}').toString('base64') };
    throw Error(path);
  }
}
describe('weekly GitHub atomic content writes', () => {
  it('updates only allowed JSON through a single-parent non-force ref change', () => {
    const gh = new Api();
    expect(gh.writeCommit('main', parent, { 'data/production/editions/2026-11-15.json': { date: '2026-11-15' }, 'data/candidates/editions/2026-11-15.json': null }, 'publish')).toBe(next);
    expect(gh.calls.find(c => c.path === 'git/commits')?.data.parents).toEqual([parent]);
    expect(gh.calls.at(-1)).toEqual({ path: 'git/refs/heads/main', method: 'PATCH', data: { sha: next, force: false } });
  });
  it('creates a new branch rather than forcing over a concurrent ref', () => {
    const gh = new Api();
    gh.current = undefined;
    gh.writeCommit('automation/newsletter-2026-11-15', parent, { 'data/candidates/editions/2026-11-15.json': {} }, 'draft');
    expect(gh.calls.at(-1)).toEqual({ path: 'git/refs', method: 'POST', data: { ref: 'refs/heads/automation/newsletter-2026-11-15', sha: next } });
    gh.current = 'f'.repeat(40);
    expect(() => gh.writeCommit('main', parent, {}, 'stale')).toThrow(/concurrently/);
  });
  it.each(['120000', '100755'])('rejects non-regular candidate mode %s', mode => {
    const gh = new Api();
    gh.mode = mode;
    expect(() => gh.regularFile('data/candidates/editions/2026-11-15.json', parent)).toThrow(/regular/);
  });
  it('rejects truncated trees, oversized packets and attempts to modify code', () => {
    const gh = new Api();
    gh.truncated = true;
    expect(() => gh.regularFile('data/candidates/editions/2026-11-15.json', parent)).toThrow();
    gh.size = 250001;
    expect(() => gh.jsonFile('data/candidates/editions/2026-11-15.json', parent)).toThrow();
    expect(() => gh.writeCommit('main', parent, { '.github/workflows/evil.yml': {} }, 'bad')).toThrow(/path/);
  });
});
