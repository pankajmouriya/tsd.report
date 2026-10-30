import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { incidentCandidateSchema, incidentPublicationSchema, type IncidentCandidate, type IncidentPublication } from './incident-schema';
import type { Edition, Story } from './schema';

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, item]) => [key, sorted(item)]));
  return value;
}

export function incidentContentHash(candidate: IncidentCandidate): string {
  return createHash('sha256').update(JSON.stringify(sorted(candidate))).digest('hex');
}

export function selectLatestPublications(records: IncidentPublication[]): IncidentPublication[] {
  const groups = new Map<string, IncidentPublication[]>();
  for (const record of records) {
    const parsed = incidentPublicationSchema.parse(record);
    if (incidentContentHash(parsed.candidate) !== parsed.content_sha256) throw new Error('Published content hash mismatch');
    const id = parsed.candidate.incident_id;
    groups.set(id, [...(groups.get(id) ?? []), parsed]);
  }
  return [...groups.values()].map((revisions) => {
    revisions.sort((a, b) => a.candidate.revision - b.candidate.revision);
    revisions.forEach((record, index) => {
      if (record.candidate.revision !== index + 1 || record.candidate.supersedes !== (index ? revisions[index - 1].content_sha256 : null)) throw new Error('Invalid immutable incident revision chain');
    });
    return revisions[revisions.length - 1];
  }).sort((left, right) => right.published_at.localeCompare(left.published_at));
}

export function loadIncidentPublications(root = process.cwd()): IncidentPublication[] {
  const directory = resolve(root, 'data/production/incidents');
  if (!existsSync(directory)) return [];
  return selectLatestPublications(readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.json')).map((name) => JSON.parse(readFileSync(resolve(directory, name), 'utf8'))));
}

export function loadIncidentPreview(root = process.cwd()): IncidentCandidate | undefined {
  const name = process.env.TSD_INCIDENT_PREVIEW;
  if (!name) return undefined;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error('Preview must name an incident candidate, not a path');
  return incidentCandidateSchema.parse(JSON.parse(readFileSync(resolve(root, 'data/candidates/incidents', `${name}.json`), 'utf8')));
}

export function incidentStory(candidate: IncidentCandidate, publication?: IncidentPublication): Story {
  const copy = candidate.editorial;
  const destination = candidate.schema_version === 2
    ? candidate.sources.find((source) => source.id === candidate.destination_source_id)
    : undefined;
  const destinationId = candidate.schema_version === 2 ? candidate.destination_source_id : null;
  if (candidate.schema_version === 2 && !destination) throw new Error('Incident destination source missing');
  const common = {
    id: `incident-${candidate.incident_id}`, slug: candidate.incident_id, title: copy.title,
    type: 'incident' as const, category: candidate.classification === 'dependency-vulnerability' ? 'vulnerabilities' as const : 'supply-chain' as const,
    published_at: publication?.published_at ?? candidate.evidence_as_of,
    updated_at: candidate.revision > 1 ? publication?.published_at ?? candidate.evidence_as_of : null,
    summary: copy.summary, why_it_matters: copy.why_it_matters, action: copy.action,
    affected_technologies: copy.affected_technologies, tags: copy.tags,
    sources: [...candidate.sources].sort((left, right) =>
      left.id === destinationId ? -1 : right.id === destinationId ? 1 : 0)
      .map(({ data_date: _dataDate, ...source }) => source),
    signal: { score: 70, label: 'recommended' as const, reasons: ['Selected for incident reporting'] },
    vulnerabilities: [], body: candidate.schema_version === 1 ? candidate.editorial.sections.flatMap((section) => section.paragraphs) : [],
    author: null,
    ...(destination ? { destination_url: destination.url } : {}),
  };
  return publication ? { ...common, status: 'published', reviewed_by: publication.review.actor,
    reviewed_at: publication.review.approval_kind === 'merge' ? publication.review.merged_at : publication.review.reviewed_at }
    : { ...common, fixture: true };
}

export type HomepageEdition = Pick<Edition, 'date' | 'lead_story' | 'sections' | 'newsletter'> & { stories: Story[] };

export function composeHomepage(edition: Edition, incidents: Story[]): HomepageEdition {
  if (!incidents.length) return edition;
  const seen = new Set<string>();
  const stories = [...incidents.slice(0, 20), ...edition.stories].filter((story) => {
    if (seen.has(story.id)) return false;
    seen.add(story.id); return true;
  });
  const lead = stories[0];
  return { date: lead.published_at.slice(0, 10), lead_story: lead.id,
    sections: { latest: stories.slice(1).map((story) => story.id) }, stories };
}
