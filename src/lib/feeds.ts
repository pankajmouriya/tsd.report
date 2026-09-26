const ORIGIN = 'https://tsd.report';

export function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

type FeedStory = { slug: string; title: string; summary: string };
type FeedEdition = { date: string; stories: FeedStory[] };

export function toMarkdownFeed(edition: FeedEdition): string {
  return `# The Security Diff — ${edition.date}\n\n> Fixture preview. Security engineering, without the noise.\n\n${edition.stories.map((story) => `## [${story.title}](${ORIGIN}/article/${story.slug})\n\n${story.summary}`).join('\n\n')}`;
}

export function toRss(edition: FeedEdition): string {
  const items = edition.stories.map((story) => `<item><title>${escapeXml(story.title)}</title><link>${ORIGIN}/article/${story.slug}</link><guid>${ORIGIN}/article/${story.slug}</guid><description>${escapeXml(story.summary)}</description></item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>The Security Diff — Fixture Preview</title><link>${ORIGIN}</link><description>Security engineering, without the noise.</description>${items}</channel></rss>`;
}
