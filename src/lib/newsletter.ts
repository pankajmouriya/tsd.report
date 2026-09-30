import { formatProbability } from './format';
import { articlePath, editionPath } from './routes';
import type { Edition, Story, Vulnerability } from './schema';

export interface NewsletterDigestStory {
  slug: string;
  category: Story['category'];
  headline: string;
  summary: string;
  signal?: Story['signal'];
  url: string;
}

export interface NewsletterDigestVulnerability extends Vulnerability {
  action: string;
  url: string;
}

export interface NewsletterDigest {
  editionDate: string;
  subject: string;
  previewText: string;
  canonicalUrl: string;
  lead: NewsletterDigestStory;
  stories: NewsletterDigestStory[];
  vulnerabilities: NewsletterDigestVulnerability[];
  fixture: boolean;
}

function webUrl(value: string, base?: string): string {
  const url = new URL(value, base);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Newsletter links require an HTTP or HTTPS origin');
  return url.href;
}

export function buildNewsletterDigest(edition: Edition, origin = 'https://tsd.report'): NewsletterDigest {
  if (!edition.newsletter) throw new Error(`Edition ${edition.date} requires newsletter metadata`);
  const byId = new Map(edition.stories.map((story) => [story.id, story]));
  const lead = byId.get(edition.lead_story);
  if (!lead) throw new Error('Newsletter lead must reference an edition story');
  const selected = [lead];
  const seen = new Set([lead.slug]);
  for (const id of [...Object.values(edition.sections).flat(), ...edition.stories.map((story) => story.id)]) {
    const story = byId.get(id);
    if (!story) throw new Error('Newsletter section must reference an edition story');
    if (seen.has(story.slug)) continue;
    seen.add(story.slug);
    selected.push(story);
  }
  const digestStory = (story: Story): NewsletterDigestStory => ({
    slug: story.slug, category: story.category, headline: story.title, summary: story.summary,
    signal: story.signal ? structuredClone(story.signal) : undefined,
    url: webUrl(articlePath(story.slug), origin),
  });
  return {
    editionDate: edition.date,
    subject: edition.newsletter.subject,
    previewText: edition.newsletter.preview_text,
    canonicalUrl: webUrl(editionPath(edition.date), origin),
    lead: digestStory(lead),
    stories: selected.slice(1).map(digestStory),
    vulnerabilities: selected.flatMap((story) => story.vulnerabilities.map((vulnerability) => ({
      ...structuredClone(vulnerability), action: story.action, url: webUrl(articlePath(story.slug), origin),
    }))),
    fixture: edition.fixture === true,
  };
}

const categoryLabels: Record<Story['category'], string> = {
  vulnerabilities: 'Vulnerabilities', 'supply-chain': 'Supply Chain', 'ai-security': 'AI & Agent Security',
  appsec: 'AppSec', cloud: 'Cloud & Kubernetes', research: 'Research', 'security-engineering': 'Security Engineering',
};
const signalLabels = { standard: 'Standard', recommended: 'Recommended', 'must-read': 'Must Read' };

function signalText(signal: Story['signal']): string {
  const reasons = signal.reasons.length ? ` — ${signal.reasons.join('; ')}` : '';
  return `Security signal: ${signalLabels[signal.label]} (${signal.score}/100)${reasons}`;
}

function vulnerabilityFacts(entry: NewsletterDigestVulnerability): string[] {
  return [
    `CVSS: ${entry.cvss ?? 'Not available'}${entry.cvss_version ? ` (${entry.cvss_version})` : ''}`,
    `EPSS probability: ${formatProbability(entry.epss)}`,
    `EPSS percentile: ${formatProbability(entry.epss_percentile)}`,
    `CISA KEV: ${entry.kev == null ? 'Unknown' : entry.kev ? 'Yes' : 'No'}`,
    `Known exploitation: ${{ confirmed: 'Confirmed', 'not-confirmed': 'Not confirmed', unknown: 'Unknown' }[entry.exploitation]}`,
    `Affected: ${entry.affected.join(', ') || 'Not available'}`,
    `Fixed versions: ${entry.fixed_versions.join(', ') || 'Not available'}`,
    ...(entry.ghsa ? [`GHSA: ${entry.ghsa}`] : []),
    ...(entry.evidence_date ? [`Evidence date: ${entry.evidence_date}`] : []),
  ];
}

function footerLinks(digest: NewsletterDigest): Array<[string, string]> {
  return [
    ['Read the complete edition', webUrl(digest.canonicalUrl)],
    ['Editorial policy', webUrl('/editorial-policy', digest.canonicalUrl)],
    ['Privacy', webUrl('/privacy', digest.canonicalUrl)],
    ['RSS feed', webUrl('/rss.xml', digest.canonicalUrl)],
  ];
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function markdownText(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replace(/[\\`*_{}\[\]()#+.!|~\-]/g, '\\$&');
}

function markdownLink(label: string, url: string): string {
  const destination = webUrl(url).replace(/[()< >"\\\s]/g, (character) => encodeURIComponent(character));
  return `[${markdownText(label)}](${destination})`;
}

const provenanceNote = 'Read the linked coverage for sources and evidence dates. This digest preserves the edition snapshot.';

export function renderNewsletterMarkdown(digest: NewsletterDigest): string {
  const story = (entry: NewsletterDigestStory): string => [
    `### ${markdownLink(entry.headline, entry.url)}`,
    markdownText(categoryLabels[entry.category]),
    markdownText(entry.summary),
    ...(entry.signal ? [markdownText(signalText(entry.signal))] : []),
  ].join('\n\n');
  const [editionLink, ...policies] = footerLinks(digest);
  return [
    `# The Security Diff — ${markdownText(digest.editionDate)}`,
    ...(digest.fixture ? ['> Fixture preview — sample content, not a published email.'] : []),
    markdownText(digest.previewText),
    '## Lead story', story(digest.lead), ...digest.stories.map(story),
    ...(digest.vulnerabilities.length ? ['## Vulnerability Watch', ...digest.vulnerabilities.map((entry) => [
      `### ${markdownLink(entry.cve, entry.url)}`,
      ...vulnerabilityFacts(entry).map(markdownText),
      `Action: ${markdownText(entry.action)}`,
    ].join('\n\n'))] : []),
    markdownLink(...editionLink), provenanceNote,
    policies.map(([label, url]) => markdownLink(label, url)).join(' · '),
  ].join('\n\n') + '\n';
}

export function renderNewsletterPreviewHtml(digest: NewsletterDigest): string {
  const link = (label: string, url: string) => `<a href="${escapeHtml(webUrl(url))}">${escapeHtml(label)}</a>`;
  const story = (entry: NewsletterDigestStory) => `<article>
<p>${escapeHtml(categoryLabels[entry.category])}</p>
<h3>${link(entry.headline, entry.url)}</h3>
<p>${escapeHtml(entry.summary)}</p>
${entry.signal ? `<p>${escapeHtml(signalText(entry.signal))}</p>` : ''}
</article>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="${escapeHtml(digest.previewText)}">
<title>${escapeHtml(digest.subject)}</title>
</head>
<body>
<header><h1>The Security Diff</h1><p>Edition <time datetime="${escapeHtml(digest.editionDate)}">${escapeHtml(digest.editionDate)}</time></p></header>
${digest.fixture ? '<p><strong>Fixture preview</strong> — sample content, not a published email.</p>' : '<p>Email preview</p>'}
<main>
<p>${escapeHtml(digest.previewText)}</p>
<section aria-labelledby="lead-heading"><h2 id="lead-heading">Lead story</h2>${story(digest.lead)}</section>
${digest.stories.length ? `<section aria-labelledby="stories-heading"><h2 id="stories-heading">More from this edition</h2>${digest.stories.map(story).join('\n')}</section>` : ''}
${digest.vulnerabilities.length ? `<section aria-labelledby="vulnerabilities-heading"><h2 id="vulnerabilities-heading">Vulnerability Watch</h2>${digest.vulnerabilities.map((entry) => `<article><h3>${link(entry.cve, entry.url)}</h3><ul>${vulnerabilityFacts(entry).map((fact) => `<li>${escapeHtml(fact)}</li>`).join('')}</ul><p>Action: ${escapeHtml(entry.action)}</p></article>`).join('\n')}</section>` : ''}
</main>
<footer><p>${escapeHtml(provenanceNote)}</p><nav aria-label="Publication links">${footerLinks(digest).map(([label, url]) => link(label, url)).join(' · ')}</nav></footer>
</body>
</html>
`;
}
