const ORIGIN = 'https://tsd.report';

export function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

type FeedStory = { slug: string; title: string; summary: string };
type FeedEdition = { date: string; stories: FeedStory[] };
type FeedMode = 'fixture' | 'production';

export function toMarkdownFeed(edition: FeedEdition, mode: FeedMode = 'fixture'): string {
  const introduction = mode === 'fixture'
    ? 'Fixture preview. Security engineering, without the noise.'
    : 'Security engineering, without the noise.';
  return `# The Security Diff — ${edition.date}\n\n> ${introduction}\n\n${edition.stories.map((story) => `## [${story.title}](${ORIGIN}/article/${story.slug})\n\n${story.summary}`).join('\n\n')}`;
}

export function toRss(edition: FeedEdition, mode: FeedMode = 'fixture'): string {
  const items = edition.stories.map((story) => `<item><title>${escapeXml(story.title)}</title><link>${ORIGIN}/article/${story.slug}</link><guid>${ORIGIN}/article/${story.slug}</guid><description>${escapeXml(story.summary)}</description></item>`).join('');
  const title = mode === 'fixture' ? 'The Security Diff — Fixture Preview' : 'The Security Diff';
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${title}</title><link>${ORIGIN}</link><description>Security engineering, without the noise.</description>${items}</channel></rss>`;
}
