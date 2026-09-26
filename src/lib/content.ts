import edition24 from '../../data/fixtures/editions/2026-09-24.json';
import edition25 from '../../data/fixtures/editions/2026-09-25.json';
import edition26 from '../../data/fixtures/editions/2026-09-26.json';
import { editionSchema, type Edition, type Story } from './schema';

const editions = [edition26, edition25, edition24].map((value) => editionSchema.parse(value));

export function getEditions(): Edition[] {
  return editions;
}

export function getLatestEdition(): Edition {
  return editions[0];
}

export function findEdition(date: string): Edition | undefined {
  return editions.find((edition) => edition.date === date);
}

export function getStories(): Story[] {
  const bySlug = new Map<string, Story>();
  for (const edition of editions) for (const story of edition.stories) bySlug.set(story.slug, story);
  return [...bySlug.values()];
}

export function findStory(slug: string): Story | undefined {
  return getStories().find((story) => story.slug === slug);
}

export function getStoryById(edition: Edition, id: string): Story {
  const story = edition.stories.find((candidate) => candidate.id === id);
  if (!story) throw new Error(`Unknown story ${id}`);
  return story;
}

export function getCves(): string[] {
  return [...new Set(getStories().flatMap((story) => story.vulnerabilities.map((vulnerability) => vulnerability.cve)))];
}

export function getStoriesForCve(cve: string): Story[] {
  return getStories().filter((story) => story.vulnerabilities.some((vulnerability) => vulnerability.cve === cve));
}

export function validateContentMode(mode: string): void {
  if (!['fixture', 'production'].includes(mode)) throw new Error(`Invalid CONTENT_MODE: ${mode}`);
  if (mode === 'production' && editions.some((edition) => edition.fixture || edition.stories.some((story) => story.fixture))) {
    throw new Error('Production builds reject fixture content');
  }
}

export function assertContentMode(): void {
  const mode = import.meta.env?.CONTENT_MODE ?? process.env.CONTENT_MODE ?? 'fixture';
  validateContentMode(mode);
}
