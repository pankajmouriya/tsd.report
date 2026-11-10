import { buildNewsletterDigest, renderNewsletterMarkdown } from '../../src/lib/newsletter';
import { describe, it, expect } from 'vitest';
import { productionEditionSchema } from '../../src/lib/schema';
import { nextWeeklyDate, buildWeeklyDraft, validateWeeklyDraft, finalizeWeeklyDraft, weeklyHash } from '../../src/lib/weekly-newsletter';
import { story, edition } from '../helpers/weekly-newsletter';
const now = new Date('2026-11-09T01:00:00Z');
describe('weekly newsletter selection and immutable approval', () => {
  it('uses Sunday in Asia/Kolkata across UTC midnight', () => {
    expect(nextWeeklyDate(new Date('2026-11-07T20:00:00Z'), [])).toBe('2026-11-08');
    expect(nextWeeklyDate(new Date('2026-11-08T19:00:00Z'), [])).toBe('2026-11-15');
  });
  it('rolls a finalized current or early-finalized upcoming Sunday forward', () => {
    expect(nextWeeklyDate(new Date('2026-11-08T12:00:00Z'), [edition()])).toBe('2026-11-15');
    expect(nextWeeklyDate(new Date('2026-11-13T12:00:00Z'), [edition(undefined, '2026-11-15')])).toBe('2026-11-22');
  });
  it('creates no empty draft and excludes even unsent approved letters', () => {
    expect(buildWeeklyDraft([story('old')], [edition()], now)).toBeUndefined();
    const revised = { ...story('old'), summary: 'A newer revision of the same incident.' };
    expect(buildWeeklyDraft([revised], [edition()], now)).toBeUndefined();
  });
  it('also reserves a prior slug rather than repackaging old content under another id', () => {
    expect(buildWeeklyDraft([{ ...story('old'), id: 'incident-unit-renamed' }], [edition()], now)).toBeUndefined();
  });
  it('reserves all prior newsletter weeks, not only the latest', () => {
    const result = buildWeeklyDraft([story('a'), story('b'), story('new')], [edition([story('a')], '2026-11-01'), edition([story('b')])], now)!;
    expect(result.stories.map(s => s.id)).toEqual([story('new').id]);
  });
  it('preserves copy, lead, reading order, date and generation time while appending new stories', () => {
    const first = buildWeeklyDraft([story('a'), story('b')], [], now)!;
    first.newsletter.subject = 'Editor-chosen subject';
    first.lead_story = story('b').id;
    first.sections.latest = [story('a').id];
    const result = buildWeeklyDraft([story('c'), story('b'), story('a')], [], new Date('2026-11-20T01:00:00Z'), first)!;
    expect(result.date).toBe('2026-11-15');
    expect(result.generated_at).toBe(first.generated_at);
    expect(result.newsletter.subject).toBe('Editor-chosen subject');
    expect(result.lead_story).toBe(story('b').id);
    expect(result.sections.latest).toEqual([story('a').id, story('c').id]);
    expect(buildWeeklyDraft([story('c'), story('b'), story('a')], [], now, result)).toEqual(result);
  });
  it('requires the complete selected canonical snapshot and rejects invented facts or reviewer fields', () => {
    const draft = buildWeeklyDraft([story('a')], [], now)!;
    expect(() => validateWeeklyDraft(draft, [story('a')], [])).not.toThrow();
    expect(() => validateWeeklyDraft({ ...draft, stories: [{ ...draft.stories[0], action: 'Invented remedy' }] }, [story('a')], [])).toThrow(/canonical/);
    expect(() => validateWeeklyDraft({ ...draft, reviewed_by: 'pretend' }, [story('a')], [])).toThrow();
    expect(() => validateWeeklyDraft({ ...draft, newsletter: { ...draft.newsletter, approved_by: 'pretend' } }, [story('a')], [])).toThrow();
  });
  it('rejects non-Sunday dates, duplicate sections, invalid lead and multiline email headers', () => {
    const d = buildWeeklyDraft([story('a')], [], now)!;
    for (const value of [{ ...d, date: '2026-11-16' }, { ...d, lead_story: 'absent' }, { ...d, sections: { latest: [d.lead_story] } }, { ...d, newsletter: { ...d.newsletter, subject: 'Header\ninjection' } }])
      expect(() => validateWeeklyDraft(value, [story('a')], [])).toThrow();
  });
  it('rejects a draft if another finalized edition already reserved its stories', () => {
    const d = buildWeeklyDraft([story('a')], [], now)!;
    expect(() => validateWeeklyDraft(d, [story('a')], [edition([story('a')])])).toThrow(/reserved/);
  });
  it('finalizes only with real merge provenance and preserves the frozen copy', () => {
    const d = buildWeeklyDraft([story('a')], [], now)!;
    const review = { actor: 'pankajmouriya', merged_at: '2026-11-15T12:00:00Z', head_sha: 'a'.repeat(40), merge_sha: 'b'.repeat(40), pr_number: 99 };
    const result = finalizeWeeklyDraft(d, review);
    expect(productionEditionSchema.parse(result.edition).newsletter?.status).toBe('approved');
    expect(renderNewsletterMarkdown(buildNewsletterDigest(result.edition))).toBe(renderNewsletterMarkdown(buildNewsletterDigest(d)));
    expect(result.edition.stories).toEqual(d.stories);
    expect(result.edition.reviewed_at).toBe(review.merged_at);
    expect(result.record.candidate_sha256).toBe(weeklyHash(d));
    expect(() => finalizeWeeklyDraft(d, { ...review, actor: 'someone-else' })).toThrow();
  });
});
it('does not backfill old unlettered archives but carries additions after the last collection time',()=>{
 const previous={...edition(),generated_at:'2026-11-08T12:04:00Z'};
 const archive={...story('archive'),published_at:'2026-10-31T10:01:00Z'};
 expect(buildWeeklyDraft([archive],[previous],now)).toBeUndefined();
 const late={...story('late'),published_at:'2026-11-08T12:05:00Z'};
 expect(buildWeeklyDraft([archive,late],[previous],now)?.stories.map(s=>s.id)).toEqual([late.id]);
 const forced=buildWeeklyDraft([archive],[],now)!;
 expect(()=>validateWeeklyDraft(forced,[archive],[previous])).toThrow(/collection/);
});
