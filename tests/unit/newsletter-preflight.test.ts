import { describe, expect, it, vi } from 'vitest';
import { inspectNewsletterProvider } from '../../scripts/newsletter/preflight';

const page = (results: unknown[] = []) => new Response(JSON.stringify({ count: results.length, results }), { status: 200 });
const input = { editionDate: '2026-10-31', apiKey: '  test-key\n' };

describe('newsletter provider preflight', () => {
  it('reads inventory without creating mail and reports only matching states', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(page([
      { id: 'em_unrelated', slug: 'another-email', status: 'sent', metadata: {} },
      { id: 'em_match', slug: 'tsd-edition-2026-10-31', status: 'draft', metadata: {} },
    ]));
    const result = await inspectNewsletterProvider({ ...input, fetchImpl });
    expect(result).toEqual({ editionDate: input.editionDate, matchingCount: 1, states: ['draft'] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'GET', redirect: 'error' });
    expect((fetchImpl.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Token test-key');
    expect(JSON.stringify(result)).not.toContain('em_match');
  });

  it('reports no matching email after a complete empty inventory', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(page());
    expect(await inspectNewsletterProvider({ ...input, fetchImpl })).toEqual({ editionDate: input.editionDate, matchingCount: 0, states: [] });
  });

  it('reports only a safe HTTP category when inventory access is forbidden', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('private provider response', { status: 403 }));
    await expect(inspectNewsletterProvider({ ...input, fetchImpl })).rejects.toThrow('Buttondown email inventory returned HTTP 403');
  });

  it('does not expose provider text, credentials, or malformed records', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(page([{ id: 'secret', status: 'sent', body: input.apiKey }]));
    const error = await inspectNewsletterProvider({ ...input, fetchImpl }).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toContain('response failed validation');
    expect(String(error)).not.toContain('secret');
    expect(String(error)).not.toContain('test-key');
  });
});
