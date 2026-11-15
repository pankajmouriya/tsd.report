import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { incidentCandidateSchema } from '../../src/lib/incident-schema';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('CONTENT_MODE', 'production');
  vi.stubEnv('TSD_INCIDENT_PREVIEW', '');
});

afterEach(() => {
  vi.doUnmock('../../src/lib/incidents');
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('homepage selection', () => {
  it('shows exactly the latest reviewed edition, preserving its lead, order and newsletter', async () => {
    const content = await import('../../src/lib/content');
    const latest = content.getLatestEdition();
    const before = JSON.stringify(content.getEditions());
    const older = content.getStories().filter((story) => !latest.stories.some((item) => item.id === story.id));
    expect(older.length).toBeGreaterThan(0);
    expect(content.getHomepageEdition()).toEqual(latest);
    expect(JSON.stringify(content.getEditions())).toBe(before);
    for (const story of older) expect(content.findStory(story.slug)).toEqual(story);
  });

  it('preserves the rolling incident selection and stable identities in feeds', async () => {
    const content = await import('../../src/lib/content');
    const { composeHomepage, incidentStory, loadIncidentPublications } = await import('../../src/lib/incidents');
    const expected = composeHomepage(content.getLatestEdition(), loadIncidentPublications().map((record) => incidentStory(record.candidate, record)));
    expect(content.getFeedEdition()).toEqual(expected);
    expect(expected.stories.length).toBeGreaterThan(content.getHomepageEdition().stories.length);
  });

  it('still puts an unpublished candidate first in an explicitly marked incident preview', async () => {
    const preview = incidentCandidateSchema.parse(JSON.parse(readFileSync('tests/fixtures/incidents/candidate.json', 'utf8')));
    vi.doMock('../../src/lib/incidents', async (importOriginal) => ({
      ...await importOriginal<typeof import('../../src/lib/incidents')>(),
      loadIncidentPreview: () => preview,
    }));
    const content = await import('../../src/lib/content');
    expect(content.isIncidentPreview()).toBe(true);
    expect(content.getHomepageEdition().lead_story).toBe(`incident-${preview.incident_id}`);
    expect(content.getLatestEdition().stories.some((story) => story.id === `incident-${preview.incident_id}`)).toBe(false);
  });
});
