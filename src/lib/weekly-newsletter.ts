import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { productionEditionSchema, productionStorySchema, weeklyNewsletterCandidateSchema, type Edition, type Story, type WeeklyNewsletterCandidate } from './schema';
export const WEEKLY_CHECK = 'weekly-newsletter-candidate';
export const WEEKLY_EDITOR = 'pankajmouriya';
export const weeklyMergeSchema = z.object({
  actor: z.literal(WEEKLY_EDITOR),
  merged_at: z.iso.datetime(),
  head_sha: z.string().regex(/^[a-f0-9]{40}$/),
  merge_sha: z.string().regex(/^[a-f0-9]{40}$/),
  pr_number: z.number().int().positive(),
}).strict();
export const weeklyReviewRecordSchema = z.object({ schema_version: z.literal(1), date: z.iso.date(), candidate_sha256: z.string().regex(/^[a-f0-9]{64}$/), review: weeklyMergeSchema }).strict();
export function weeklyHash(candidate: WeeklyNewsletterCandidate): string {
  return createHash('sha256').update(JSON.stringify(weeklyNewsletterCandidateSchema.parse(candidate))).digest('hex');
}
function reservedStories(editions: Edition[]) {
  const stories: Story[] = [];
  for (const edition of editions)
    if (!edition.fixture && edition.newsletter?.status === 'approved')
      stories.push(...edition.stories);
  return { ids: new Set(stories.map(s => s.id)), slugs: new Set(stories.map(s => s.slug)) };
}
function collectionCutoff(editions: Edition[]): number {
  let latest: { date: string; time: string } | undefined;
  for (const edition of editions) {
    if (!edition.fixture && edition.newsletter?.status === 'approved' && (!latest || edition.date > latest.date)) {
      latest = { date: edition.date, time: edition.generated_at ?? edition.newsletter.approved_at };
    }
  }
  return latest ? new Date(latest.time).getTime() : -Infinity;
}
export function nextWeeklyDate(now: Date, editions: Edition[]): string {
  if (!Number.isFinite(now.getTime()))
    throw new Error('Invalid weekly clock');
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (name: string) => local.find(p => p.type === name)!.value;
  const date = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + (7 - date.getUTCDay()) % 7);
  const latest = editions.reduce((max, e) => e.date > max ? e.date : max, '');
  while (date.toISOString().slice(0, 10) <= latest)
    date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}
function canonicalStories(stories: Story[]) {
  const parsed = stories.map(s => productionStorySchema.parse(s));
  if (parsed.some(s => s.type !== 'incident' || !s.id.startsWith('incident-') || /^(synthetic|fixture|example)-/.test(s.slug)))
    throw new Error('Weekly selection requires real canonical incident publications');
  if (new Set(parsed.map(s => s.id)).size !== parsed.length || new Set(parsed.map(s => s.slug)).size !== parsed.length)
    throw new Error('Duplicate canonical incident identity');
  return parsed;
}
export function validateWeeklyDraft(value: unknown, catalog: Story[], editions: Edition[]): WeeklyNewsletterCandidate {
  const candidate = weeklyNewsletterCandidateSchema.parse(value);
  if (new Date(`${candidate.date}T00:00:00Z`).getUTCDay() !== 0)
    throw new Error('Weekly edition date must be a Sunday');
  if (editions.some(e => e.date >= candidate.date))
    throw new Error('Weekly edition date is already finalized or superseded');
  if (/[\r\n]/.test(candidate.newsletter.subject + candidate.newsletter.preview_text))
    throw new Error('Newsletter copy must be single-line');
  const selected = [candidate.lead_story, ...Object.values(candidate.sections).flat()];
  if (new Set(selected).size !== selected.length || selected.length !== candidate.stories.length)
    throw new Error('Each weekly story must appear exactly once in reading order');
  const byId = new Map(canonicalStories(catalog).map(s => [s.id, s]));
  const reserved = reservedStories(editions);
  const cutoff = collectionCutoff(editions);
  for (const story of candidate.stories) {
    if (reserved.ids.has(story.id) || reserved.slugs.has(story.slug))
      throw new Error('Story is reserved by a finalized newsletter');
    if (new Date(story.published_at).getTime() < cutoff)
      throw new Error('Story precedes the prior newsletter collection boundary');
    if (!isDeepStrictEqual(story, byId.get(story.id)))
      throw new Error('Story must match the current canonical publication exactly');
  }
  return candidate;
}
export function buildWeeklyDraft(catalog: Story[], editions: Edition[], now: Date, previous?: WeeklyNewsletterCandidate): WeeklyNewsletterCandidate | undefined {
  const stories = canonicalStories(catalog), reserved = reservedStories(editions);
  const cutoff = collectionCutoff(editions);
  const pending = stories.filter(s => !reserved.ids.has(s.id) && !reserved.slugs.has(s.slug) && new Date(s.published_at).getTime() >= cutoff);
  if (!pending.length)
    return undefined;
  const before = previous ? weeklyNewsletterCandidateSchema.parse(previous) : undefined;
  const byId = new Map(pending.map(s => [s.id, s]));
  const order = before ? [before.lead_story, ...Object.values(before.sections).flat(), ...before.stories.map(s => s.id)] : [];
  const ids = [...new Set([...order, ...pending.map(s => s.id)])].filter(id => byId.has(id));
  const date = before?.date ?? nextWeeklyDate(now, editions);
  const result = {
    schema_version: 1 as const,
    date,
    status: 'draft' as const,
    lead_story: ids[0],
    sections: { latest: ids.slice(1) },
    stories: ids.map(id => byId.get(id)!),
    newsletter: before?.newsletter ?? {
      status: 'draft' as const,
      subject: `The Security Diff — ${date}`,
      preview_text: 'New incident and vulnerability reports selected for this week.',
    },
    generated_at: before?.generated_at ?? now.toISOString(),
  };
  return validateWeeklyDraft(result, catalog, editions);
}
export function finalizeWeeklyDraft(candidate: WeeklyNewsletterCandidate, review: unknown) {
  const approved = weeklyMergeSchema.parse(review);
  const edition = productionEditionSchema.parse({ ...candidate, status: 'published', reviewed_by: approved.actor, reviewed_at: approved.merged_at, newsletter: { ...candidate.newsletter, status: 'approved', approved_by: approved.actor, approved_at: approved.merged_at } });
  const record = weeklyReviewRecordSchema.parse({ schema_version: 1, date: candidate.date, candidate_sha256: weeklyHash(candidate), review: approved });
  return { edition, record };
}

export function validateWeeklyReviewRecords(root: string, editions: Edition[]): number {
  const directory = resolve(root, 'data/production/newsletter-reviews');
  if (!existsSync(directory)) return 0;
  let count = 0;
  for (const name of readdirSync(directory).filter(name => name.endsWith('.json'))) {
    const record = weeklyReviewRecordSchema.parse(JSON.parse(readFileSync(resolve(directory, name), 'utf8')));
    if (name !== `${record.date}.json`) throw new Error('Weekly review filename and date differ');
    const source = editions.find(edition => edition.date === record.date);
    if (!source) throw new Error('Weekly review has no production edition');
    const edition = productionEditionSchema.parse(source);
    if (edition.newsletter?.status !== 'approved') throw new Error('Weekly edition newsletter is not approved');
    const candidate = weeklyNewsletterCandidateSchema.parse({
      schema_version: edition.schema_version,
      date: edition.date,
      generated_at: edition.generated_at,
      lead_story: edition.lead_story,
      sections: edition.sections,
      stories: edition.stories,
      status: 'draft',
      newsletter: { status: 'draft', subject: edition.newsletter.subject, preview_text: edition.newsletter.preview_text },
    });
    const expected = finalizeWeeklyDraft(candidate, record.review);
    if (!isDeepStrictEqual(expected.edition, edition) || !isDeepStrictEqual(expected.record, record)) {
      throw new Error('Weekly edition does not match its immutable reviewed snapshot');
    }
    count++;
  }
  return count;
}
