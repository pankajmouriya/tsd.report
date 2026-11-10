import { describe, it, expect } from 'vitest';
import { refreshWeeklyDraft, publishWeeklyDraft, reportWeeklyCheck } from '../../scripts/newsletter/weekly';
import { FakeWeeklyGitHub, catalog, HEAD } from '../helpers/weekly-github';
import { story, edition } from '../helpers/weekly-newsletter';
const now = new Date('2026-11-09T00:00:00Z');
describe('trusted weekly draft automation', () => {
  it('creates a bot draft containing only unpublished stories and explicitly validates it', () => {
    const gh = new FakeWeeklyGitHub();
    const result = refreshWeeklyDraft(gh, catalog(), now);
    expect(result.status).toBe('draft-updated');
    expect(gh.prs).toHaveLength(1);
    expect(gh.prs[0].draft).toBe(true);
    expect(gh.writes[0].changes['data/candidates/editions/2026-11-15.json'].stories.map((s: any) => s.id)).toEqual([story('new').id]);
    expect(gh.dispatches).toContainEqual({ workflow: 'weekly-newsletter.yml', inputs: { operation: 'validate', pr_number: '7' } });
  });
  it('does not create an empty PR or repeat last week', () => {
    const gh = new FakeWeeklyGitHub();
    expect(refreshWeeklyDraft(gh, { ...catalog(), stories: [story('old')] }, now).status).toBe('no-unpublished-stories');
    expect(gh.writes).toHaveLength(0);
    expect(gh.prs).toHaveLength(0);
  });
  it('reuses the existing draft and does not commit unchanged data', () => {
    const gh = new FakeWeeklyGitHub();
    gh.seed();
    expect(refreshWeeklyDraft(gh, catalog(), now).status).toBe('unchanged');
    expect(gh.writes).toHaveLength(0);
    expect(gh.prs).toHaveLength(1);
  });
  it('appends into the same draft, preserves human copy, and binds its PR body to its head', () => {
    const gh = new FakeWeeklyGitHub();
    const draft = gh.seed();
    draft.newsletter.subject = 'Chosen subject';
    refreshWeeklyDraft(gh, { ...catalog(), stories: [story('extra'), story('new'), story('old')] }, now);
    expect(gh.prs).toHaveLength(1);
    expect(gh.writes[0].changes['data/candidates/editions/2026-11-15.json'].newsletter.subject).toBe('Chosen subject');
    expect(gh.prs[0].body).toContain(HEAD);
  });
  it('freezes a ready PR without mutating it and rejects ambiguous open drafts', () => {
    const gh = new FakeWeeklyGitHub();
    gh.seed();
    gh.prs[0].draft = false;
    expect(refreshWeeklyDraft(gh, catalog(), now).status).toBe('frozen-for-review');
    expect(gh.writes).toHaveLength(0);
    gh.prs.push({ ...gh.prs[0], number: 8 });
    expect(() => refreshWeeklyDraft(gh, catalog(), now)).toThrow(/multiple/i);
  });
  it.each(['fork', 'author', 'path', 'merge-actor', 'check-head', 'check-hash', 'check-app'])('blocks publication for %s', kind => {
    const gh = new FakeWeeklyGitHub();
    gh.merged();
    if (kind === 'fork')
      gh.prs[0].head.repo.full_name = 'attacker/fork';
    if (kind === 'author')
      gh.prs[0].user.login = 'attacker';
    if (kind === 'path')
      gh.prs[0].changed_files = 2;
    if (kind === 'merge-actor')
      gh.prs[0].merged_by.login = 'someone-else';
    if (kind === 'check-head')
      gh.checks[0].head_sha = 'f'.repeat(40);
    if (kind === 'check-hash')
      gh.checks[0].external_id = 'f'.repeat(64);
    if (kind === 'check-app')
      gh.checks[0].app.slug = 'untrusted';
    expect(() => publishWeeklyDraft(gh, catalog(), 7)).toThrow();
    expect(gh.writes).toHaveLength(0);
  });
  it('publishes an atomic edition/review record from the real editor merge, never dispatching send', () => {
    const gh = new FakeWeeklyGitHub();
    gh.merged();
    const result = publishWeeklyDraft(gh, catalog(), 7);
    expect(result.status).toBe('deployment-queued');
    const changes = gh.writes[0].changes;
    expect(changes['data/production/editions/2026-11-15.json'].newsletter.approved_at).toBe('2026-11-15T12:00:00Z');
    expect(changes['data/candidates/editions/2026-11-15.json']).toBeNull();
    expect(changes['data/production/newsletter-reviews/2026-11-15.json'].review.head_sha).toBe(HEAD);
    expect(gh.dispatches.map(d => d.workflow)).toEqual(['validate.yml', 'weekly-newsletter.yml']);
  });
  it('retries an identical publication without rewriting its archive and rejects altered archives', () => {
    const gh = new FakeWeeklyGitHub();
    gh.merged();
    publishWeeklyDraft(gh, catalog(), 7);
    const c = { ...catalog(), sha: gh.current };
    publishWeeklyDraft(gh, c, 7);
    expect(gh.writes).toHaveLength(1);
    (gh.jsonFile('data/production/editions/2026-11-15.json', gh.current) as any).newsletter.subject = 'changed';
    expect(() => publishWeeklyDraft(gh, c, 7)).toThrow(/immutable/i);
  });
  it('stops when a concurrent main update or candidate change invalidates the frozen publication', () => {
    const gh = new FakeWeeklyGitHub();
    gh.merged();
    gh.race = true;
    expect(() => publishWeeklyDraft(gh, catalog(), 7)).toThrow(/Non-force/);
    expect(gh.dispatches).toHaveLength(0);
    gh.race = false;
    gh.current = 'e'.repeat(40);
    expect(() => publishWeeklyDraft(gh, catalog(), 7)).toThrow(/main/i);
  });
  it('does not report a successful check for an older head', () => {
    const gh = new FakeWeeklyGitHub();
    gh.seed();
    expect(() => reportWeeklyCheck(gh, catalog(), 7, 'e'.repeat(40), 'success')).toThrow(/head/i);
  });
});
it('resumes a branch created before PR creation failed without overwriting it', () => {
  const gh = new FakeWeeklyGitHub();
  const draft = gh.seed();
  gh.prs = [];
  gh.files.set('automation/newsletter-2026-11-15:data/candidates/editions/2026-11-15.json', draft);
  const result = refreshWeeklyDraft(gh, catalog(), now);
  expect(result.status).toBe('draft-updated');
  expect(gh.prs).toHaveLength(1);
  expect(gh.writes).toHaveLength(0);
});
it('rechecks draft state immediately before an update', () => {
  const gh = new FakeWeeklyGitHub();
  gh.seed();
  const api = gh.api.bind(gh);
  let reads = 0;
  gh.api = (path, method, data) => {
    if (path === 'pulls/7' && (!method || method === 'GET') && ++reads === 2)
      gh.prs[0].draft = false; return api(path, method, data);
  };
  expect(refreshWeeklyDraft(gh, { ...catalog(), stories: [story('new'), story('extra')] }, now).status).toBe('frozen-for-review');
  expect(gh.writes).toHaveLength(0);
});
it('validates again on unchanged drafts when the named check is missing', () => {
  const gh = new FakeWeeklyGitHub();
  gh.seed();
  gh.checks = [];
  refreshWeeklyDraft(gh, catalog(), now);
  expect(gh.dispatches).toContainEqual({ workflow: 'weekly-newsletter.yml', inputs: { operation: 'validate', pr_number: '7' } });
});
it('defers frozen additions into the next week after publication', () => {
  const gh = new FakeWeeklyGitHub();
  gh.merged();
  publishWeeklyDraft(gh, catalog(), 7);
  const published = gh.jsonFile('data/production/editions/2026-11-15.json', gh.current) as ReturnType<typeof edition>;
  const c = { ...catalog(), sha: gh.current, editions: [...catalog().editions, published], stories: [story('new'), story('old'), story('late')] };
  refreshWeeklyDraft(gh, c, new Date('2026-11-15T12:30:00Z'));
  expect(gh.writes[1].changes['data/candidates/editions/2026-11-22.json'].stories.map((s: any) => s.id)).toEqual([story('late').id]);
});
it('does not reuse an older successful check after the same head fails a later validation', () => {
  const gh = new FakeWeeklyGitHub();
  gh.merged();
  gh.checks.push({ ...gh.checks[0], id: 2, conclusion: 'failure' });
  expect(() => publishWeeklyDraft(gh, catalog(), 7)).toThrow(/validation/);
  expect(gh.writes).toHaveLength(0);
});
it('requires the real merge to remain an ancestor of main', () => {
  const gh = new FakeWeeklyGitHub();
  gh.merged();
  const api = gh.api.bind(gh);
  gh.api = (path, method, data) => path.startsWith('compare/') ? { status: 'diverged' } : api(path, method, data);
  expect(() => publishWeeklyDraft(gh, catalog(), 7)).toThrow(/ancestor/);
});
it('rejects a symlink candidate and does not reopen a manually closed unmerged PR', () => {
  const gh = new FakeWeeklyGitHub();
  gh.seed();
  gh.regularFile = () => { throw Error('symlink'); };
  expect(() => refreshWeeklyDraft(gh, catalog(), now)).toThrow(/symlink/);
  expect(gh.writes).toHaveLength(0);
  gh.regularFile = () => { };
  gh.prs[0].state = 'closed';
  expect(refreshWeeklyDraft(gh, catalog(), now).status).toBe('closed-draft-requires-editor');
  expect(gh.writes).toHaveLength(0);
});
it('renders the reviewed candidate as escaped noindex HTML and exact PR Markdown',async()=>{
 const {mkdtempSync,readFileSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const {prepareWeeklyPreview}=await import('../../scripts/newsletter/weekly');const {renderNewsletterMarkdown,buildNewsletterDigest}=await import('../../src/lib/newsletter');
 const gh=new FakeWeeklyGitHub();const draft=gh.seed();draft.newsletter.subject='<script>unit-test</script>';const directory=mkdtempSync(join(tmpdir(),'tsd-weekly-preview-test-'));
 try{
  const result=prepareWeeklyPreview(gh,catalog(),7,directory);expect(result.head).toBe(HEAD);
  const html=readFileSync(join(directory,'email.html'),'utf8');expect(html).toContain('noindex, nofollow');expect(html).toContain('Unapproved weekly draft');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>unit-test</script>');
  expect(readFileSync(join(directory,'email.md'),'utf8')).toBe(renderNewsletterMarkdown(buildNewsletterDigest(draft)));
  expect(gh.prs[0].body).toContain(result.hash);expect(gh.prs[0].body).not.toContain('<script>unit-test</script>');
 }finally{rmSync(directory,{recursive:true});}
});
