import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ButtondownClient } from './buttondown';

export interface NewsletterPreflightResult {
  editionDate: string;
  matchingCount: number;
  states: string[];
}

function safeInventoryError(error: unknown): Error {
  const message = error instanceof Error ? error.message : '';
  const http = /^Buttondown GET failed \(HTTP ([1-5][0-9]{2})\)$/.exec(message);
  if (http) return new Error(`Buttondown email inventory returned HTTP ${http[1]}`);
  if (message === 'Buttondown GET failed after bounded retries') return new Error('Buttondown email inventory could not be reached');
  if (message === 'Invalid Buttondown response') return new Error('Buttondown email inventory response failed validation');
  if (message === 'Inconsistent Buttondown pagination' || message === 'Repeated email in Buttondown pagination' || message === 'Incomplete Buttondown pagination') {
    return new Error('Buttondown email inventory pagination failed validation');
  }
  return new Error('Buttondown email inventory failed');
}

export async function inspectNewsletterProvider(input: {
  editionDate: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<NewsletterPreflightResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.editionDate)) throw new Error('Expected edition date must use YYYY-MM-DD');
  if (!input.apiKey.trim()) throw new Error('Buttondown API key is missing');
  try {
    const emails = await new ButtondownClient(input.apiKey, input.fetchImpl).listAllEmails();
    const slug = `tsd-edition-${input.editionDate}`;
    const matches = emails.filter((email) => email.slug === slug || email.metadata.edition_date === input.editionDate);
    return { editionDate: input.editionDate, matchingCount: matches.length, states: matches.map((email) => email.status) };
  } catch (error) {
    throw safeInventoryError(error);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.env.CONTENT_MODE = 'production';
    const { loadEditions } = await import('../../src/lib/content');
    const edition = loadEditions('production')[0];
    if (!edition || edition.date !== process.env.EXPECTED_EDITION_DATE) throw new Error('Expected edition is not the newest production edition');
    const result = await inspectNewsletterProvider({ editionDate: edition.date, apiKey: process.env.BUTTONDOWN_API_KEY ?? '' });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error && error.message.startsWith('Buttondown email inventory') ? error.message
      : error instanceof Error && ['Buttondown API key is missing', 'Expected edition is not the newest production edition'].includes(error.message) ? error.message
        : 'Newsletter provider preflight failed');
    process.exitCode = 1;
  }
}
