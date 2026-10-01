import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildNewsletterDigest, renderNewsletterPreviewHtml } from '../../src/lib/newsletter';

try {
  const { values } = parseArgs({ options: {
    mode: { type: 'string', default: 'fixture' },
    output: { type: 'string', default: 'dist/newsletter-preview.html' },
  } });
  const mode = values.mode;
  if (mode !== 'fixture' && mode !== 'production') throw new Error(`Invalid CONTENT_MODE: ${mode}`);
  // The content boundary initializes eagerly, so select the CLI mode before importing it.
  process.env.CONTENT_MODE = mode;
  const { loadEditions } = await import('../../src/lib/content');
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
