import { describe, expect, it } from 'vitest';
import { articlePath, cvePath, editionPath } from '../../src/lib/routes';

describe('canonical routes', () => {
  it('uses the singular article route', () => {
    expect(articlePath('monitor-ai-agents')).toBe('/article/monitor-ai-agents');
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
