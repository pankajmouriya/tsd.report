import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as content from '../../src/lib/content';

describe('content mode', () => {
  it('selects only the requested environment records', () => {
    expect(typeof content.selectContentRecords).toBe('function');
    const fixture = { local: { fixture: true } };
    const production = { public: { status: 'published' } };
    expect(content.selectContentRecords?.('fixture', fixture, production)).toEqual([fixture.local]);
    expect(content.selectContentRecords?.('production', fixture, production)).toEqual([production.public]);
  });

  it('rejects an empty production corpus', () => {
    expect(() => content.validateContentMode('production', [])).toThrow('Production content requires at least one reviewed edition');
  });

  it('loads only reviewed production records from the production root', () => {
    expect(typeof content.loadEditions).toBe('function');
    const root = mkdtempSync(join(tmpdir(), 'tsd-production-content-'));
    const directory = join(root, 'data/production/editions');
    mkdirSync(directory, { recursive: true });
    const fixtureEdition = content.getEditions()[0];
    const { fixture: _editionFixture, ...edition } = fixtureEdition;
    const production = {
      ...edition,
      status: 'published',
      reviewed_by: 'Test reviewer',
      reviewed_at: '2026-09-26T01:00:00Z',
      stories: fixtureEdition.stories.map(({ fixture: _storyFixture, ...story }) => ({
        ...story,
        status: 'published',
        reviewed_by: 'Test reviewer',
        reviewed_at: '2026-09-26T01:00:00Z',
      })),
    };
    writeFileSync(join(directory, 'edition.json'), JSON.stringify(production));
    try {
      expect(content.loadEditions?.('production', root)).toHaveLength(1);
      writeFileSync(join(directory, 'fixture.json'), JSON.stringify(fixtureEdition));
      expect(() => content.loadEditions?.('production', root)).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects unknown modes', () => {
    expect(() => content.validateContentMode('preview')).toThrow('Invalid CONTENT_MODE');
  });

  it('derives category routes from the selected stories', () => {
    expect(typeof content.getStoryCategories).toBe('function');
    expect(content.getStoryCategories?.([
      { category: 'cloud' },
      { category: 'security-engineering' },
      { category: 'cloud' },
    ])).toEqual(['cloud', 'security-engineering']);
  });
});
