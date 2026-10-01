import { describe, expect, it } from 'vitest';
import { escapeXml, toJsonFeed, toMarkdownFeed, toRss } from '../../src/lib/feeds';

describe('feed serialization', () => {
  it('escapes XML metacharacters', () => {
    expect(escapeXml('A & B < C')).toBe('A &amp; B &lt; C');
  });

  it('links stories through the canonical singular article route', () => {
    const output = toMarkdownFeed({ date: '2026-09-26', stories: [{ slug: 'test-story', title: 'Test story', summary: 'Summary' }] });
    expect(output).toContain('[Test story](https://tsd.report/article/test-story)');
  });

  it('uses an external destination while preserving the internal feed identity', () => {
    const edition = {
      date: '2026-09-26',
      stories: [{
        slug: 'external-paper', title: 'External paper', summary: 'Summary',
        destination_url: 'https://example.com/research-paper?one=1&two=2',
        published_at: '2026-09-26T00:00:00Z',
      }],
    };

    expect(toMarkdownFeed(edition)).toContain('[External paper](https://example.com/research-paper?one=1&two=2)');
    const rss = toRss(edition);
    expect(rss).toContain('<link>https://example.com/research-paper?one=1&amp;two=2</link>');
    expect(rss).toContain('<guid>https://tsd.report/article/external-paper</guid>');
    expect(toJsonFeed(edition).items[0]).toMatchObject({
      id: 'https://tsd.report/article/external-paper',
      url: 'https://example.com/research-paper?one=1&two=2',
    });
  });

  it('does not label production feeds as fixture previews', () => {
    const edition = { date: '2026-09-26', stories: [{ slug: 'test-story', title: 'Test story', summary: 'Summary' }] };
    expect(toMarkdownFeed(edition, 'production')).not.toMatch(/fixture/i);
  });
});
