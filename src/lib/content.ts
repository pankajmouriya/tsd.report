import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { composeHomepage, incidentStory, loadIncidentPreview, loadIncidentPublications } from './incidents';
import {
  fixtureEditionSchema,
  productionEditionSchema,
  type Edition,
  type Story,
} from './schema';

export type ContentMode = 'fixture' | 'production';

export function resolveContentMode(value = import.meta.env?.CONTENT_MODE ?? process.env.CONTENT_MODE): ContentMode {
  const mode = value ?? 'fixture';
  if (mode !== 'fixture' && mode !== 'production') throw new Error(`Invalid CONTENT_MODE: ${mode}`);
  return mode;
}

export function selectContentRecords<TFixture, TProduction>(
  mode: ContentMode,
  fixtureRecords: Record<string, TFixture>,
  productionRecords: Record<string, TProduction>,
): Array<TFixture | TProduction> {
  return Object.values(mode === 'fixture' ? fixtureRecords : productionRecords);
}

function readEditionRecords(mode: ContentMode, projectRoot: string): unknown[] {
  const directory = resolve(projectRoot, 'data', mode === 'fixture' ? 'fixtures' : 'production', 'editions');
  if (!existsSync(directory)) return [];
  const records = Object.fromEntries(
    readdirSync(directory)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => [name, JSON.parse(readFileSync(resolve(directory, name), 'utf8'))]),
  );
  return selectContentRecords(mode, mode === 'fixture' ? records : {}, mode === 'production' ? records : {});
}

export function validateContentMode(mode: string, selectedEditions: Edition[] = editions): void {
  if (mode !== 'fixture' && mode !== 'production') throw new Error(`Invalid CONTENT_MODE: ${mode}`);
  if (mode === 'production' && selectedEditions.length === 0) {
    throw new Error('Production content requires at least one reviewed edition');
  }
  if (mode === 'production' && selectedEditions.some((edition) => edition.fixture || edition.stories.some((story) => story.fixture))) {
    throw new Error('Production builds reject fixture content');
  }
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const identities = new Map<string, { slug: string; type: string }>();
  for (const edition of selectedEditions) {
    for (const story of edition.stories) {
      const previous = identities.get(story.id);
      const snapshotOfIncident = story.type === 'incident' && story.id.startsWith('incident-') && previous?.type === 'incident' && previous.slug === story.slug;
      if (ids.has(story.id) && !snapshotOfIncident) throw new Error(`Duplicate story id across editions: ${story.id}`);
      if (slugs.has(story.slug) && !snapshotOfIncident) throw new Error(`Duplicate story slug across editions: ${story.slug}`);
      ids.add(story.id);
      slugs.add(story.slug);
      identities.set(story.id, { slug: story.slug, type: story.type });
    }
  }
}

const contentMode = resolveContentMode();

export function loadEditions(mode: ContentMode, projectRoot = process.cwd()): Edition[] {
  const records = readEditionRecords(mode, projectRoot);
  if (mode === 'production' && records.some((record) => {
    if (!record || typeof record !== 'object') return false;
    const value = record as { fixture?: unknown; stories?: Array<{ fixture?: unknown }> };
    return value.fixture === true || value.stories?.some((story) => story.fixture === true);
  })) {
    throw new Error('Production builds reject fixture content');
  }
  const selectedSchema = mode === 'fixture' ? fixtureEditionSchema : productionEditionSchema;
  const loaded = records
    .map((value) => selectedSchema.parse(value) as Edition)
    .sort((left, right) => right.date.localeCompare(left.date));
  validateContentMode(mode, loaded);
  return loaded;
}

const editions = loadEditions(contentMode);
const incidentPublications = contentMode === 'production' ? loadIncidentPublications() : [];
const incidentPreview = loadIncidentPreview();
if (incidentPreview && contentMode !== 'production') throw new Error('Incident previews require the production content corpus');
const incidentStories: Story[] = [
  ...(incidentPreview ? [incidentStory(incidentPreview)] : []),
  ...incidentPublications.filter((record) => record.candidate.incident_id !== incidentPreview?.incident_id).map((record) => incidentStory(record.candidate, record)),
];

for (const incident of incidentStories) {
  for (const edition of editions) for (const existing of edition.stories) {
    if (incident.slug === existing.slug && incident.id !== existing.id) throw new Error('Incident slug collides with an archived story');
  }
}

export function getHomepageEdition() { return composeHomepage(getLatestEdition(), incidentStories); }
export function isIncidentPreview(): boolean { return incidentPreview !== undefined; }
export function isSyntheticIncidentPreview(): boolean { return incidentPreview?.fixture === true; }
export function getIncidentForStory(id: string) {
  if (incidentPreview && id === `incident-${incidentPreview.incident_id}`) return { candidate: incidentPreview, review: null };
  return incidentPublications.find((record) => id === `incident-${record.candidate.incident_id}`);
}

export function getContentMode(): ContentMode {
  return contentMode;
}

export function getEditions(): Edition[] {
  return editions;
}

export function getLatestEdition(): Edition {
  const edition = editions[0];
  if (!edition) throw new Error(`No ${contentMode} editions are available`);
  return edition;
}

export function findEdition(date: string): Edition | undefined {
  return editions.find((edition) => edition.date === date);
}

export function getStories(): Story[] {
  const bySlug = new Map<string, Story>();
  for (const story of [...incidentStories, ...editions.flatMap<Story>((edition) => edition.stories)]) if (!bySlug.has(story.slug)) bySlug.set(story.slug, story);
  return [...bySlug.values()];
}

export function getStoryCategories(stories: Array<{ category: string }> = getStories()): string[] {
  return [...new Set(stories.map((story) => story.category))];
}

export function findStory(slug: string): Story | undefined {
  return getStories().find((story) => story.slug === slug);
}

export function findEditionForStory(slug: string): Edition | undefined {
  return editions.find((edition) => edition.stories.some((story) => story.slug === slug));
}

export function findStoryById(id: string): Story | undefined {
  return getStories().find((story) => story.id === id);
}

export function getStoryById(edition: { stories: Story[] }, id: string): Story {
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

export function assertContentMode(): void {
  validateContentMode(contentMode, editions);
}
