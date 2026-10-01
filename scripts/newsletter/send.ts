import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildNewsletterDigest, renderNewsletterMarkdown } from '../../src/lib/newsletter';
import { editionPath } from '../../src/lib/routes';
import type { Edition } from '../../src/lib/schema';
import {
  ButtondownAmbiguousCreateError, ButtondownClient, decideButtondownDelivery,
  type ButtondownCreateEmail, type NewsletterIdentity,
} from './buttondown';

export type DeliveryResult =
  | { kind: 'skipped'; reason: 'not-configured' | 'draft' }
  | { kind: 'queued'; editionDate: string; emailId: string; contentDigest: string }
  | { kind: 'already-accepted'; editionDate: string; emailId: string; contentDigest: string };

// Only static messages created here may cross the CLI/error boundary.
class NewsletterDeliveryError extends Error {}

interface DeliverySummary {
  editionDate: string;
  canonicalUrl: string;
  sourceSha: string;
  contentDigest: string | null;
  emailId: string | null;
  state: string;
}

function writeSummary(path: string, summary: DeliverySummary, apiKey: string | undefined): void {
  // Serialize only the six operational fields. Provider IDs are untrusted text too.
  const serialized = JSON.stringify(summary, (_key, value: unknown) => {
    if (typeof value !== 'string') return value;
    const redacted = apiKey ? value.replaceAll(apiKey, '[REDACTED]') : value;
    return redacted.replace(/[^\s<>"']+@[^\s<>"']+/g, '[REDACTED]');
  }, 2).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  try {
    appendFileSync(path, `<pre>${serialized}</pre>\n`, 'utf8');
  } catch {
    throw new NewsletterDeliveryError('Newsletter summary could not be written; reconcile delivery before retrying');
  }
}

export async function deliverLatestNewsletter(input: {
  edition: Edition;
  apiKey: string | undefined;
  sourceSha: string;
  fetchImpl?: typeof fetch;
  summaryPath?: string;
}): Promise<DeliveryResult> {
  const { edition, apiKey, sourceSha } = input;
  const summary: DeliverySummary = {
    editionDate: edition.date,
    canonicalUrl: new URL(editionPath(edition.date), 'https://tsd.report').href,
    sourceSha,
    contentDigest: null,
    emailId: null,
    state: 'failed',
  };
  try {
    if (!edition.newsletter || edition.newsletter.status === 'draft') {
      const reason = edition.newsletter ? 'draft' : 'not-configured';
      summary.state = reason;
      return { kind: 'skipped', reason };
    }
    if (edition.newsletter.status !== 'approved' || edition.fixture || edition.stories.some((story) => story.fixture)) {
      throw new NewsletterDeliveryError('Newsletter delivery requires an approved production edition');
    }
    if (!apiKey?.trim()) throw new NewsletterDeliveryError('Buttondown API key is required for an approved newsletter');
    if (!sourceSha.trim()) throw new NewsletterDeliveryError('Newsletter source SHA is required');

    const digest = buildNewsletterDigest(edition);
    const body = renderNewsletterMarkdown(digest);
    const contentDigest = createHash('sha256').update(body, 'utf8').digest('hex');
    summary.contentDigest = contentDigest;
    const identity: NewsletterIdentity = {
      slug: `tsd-edition-${edition.date}`,
      metadata: { edition_date: edition.date, source_sha: sourceSha, content_digest: contentDigest, schema_version: edition.schema_version },
    };
    const client = new ButtondownClient(apiKey, input.fetchImpl);
    const decision = decideButtondownDelivery(await client.listAllEmails(), identity);
    if (decision.kind === 'manual-review') {
      summary.emailId = decision.email.id;
      summary.state = 'manual-review';
      throw new NewsletterDeliveryError('Newsletter identity or provider state requires manual review');
    }
    let emailId: string;
    let kind: 'queued' | 'already-accepted';
    if (decision.kind === 'already-accepted') {
      emailId = decision.email.id;
      kind = 'already-accepted';
    } else {
      const payload: ButtondownCreateEmail = {
        ...identity,
        subject: digest.subject,
        description: digest.previewText,
        body,
        canonical_url: digest.canonicalUrl,
        status: 'about_to_send',
        archival_mode: 'disabled',
        filters: { filters: [], groups: [], predicate: 'and' },
      };
      try {
        const created = await client.createEmail(payload);
        const confirmation = decideButtondownDelivery([created], identity);
        if (confirmation.kind !== 'already-accepted') {
          summary.emailId = created.id;
          summary.state = 'manual-review';
          throw new NewsletterDeliveryError('Newsletter create response requires manual review');
        }
        emailId = confirmation.email.id;
        kind = 'queued';
      } catch (error) {
        if (!(error instanceof ButtondownAmbiguousCreateError)) throw error;
        summary.state = 'ambiguous';
        // A timed-out POST may already have queued mail. Never repeat it here.
        const reconciled = decideButtondownDelivery(await client.listAllEmails(), identity);
        if (reconciled.kind !== 'already-accepted') {
          throw new NewsletterDeliveryError('Newsletter create outcome remains ambiguous; manual review is required');
        }
        emailId = reconciled.email.id;
        kind = 'already-accepted';
      }
    }
    summary.emailId = emailId;
    summary.state = kind;
    return { kind, editionDate: edition.date, emailId, contentDigest };
  } catch (error) {
    if (error instanceof NewsletterDeliveryError) throw error;
    throw new NewsletterDeliveryError('Newsletter delivery failed; reconcile Buttondown before retrying');
  } finally {
    if (input.summaryPath) writeSummary(input.summaryPath, summary, apiKey);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    // content.ts initializes eagerly; force production before its first import.
    process.env.CONTENT_MODE = 'production';
    const { loadEditions } = await import('../../src/lib/content');
    const edition = loadEditions('production')[0];
    if (!edition) throw new NewsletterDeliveryError('No production edition is available');
    const result = await deliverLatestNewsletter({
      edition,
      apiKey: process.env.BUTTONDOWN_API_KEY,
      sourceSha: process.env.GITHUB_SHA ?? '',
      summaryPath: process.env.GITHUB_STEP_SUMMARY,
    });
    console.log(result.kind === 'skipped' ? `Newsletter skipped: ${result.reason}` : `Newsletter ${result.kind}`);
  } catch (error) {
    console.error(error instanceof NewsletterDeliveryError ? error.message : 'Newsletter delivery failed while loading production content');
    process.exitCode = 1;
  }
}
