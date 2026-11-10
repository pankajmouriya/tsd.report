import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export function isPendingCandidateOnly(paths: string[]): boolean {
  return paths.length === 1 && /^data\/candidates\/(?:incidents\/[a-z0-9-]+|editions\/\d{4}-\d{2}-\d{2})\.json$/.test(paths[0]);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const before = process.env.PUBLICATION_BASE_SHA ?? '', head = process.env.GITHUB_SHA ?? '';
  if (!/^[a-f0-9]{40}$/.test(before) || !/^[a-f0-9]{40}$/.test(head))
    throw new Error('Missing publication revision');
  const paths = /^0+$/.test(before) ? [] : execFileSync('git', ['diff', '--no-renames', '--name-only', before, head], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const pending = isPendingCandidateOnly(paths);
  if (!process.env.GITHUB_OUTPUT)
    throw new Error('Publication output path is missing');
  appendFileSync(process.env.GITHUB_OUTPUT, `pending_candidate=${pending}\n`);
  console.log(pending ? 'Candidate-only merge: trusted publisher owns the production deployment.' : 'Production content or code change: keep the normal deployment.');
}
