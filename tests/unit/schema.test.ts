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
