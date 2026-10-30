import { z } from 'zod';

const identifier = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
const text = z.string().min(1).max(6000).refine((value) => value.trim().length > 0, 'Text must not be blank');
const httpsUrl = z.url().max(2048).refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  const authority = value.match(/^https:\/\/([^/]+)/i)?.[1];
  return typeof authority === 'string' && url.protocol === 'https:' && !url.username && !url.password && !authority.includes(':') && !/[\s<>\u0000-\u001f\u007f]/.test(value);
}, 'Use credential-free HTTPS URLs on the default port');
const references = z.array(identifier).min(1).max(50);

export const incidentEditorialSchema = z.object({
  title: text.max(240), summary: text.max(1200), why_it_matters: text.max(1800), action: text.max(1800),
  tags: z.array(identifier).min(1).max(12),
  affected_technologies: z.array(text.max(160)).max(20),
  claim_ids: references,
  sections: z.array(z.object({
    heading: text.max(160), paragraphs: z.array(text).min(1).max(12), claim_ids: references,
  }).strict()).min(1).max(12),
}).strict();

export const incidentCandidateBaseSchema = z.object({
  schema_version: z.literal(1), status: z.literal('candidate'), fixture: z.literal(true).optional(),
  incident_id: identifier, revision: z.number().int().min(1).max(10000),
  classification: z.enum(['supply-chain-compromise', 'dependency-vulnerability', 'certificate-trust']),
  occurred_at: z.iso.datetime().nullable(), evidence_as_of: z.iso.datetime(),
  supersedes: z.string().regex(/^[a-f0-9]{64}$/).nullable(), correction_note: text.nullable(),
  sources: z.array(z.object({
    id: identifier, name: text.max(240), url: httpsUrl,
    type: z.enum(['vendor', 'government', 'research', 'community']),
    published_at: z.iso.datetime().nullable(), retrieved_at: z.iso.datetime(), data_date: z.string().min(1).max(120).nullable(),
  }).strict()).min(1).max(30),
  facts: z.array(z.object({
    id: identifier, statement: text, source_ids: references,
    state: z.enum(['confirmed', 'reported', 'disputed', 'unknown']),
  }).strict()).min(1).max(100),
  editorial: incidentEditorialSchema,
}).strict();

export function candidateIssues(candidate: z.infer<typeof incidentCandidateBaseSchema>): string[] {
  const issues: string[] = [];
  const synthetic = /^(synthetic|fixture|example)-/.test(candidate.incident_id) || candidate.sources.some((source) => {
    if (!URL.canParse(source.url)) return false;
    const host = new URL(source.url).hostname;
    return ['example.com', 'example.net', 'example.org'].includes(host) || /\.(example|invalid|test)$/.test(host);
  });
  if (synthetic && !candidate.fixture) issues.push('Synthetic evidence requires a fixture marker');
  const sourceIds = new Set(candidate.sources.map((source) => source.id));
  const factIds = new Set(candidate.facts.map((fact) => fact.id));
  if (sourceIds.size !== candidate.sources.length || factIds.size !== candidate.facts.length) issues.push('Duplicate evidence identity');
  if (!candidate.sources.some((source) => source.type !== 'community')) issues.push('Primary or original research evidence required');
  for (const fact of candidate.facts) if (fact.source_ids.some((id) => !sourceIds.has(id))) issues.push('Unknown source reference');
  const { editorial } = candidate;
  const citedIds = [...editorial.claim_ids, ...editorial.sections.flatMap((section) => section.claim_ids)];
  if (citedIds.some((id) => !factIds.has(id))) issues.push('Unknown claim reference');
  if ((candidate.revision === 1 && (candidate.supersedes !== null || candidate.correction_note !== null)) ||
      (candidate.revision > 1 && (!candidate.supersedes || !candidate.correction_note))) issues.push('Invalid correction chain');
  if (candidate.sources.some((source) => Date.parse(source.retrieved_at) > Date.parse(candidate.evidence_as_of))) issues.push('Evidence as-of precedes retrieval');
  const prose = [editorial.title, editorial.summary, editorial.why_it_matters, editorial.action,
    ...editorial.affected_technologies, ...editorial.sections.flatMap((section) => [section.heading, ...section.paragraphs])].join('\n');
  if (/<\/?[a-z!]|javascript:|https?:\/\/|!\[/i.test(prose)) issues.push('Editorial copy must be inert text with source-id citations');
  const tokens = (value: string) => (value.match(/CVE-\d{4}-\d{4,}|GHSA-[a-z0-9-]+|\b[vV]?\d+\.\d+(?:\.\d+)*(?:[-+][a-zA-Z0-9.-]+)?\b/g) ?? []).map((token) => token.replace(/^[vV](?=\d)/, ''));
  const evidence = new Set(tokens(candidate.facts.map((fact) => fact.statement).join('\n')));
  for (const token of tokens(prose)) {
    if (!evidence.has(token)) issues.push(`Unsupported identifier or version: ${token}`);
  }
  return issues;
}

export const incidentCandidateSchema = incidentCandidateBaseSchema.superRefine((candidate, context) => {
  for (const message of candidateIssues(candidate)) context.addIssue({ code: 'custom', message, input: candidate });
});

export const incidentPublicationBaseSchema = z.object({
  schema_version: z.literal(1), status: z.literal('published'), candidate: incidentCandidateBaseSchema,
  content_sha256: z.string().regex(/^[a-f0-9]{64}$/), published_at: z.iso.datetime(),
  review: z.object({
    actor: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/), reviewed_at: z.iso.datetime(),
    head_sha: z.string().regex(/^[a-f0-9]{40}$/), review_id: z.number().int().positive(),
    pr_number: z.number().int().positive(), pr_url: httpsUrl,
  }).strict(),
}).strict();

export const incidentPublicationSchema = incidentPublicationBaseSchema.superRefine((publication, context) => {
  for (const message of candidateIssues(publication.candidate)) context.addIssue({ code: 'custom', message, input: publication });
  if (publication.candidate.fixture) context.addIssue({ code: 'custom', message: 'Cannot publish fixture content', input: publication });
  if (Date.parse(publication.review.reviewed_at) > Date.parse(publication.published_at)) context.addIssue({ code: 'custom', message: 'Publication precedes review', input: publication });
});

export type IncidentCandidate = z.infer<typeof incidentCandidateSchema>;
export type IncidentPublication = z.infer<typeof incidentPublicationSchema>;
