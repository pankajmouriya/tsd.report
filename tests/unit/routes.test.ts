import { describe, expect, it } from 'vitest';
import { articlePath, cvePath, editionPath, isExternalStory, storyDestination, storyIdentityPath } from '../../src/lib/routes';

describe('canonical routes', () => {
  it('uses the singular article route', () => {
    expect(articlePath('monitor-ai-agents')).toBe('/article/monitor-ai-agents');
  });

  it('separates stable story identity from an optional reader destination', () => {
    expect(storyIdentityPath({ slug: 'research-paper' })).toBe('/article/research-paper');
    expect(storyDestination({ slug: 'research-paper' })).toBe('/article/research-paper');
    expect(isExternalStory({ slug: 'research-paper' })).toBe(false);

    const external = { slug: 'research-paper', destination_url: 'https://example.com/research-paper' };
    expect(storyIdentityPath(external)).toBe('/article/research-paper');
    expect(storyDestination(external)).toBe('https://example.com/research-paper');
    expect(isExternalStory(external)).toBe(true);
  });

  it('maps a real calendar date to an edition route', () => {
    expect(editionPath('2026-09-26')).toBe('/2026/09/26');
  });

  it('rejects impossible dates and unsafe slugs', () => {
    expect(() => editionPath('2026-02-30')).toThrow();
    expect(() => articlePath('../archive')).toThrow();
  });

  it('normalizes valid CVE identifiers', () => {
    expect(cvePath('cve-2025-49704')).toBe('/cve/CVE-2025-49704');
  });
});
