import { describe, expect, it } from 'vitest';
import { editionSchema } from '../../src/lib/schema';

describe('editionSchema', () => {
  it('rejects an out-of-range EPSS probability', () => {
    const result = editionSchema.safeParse({ schema_version: 1, date: '2026-09-26', stories: [
      { id: 'x', slug: 'x', title: 'x', type: 'cve', category: 'vulnerabilities', published_at: '2026-09-26T00:00:00Z', summary: 'x', why_it_matters: 'x', action: 'x', tags: [], sources: [], signal: { score: 1, label: 'standard', reasons: [] }, vulnerabilities: [{ cve: 'CVE-2025-49704', epss: 1.2 }] }
    ], lead_story: 'x', sections: {} });
    expect(result.success).toBe(false);
  });

  it('rejects a missing lead story reference', () => {
    const result = editionSchema.safeParse({ schema_version: 1, date: '2026-09-26', stories: [], lead_story: 'missing', sections: {} });
    expect(result.success).toBe(false);
  });
});
