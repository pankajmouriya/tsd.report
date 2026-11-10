import type { WeeklyGitHub, WeeklyCatalog } from '../../scripts/newsletter/weekly';
import { buildWeeklyDraft, WEEKLY_CHECK, weeklyHash } from '../../src/lib/weekly-newsletter';
import { story, edition } from './weekly-newsletter';
export const MAIN = 'a'.repeat(40), HEAD = 'b'.repeat(40), MERGE = 'c'.repeat(40);
export function catalog(): WeeklyCatalog { return { sha: MAIN, stories: [story('new'), story('old')], editions: [edition()] }; }
export class FakeWeeklyGitHub implements WeeklyGitHub {
  repository = 'example/newspaper';
  files = new Map<string, unknown>();
  prs: Record<string, any>[] = [];
  calls: {
    path: string;
    method: string;
    data: unknown;
  }[] = [];
  writes: any[] = [];
  dispatches: any[] = [];
  current = MAIN;
  race = false;
  checks: any[] = [];
  jsonFile(path: string, ref: string) { return this.files.get(`${ref}:${path}`); }
  regularFile(_path: string, _ref: string) { }
  pages(path: string): unknown[] {
    if (path.includes('/files'))
      return [{ filename: `data/candidates/editions/2026-11-15.json`, status: 'added' }]; if (path.includes('/reviews'))
      return []; if (path.includes('state=open'))
      return this.prs.filter(p => p.state === 'open'); if (path.includes('head=')) {
        const head = decodeURIComponent(path.split('head=')[1]).split(':')[1];
        return this.prs.filter(p => p.head.ref === head);
      } return this.prs;
  }
  api(path: string, method = 'GET', data?: unknown): unknown {
    this.calls.push({ path, method, data });
    if (path === 'git/ref/heads/main')
      return { object: { sha: this.current } };
    if (path.startsWith('commits/'))
      return { check_runs: this.checks };
    if (path.startsWith('compare/'))
      return { status: 'ahead', files: [{ filename: 'data/candidates/editions/2026-11-15.json', status: 'added' }] };
    if (path.startsWith('git/ref/heads/automation/'))
      return { object: { sha: HEAD } };
    if (path.startsWith('pulls?'))
      return this.prs;
    if (path === 'pulls' && method === 'POST') {
      const pr = { number: 7 + this.prs.length, html_url: 'https://github.com/example/newspaper/pull/7', state: 'open', user: { login: 'github-actions[bot]' }, changed_files: 1, ...data as any, head: { ref: (data as any).head, sha: HEAD, repo: { full_name: this.repository } }, base: { ref: 'main' } };
      this.prs.push(pr);
      return pr;
    }
    if (path === 'pulls/7' && method === 'PATCH') {
      Object.assign(this.prs[0], data);
      return this.prs[0];
    }
    if (path === 'pulls/7')
      return this.prs[0];
    if (path === 'check-runs') {
      this.checks.push({ ...data as any, app: { slug: 'github-actions' } });
      return {};
    }
    throw Error(`Unexpected fake API ${method} ${path}`);
  }
  writeCommit(branch: string, parent: string, changes: Record<string, unknown | null>, message: string) {
    if (this.race)
      throw Error('Non-force update refused');
    this.writes.push({ branch, parent, changes: structuredClone(changes), message });
    const sha = branch === 'main' ? 'd'.repeat(40) : HEAD;
    for (const [path, value] of Object.entries(changes))
      if (value !== null)
        this.files.set(`${sha}:${path}`, value);
    if (branch === 'main')
      this.current = sha;
    return sha;
  }
  dispatch(workflow: string, inputs: Record<string, string>) { this.dispatches.push({ workflow, inputs }); }
  seed() {
    const c = catalog();
    const draft = buildWeeklyDraft([story('new')], c.editions, new Date('2026-11-09T00:00:00Z'))!;
    this.prs = [{ number: 7, html_url: 'https://github.com/example/newspaper/pull/7', state: 'open', draft: true, merged: false, user: { login: 'github-actions[bot]' }, changed_files: 1, head: { ref: 'automation/newsletter-2026-11-15', sha: HEAD, repo: { full_name: this.repository } }, base: { ref: 'main' } }];
    this.files.set(`${HEAD}:data/candidates/editions/2026-11-15.json`, draft);
    this.files.set(`${MAIN}:data/candidates/editions/2026-11-15.json`, draft);
    this.checks = [{ id: 1, name: WEEKLY_CHECK, head_sha: HEAD, external_id: weeklyHash(draft), status: 'completed', conclusion: 'success', app: { slug: 'github-actions' } }];
    return draft;
  }
  merged() { const d = this.seed(); Object.assign(this.prs[0], { state: 'closed', draft: false, merged: true, merged_by: { login: 'pankajmouriya' }, merged_at: '2026-11-15T12:00:00Z', merge_commit_sha: MERGE }); return d; }
}
