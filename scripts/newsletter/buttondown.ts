import { z } from 'zod';

const emailStatusSchema = z.enum([
  'draft', 'about_to_send', 'scheduled', 'in_flight', 'throttled', 'resending', 'sent',
  'paused', 'errored', 'partially_sent', 'suppressed', 'deleted', 'managed_by_rss', 'imported', 'transactional',
]);
export type ButtondownEmailStatus = z.infer<typeof emailStatusSchema>;

const nonempty = z.string().refine((value) => value.trim().length > 0);
const identityMetadataSchema = z.object({
  edition_date: z.iso.date(),
  source_sha: nonempty,
  content_digest: nonempty,
  schema_version: z.number().int().positive(),
});

export interface NewsletterIdentity {
  slug: string;
  metadata: z.infer<typeof identityMetadataSchema>;
}

export interface ButtondownEmailRecord {
  id: string;
  slug: string;
  status: ButtondownEmailStatus;
  metadata: Record<string, unknown>;
}

export interface ButtondownEmailPage {
  count: number;
  results: ButtondownEmailRecord[];
}

const emailSchema = z.object({
  id: nonempty,
  slug: nonempty,
  status: emailStatusSchema,
  // Unrelated emails may have no TSD metadata. Retain only our four identity keys.
  metadata: identityMetadataSchema.partial(),
});
const pageSchema = z.object({
  count: z.number().int().nonnegative(),
  results: z.array(emailSchema),
}).refine((value) => value.results.length <= value.count);

function parseEmail(value: unknown): ButtondownEmailRecord {
  const result = emailSchema.safeParse(value);
  if (!result.success) throw new Error('Invalid Buttondown response');
  return result.data;
}

export function parseButtondownEmailPage(value: unknown): ButtondownEmailPage {
  const result = pageSchema.safeParse(value);
  if (!result.success) throw new Error('Invalid Buttondown response');
  return result.data;
}

export type DeliveryDecision =
  | { kind: 'create' }
  | { kind: 'already-accepted'; email: ButtondownEmailRecord }
  | { kind: 'manual-review'; email: ButtondownEmailRecord; reason: string };

const acceptedStates = new Set<ButtondownEmailStatus>([
  'draft', 'about_to_send', 'scheduled', 'in_flight', 'throttled', 'resending', 'sent',
]);

export function decideButtondownDelivery(emails: ButtondownEmailRecord[], identity: NewsletterIdentity): DeliveryDecision {
  const matches = emails.filter((email) => email.slug === identity.slug || email.metadata.edition_date === identity.metadata.edition_date);
  if (!matches.length) return { kind: 'create' };
  const email = matches[0];
  if (matches.length > 1) return { kind: 'manual-review', email, reason: 'Multiple emails match the edition identity' };
  if (email.slug !== identity.slug || email.metadata.edition_date !== identity.metadata.edition_date || email.metadata.content_digest !== identity.metadata.content_digest) {
    return { kind: 'manual-review', email, reason: 'Existing email conflicts with the edition identity' };
  }
  // Source SHA changes alone do not authorize a second copy of the same edition.
  if (acceptedStates.has(email.status)) return { kind: 'already-accepted', email };
  return { kind: 'manual-review', email, reason: 'Existing email state requires manual review' };
}

const createEmailSchema = z.object({
  slug: nonempty,
  subject: nonempty,
  description: nonempty,
  body: nonempty,
  canonical_url: z.url({ protocol: /^https$/ }),
  status: z.literal('about_to_send'),
  archival_mode: z.literal('disabled'),
  filters: z.object({ filters: z.tuple([]), groups: z.tuple([]), predicate: z.literal('and') }),
  metadata: identityMetadataSchema,
});
export type ButtondownCreateEmail = z.infer<typeof createEmailSchema>;

/** The request may have been accepted; the caller must reconcile before any future create. */
export class ButtondownAmbiguousCreateError extends Error {
  constructor() {
    super('Buttondown create outcome is ambiguous; reconcile the edition identity before proceeding');
    this.name = 'ButtondownAmbiguousCreateError';
  }
}

const endpoint = 'https://api.buttondown.com/v1/emails';
const timeoutMilliseconds = 10_000;
const getAttempts = 3;
const transientStatus = (status: number) => status === 408 || status === 429 || status >= 500;

export class ButtondownClient {
  #apiKey: string;
  #fetchImpl: typeof fetch;

  constructor(apiKey: string, fetchImpl: typeof fetch = fetch) {
    if (!apiKey.trim()) throw new Error('Buttondown API key is required');
    this.#apiKey = apiKey;
    this.#fetchImpl = fetchImpl;
  }

  #headers(): Record<string, string> {
    return { Authorization: `Token ${this.#apiKey}`, 'X-API-Version': '2026-04-01', 'Content-Type': 'application/json' };
  }

  async #getPage(page: number): Promise<ButtondownEmailPage> {
    for (let attempt = 0; attempt < getAttempts; attempt++) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, attempt * 100));
      const signal = AbortSignal.timeout(timeoutMilliseconds);
      let response: Response;
      try {
        response = await this.#fetchImpl(`${endpoint}?page=${page}`, {
          method: 'GET', headers: this.#headers(), signal, redirect: 'error',
        });
      } catch {
        if (attempt < getAttempts - 1) continue;
        throw new Error('Buttondown GET failed after bounded retries');
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        if (transientStatus(response.status) && attempt < getAttempts - 1) continue;
        throw new Error(`Buttondown GET failed (HTTP ${response.status})`);
      }
      let value: unknown;
      try {
        value = await response.json();
      } catch {
        if (signal.aborted && attempt < getAttempts - 1) continue;
        throw new Error('Invalid Buttondown response');
      }
      return parseButtondownEmailPage(value);
    }
    throw new Error('Buttondown GET failed after bounded retries');
  }

  async listAllEmails(): Promise<ButtondownEmailRecord[]> {
    const emails: ButtondownEmailRecord[] = [];
    const ids = new Set<string>();
    let expectedCount: number | undefined;
    for (let page = 1; ; page++) {
      const result = await this.#getPage(page);
      expectedCount ??= result.count;
      if (result.count !== expectedCount || emails.length + result.results.length > expectedCount) {
        throw new Error('Inconsistent Buttondown pagination');
      }
      for (const email of result.results) {
        if (ids.has(email.id)) throw new Error('Repeated email in Buttondown pagination');
        ids.add(email.id);
        emails.push(email);
      }
      if (emails.length === expectedCount) return emails;
      if (!result.results.length) throw new Error('Incomplete Buttondown pagination');
    }
  }

  async createEmail(payload: ButtondownCreateEmail): Promise<ButtondownEmailRecord> {
    const parsed = createEmailSchema.safeParse(payload);
    if (!parsed.success) throw new Error('Invalid Buttondown create payload');
    let response: Response;
    try {
      // No POST retry, including redirects: acceptance may precede a connection failure.
      response = await this.#fetchImpl(endpoint, {
        method: 'POST', headers: this.#headers(), redirect: 'error',
        signal: AbortSignal.timeout(timeoutMilliseconds), body: JSON.stringify(parsed.data),
      });
    } catch {
      throw new ButtondownAmbiguousCreateError();
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      if (response.status === 408 || response.status >= 500) throw new ButtondownAmbiguousCreateError();
      throw new Error(`Buttondown POST failed (HTTP ${response.status})`);
    }
    try {
      return parseEmail(await response.json());
    } catch {
      // A successful response with a missing/unreadable identity still may have queued mail.
      throw new ButtondownAmbiguousCreateError();
    }
  }
}
