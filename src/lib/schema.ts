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

const editionFields = {
  schema_version: z.literal(1),
  date: z.iso.date(),
  generated_at: z.iso.datetime().optional(),
  lead_story: z.string(),
  sections: z.record(z.string(), z.array(z.string())),
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
export type Vulnerability = z.infer<typeof vulnerabilitySchema>;
export type Source = z.infer<typeof sourceSchema>;
