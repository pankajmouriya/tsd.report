import { describe, expect, it } from 'vitest';
import { filterStories, parseStoryFilters } from '../../src/lib/filter';
import type { Story } from '../../src/lib/schema';

const stories = [
  { id: 'one', category: 'ai-security', signal: { label: 'must-read' } },
  { id: 'two', category: 'appsec', signal: { label: 'recommended' } },
  { id: 'three', category: 'research', signal: { label: 'standard' } },
] as Story[];

describe('filterStories', () => {
  it('preserves editorial ordering for all stories', () => {
    expect(filterStories(stories, { topic: 'all', signal: 'all' }).map((s) => s.id))
      .toEqual(['one', 'two', 'three']);
  });

  it('treats must-read stories as recommended', () => {
    expect(filterStories(stories, { topic: 'all', signal: 'recommended' }).map((s) => s.id))
      .toEqual(['one', 'two']);
  });

  it('combines topic and signal with AND', () => {
    expect(filterStories(stories, { topic: 'appsec', signal: 'must-read' })).toEqual([]);
  });
});

describe('parseStoryFilters', () => {
  it('accepts known topic and signal values', () => {
    expect(parseStoryFilters(new URLSearchParams('topic=ai-security&signal=must-read')))
      .toEqual({ topic: 'ai-security', signal: 'must-read' });
  });

  it('falls back to all for invalid values', () => {
    expect(parseStoryFilters(new URLSearchParams('topic=invalid&signal=urgent')))
      .toEqual({ topic: 'all', signal: 'all' });
  });
});
