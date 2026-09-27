import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const reference = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  url: z.url().refine((value) => ['https:', 'http:'].includes(new URL(value).protocol), 'Reference URLs must use HTTP or HTTPS'),
  published_at: z.coerce.date().optional(),
  retrieved_at: z.coerce.date(),
  supports: z.string().min(1),
}).strict();

const articleFields = {
  story_id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  structure: z.enum(['essay', 'brief']),
  credit: z.string().min(1),
  references: z.array(reference),
  related_story_ids: z.array(z.string()).max(3).default([]),
};

const fixtureArticles = defineCollection({
  loader: glob({ base: './content/fixtures/articles', pattern: '**/*.md' }),
  schema: z.object({
    ...articleFields,
    status: z.enum(['unreviewed-fixture', 'reviewed-fixture']),
    fixture: z.literal(true),
  }).strict(),
});

const productionArticles = defineCollection({
  loader: glob({ base: './content/production/articles', pattern: '**/*.md' }),
  schema: z.object({
    ...articleFields,
    references: z.array(reference).min(1),
    status: z.literal('published'),
    fixture: z.never().optional(),
    reviewed_by: z.string().min(1),
    reviewed_at: z.coerce.date(),
  }).strict(),
});

export const collections = { fixtureArticles, productionArticles };
