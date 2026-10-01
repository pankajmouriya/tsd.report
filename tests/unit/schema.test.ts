import { describe, expect, it } from 'vitest';
import * as schemas from '../../src/lib/schema';

const fixtureEdition = {
  schema_version: 1,
  date: '2026-09-26',
  fixture: true,
  lead_story: 'story-1',
  sections: { briefs: ['story-1'] },
  stories: [{
    id: 'story-1', slug: 'test-story', title: 'Test story', type: 'news', category: 'security-engineering',
    published_at: '2026-09-26T00:00:00Z', summary: 'Summary', why_it_matters: 'Why', action: 'Act',
    affected_technologies: [], tags: ['test'], sources: [{
      id: 'test-source', name: 'Test source', url: 'https://example.com/source', type: 'editorial', retrieved_at: '2026-09-26T00:00:00Z',
    }],
    signal: { score: 1, label: 'standard', reasons: ['Test only'] }, vulnerabilities: [], body: [], fixture: true,
  }],
};

describe('editionSchema', () => {
  const draftNewsletter = {
    status: 'draft',
    subject: 'The Security Diff — September 26, 2026',
    preview_text: 'The security changes worth your attention.',
  };

  it('accepts draft newsletter copy without approval metadata', () => {
    const result = schemas.fixtureEditionSchema.safeParse({
      ...fixtureEdition,
      newsletter: draftNewsletter,
    });
    expect(result.success).toBe(true);
  });

  it('requires approver and timestamp for an approved newsletter', () => {
    const result = schemas.fixtureEditionSchema.safeParse({
      ...fixtureEdition,
      newsletter: {
        status: 'approved',
        subject: 'The Security Diff — September 26, 2026',
        preview_text: 'The security changes worth your attention.',
      },
    });
    expect(result.success).toBe(false);
  });

  it('accepts approved newsletter copy with an approver and ISO timestamp', () => {
    const result = schemas.fixtureEditionSchema.safeParse({
      ...fixtureEdition,
      newsletter: {
        status: 'approved',
        subject: 'The Security Diff — September 26, 2026',
        preview_text: 'The security changes worth your attention.',
        approved_by: 'Test editor',
        approved_at: '2026-09-26T01:00:00Z',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects blank and overlong newsletter subjects', () => {
    for (const subject of ['', ' '.repeat(2), 's'.repeat(121)]) {
      const result = schemas.fixtureEditionSchema.safeParse({
        ...fixtureEdition,
        newsletter: { ...draftNewsletter, subject },
      });
      expect(result.success).toBe(false);
    }
  });

  it('rejects blank and overlong newsletter preview text', () => {
    for (const preview_text of ['', ' '.repeat(2), 'p'.repeat(201)]) {
      const result = schemas.fixtureEditionSchema.safeParse({
        ...fixtureEdition,
        newsletter: { ...draftNewsletter, preview_text },
      });
      expect(result.success).toBe(false);
    }
  });

  it('rejects invalid newsletter approval timestamps', () => {
    const result = schemas.fixtureEditionSchema.safeParse({
      ...fixtureEdition,
      newsletter: {
        status: 'approved',
        subject: draftNewsletter.subject,
        preview_text: draftNewsletter.preview_text,
        approved_by: 'Test editor',
        approved_at: 'yesterday',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects unsupported newsletter statuses', () => {
    const result = schemas.fixtureEditionSchema.safeParse({
      ...fixtureEdition,
      newsletter: { ...draftNewsletter, status: 'sent' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects approval fields on draft newsletter copy', () => {
    const result = schemas.fixtureEditionSchema.safeParse({
      ...fixtureEdition,
      newsletter: {
        ...draftNewsletter,
        approved_by: 'Test editor',
        approved_at: '2026-09-26T01:00:00Z',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown newsletter object keys', () => {
    const result = schemas.fixtureEditionSchema.safeParse({
      ...fixtureEdition,
      newsletter: { ...draftNewsletter, send_now: true },
    });
    expect(result.success).toBe(false);
  });

  it('accepts an optional absolute HTTPS story destination in both content modes', () => {
    const externalFixture = {
      ...fixtureEdition,
      stories: fixtureEdition.stories.map((story) => ({
        ...story,
        destination_url: 'https://example.com/research-paper',
      })),
    };
    expect(schemas.fixtureEditionSchema.safeParse(externalFixture).success).toBe(true);

    const { fixture: _editionFixture, ...edition } = externalFixture;
    const production = {
      ...edition,
      status: 'published',
      reviewed_by: 'Test reviewer',
      reviewed_at: '2026-09-26T01:00:00Z',
      stories: externalFixture.stories.map(({ fixture: _storyFixture, ...story }) => ({
        ...story,
        status: 'published',
        reviewed_by: 'Test reviewer',
        reviewed_at: '2026-09-26T01:00:00Z',
      })),
    };
    expect(schemas.productionEditionSchema.safeParse(production).success).toBe(true);
  });

  it.each([
    'http://example.com/research-paper',
    '/research-paper',
    'https://reader:secret@example.com/research-paper',
    'javascript:alert(1)',
    'data:text/html,unsafe',
  ])('rejects unsafe external story destination %s', (destination_url) => {
    const result = schemas.fixtureEditionSchema.safeParse({
      ...fixtureEdition,
      stories: fixtureEdition.stories.map((story) => ({ ...story, destination_url })),
    });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range EPSS probability', () => {
    const result = schemas.editionSchema.safeParse({ schema_version: 1, date: '2026-09-26', stories: [
      { id: 'x', slug: 'x', title: 'x', type: 'cve', category: 'vulnerabilities', published_at: '2026-09-26T00:00:00Z', summary: 'x', why_it_matters: 'x', action: 'x', tags: [], sources: [], signal: { score: 1, label: 'standard', reasons: [] }, vulnerabilities: [{ cve: 'CVE-2025-49704', epss: 1.2 }] }
    ], lead_story: 'x', sections: {} });
    expect(result.success).toBe(false);
  });

  it('rejects a missing lead story reference', () => {
    const result = schemas.editionSchema.safeParse({ schema_version: 1, date: '2026-09-26', stories: [], lead_story: 'missing', sections: {} });
    expect(result.success).toBe(false);
  });

  it('keeps fixture and production publication metadata separate', () => {
    expect(schemas.fixtureEditionSchema).toBeDefined();
    expect(schemas.productionEditionSchema).toBeDefined();
    expect(schemas.fixtureEditionSchema?.safeParse(fixtureEdition).success).toBe(true);

    const production = {
      ...fixtureEdition,
      status: 'published',
      reviewed_by: 'Test reviewer',
      reviewed_at: '2026-09-26T01:00:00Z',
      stories: fixtureEdition.stories.map(({ fixture: _fixture, ...story }) => ({
        ...story,
        status: 'published',
        reviewed_by: 'Test reviewer',
        reviewed_at: '2026-09-26T01:00:00Z',
      })),
    };
    expect(schemas.productionEditionSchema?.safeParse(production).success).toBe(false);
    const { fixture: _fixture, ...withoutFixture } = production;
    expect(schemas.productionEditionSchema?.safeParse(withoutFixture).success).toBe(true);
    expect(schemas.productionEditionSchema?.safeParse({ ...withoutFixture, fixture: true }).success).toBe(false);
    expect(schemas.productionEditionSchema?.safeParse({
      ...withoutFixture,
      stories: withoutFixture.stories.map((story) => ({ ...story, sources: [] })),
    }).success).toBe(false);
  });
});
