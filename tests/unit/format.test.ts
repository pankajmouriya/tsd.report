import { describe, expect, it } from 'vitest';
import { formatProbability } from '../../src/lib/format';

describe('formatProbability', () => {
  it('distinguishes zero from unknown', () => {
    expect(formatProbability(0)).toBe('0%');
    expect(formatProbability(null)).toBe('Not available');
  });
});
