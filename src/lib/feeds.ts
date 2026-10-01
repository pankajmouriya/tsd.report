import { storyDestination, storyIdentityPath } from './routes';

const ORIGIN = 'https://tsd.report';

export function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

type FeedStory = { slug: string; title: string; summary: string; destination_url?: string; published_at?: string };
type FeedEdition = { date: string; stories: FeedStory[] };
type FeedMode = 'fixture' | 'production';

function absoluteIdentity(story: FeedStory): string {
  return `${ORIGIN}${storyIdentityPath(story)}`;
}

function absoluteDestination(story: FeedStory): string {
  const destination = storyDestination(story);
  return destination.startsWith('/') ? `${ORIGIN}${destination}` : destination;
}

export function toMarkdownFeed(edition: FeedEdition, mode: FeedMode = 'fixture'): string {
  const introduction = mode === 'fixture'
    ? 'Fixture preview. Security engineering, without the noise.'
    : 'Security engineering, without the noise.';
  return `# The Security Diff — ${edition.date}\n\n> ${introduction}\n\n${edition.stories.map((story) => `## [${story.title}](${absoluteDestination(story)})\n\n${story.summary}`).join('\n\n')}`;
}

export function toRss(edition: FeedEdition, mode: FeedMode = 'fixture'): string {
  const items = edition.stories.map((story) => `<item><title>${escapeXml(story.title)}</title><link>${escapeXml(absoluteDestination(story))}</link><guid>${escapeXml(absoluteIdentity(story))}</guid><description>${escapeXml(story.summary)}</description></item>`).join('');
  const title = mode === 'fixture' ? 'The Security Diff — Fixture Preview' : 'The Security Diff';
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${title}</title><link>${ORIGIN}</link><description>Security engineering, without the noise.</description>${items}</channel></rss>`;
}

export function toJsonFeed(edition: FeedEdition, mode: FeedMode = 'fixture') {
  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: mode === 'fixture' ? 'The Security Diff — Fixture Preview' : 'The Security Diff',
    home_page_url: `${ORIGIN}/`,
    feed_url: `${ORIGIN}/feed.json`,
    items: edition.stories.map((story) => ({
      id: absoluteIdentity(story),
      url: absoluteDestination(story),
      title: story.title,
      summary: story.summary,
      date_published: story.published_at,
    })),
  };
}
