import { execFileSync } from 'node:child_process';
import { z } from 'zod';
const sha = z.string().regex(/^[a-f0-9]{40}$/);
const commit = z.object({ sha, tree: z.object({ sha }) });
export class WeeklyGitHubError extends Error {
  constructor(public status?: number) { super(`Weekly GitHub request failed (HTTP ${status ?? 'unknown'})`); }
}
export class NewsletterGitHub {
  constructor(public repository: string) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
      throw new Error('Invalid repository');
  }
  api(path: string, method = 'GET', data?: unknown): unknown {
    const args = ['api', `repos/${this.repository}/${path}`, '--method', method];
    if (data !== undefined)
      args.push('--input', '-');
    let output: string;
    try {
      output = execFileSync('gh', args, { encoding: 'utf8', input: data === undefined ? undefined : JSON.stringify(data), timeout: 60000, maxBuffer: 8000000 });
    }
    catch (error) {
      const stderr = String((error as {
        stderr?: unknown;
      }).stderr ?? '');
      throw new WeeklyGitHubError(Number(/HTTP (\d{3})/.exec(stderr)?.[1]) || undefined);
    }
    return output.trim() ? JSON.parse(output) : undefined;
  }
  pages(path: string): unknown[] {
    const result: unknown[] = [];
    for (let page = 1; page <= 20; page++) {
      const items = z.array(z.unknown()).max(100).parse(this.api(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`));
      result.push(...items);
      if (items.length < 100)
        return result;
    }
    throw new Error('Weekly GitHub pagination limit exceeded');
  }
  jsonFile(path: string, ref: string): unknown | undefined {
    let raw: unknown;
    try {
      raw = this.api(`contents/${path}?ref=${encodeURIComponent(ref)}`);
    }
    catch (error) {
      if (error instanceof WeeklyGitHubError && error.status === 404)
        return undefined;
      throw error;
    }
    const file = z.object({ type: z.literal('file'), encoding: z.literal('base64'), size: z.number().int().min(0).max(250000), content: z.string() }).parse(raw);
    const bytes = Buffer.from(file.content, 'base64');
    if (bytes.length > 250000)
      throw new Error('Weekly packet size limit exceeded');
    return JSON.parse(bytes.toString('utf8'));
  }
  regularFile(path: string, ref: string): void {
    const tree = z.object({ truncated: z.boolean(), tree: z.array(z.object({ path: z.string(), mode: z.string(), type: z.string() })) }).parse(this.api(`git/trees/${ref}?recursive=1`));
    const entries = tree.tree.filter(e => e.path === path);
    if (tree.truncated || entries.length !== 1 || entries[0].mode !== '100644' || entries[0].type !== 'blob')
      throw new Error('Weekly candidate must be a bounded regular JSON file');
  }
  writeCommit(branch: string, parent: string, changes: Record<string, unknown | null>, message: string): string {
    if (branch !== 'main' && !/^automation\/newsletter-\d{4}-\d{2}-\d{2}$/.test(branch))
      throw new Error('Invalid weekly branch');
    sha.parse(parent);
    let previous: string | undefined;
    try {
      previous = z.object({ object: z.object({ sha }) }).parse(this.api(`git/ref/heads/${branch}`)).object.sha;
    }
    catch (error) {
      if (!(error instanceof WeeklyGitHubError && error.status === 404))
        throw error;
    }
    if (previous && previous !== parent)
      throw new Error('Weekly branch changed concurrently');
    if (branch === 'main' && !previous)
      throw new Error('Main branch is missing');
    const base = commit.parse(this.api(`git/commits/${parent}`));
    const entries = Object.entries(changes).map(([path, value]) => {
      if (!/^data\/(candidates\/editions|production\/(editions|newsletter-reviews))\/\d{4}-\d{2}-\d{2}\.json$/.test(path))
        throw new Error('Invalid weekly content path');
      if (value === null)
        return { path, mode: '100644', type: 'blob', sha: null };
      const content = JSON.stringify(value, null, 2) + '\n';
      if (Buffer.byteLength(content) > 250000)
        throw new Error('Weekly output size limit exceeded');
      const blob = z.object({ sha }).parse(this.api('git/blobs', 'POST', { content, encoding: 'utf-8' }));
      return { path, mode: '100644', type: 'blob', sha: blob.sha };
    });
    const tree = z.object({ sha }).parse(this.api('git/trees', 'POST', { base_tree: base.tree.sha, tree: entries }));
    const next = z.object({ sha }).parse(this.api('git/commits', 'POST', { message, tree: tree.sha, parents: [parent] }));
    // The new commit descends from exactly the observed parent. A concurrent
    // branch update cannot be overwritten by this non-force update.
    if (previous)
      this.api(`git/refs/heads/${branch}`, 'PATCH', { sha: next.sha, force: false });
    else
      this.api('git/refs', 'POST', { ref: `refs/heads/${branch}`, sha: next.sha });
    return next.sha;
  }
  dispatch(workflow: string, inputs: Record<string, string>): void {
    this.api(`actions/workflows/${workflow}/dispatches`, 'POST', { ref: 'main', inputs });
  }
}
