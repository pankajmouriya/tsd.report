import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ButtondownAmbiguousCreateError, ButtondownClient, decideButtondownDelivery, parseButtondownEmailPage,
  type ButtondownCreateEmail, type ButtondownEmailRecord, type ButtondownEmailStatus, type NewsletterIdentity,
} from '../../scripts/newsletter/buttondown';

const apiKey = 'test-only-secret-never-print';
const privateText = 'private-provider-response subscriber@example.test';
const identity: NewsletterIdentity = {
  slug: 'tsd-edition-2026-09-30',
  metadata: { edition_date: '2026-09-30', source_sha: 'a'.repeat(40), content_digest: 'b'.repeat(64), schema_version: 1 },
};
const payload: ButtondownCreateEmail = {
  ...identity, subject: 'The Security Diff — September 30', description: 'Changes worth reading.', body: '# The Security Diff\n',
  canonical_url: 'https://tsd.report/2026/09/30', status: 'about_to_send', archival_mode: 'disabled',
  filters: { filters: [], groups: [], predicate: 'and' },
};
const email = (overrides: Partial<ButtondownEmailRecord> = {}): ButtondownEmailRecord => ({
  id: 'em_test_1', slug: identity.slug, status: 'sent', metadata: { ...identity.metadata }, ...overrides,
});
const page = (results: unknown[] = [email()], count = results.length) => ({ count, results });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const accepted: ButtondownEmailStatus[] = ['draft', 'about_to_send', 'scheduled', 'in_flight', 'throttled', 'resending', 'sent'];
const manual: ButtondownEmailStatus[] = ['paused', 'errored', 'partially_sent', 'suppressed', 'deleted', 'managed_by_rss', 'imported', 'transactional'];

afterEach(() => vi.restoreAllMocks());

describe('Buttondown response boundary', () => {
  it('allows provider fields while returning only selected identity fields', () => {
    const result = parseButtondownEmailPage({ ...page([{ ...email(), body: privateText, subscribers: [privateText], metadata: { ...identity.metadata, subscriber: privateText } }]), next: 'https://evil.test', previous: null });
    expect(result).toEqual({ count: 1, results: [email()] });
    expect(JSON.stringify(result)).not.toContain(privateText);
  });

  it('accepts empty metadata on unrelated emails and an empty account', () => {
    expect(parseButtondownEmailPage(page([email({ slug: 'other', metadata: {} })])).results[0].metadata).toEqual({});
    expect(parseButtondownEmailPage(page([]))).toEqual({ count: 0, results: [] });
  });

  it.each([...accepted, ...manual])('parses the known %s state', (status) => {
    expect(parseButtondownEmailPage(page([email({ status })])).results[0].status).toBe(status);
  });

  it.each([
    null, [], {}, { results: [] }, { count: 1 }, { count: -1, results: [] }, { count: 0.5, results: [] },
    { count: '1', results: [] }, { count: Number.MAX_SAFE_INTEGER + 1, results: [] },
    { count: 1, results: {} }, page([{ ...email(), id: undefined }]), page([{ ...email(), id: '' }]),
    page([{ ...email(), slug: undefined }]), page([{ ...email(), slug: ' ' }]),
    page([{ ...email(), metadata: undefined }]), page([{ ...email(), metadata: null }]), page([{ ...email(), metadata: [] }]),
    page([{ ...email(), status: 'new_unknown_state' }]), page([{ ...email(), status: undefined }]),
    page([{ ...email(), metadata: { edition_date: 20260930 } }]),
    page([{ ...email(), metadata: { source_sha: null } }]),
    page([{ ...email(), metadata: { content_digest: {} } }]),
    page([{ ...email(), metadata: { schema_version: '1' } }]),
    page([{ ...email(), metadata: { schema_version: 0 } }]),
    page([email()], 0),
  ])('rejects malformed required fields without returning provider input (%#)', (value) => {
    expect(() => parseButtondownEmailPage(value)).toThrow(/invalid.*response/i);
  });
});

describe('Buttondown duplicate delivery policy', () => {
  it('creates only when neither slug nor edition date matches', () => {
    expect(decideButtondownDelivery([], identity)).toEqual({ kind: 'create' });
    expect(decideButtondownDelivery([email({ slug: 'unrelated', metadata: {} })], identity)).toEqual({ kind: 'create' });
  });

  it.each(accepted)('treats %s as already accepted despite a code-only source SHA change', (status) => {
    const existing = email({ status, metadata: { ...identity.metadata, source_sha: 'c'.repeat(40) } });
    expect(decideButtondownDelivery([existing], identity)).toEqual({ kind: 'already-accepted', email: existing });
  });

  it.each(manual)('requires manual review for %s and never creates a replacement', (status) => {
    expect(decideButtondownDelivery([email({ status })], identity)).toMatchObject({ kind: 'manual-review', email: { status }, reason: expect.any(String) });
  });

  it.each([
    [email(), email({ id: 'em_test_2' })],
    [email({ metadata: {} })],
    [email({ metadata: { ...identity.metadata, edition_date: '2026-09-29' } })],
    [email({ metadata: { ...identity.metadata, content_digest: 'different' } })],
    [email({ slug: 'conflicting-slug' })],
    [email({ slug: 'conflicting-slug', metadata: { ...identity.metadata, content_digest: 'different' } })],
    [email(), email({ id: 'em_test_2', slug: 'other', metadata: { ...identity.metadata, content_digest: 'different' } })],
  ])('fails closed for duplicate or inconsistent identity (%#)', (...emails) => {
    expect(decideButtondownDelivery(emails, identity)).toMatchObject({ kind: 'manual-review', reason: expect.any(String) });
  });
});

describe('Buttondown HTTP boundary', () => {
  it('lists every page with pinned authenticated headers and a bounded timeout on the fixed API origin', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ ...page([email()], 3), next: 'https://evil.test/steal-key' }))
      .mockResolvedValueOnce(response(page([email({ id: 'em_test_2', slug: 'second', metadata: {} })], 3)))
      .mockResolvedValueOnce(response(page([email({ id: 'em_test_3', slug: 'third', metadata: {} })], 3)));
    const records = await new ButtondownClient(apiKey, fetchImpl).listAllEmails();
    expect(records.map((record) => record.id)).toEqual(['em_test_1', 'em_test_2', 'em_test_3']);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    fetchImpl.mock.calls.forEach(([input, init], index) => {
      const url = new URL(String(input));
      expect(url.origin + url.pathname).toBe('https://api.buttondown.com/v1/emails');
      expect(url.searchParams.get('page')).toBe(String(index + 1));
      expect(init?.method).toBe('GET');
      expect(init?.redirect).toBe('error');
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      const headers = new Headers(init?.headers);
      expect(headers.get('Authorization')).toBe(`Token ${apiKey}`);
      expect(headers.get('X-API-Version')).toBe('2026-04-01');
      expect(headers.has('X-Buttondown-API-Version')).toBe(false);
    });
  });

  it('stops after one empty account page', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(page([])));
    expect(await new ButtondownClient(apiKey, fetchImpl).listAllEmails()).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    [page([email()], 2), page([], 2)],
    [page([email()], 2), page([email()], 2)],
    [page([email()], 2), page([email({ id: 'em_test_2' })], 3)],
    [page([email()], 2), page([email({ id: 'em_test_2' }), email({ id: 'em_test_3' })], 2)],
  ])('refuses incomplete or inconsistent pagination (%#)', async (first, second) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(response(first)).mockResolvedValueOnce(response(second));
    await expect(new ButtondownClient(apiKey, fetchImpl).listAllEmails()).rejects.toThrow(/pagination/i);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([408, 429, 500, 502, 503, 504])('retries transient GET HTTP %s and returns parsed records', async (status) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(response(privateText, status)).mockResolvedValueOnce(response(page()));
    expect(await new ButtondownClient(apiKey, fetchImpl).listAllEmails()).toEqual([email()]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('bounds repeated GET failures to three attempts and redacts transport details', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error(`${apiKey} ${privateText}`));
    const result = await new ButtondownClient(apiKey, fetchImpl).listAllEmails().catch((error: unknown) => error);
    expect(result).toBeInstanceOf(Error);
    expect(String(result)).not.toContain(apiKey);
    expect(String(result)).not.toContain(privateText);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it.each([400, 401, 403, 404, 409, 422, 302])('never retries permanent GET HTTP %s or exposes its body', async (status) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({ detail: `${apiKey} ${privateText}` }, status));
    const error = await new ButtondownClient(apiKey, fetchImpl).listAllEmails().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain(apiKey);
    expect(String(error)).not.toContain(privateText);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('aborts a hanging GET, retries with a fresh signal, and succeeds', async () => {
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => realTimeout(1));
    const fetchImpl = vi.fn<typeof fetch>()
      .mockImplementationOnce(async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true });
      }))
      .mockResolvedValueOnce(response(page()));
    expect(await new ButtondownClient(apiKey, fetchImpl).listAllEmails()).toEqual([email()]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(timeout.mock.calls.every(([milliseconds]) => milliseconds > 0 && milliseconds <= 30_000)).toBe(true);
    expect(fetchImpl.mock.calls[0][1]?.signal).not.toBe(fetchImpl.mock.calls[1][1]?.signal);
  });

  it('does not retry a malformed GET response or leak JSON parsing details', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(`${apiKey} ${privateText}`));
    const error = await new ButtondownClient(apiKey, fetchImpl).listAllEmails().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain(apiKey);
    expect(String(error)).not.toContain(privateText);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('queues one exact allowlisted payload for all subscribers, omitting deprecated fields and unknown properties', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({ ...email({ status: 'about_to_send' }), body: privateText }, 201));
    const result = await new ButtondownClient(apiKey, fetchImpl).createEmail({ ...payload, extra: privateText, email_type: 'public' } as ButtondownCreateEmail);
    expect(result).toEqual(email({ status: 'about_to_send' }));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe('https://api.buttondown.com/v1/emails');
    expect(init?.method).toBe('POST');
    expect(init?.redirect).toBe('error');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init?.body))).toEqual({
      slug: 'tsd-edition-2026-09-30', subject: 'The Security Diff — September 30', description: 'Changes worth reading.', body: '# The Security Diff\n',
      canonical_url: 'https://tsd.report/2026/09/30', status: 'about_to_send', archival_mode: 'disabled',
      filters: { filters: [], groups: [], predicate: 'and' },
      metadata: { edition_date: '2026-09-30', source_sha: 'a'.repeat(40), content_digest: 'b'.repeat(64), schema_version: 1 },
    });
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe(`Token ${apiKey}`);
    expect(headers.get('X-API-Version')).toBe('2026-04-01');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(String(init?.body)).not.toContain(apiKey);
  });

  it.each([408, 500, 502, 503, 504])('exposes HTTP %s after POST as typed ambiguity without retry or response details', async (status) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(`${apiKey} ${privateText}`, status));
    const error = await new ButtondownClient(apiKey, fetchImpl).createEmail(payload).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ButtondownAmbiguousCreateError);
    expect(String(error)).not.toContain(apiKey);
    expect(String(error)).not.toContain(privateText);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('aborts a hanging POST and reports ambiguity without retry', async () => {
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => realTimeout(1));
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true });
    }));
    await expect(new ButtondownClient(apiKey, fetchImpl).createEmail(payload)).rejects.toBeInstanceOf(ButtondownAmbiguousCreateError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    () => Promise.reject(new Error(`${apiKey} ${privateText}`)),
    () => Promise.resolve(new Response(`${apiKey} ${privateText}`, { status: 201 })),
    () => Promise.resolve(response({ ...email(), status: 'unknown', body: `${apiKey} ${privateText}` }, 201)),
  ])('treats connection loss or an unreadable successful POST as ambiguous (%#)', async (result) => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(result);
    const error = await new ButtondownClient(apiKey, fetchImpl).createEmail(payload).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ButtondownAmbiguousCreateError);
    expect(String(error)).not.toContain(apiKey);
    expect(String(error)).not.toContain(privateText);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([400, 401, 403, 409, 422, 429, 302])('fails POST HTTP %s once without retry, ambiguity, or sensitive errors', async (status) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(`${apiKey} ${privateText}`, status));
    const error = await new ButtondownClient(apiKey, fetchImpl).createEmail(payload).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ButtondownAmbiguousCreateError);
    expect(String(error)).not.toContain(apiKey);
    expect(String(error)).not.toContain(privateText);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('refuses malformed create input before issuing any POST', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(new ButtondownClient(apiKey, fetchImpl).createEmail({ ...payload, status: 'sent' } as unknown as ButtondownCreateEmail)).rejects.toThrow(/invalid.*payload/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects an empty key before any network access', () => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(() => new ButtondownClient(' ', fetchImpl)).toThrow(/API key/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never logs secret headers, provider records, or response bodies', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(`${apiKey} ${privateText}`, 401));
    await new ButtondownClient(apiKey, fetchImpl).listAllEmails().catch(() => {});
    await new ButtondownClient(apiKey, fetchImpl).createEmail(payload).catch(() => {});
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
