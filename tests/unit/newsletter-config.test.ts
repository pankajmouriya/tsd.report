import { describe, expect, it } from 'vitest';
import { resolveNewsletterSignupConfig } from '../../src/lib/newsletter-config';

const enabled = {
  TSD_NEWSLETTER_SIGNUP_ENABLED: 'true',
  BUTTONDOWN_USERNAME: 'tsd-test',
  TSD_PUBLICATION_CONTACT_URL: 'mailto:privacy@example.test',
};

describe('public newsletter signup configuration', () => {
  it.each([undefined, '', 'false', 'TRUE', 'True', '1', ' true', 'true '])(
    'omits signup unless the enabled flag is exactly true (%s)',
    (flag) => {
      expect(resolveNewsletterSignupConfig({ TSD_NEWSLETTER_SIGNUP_ENABLED: flag })).toBeNull();
    },
  );

  it('ignores invalid public values when signup is disabled', () => {
    expect(resolveNewsletterSignupConfig({
      BUTTONDOWN_USERNAME: '../invalid',
      TSD_PUBLICATION_CONTACT_URL: 'javascript:alert(1)',
    })).toBeNull();
  });

  it.each(['BUTTONDOWN_USERNAME', 'TSD_PUBLICATION_CONTACT_URL'])('requires %s when enabled', (key) => {
    for (const value of [undefined, '', '   ']) {
      expect(() => resolveNewsletterSignupConfig({ ...enabled, [key]: value })).toThrow(key);
    }
  });

  it('returns the native Buttondown action and public contact', () => {
    expect(resolveNewsletterSignupConfig(enabled)).toEqual({
      username: 'tsd-test',
      action: 'https://buttondown.com/api/emails/embed-subscribe/tsd-test',
      contactUrl: 'mailto:privacy@example.test',
    });
  });

  it('accepts letters, numbers, underscores and hyphens in usernames', () => {
    expect(resolveNewsletterSignupConfig({ ...enabled, BUTTONDOWN_USERNAME: 'TSD_2026-test' })?.action)
      .toBe('https://buttondown.com/api/emails/embed-subscribe/TSD_2026-test');
  });

  it.each(['tsd.report', '../tsd', 'tsd/test', 'tsd test', 'tsd%20test', 'tsd?test', 'tést', ' tsd'])('rejects unsafe username %s', (username) => {
    expect(() => resolveNewsletterSignupConfig({ ...enabled, BUTTONDOWN_USERNAME: username }))
      .toThrow('BUTTONDOWN_USERNAME');
  });

  it.each(['mailto:privacy@example.test', 'mailto:privacy@example.test?subject=Privacy', 'https://example.test/contact'])('accepts public contact %s', (contactUrl) => {
    expect(resolveNewsletterSignupConfig({ ...enabled, TSD_PUBLICATION_CONTACT_URL: contactUrl })?.contactUrl)
      .toBe(contactUrl);
  });

  it.each(['http://example.test', 'javascript:alert(1)', 'data:text/html,test', '/contact', 'not a URL', 'https://', 'mailto:', 'mailto:not-an-address', 'https://user:pass@example.test', ' https://example.test'])('rejects invalid public contact %s', (contactUrl) => {
    expect(() => resolveNewsletterSignupConfig({ ...enabled, TSD_PUBLICATION_CONTACT_URL: contactUrl }))
      .toThrow('TSD_PUBLICATION_CONTACT_URL');
  });
});
