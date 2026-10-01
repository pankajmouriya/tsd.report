import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fixtureEditionSchema, fixtureStorySchema } from '../../src/lib/schema';
import { buildNewsletterDigest, renderNewsletterMarkdown, renderNewsletterPreviewHtml } from '../../src/lib/newsletter';

const fixture = fixtureEditionSchema.parse(JSON.parse(readFileSync('data/fixtures/editions/2026-09-26.json', 'utf8')));
const seed = fixture.stories[0];
const copy = { status: 'draft' as const, subject: 'The Security Diff — Édition', preview_text: 'Security changes worth reading.' };
const story = (id: string, overrides = {}) => fixtureStorySchema.parse({ ...seed, id, slug: id, title: `Headline ${id}`, summary: `Summary ${id}`, vulnerabilities: [], body: ['FULL ARTICLE BODY MUST NEVER BE COPIED'], ...overrides });
const edition = (overrides = {}) => fixtureEditionSchema.parse({
  schema_version: 1, date: '2026-09-26', fixture: true, newsletter: copy,
  lead_story: 'lead', sections: { briefs: ['last', 'lead', 'first', 'last', 'alias'] },
  stories: [story('first'), story('lead'), story('last'), story('alias', { slug: 'first' }), story('unsectioned')],
  ...overrides,
});

describe('newsletter digest', () => {
  it('preserves section order, includes the lead once, deduplicates slugs, and retains unsectioned stories', () => {
    const digest = buildNewsletterDigest(edition());
    expect(digest.lead.slug).toBe('lead');
    expect(digest.stories.map((entry) => entry.slug)).toEqual(['last', 'first', 'unsectioned']);
    for (const render of [renderNewsletterMarkdown, renderNewsletterPreviewHtml]) {
      const output = render(digest);
      expect(output.match(/Headline lead/g)).toHaveLength(1);
      expect(output.indexOf('Headline last')).toBeLessThan(output.indexOf('Headline first'));
      expect(output).not.toContain('FULL ARTICLE BODY MUST NEVER BE COPIED');
    }
  });

  it('uses canonical article and permanent dated edition links, including a configured origin', () => {
    const digest = buildNewsletterDigest(edition());
    expect(digest.canonicalUrl).toBe('https://tsd.report/2026/09/26');
    expect(digest.lead.url).toBe('https://tsd.report/article/lead');
    for (const render of [renderNewsletterMarkdown, renderNewsletterPreviewHtml]) {
      const output = render(digest);
      for (const path of ['/2026/09/26', '/article/lead', '/editorial-policy', '/privacy', '/rss.xml']) {
        expect(output).toContain(`https://tsd.report${path}`);
      }
      expect(output).not.toContain('/articles/');
    }
    const local = buildNewsletterDigest(edition(), 'https://preview.example.test/base');
    expect(local.lead.url).toBe('https://preview.example.test/article/lead');
    expect(renderNewsletterMarkdown(local)).toContain('https://preview.example.test/privacy');
  });

  it('renders supplied editorial signals and omits an absent digest signal', () => {
    const digest = buildNewsletterDigest(edition({ sections: {}, stories: [story('lead', { signal: { score: 0, label: 'standard', reasons: [] } })] }));
    for (const render of [renderNewsletterMarkdown, renderNewsletterPreviewHtml]) {
      expect(render(digest).replaceAll('\\', '')).toContain('Security signal: Standard (0/100)');
    }
    digest.lead.signal = undefined;
    for (const render of [renderNewsletterMarkdown, renderNewsletterPreviewHtml]) expect(render(digest)).not.toContain('Security signal:');
  });

  it('omits Vulnerability Watch for an edition with no supplied entries', () => {
    const digest = buildNewsletterDigest(edition());
    expect(digest.vulnerabilities).toEqual([]);
    expect(renderNewsletterMarkdown(digest)).not.toContain('Vulnerability Watch');
    expect(renderNewsletterPreviewHtml(digest)).not.toContain('Vulnerability Watch');
  });

  it('retains real supplied vulnerability facts and their action context without conflating unknowns', () => {
    const vulnerability = { ...seed.vulnerabilities[0], cvss: null, epss: null, epss_percentile: null, kev: null, exploitation: 'unknown', affected: [], fixed_versions: [] };
    const digest = buildNewsletterDigest(edition({ sections: {}, stories: [story('lead', { vulnerabilities: [vulnerability], action: 'Read the supplied vendor guidance.' })] }));
    expect(digest.vulnerabilities[0]).toMatchObject({ cve: vulnerability.cve, cvss: null, epss: null, epss_percentile: null, kev: null, exploitation: 'unknown', action: 'Read the supplied vendor guidance.' });
    for (const render of [renderNewsletterMarkdown, renderNewsletterPreviewHtml]) {
      const output = render(digest).replaceAll('\\', '');
      expect(output).toContain('Vulnerability Watch');
      expect(output).toContain(vulnerability.cve);
      for (const value of ['CVSS: Not available', 'EPSS probability: Not available', 'EPSS percentile: Not available', 'CISA KEV: Unknown', 'Known exploitation: Unknown', 'Fixed versions: Not available', 'Read the supplied vendor guidance.']) expect(output).toContain(value);
      expect(output).not.toMatch(/CVSS: 0|EPSS probability: 0|CISA KEV: No|safe/i);
    }
  });

  it('renders genuine zero and false values separately from unknown facts', () => {
    const digest = buildNewsletterDigest(edition({ sections: {}, stories: [story('lead', { vulnerabilities: [{ ...seed.vulnerabilities[0], cvss: 0, epss: 0, epss_percentile: 0, kev: false, exploitation: 'not-confirmed' }] })] }));
    for (const render of [renderNewsletterMarkdown, renderNewsletterPreviewHtml]) {
      const output = render(digest);
      for (const value of ['CVSS: 0', 'EPSS probability: 0%', 'EPSS percentile: 0%', 'CISA KEV: No', 'Known exploitation: Not confirmed']) expect(output).toContain(value);
    }
  });

  it('escapes Markdown formatting, links, raw HTML, and line-based syntax in supplied copy', () => {
    const digest = buildNewsletterDigest(edition({ newsletter: { ...copy, subject: '*subject* <script>', preview_text: '[preview](https://evil.test)' }, sections: {}, stories: [story('lead', { title: '[click](https://evil.test) *bold* <img>', summary: 'Text\n# heading\n![pixel](https://evil.test) & more `code`' })] }));
    const output = renderNewsletterMarkdown(digest);
    expect(output).toContain('\\[click\\]\\(https://evil\\.test\\) \\*bold\\* &lt;img&gt;');
    expect(output).toContain('Text \\# heading \\!\\[pixel\\]');
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('<img>');
    expect(output).not.toContain('![pixel](https://evil.test)');
  });

  it('escapes every data-derived HTML field and attribute', () => {
    const injection = '<img src=x onerror="alert(1)"> & \'quoted\'';
    const digest = buildNewsletterDigest(edition({ newsletter: { ...copy, subject: injection, preview_text: injection }, sections: {}, stories: [story('lead', { title: injection, summary: injection, vulnerabilities: [{ ...seed.vulnerabilities[0], affected: [injection], fixed_versions: [injection] }], action: injection, signal: { score: 42, label: 'recommended', reasons: [injection] } })] }));
    digest.lead.url = 'https://example.test/?value="<injected>&other=1';
    const output = renderNewsletterPreviewHtml(digest);
    expect(output).not.toContain('<img');
    expect(output).not.toContain('<injected>');
    expect(output).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;quoted&#39;');
    expect(output).toContain('&amp;other=1');
  });

  it('encodes destination parentheses so a supplied URL cannot break the Markdown link or inject an image', () => {
    const digest = buildNewsletterDigest(edition({ sections: {}, stories: [story('lead')] }));
    digest.lead.url = 'https://example.test/report)![pixel](https://evil.test/tracker)';
    const output = renderNewsletterMarkdown(digest);
    const headlineLink = output.split('\n').find((line) => line.startsWith('### [Headline lead]'));
    expect(headlineLink).toBe('### [Headline lead](https://example.test/report%29![pixel]%28https://evil.test/tracker%29)');
    expect(output).not.toContain('![pixel](');
    expect(headlineLink?.match(/^### \[Headline lead\]\(([^)]+)\)$/)?.[1]).toBe('https://example.test/report%29![pixel]%28https://evil.test/tracker%29');
  });

  it('retains Unicode and long headlines in a one-story edition', () => {
    const title = `Évidence — 安全 🔐 ${'A long headline '.repeat(35)}`;
    const digest = buildNewsletterDigest(edition({ sections: {}, stories: [story('lead', { title })] }));
    expect(digest.stories).toEqual([]);
    expect(renderNewsletterMarkdown(digest)).toContain(title.trim());
    expect(renderNewsletterPreviewHtml(digest)).toContain(title);
  });

  it('produces deterministic output and labels fixtures as previews', () => {
    const input = edition();
    const original = JSON.stringify(input);
    for (const render of [renderNewsletterMarkdown, renderNewsletterPreviewHtml]) {
      const output = render(buildNewsletterDigest(input));
      expect(output).toBe(render(buildNewsletterDigest(structuredClone(input))));
      expect(output).toContain('Fixture preview');
    }
    expect(renderNewsletterPreviewHtml(buildNewsletterDigest(input))).toContain('noindex, nofollow');
    expect(JSON.stringify(input)).toBe(original);
  });

  it('fails when newsletter metadata is absent and rejects non-web origins', () => {
    expect(() => buildNewsletterDigest(edition({ newsletter: undefined }))).toThrow(/newsletter metadata/i);
    expect(() => buildNewsletterDigest(edition(), 'javascript:alert(1)')).toThrow();
  });
});

describe('newsletter preview CLI', () => {
  const script = fileURLToPath(new URL('../../scripts/newsletter/render.ts', import.meta.url));
  const tsx = resolve('node_modules/tsx/dist/loader.mjs');
  const run = (cwd: string, args: string[], ambientMode?: string) => spawnSync(process.execPath, ['--import', tsx, script, ...args], { cwd, encoding: 'utf8', env: { PATH: process.env.PATH, ...(ambientMode ? { CONTENT_MODE: ambientMode } : {}) } });

  it('honors explicit fixture mode before loading an unavailable ambient production corpus', () => {
    const root = mkdtempSync(join(tmpdir(), 'tsd-newsletter-mode-'));
    try {
      const directory = join(root, 'data/fixtures/editions');
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, 'edition.json'), JSON.stringify(edition({ sections: {}, stories: [story('lead')] })));
      const result = run(root, ['--mode', 'fixture'], 'production');
      expect(result.status, result.stderr).toBe(0);
      const output = readFileSync(join(root, 'dist/newsletter-preview.html'), 'utf8');
      expect(output).toContain('Fixture preview');
      expect(output).toContain('https://tsd.report/article/lead');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('selects the latest edition, writes standalone HTML, and supports a custom output', () => {
    const root = mkdtempSync(join(tmpdir(), 'tsd-newsletter-preview-'));
    try {
      const directory = join(root, 'data/fixtures/editions');
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, 'older.json'), JSON.stringify(edition({ date: '2026-09-25', newsletter: undefined, sections: {}, stories: [story('lead')] })));
      writeFileSync(join(directory, 'newer.json'), JSON.stringify(edition({ lead_story: 'newest', sections: {}, stories: [story('newest')] })));
      const result = run(root, ['--mode', 'fixture']);
      expect(result.status, result.stderr).toBe(0);
      const output = readFileSync(join(root, 'dist/newsletter-preview.html'), 'utf8');
      expect(output).toContain('<!doctype html>');
      expect(output).toContain('https://tsd.report/article/newest');
      expect(output).not.toContain('https://tsd.report/article/lead');
      const custom = run(root, ['--mode', 'fixture', '--output', 'review/digest.html']);
      expect(custom.status, custom.stderr).toBe(0);
      expect(readFileSync(join(root, 'review/digest.html'), 'utf8')).toBe(output);
      expect(run(root, ['--mode', 'invalid']).status).not.toBe(0);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('refuses a latest edition with no newsletter metadata without writing an artifact', () => {
    const result = run(process.cwd(), ['--mode', 'production', '--output', join(tmpdir(), 'should-not-create-newsletter.html')]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/newsletter metadata/i);
  });
});
