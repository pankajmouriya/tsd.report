import { describe, expect, it } from 'vitest';
import { validateContentMode } from '../../src/lib/content';

describe('content mode', () => {
  it('rejects fixture content in production', () => {
    expect(() => validateContentMode('production')).toThrow('reject fixture content');
  });

  it('rejects unknown modes', () => {
    expect(() => validateContentMode('preview')).toThrow('Invalid CONTENT_MODE');
  });
});
