import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { incidentCandidateSchema, incidentPublicationSchema } from '../../src/lib/incident-schema';
import { composeHomepage, incidentContentHash, incidentStory, selectLatestPublications } from '../../src/lib/incidents';
import { getEditions, validateContentMode } from '../../src/lib/content';

const candidate = () => JSON.parse(readFileSync('tests/fixtures/incidents/candidate.json', 'utf8'));

describe('incident contract', () => {
  it('requires the fixture marker even if a drafter removes it', () => {
    const value = candidate(); delete value.fixture;
    expect(() => incidentCandidateSchema.parse(value)).toThrow();
  });
  it('accepts an explicitly synthetic candidate with attributed unknowns', () => {
    expect(incidentCandidateSchema.parse(candidate()).occurred_at).toBeNull();
  });
  it.each(['reviewed_by', 'reviewed_at', 'vulnerabilities', 'newsletter'])('rejects drafter field %s', (field) => {
    expect(() => incidentCandidateSchema.parse({ ...candidate(), [field]: 'forged' })).toThrow();
  });
  it('rejects nonexistent claim references and unsafe source URLs', () => {
    const value = candidate();
    value.editorial.sections[0].claim_ids = ['invented'];
    expect(() => incidentCandidateSchema.parse(value)).toThrow();
    const unsafe = candidate();
    unsafe.sources[0].url = 'javascript:alert(1)';
    expect(() => incidentCandidateSchema.parse(unsafe)).toThrow();
  });
  it('rejects unsupported versions in prose and executable markup', () => {
    const value = candidate();
    value.editorial.action = 'Upgrade to version 9.99.7 now.';
    expect(() => incidentCandidateSchema.parse(value)).toThrow();
    value.editorial.action = '<script>steal()</script>';
    expect(() => incidentCandidateSchema.parse(value)).toThrow();
  });
  it('does not accept a version merely because it is a substring of evidence', () => {
    const value = candidate();
    value.facts[0].statement += ' Version 19.99.78 is mentioned.';
    value.editorial.action = 'Upgrade to v9.99.7.';
    expect(() => incidentCandidateSchema.parse(value)).toThrow();
  });
  it('hashes the shared packet exactly as Python does', () => {
    expect(incidentContentHash(candidate())).toBe('014c3c75b17ca7d20fc3654edbb11564a8bba392098ff706773dc59613122663');
  });
  it('rejects publishing a synthetic scenario even with review-shaped metadata', () => {
    expect(() => incidentPublicationSchema.parse({
      schema_version: 1, status: 'published', candidate: candidate(),
      content_sha256: 'a'.repeat(64), published_at: '2026-10-30T06:00:00Z',
      review: { actor: 'test-reviewer', reviewed_at: '2026-10-30T05:30:00Z',
        head_sha: 'b'.repeat(40), review_id: 1, pr_number: 1,
        pr_url: 'https://github.com/example/newspaper/pull/1' },
    })).toThrow();
  });
});

describe('incident homepage and revisions', () => {
  it('loads a valid immutable correction chain and selects its latest revision', () => {
    const first = candidate(); delete first.fixture;
    first.incident_id = 'test-release';
    first.sources[0].url = 'https://nodejs.org/en/security';
    const second = structuredClone(first);
    second.revision = 2; second.supersedes = incidentContentHash(first);
    second.correction_note = 'Clarifies the previously reported scope.';
    const record = (value: typeof first, date: string) => ({
      schema_version: 1, status: 'published', candidate: value,
      content_sha256: incidentContentHash(value), published_at: date,
      review: { actor: 'test-reviewer', reviewed_at: '2026-10-30T05:30:00Z', head_sha: 'a'.repeat(40),
        review_id: value.revision, pr_number: value.revision, pr_url: `https://github.com/example/newspaper/pull/${value.revision}` },
    });
    const records = [record(first, '2026-10-30T06:00:00Z'), record(second, '2026-10-31T06:00:00Z')];
    const latest = selectLatestPublications(records as never);
    expect(latest).toHaveLength(1);
    expect(latest[0].candidate.revision).toBe(2);
  });
  it('adds same-day stories without changing the archived edition', () => {
    const archived = structuredClone(getEditions()[0]);
    const before = JSON.stringify(archived);
    const first = incidentStory(candidate());
    const second = { ...first, id: 'incident-another-release', slug: 'another-release', title: 'Another synthetic release' };
    const home = composeHomepage(archived, [first, second]);
    expect(home.stories.slice(0, 2).map((story) => story.id)).toEqual([first.id, second.id]);
    expect(home.date).toBe('2026-10-30');
    expect(JSON.stringify(archived)).toBe(before);
  });
  it('rejects a broken revision chain instead of silently replacing a story', () => {
    expect(() => selectLatestPublications([{ candidate: { incident_id: 'example', revision: 2, supersedes: 'a'.repeat(64) } }] as never)).toThrow();
  });
  it('allows immutable edition snapshots of the same canonical incident', () => {
    const story = incidentStory(candidate());
    const first = { ...getEditions()[0], stories: [story], lead_story: story.id, sections: {} };
    const second = { ...first, date: '2026-10-31', stories: [{ ...story, summary: 'A later snapshot of the same incident.' }] };
    expect(() => validateContentMode('fixture', [first, second] as never)).not.toThrow();
  });
});
