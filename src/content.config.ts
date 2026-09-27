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
});

const articles = defineCollection({
  loader: glob({ base: './content/articles', pattern: '**/*.md' }),
  schema: z.object({
    story_id: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1),
    structure: z.enum(['essay', 'brief']),
    status: z.enum(['unreviewed-fixture', 'reviewed-fixture']),
    credit: z.string().min(1),
    fixture: z.literal(true),
    references: z.array(reference),
    related_story_ids: z.array(z.string()).max(3).default([]),
  }),
});

export const collections = { articles };
