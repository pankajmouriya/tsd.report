import { describe, expect, it } from 'vitest';
import { escapeXml, toMarkdownFeed } from '../../src/lib/feeds';

describe('feed serialization', () => {
  it('escapes XML metacharacters', () => {
    expect(escapeXml('A & B < C')).toBe('A &amp; B &lt; C');
  });

  it('links stories through the canonical singular article route', () => {
    const output = toMarkdownFeed({ date: '2026-09-26', stories: [{ slug: 'test-story', title: 'Test story', summary: 'Summary' }] });
    expect(output).toContain('[Test story](https://tsd.report/article/test-story)');
  });
});
