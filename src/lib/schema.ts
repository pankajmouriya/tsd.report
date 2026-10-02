import { z } from 'zod';

export const categories = ['vulnerabilities', 'supply-chain', 'ai-security', 'appsec', 'cloud', 'research', 'security-engineering'] as const;
export const storyTypes = ['news', 'cve', 'research', 'original', 'incident', 'explainer', 'tool', 'advisory'] as const;

const sourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.url(),
  type: z.enum(['vendor', 'government', 'research', 'community', 'editorial']),
  published_at: z.iso.datetime().nullable().optional(),
  retrieved_at: z.iso.datetime(),
}).strict();

const vulnerabilitySchema = z.object({
  cve: z.string().regex(/^CVE-\d{4}-\d{4,}$/),
  ghsa: z.string().regex(/^GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$/).nullable().optional(),
  cvss: z.number().min(0).max(10).nullable().optional(),
  cvss_version: z.string().nullable().optional(),
  epss: z.number().min(0).max(1).nullable().optional(),
  epss_percentile: z.number().min(0).max(1).nullable().optional(),
  kev: z.boolean().nullable().optional(),
  exploitation: z.enum(['confirmed', 'not-confirmed', 'unknown']).default('unknown'),
  affected: z.array(z.string()).default([]),
  fixed_versions: z.array(z.string()).default([]),
  evidence_date: z.iso.date().nullable().optional(),
}).strict();

const signalSchema = z.object({
  score: z.number().min(0).max(100),
  label: z.enum(['standard', 'recommended', 'must-read']),
  reasons: z.array(z.string()),
}).strict();

const externalDestinationSchema = z.url().superRefine((value, context) => {
  if (!URL.canParse(value)) return;
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    context.addIssue({ code: 'custom', message: 'Story destination must use HTTPS', input: value });
  }
  if (url.username || url.password) {
    context.addIssue({ code: 'custom', message: 'Story destination must not contain credentials', input: value });
  }
});

const httpsUrlSchema = z.url().superRefine((value, context) => {
  if (!URL.canParse(value)) return;
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    context.addIssue({ code: 'custom', message: 'Evidence URLs must use HTTPS', input: value });
  }
  if (url.username || url.password) {
    context.addIssue({ code: 'custom', message: 'Evidence URLs must not contain credentials', input: value });
  }
});

const storyFields = {
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  type: z.enum(storyTypes),
  category: z.enum(categories),
  published_at: z.iso.datetime(),
  updated_at: z.iso.datetime().nullable().optional(),
  summary: z.string().min(1),
  why_it_matters: z.string().min(1),
  action: z.string().min(1),
  affected_technologies: z.array(z.string()).default([]),
  tags: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  sources: z.array(sourceSchema),
  signal: signalSchema,
  vulnerabilities: z.array(vulnerabilitySchema).default([]),
  illustration: z.string().nullable().optional(),
  body: z.array(z.string()).default([]),
  author: z.string().nullable().optional(),
  destination_url: externalDestinationSchema.optional(),
};

export const fixtureStorySchema = z.object({
  ...storyFields,
  fixture: z.literal(true),
}).strict();

export const productionStorySchema = z.object({
  ...storyFields,
  sources: z.array(sourceSchema).min(1),
  fixture: z.never().optional(),
  status: z.literal('published'),
  reviewed_by: z.string().min(1),
  reviewed_at: z.iso.datetime(),
}).strict();

const newsletterCopyFields = {
  subject: z.string().trim().min(1).max(120),
  preview_text: z.string().trim().min(1).max(200),
};

const draftSchema = z.object({
  status: z.literal('draft'),
  ...newsletterCopyFields,
}).strict();

const approvedSchema = z.object({
  status: z.literal('approved'),
  ...newsletterCopyFields,
  approved_by: z.string().trim().min(1),
  approved_at: z.iso.datetime(),
}).strict();

export const newsletterSchema = z.discriminatedUnion('status', [draftSchema, approvedSchema]);

const editionFields = {
  schema_version: z.literal(1),
  date: z.iso.date(),
  generated_at: z.iso.datetime().optional(),
  lead_story: z.string(),
  sections: z.record(z.string(), z.array(z.string())),
  newsletter: newsletterSchema.optional(),
};

function validateEdition(
  edition: { lead_story: string; sections: Record<string, string[]>; stories: Array<{ id: string }> },
  context: z.core.$RefinementCtx,
) {
  const ids = new Set(edition.stories.map((story) => story.id));
  if (!ids.has(edition.lead_story)) {
    context.addIssue({ code: 'custom', path: ['lead_story'], message: 'Lead story must reference an edition story', input: edition.lead_story });
  }
  if (ids.size !== edition.stories.length) {
    context.addIssue({ code: 'custom', path: ['stories'], message: 'Story ids must be unique', input: edition.stories });
  }
  for (const [section, sectionIds] of Object.entries(edition.sections)) {
    for (const id of sectionIds) if (!ids.has(id)) {
      context.addIssue({ code: 'custom', path: ['sections', section], message: `Unknown story id: ${id}`, input: id });
    }
  }
}

export const fixtureEditionSchema = z.object({
  ...editionFields,
  fixture: z.literal(true),
  stories: z.array(fixtureStorySchema),
}).strict().superRefine(validateEdition);

export const productionEditionSchema = z.object({
  ...editionFields,
  fixture: z.never().optional(),
  status: z.literal('published'),
  reviewed_by: z.string().min(1),
  reviewed_at: z.iso.datetime(),
  stories: z.array(productionStorySchema).min(1),
}).strict().superRefine(validateEdition);

const vulnerabilityWatchSelectionSchema = z.object({
  lookback_days: z.literal(30),
  epss_probability_min: z.literal(0.5),
  epss_percentile_min: z.literal(0.95),
  limit: z.literal(10),
  ranking_version: z.literal('kev-epss-v1'),
  window_start: z.iso.date(),
  window_end: z.iso.date(),
}).strict();

const vulnerabilityWatchSourceSchema = z.object({
  id: z.enum(['cisa-kev', 'first-epss', 'nvd']),
  name: z.string().trim().min(1),
  url: httpsUrlSchema,
  status: z.enum(['ok', 'degraded']),
  retrieved_at: z.iso.datetime(),
  data_date: z.iso.date().nullable(),
  error: z.string().trim().min(1).nullable(),
}).strict().superRefine((source, context) => {
  if (source.status === 'ok' && source.error !== null) {
    context.addIssue({ code: 'custom', path: ['error'], message: 'Successful sources cannot include an error', input: source.error });
  }
  if (source.status === 'degraded' && source.error === null) {
    context.addIssue({ code: 'custom', path: ['error'], message: 'Degraded sources require an error', input: source.error });
  }
});

const vulnerabilityWatchReferenceSchema = z.object({
  source_id: z.enum(['cisa-kev', 'first-epss', 'nvd', 'vendor']),
  name: z.string().trim().min(1),
  url: httpsUrlSchema,
  type: z.enum(['government', 'vendor', 'research', 'community']),
  published_at: z.iso.datetime().nullable(),
  retrieved_at: z.iso.datetime(),
}).strict();

const vulnerabilityWatchEntrySchema = z.object({
  rank: z.number().int().min(1).max(10),
  cve: z.string().regex(/^CVE-\d{4}-\d{4,}$/),
  kev: z.object({
    source_id: z.literal('cisa-kev'),
    date_added: z.iso.date(),
    due_date: z.iso.date(),
    vendor_project: z.string().trim().min(1),
    product: z.string().trim().min(1),
    vulnerability_name: z.string().trim().min(1),
    required_action: z.string().trim().min(1),
    known_ransomware_campaign_use: z.enum(['Known', 'Unknown']),
    notes: z.string().trim().min(1).nullable(),
  }).strict(),
  epss: z.object({
    source_id: z.literal('first-epss'),
    probability: z.number().min(0).max(1),
    percentile: z.number().min(0).max(1),
    score_date: z.iso.date(),
  }).strict(),
  cvss: z.object({
    source_id: z.literal('nvd'),
    score: z.number().min(0).max(10),
    version: z.string().trim().min(1),
    vector: z.string().trim().min(1),
    issuer: z.string().trim().min(1),
  }).strict().nullable(),
  description: z.string().trim().min(1).nullable(),
  references: z.array(vulnerabilityWatchReferenceSchema),
}).strict();

const vulnerabilityWatchBaseFields = {
  schema_version: z.literal(1),
  date: z.iso.date(),
  generated_at: z.iso.datetime(),
  selection: vulnerabilityWatchSelectionSchema,
  sources: z.array(vulnerabilityWatchSourceSchema).length(3),
  entries: z.array(vulnerabilityWatchEntrySchema).max(10),
};

function validateVulnerabilityWatch(
  snapshot: {
    date: string;
    selection: z.infer<typeof vulnerabilityWatchSelectionSchema>;
    sources: Array<z.infer<typeof vulnerabilityWatchSourceSchema>>;
    entries: Array<z.infer<typeof vulnerabilityWatchEntrySchema>>;
  },
  context: z.core.$RefinementCtx,
) {
  if (snapshot.selection.window_end !== snapshot.date) {
    context.addIssue({ code: 'custom', path: ['selection', 'window_end'], message: 'Selection window must end on the snapshot date', input: snapshot.selection.window_end });
  }
  const sourceIds = snapshot.sources.map((source) => source.id);
  if (new Set(sourceIds).size !== sourceIds.length || !['cisa-kev', 'first-epss', 'nvd'].every((id) => sourceIds.includes(id as typeof sourceIds[number]))) {
    context.addIssue({ code: 'custom', path: ['sources'], message: 'Each configured source must appear exactly once', input: snapshot.sources });
  }
  const cves = new Set<string>();
  snapshot.entries.forEach((entry, index) => {
    if (entry.rank !== index + 1) {
      context.addIssue({ code: 'custom', path: ['entries', index, 'rank'], message: 'Entry ranks must be contiguous and ordered', input: entry.rank });
    }
    if (cves.has(entry.cve)) {
      context.addIssue({ code: 'custom', path: ['entries', index, 'cve'], message: 'Watch CVEs must be unique', input: entry.cve });
    }
    cves.add(entry.cve);
    if (entry.epss.probability < snapshot.selection.epss_probability_min || entry.epss.percentile < snapshot.selection.epss_percentile_min) {
      context.addIssue({ code: 'custom', path: ['entries', index, 'epss'], message: 'Entry does not meet the snapshot EPSS thresholds', input: entry.epss });
    }
  });
}

export const vulnerabilityWatchCandidateSchema = z.object({
  ...vulnerabilityWatchBaseFields,
  status: z.literal('candidate'),
}).strict().superRefine(validateVulnerabilityWatch);

export const vulnerabilityWatchPublishedSchema = z.object({
  ...vulnerabilityWatchBaseFields,
  status: z.literal('published'),
  reviewed_by: z.string().trim().min(1),
  reviewed_at: z.iso.datetime(),
  review_pr: httpsUrlSchema,
}).strict().superRefine(validateVulnerabilityWatch);

export const vulnerabilityWatchFixtureSchema = z.object({
  ...vulnerabilityWatchBaseFields,
  status: z.literal('fixture'),
  fixture: z.literal(true),
}).strict().superRefine(validateVulnerabilityWatch);

// Compatibility aliases for existing fixture authoring tools.
export const storySchema = fixtureStorySchema;
export const editionSchema = fixtureEditionSchema;

export type Category = typeof categories[number];
export type FixtureStory = z.infer<typeof fixtureStorySchema>;
export type ProductionStory = z.infer<typeof productionStorySchema>;
export type Story = FixtureStory | ProductionStory;
export type FixtureEdition = z.infer<typeof fixtureEditionSchema>;
export type ProductionEdition = z.infer<typeof productionEditionSchema>;
export type Edition = FixtureEdition | ProductionEdition;
export type Newsletter = z.infer<typeof newsletterSchema>;
export type Vulnerability = z.infer<typeof vulnerabilitySchema>;
export type Source = z.infer<typeof sourceSchema>;
export type VulnerabilityWatchCandidate = z.infer<typeof vulnerabilityWatchCandidateSchema>;
export type VulnerabilityWatchPublished = z.infer<typeof vulnerabilityWatchPublishedSchema>;
export type VulnerabilityWatchFixture = z.infer<typeof vulnerabilityWatchFixtureSchema>;
export type VulnerabilityWatchSnapshot = VulnerabilityWatchCandidate | VulnerabilityWatchPublished | VulnerabilityWatchFixture;
export type VulnerabilityWatchEntry = VulnerabilityWatchSnapshot['entries'][number];
