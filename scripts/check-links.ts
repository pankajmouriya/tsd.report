import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(projectRoot, 'dist');
if (!existsSync(dist)) throw new Error('dist does not exist; run npm run build first');

function files(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    return statSync(child).isDirectory() ? files(child) : [child];
  });
}

const failures: string[] = [];
for (const html of files(dist).filter((path) => path.endsWith('.html'))) {
  const body = readFileSync(html, 'utf8');
  for (const [, href] of body.matchAll(/href="([^"#?]+)[^\"]*"/g)) {
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const candidate = resolve(dist, `.${href}`);
    const targets = [candidate, `${candidate}.html`, join(candidate, 'index.html')];
    if (!targets.some(existsSync)) failures.push(`${html.slice(dist.length)} -> ${href}`);
  }
}
if (failures.length) throw new Error(`Broken internal links:\n${failures.join('\n')}`);
console.log('Internal links: PASS');
