import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliverLatestNewsletter } from '../../scripts/newsletter/send';
import { buildNewsletterDigest, renderNewsletterMarkdown } from '../../src/lib/newsletter';
import { fixtureEditionSchema, productionEditionSchema, type Edition } from '../../src/lib/schema';
import type { ButtondownEmailRecord, ButtondownEmailStatus } from '../../scripts/newsletter/buttondown';

const apiKey = 'test-only-api-secret';
const privateText = 'subscriber@example.test private-provider-body';
const sourceSha = 'a'.repeat(40);
const production = JSON.parse(readFileSync('data/production/editions/2026-09-29.json', 'utf8'));
const copy = { status: 'approved', subject: 'The Security Diff — Édition', preview_text: 'Security changes worth reading.', approved_by: 'Test reviewer', approved_at: '2026-09-30T12:00:00Z' };
const edition = () => productionEditionSchema.parse({ ...production, newsletter: copy });
const markdown = renderNewsletterMarkdown(buildNewsletterDigest(edition()));
const contentDigest = createHash('sha256').update(markdown, 'utf8').digest('hex');
const metadata = { edition_date: '2026-09-29', source_sha: sourceSha, content_digest: contentDigest, schema_version: 1 };
const email = (overrides: Partial<ButtondownEmailRecord> = {}): ButtondownEmailRecord => ({ id: 'em_test_1', slug: 'tsd-edition-2026-09-29', status: 'about_to_send', metadata: { ...metadata }, ...overrides });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const page = (results: unknown[] = [], count = results.length) => response({ count, results });
const tempRoots: string[] = [];
const temporary = () => { const root = mkdtempSync(join(tmpdir(), 'tsd-newsletter-send-')); tempRoots.push(root); return root; };
const deliver = (fetchImpl: typeof fetch, extra = {}) => deliverLatestNewsletter({ edition: edition(), apiKey, sourceSha, fetchImpl, ...extra });
const methods = (fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>) => fetchImpl.mock.calls.map(([, init]) => init?.method);
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('newsletter delivery', () => {
  it.each(['not-configured', 'draft'] as const)('skips %s before credentials, digest rendering, or any HTTP', async (reason) => {
    const input = productionEditionSchema.parse({ ...production, newsletter: reason === 'draft' ? { status: 'draft', subject: 'Draft', preview_text: 'Preview' } : undefined });
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await deliverLatestNewsletter({ edition: input, apiKey: undefined, sourceSha: '', fetchImpl })).toEqual({ kind: 'skipped', reason });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '   '])('requires an API key for approved content (%#)', async (key) => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(deliver(fetchImpl, { apiKey: key })).rejects.toThrow(/API key/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(['', '   '])('requires a source SHA for approved content (%#)', async (sha) => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(deliver(fetchImpl, { sourceSha: sha })).rejects.toThrow(/source SHA/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects approved fixtures without contacting the provider', async () => {
    const fixture = fixtureEditionSchema.parse({ ...JSON.parse(readFileSync('data/fixtures/editions/2026-09-26.json', 'utf8')), newsletter: copy });
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(deliver(fetchImpl, { edition: fixture })).rejects.toThrow(/production|fixture/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('queues exactly one deterministic Markdown digest for all subscribers, regardless of ambient mode', async () => {
    vi.stubEnv('CONTENT_MODE', 'invalid-ambient-mode');
    const input = edition();
    const original = JSON.stringify(input);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(page()).mockResolvedValueOnce(response(email(), 201));
    expect(await deliver(fetchImpl, { edition: input })).toEqual({ kind: 'queued', editionDate: '2026-09-29', emailId: 'em_test_1', contentDigest });
    expect(methods(fetchImpl)).toEqual(['GET', 'POST']);
    const payload = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body));
    expect(payload).toEqual({ slug: 'tsd-edition-2026-09-29', subject: copy.subject, description: copy.preview_text, body: markdown, canonical_url: 'https://tsd.report/2026/09/29', status: 'about_to_send', archival_mode: 'disabled', filters: { filters: [], groups: [], predicate: 'and' }, metadata });
    expect(payload.metadata.content_digest).toBe(createHash('sha256').update(Buffer.from(payload.body, 'utf8')).digest('hex'));
    expect(JSON.stringify(input)).toBe(original);
  });

  const accepted: ButtondownEmailStatus[] = ['draft', 'about_to_send', 'scheduled', 'in_flight', 'throttled', 'resending', 'sent'];
  it.each(accepted)('returns idempotent success for %s despite a different source SHA', async (status) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(page([email({ status, metadata: { ...metadata, source_sha: 'b'.repeat(40) } })]));
    expect(await deliver(fetchImpl)).toEqual({ kind: 'already-accepted', editionDate: '2026-09-29', emailId: 'em_test_1', contentDigest });
    expect(methods(fetchImpl)).toEqual(['GET']);
  });

  const manual: ButtondownEmailStatus[] = ['paused', 'errored', 'partially_sent', 'suppressed', 'deleted', 'managed_by_rss', 'imported', 'transactional'];
  it.each(manual)('fails closed for %s without creating mail', async (status) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(page([email({ status })]));
    await expect(deliver(fetchImpl)).rejects.toThrow(/manual review/i);
    expect(methods(fetchImpl)).toEqual(['GET']);
  });

  it.each([
    [email({ metadata: { ...metadata, content_digest: 'changed' } })],
    [email({ slug: 'conflicting-slug' })],
    [email({ metadata: {} })],
    [email(), email({ id: 'em_test_2' })],
  ])('fails closed for conflicting or duplicate identities (%#)', async (...records) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(page(records));
    await expect(deliver(fetchImpl)).rejects.toThrow(/manual review/i);
    expect(methods(fetchImpl)).toEqual(['GET']);
  });

  it('checks every page before creating and detects an accepted email on the last page', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(page([email({ id: 'unrelated', slug: 'other', metadata: {} })], 2)).mockResolvedValueOnce(page([email()], 2));
    expect(await deliver(fetchImpl)).toMatchObject({ kind: 'already-accepted' });
    expect(methods(fetchImpl)).toEqual(['GET', 'GET']);
  });

  it.each([
    email({ slug: 'wrong', metadata: {} }),
    email({ metadata: { ...metadata, content_digest: 'wrong' } }),
    email({ status: 'paused' }),
  ])('verifies the successful create response before claiming queued (%#)', async (created) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(page()).mockResolvedValueOnce(response(created, 201));
    await expect(deliver(fetchImpl)).rejects.toThrow(/manual review/i);
    expect(methods(fetchImpl)).toEqual(['GET', 'POST']);
  });

  it.each(['network', 'server', 'invalid-response'])('reconciles an ambiguous %s POST across all pages without retrying it', async (kind) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(page()).mockImplementationOnce(async () => {
      if (kind === 'network') throw new Error(`${apiKey} ${privateText}`);
      return kind === 'server' ? response({ detail: `${apiKey} ${privateText}` }, 503) : response({ privateText }, 201);
    }).mockResolvedValueOnce(page([email()], 2)).mockResolvedValueOnce(page([email({ id: 'unrelated', slug: 'other', metadata: {} })], 2));
    expect(await deliver(fetchImpl)).toEqual({ kind: 'already-accepted', editionDate: '2026-09-29', emailId: 'em_test_1', contentDigest });
    expect(methods(fetchImpl)).toEqual(['GET', 'POST', 'GET', 'GET']);
    expect(String(fetchImpl.mock.calls[2][0])).toMatch(/page=1$/);
    expect(String(fetchImpl.mock.calls[3][0])).toMatch(/page=2$/);
  });

  it.each([
    { records: [] },
    { records: [email({ status: 'errored' })] },
    { records: [email({ metadata: { ...metadata, content_digest: 'wrong' } })] },
    { records: [email(), email({ id: 'em_test_2' })] },
  ])('fails unresolved ambiguous creation with no second POST (%#)', async ({ records }) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(page()).mockRejectedValueOnce(new Error(`${apiKey} ${privateText}`)).mockResolvedValueOnce(page(records));
    await expect(deliver(fetchImpl)).rejects.toThrow(/ambiguous|manual review/i);
    expect(methods(fetchImpl)).toEqual(['GET', 'POST', 'GET']);
  });

  it('does not stop reconciliation at an accepted first-page match when a later duplicate exists', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(page()).mockRejectedValueOnce(new Error(privateText)).mockResolvedValueOnce(page([email()], 2)).mockResolvedValueOnce(page([email({ id: 'em_test_2' })], 2));
    await expect(deliver(fetchImpl)).rejects.toThrow(/ambiguous|manual review/i);
    expect(methods(fetchImpl)).toEqual(['GET', 'POST', 'GET', 'GET']);
  });

  it.each(['list', 'create', 'reconcile'])('redacts provider errors during %s and preserves site output', async (stage) => {
    const root = temporary();
    const site = join(root, 'index.html');
    const summaryPath = join(root, 'summary.md');
    writeFileSync(site, 'healthy deployed site');
    const fetchImpl = vi.fn<typeof fetch>();
    if (stage !== 'list') fetchImpl.mockResolvedValueOnce(page());
    if (stage === 'reconcile') fetchImpl.mockRejectedValueOnce(new Error(`${apiKey} ${privateText}`));
    fetchImpl.mockResolvedValue(response({ detail: `${apiKey} ${privateText}` }, 401));
    const error = await deliver(fetchImpl, { summaryPath }).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(Error);
    const output = `${String(error)} ${JSON.stringify(error)} ${readFileSync(summaryPath, 'utf8')}`;
    for (const value of [apiKey, privateText, 'Authorization', 'Token ']) expect(output).not.toContain(value);
    expect(readFileSync(site, 'utf8')).toBe('healthy deployed site');
    expect(methods(fetchImpl).filter((method) => method === 'POST')).toHaveLength(stage === 'list' ? 0 : 1);
  });
});

describe('safe delivery summaries', () => {
  it.each(['queued', 'already-accepted', 'manual-review', 'not-configured', 'draft'] as const)('writes only the six permitted fields for %s', async (state) => {
    const summaryPath = join(temporary(), 'summary.md');
    const fetchImpl = vi.fn<typeof fetch>();
    let input: Edition = edition();
    if (state === 'queued') fetchImpl.mockResolvedValueOnce(page()).mockResolvedValueOnce(response({ ...email(), subscribers: [privateText], body: apiKey }, 201));
    else if (state === 'already-accepted' || state === 'manual-review') fetchImpl.mockResolvedValueOnce(page([{ ...email({ status: state === 'manual-review' ? 'paused' : 'sent' }), subscribers: [privateText], body: apiKey }]));
    else input = productionEditionSchema.parse({ ...production, newsletter: state === 'draft' ? { status: 'draft', subject: 'Draft', preview_text: 'Preview' } : undefined });
    await deliver(fetchImpl, { edition: input, summaryPath }).catch(() => {});
    const summary = readFileSync(summaryPath, 'utf8');
    const parsed = JSON.parse(summary.match(/<pre>([\s\S]*)<\/pre>/)![1]);
    expect(Object.keys(parsed).sort()).toEqual(['canonicalUrl', 'contentDigest', 'editionDate', 'emailId', 'sourceSha', 'state']);
    expect(parsed).toMatchObject({ editionDate: '2026-09-29', canonicalUrl: 'https://tsd.report/2026/09/29', sourceSha, state });
    if (state === 'queued' || state === 'already-accepted') expect(parsed).toMatchObject({ contentDigest, emailId: 'em_test_1' });
    for (const value of [apiKey, privateText, copy.subject, copy.preview_text, 'Authorization']) expect(summary).not.toContain(value);
  });

  it('escapes provider-controlled summary text and redacts secrets and addresses even within an allowlisted field', async () => {
    const summaryPath = join(temporary(), 'summary.md');
    const id = `<img src=x onerror=alert(1)>\n\`\`\`\n${apiKey} subscriber@example.test`;
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(page([email({ id })]));
    await deliver(fetchImpl, { summaryPath });
    const summary = readFileSync(summaryPath, 'utf8');
    for (const value of [apiKey, 'subscriber@example.test', '<img']) expect(summary).not.toContain(value);
    expect(summary).toContain('&lt;img');
  });

  it('redacts filesystem error paths when summary writing fails', async () => {
    const root = temporary();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(page([email()]));
    const error = await deliver(fetchImpl, { summaryPath: join(root, apiKey, 'subscriber@example.test') }).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain(apiKey);
    expect(String(error)).not.toContain('subscriber@example.test');
  });
});

describe('production-only newsletter CLI', () => {
  const script = fileURLToPath(new URL('../../scripts/newsletter/send.ts', import.meta.url));
  const tsx = resolve('node_modules/tsx/dist/loader.mjs');
  function run(records: unknown[], ambientMode: string, fixtures = false) {
    const root = temporary();
    const directory = join(root, 'data', fixtures ? 'fixtures' : 'production', 'editions');
    mkdirSync(directory, { recursive: true });
    records.forEach((record, index) => writeFileSync(join(directory, `${index}.json`), JSON.stringify(record)));
    const guard = join(root, 'no-network.mjs');
    const marker = join(root, 'network-attempts');
    writeFileSync(guard, `import { appendFileSync } from 'node:fs'; globalThis.fetch = async () => { appendFileSync(${JSON.stringify(marker)}, 'attempt'); throw new Error('Forbidden network'); };`);
    const result = spawnSync(process.execPath, ['--import', guard, '--import', tsx, script], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, CONTENT_MODE: ambientMode, GITHUB_STEP_SUMMARY: join(root, 'summary.md') } });
    expect(() => readFileSync(marker)).toThrow();
    return result;
  }

  it.each(['fixture', 'production', 'invalid'])('loads production and skips missing metadata despite ambient %s', (mode) => {
    const result = run([production], mode);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('not-configured');
  });

  it('selects the newest production edition and skips its draft even if an older edition is approved', () => {
    const newest = { ...production, date: '2026-09-30', newsletter: { status: 'draft', subject: 'Draft', preview_text: 'Preview' }, lead_story: 'new-story', sections: {}, stories: production.stories.map((story: Record<string, unknown>) => ({ ...story, id: 'new-story', slug: 'new-story' })) };
    const result = run([edition(), newest], 'fixture');
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('draft');
  });

  it('fails an approved production edition without a key', () => {
    const result = run([edition()], 'fixture');
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/API key/i);
  });

  it('refuses empty production without falling back to available fixtures', () => {
    const fixture = JSON.parse(readFileSync('data/fixtures/editions/2026-09-26.json', 'utf8'));
    const result = run([fixture], 'fixture', true);
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('skipped');
  });

  it('refuses fixture content stored in the production corpus', () => {
    const fixture = JSON.parse(readFileSync('data/fixtures/editions/2026-09-26.json', 'utf8'));
    expect(run([fixture], 'fixture').status).toBe(1);
  });
});
