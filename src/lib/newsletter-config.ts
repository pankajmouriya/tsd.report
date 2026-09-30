export interface NewsletterSignupConfig {
  username: string;
  action: string;
  contactUrl: string;
}

export function resolveNewsletterSignupConfig(
  env: Record<string, string | undefined>,
): NewsletterSignupConfig | null {
  if (env.TSD_NEWSLETTER_SIGNUP_ENABLED !== 'true') return null;

  const username = env.BUTTONDOWN_USERNAME;
  if (!username || !/^[A-Za-z0-9_-]+$/.test(username)) {
    throw new Error('Newsletter signup configuration: BUTTONDOWN_USERNAME is required and must contain only letters, numbers, underscores, or hyphens.');
  }

  const contactUrl = env.TSD_PUBLICATION_CONTACT_URL;
  let contact: URL | undefined;
  try {
    if (contactUrl && contactUrl === contactUrl.trim() && !/\s/.test(contactUrl)) {
      contact = new URL(contactUrl);
    }
  } catch {
    // Invalid public configuration is reported below without echoing its value.
  }
  const validContact = contact && (
    (contact.protocol === 'https:' && Boolean(contact.hostname) && !contact.username && !contact.password)
    || (contact.protocol === 'mailto:' && /^[^@\s]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(contact.pathname))
  );
  if (!contactUrl || !validContact) {
    throw new Error('Newsletter signup configuration: TSD_PUBLICATION_CONTACT_URL is required and must be a valid mailto: address or HTTPS contact URL.');
  }

  return {
    username,
    action: `https://buttondown.com/api/emails/embed-subscribe/${encodeURIComponent(username)}`,
    contactUrl,
  };
}
