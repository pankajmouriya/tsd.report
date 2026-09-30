import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadEditions, resolveContentMode } from '../../src/lib/content';
import { buildNewsletterDigest, renderNewsletterPreviewHtml } from '../../src/lib/newsletter';

try {
  const { values } = parseArgs({ options: {
    mode: { type: 'string', default: 'fixture' },
    output: { type: 'string', default: 'dist/newsletter-preview.html' },
  } });
  const mode = resolveContentMode(values.mode);
  const edition = loadEditions(mode)[0];
  if (!edition) throw new Error(`No ${mode} editions are available`);
  if (!values.output?.trim()) throw new Error('Newsletter preview output must be a nonempty path');
  const html = renderNewsletterPreviewHtml(buildNewsletterDigest(edition));
  const output = resolve(values.output);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, html, 'utf8');
  console.log(`Rendered ${mode} edition ${edition.date} to ${output}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Newsletter preview failed');
  process.exitCode = 1;
}
