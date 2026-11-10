import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
const weekly = readFileSync(new URL('../../.github/workflows/weekly-newsletter.yml', import.meta.url), 'utf8');
const sender = readFileSync(new URL('../../.github/workflows/send-newsletter.yml', import.meta.url), 'utf8');
const publisher = readFileSync(new URL('../../pipeline/incidents/publisher.py', import.meta.url), 'utf8');
describe('weekly newsletter workflow trust boundaries', () => {
  it('runs trusted main and never checks out PR code or exposes provider credentials', () => {
    expect(weekly).toContain('pull_request_target:');
    expect(weekly).toContain('ref: main');
    expect(weekly).not.toMatch(/ref:.*(pull_request|inputs\.)/);
    expect(weekly).not.toMatch(/BUTTONDOWN_API_KEY|newsletter:send|send-newsletter\.yml/);
  });
  it('serializes state writers, gates activation and keeps sending manual', () => {
    expect(weekly.match(/group: weekly-newsletter-state/g)).toHaveLength(2);
    expect(weekly).toContain("vars.TSD_WEEKLY_NEWSLETTER_ENABLED == 'true'");
    expect(sender).toContain('workflow_dispatch:');
    expect(sender).not.toMatch(/pull_request|schedule:|workflow_run:/);
  });
  it('retains a real rendered preview and reports a head-bound check after validation', () => {
    expect(weekly).toContain('actions/upload-artifact@');
    expect(weekly).toContain('email.html');
    expect(weekly).toContain('email.md');
    expect(weekly).toContain('steps.candidate.outputs.head');
    expect(weekly).toContain('npm test');
    expect(weekly.indexOf('weekly.ts check')).toBeGreaterThan(weekly.indexOf('actions/upload-artifact@'));
  });
  it('publishes only the merged same-repository bot PR and explicitly refreshes from incident publication', () => {
    expect(weekly).toContain("github.event.pull_request.user.login == 'github-actions[bot]'");
    expect(weekly).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(weekly).toContain('github.event.pull_request.merged == true');
    expect(publisher).toContain('github.dispatch("weekly-newsletter.yml", {"operation": "refresh"})');
  });
});
it('defers only candidate-only main pushes while keeping production and code deployments',()=>{
 const deploy=readFileSync(new URL('../../.github/workflows/validate.yml',import.meta.url),'utf8');
 expect(deploy).toContain('run: node --import tsx scripts/publication-change.ts');expect(deploy).toContain("needs.quality.outputs.pending_candidate != 'true'");expect(deploy).toContain('pending_candidate: ${{ steps.publication.outputs.pending_candidate }}');expect(deploy).toContain('PUBLICATION_BASE_SHA: ${{ github.event.before }}');
});
