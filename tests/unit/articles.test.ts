import { describe, expect, it } from 'vitest';
import { validateArticleDocuments } from '../../src/lib/articles';

describe('validateArticleDocuments', () => {
  const story = { id: 'story-1', slug: 'example', title: 'Example title', fixture: true };
  const document = {
    id: 'example',
    body: 'A supported claim.[^nist]\n\n[^nist]: NIST evidence.',
    data: {
      story_id: 'story-1', slug: 'example', title: 'Example title', structure: 'essay' as const,
      status: 'unreviewed-fixture' as const, fixture: true as const,
      references: [{ id: 'nist', name: 'NIST', url: 'https://csrc.nist.gov/example', retrieved_at: '2026-09-27' }],
      related_story_ids: [],
    },
  };

  it('accepts matching story metadata and citation targets', () => {
    expect(validateArticleDocuments([document], [story])).toEqual([document]);
  });

  it('rejects duplicate slugs and story metadata mismatches', () => {
    expect(() => validateArticleDocuments([document, { ...document, id: 'copy' }], [story])).toThrow(/Duplicate article slug/);
    expect(() => validateArticleDocuments([{ ...document, data: { ...document.data, title: 'Wrong title' } }], [story])).toThrow(/title does not match/);
  });

  it('rejects unsafe, missing, and unused citation references', () => {
    expect(() => validateArticleDocuments([{ ...document, data: { ...document.data, references: [{ ...document.data.references[0], url: 'javascript:alert(1)' }] } }], [story])).toThrow(/Unsafe reference URL/);
    expect(() => validateArticleDocuments([{ ...document, body: 'Claim.[^missing]' }], [story])).toThrow(/Missing reference/);
    expect(() => validateArticleDocuments([{ ...document, body: 'No citation.' }], [story])).toThrow(/Unused reference/);
  });
});
