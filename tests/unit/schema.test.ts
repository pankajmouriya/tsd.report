import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

const watchEntry = {
  rank: 1,
  cve: 'CVE-2026-12345',
  kev: {
    source_id: 'cisa-kev',
    date_added: '2026-09-20',
    due_date: '2026-10-10',
    vendor_project: 'Example Vendor',
    product: 'Example Product',
    vulnerability_name: 'Example Product Vulnerability',
    required_action: 'Apply mitigations per vendor instructions.',
    known_ransomware_campaign_use: 'Unknown',
    notes: null,
  },
  epss: {
    source_id: 'first-epss',
    probability: 0.75,
    percentile: 0.98,
    score_date: '2026-10-02',
  },
  cvss: {
    source_id: 'nvd',
    score: 9.8,
    version: '3.1',
    vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    issuer: 'nvd@nist.gov',
  },
  description: 'An example vulnerability used by the test contract.',
  references: [{
    source_id: 'nvd',
    name: 'NVD record',
    url: 'https://nvd.nist.gov/vuln/detail/CVE-2026-12345',
    type: 'government',
    published_at: '2026-09-18T00:00:00Z',
    retrieved_at: '2026-10-02T06:17:00Z',
  }],
};

const watchBase = {
  schema_version: 1,
  date: '2026-10-02',
  generated_at: '2026-10-02T06:17:00Z',
  selection: {
    lookback_days: 30,
    epss_probability_min: 0.5,
    epss_percentile_min: 0.95,
    limit: 10,
    ranking_version: 'kev-epss-v1',
    window_start: '2026-09-03',
    window_end: '2026-10-02',
  },
  sources: [
    { id: 'cisa-kev', name: 'CISA KEV', url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', status: 'ok', retrieved_at: '2026-10-02T06:17:00Z', data_date: '2026-10-02', error: null },
    { id: 'first-epss', name: 'FIRST EPSS', url: 'https://api.first.org/data/v1/epss', status: 'ok', retrieved_at: '2026-10-02T06:17:00Z', data_date: '2026-10-02', error: null },
    { id: 'nvd', name: 'NVD', url: 'https://services.nvd.nist.gov/rest/json/cves/2.0', status: 'ok', retrieved_at: '2026-10-02T06:17:00Z', data_date: null, error: null },
  ],
  entries: [watchEntry],
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

describe('Vulnerability Watch schemas', () => {
  it.each([
    ['candidate', schemas.vulnerabilityWatchCandidateSchema],
    ['published', schemas.vulnerabilityWatchPublishedSchema],
    ['fixture', schemas.vulnerabilityWatchFixtureSchema],
  ] as const)('keeps the shared %s contract fixture valid', (name, schema) => {
    const payload = JSON.parse(readFileSync(resolve(`tests/fixtures/vulnerability-watch/${name}.json`), 'utf8'));
    expect(schema.safeParse(payload).success).toBe(true);
  });

  it('accepts strict candidate, published, and fixture states', () => {
    expect(schemas.vulnerabilityWatchCandidateSchema.safeParse({ ...watchBase, status: 'candidate' }).success).toBe(true);
    expect(schemas.vulnerabilityWatchPublishedSchema.safeParse({
      ...watchBase,
      status: 'published',
      reviewed_by: 'pankajmouriya',
      reviewed_at: '2026-10-02T07:00:00Z',
      review_pr: 'https://github.com/pankajmouriya/tsd.report/pull/42',
    }).success).toBe(true);
    expect(schemas.vulnerabilityWatchFixtureSchema.safeParse({
      ...watchBase,
      status: 'fixture',
      fixture: true,
    }).success).toBe(true);
  });

  it('rejects candidates with review metadata or unknown keys', () => {
    expect(schemas.vulnerabilityWatchCandidateSchema.safeParse({
      ...watchBase,
      status: 'candidate',
      reviewed_by: 'premature-review',
    }).success).toBe(false);
    expect(schemas.vulnerabilityWatchCandidateSchema.safeParse({
      ...watchBase,
      status: 'candidate',
      publish_now: true,
    }).success).toBe(false);
  });

  it('requires review evidence on published snapshots', () => {
    expect(schemas.vulnerabilityWatchPublishedSchema.safeParse({ ...watchBase, status: 'published' }).success).toBe(false);
    expect(schemas.vulnerabilityWatchPublishedSchema.safeParse({
      ...watchBase,
      status: 'published', reviewed_by: 'reviewer', reviewed_at: '2026-10-02T07:00:00Z', review_pr: 'http://github.com/example/repo/pull/1',
    }).success).toBe(false);
  });

  it('enforces thresholds, at most ten unique CVEs, and contiguous ranks', () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      ...watchEntry,
      rank: index + 1,
      cve: `CVE-2026-${12345 + index}`,
    }));
    expect(schemas.vulnerabilityWatchCandidateSchema.safeParse({ ...watchBase, status: 'candidate', entries }).success).toBe(true);
    expect(schemas.vulnerabilityWatchCandidateSchema.safeParse({ ...watchBase, status: 'candidate', entries: [...entries, { ...watchEntry, rank: 11, cve: 'CVE-2026-99999' }] }).success).toBe(false);
    expect(schemas.vulnerabilityWatchCandidateSchema.safeParse({ ...watchBase, status: 'candidate', entries: [{ ...watchEntry, epss: { ...watchEntry.epss, probability: 0.499 } }] }).success).toBe(false);
    expect(schemas.vulnerabilityWatchCandidateSchema.safeParse({ ...watchBase, status: 'candidate', entries: [{ ...watchEntry, rank: 2 }] }).success).toBe(false);
    expect(schemas.vulnerabilityWatchCandidateSchema.safeParse({ ...watchBase, status: 'candidate', entries: [watchEntry, { ...watchEntry, rank: 2 }] }).success).toBe(false);
  });

  it.each([
    'http://example.com/reference',
    'javascript:alert(1)',
    'https://reader:secret@example.com/reference',
  ])('rejects unsafe evidence URL %s', (url) => {
    const entries = [{ ...watchEntry, references: [{ ...watchEntry.references[0], url }] }];
    expect(schemas.vulnerabilityWatchCandidateSchema.safeParse({ ...watchBase, status: 'candidate', entries }).success).toBe(false);
  });

  it('preserves explicit nulls for unavailable NVD enrichment', () => {
    const entries = [{ ...watchEntry, cvss: null, description: null, references: [] }];
    expect(schemas.vulnerabilityWatchCandidateSchema.safeParse({ ...watchBase, status: 'candidate', entries }).success).toBe(true);
  });
});
