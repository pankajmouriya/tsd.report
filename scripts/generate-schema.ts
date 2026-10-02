import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { editionSchema, vulnerabilityWatchCandidateSchema, vulnerabilityWatchPublishedSchema } from '../src/lib/schema';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schema = z.toJSONSchema(editionSchema, { target: 'draft-2020-12' });
writeFileSync(resolve(projectRoot, 'schemas/edition.schema.json'), `${JSON.stringify(schema, null, 2)}\n`);
const vulnerabilityWatchSchema = z.toJSONSchema(
  z.union([vulnerabilityWatchCandidateSchema, vulnerabilityWatchPublishedSchema]),
  { target: 'draft-2020-12' },
);
writeFileSync(resolve(projectRoot, 'schemas/vulnerability-watch.schema.json'), `${JSON.stringify(vulnerabilityWatchSchema, null, 2)}\n`);
console.log('Generated schemas/edition.schema.json and schemas/vulnerability-watch.schema.json');
