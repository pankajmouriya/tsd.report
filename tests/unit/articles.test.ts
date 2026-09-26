import { describe, expect, it } from 'vitest';
import { parseMarkdownArticle } from '../../src/lib/articles';

describe('parseMarkdownArticle', () => {
  it('returns frontmatter and body paragraphs', () => {
    const article = parseMarkdownArticle('---\ntitle: "Example"\nslug: "example"\n---\n\nFirst paragraph.\n\nSecond paragraph.');
    expect(article).toEqual({ title: 'Example', slug: 'example', paragraphs: ['First paragraph.', 'Second paragraph.'] });
  });
});
