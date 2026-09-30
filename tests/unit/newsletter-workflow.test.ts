import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../../.github/workflows/validate.yml', import.meta.url), 'utf8');

// Parse the workflow's indentation boundaries so neighboring jobs, steps,
// comments, and nested properties cannot satisfy another block's policy.
function blocks(source: string, header: RegExp): Map<string, string> {
  const matches = [...source.matchAll(header)];
  return new Map(matches.map((match, index) => [
    match[1],
    source.slice(match.index! + match[0].length, matches[index + 1]?.index ?? source.length),
  ]));
}

const jobs = blocks(workflow.split(/^jobs:\s*$/m)[1] ?? '', /^  ([\w-]+):\s*$/gm);

function job(name: string): string {
  expect(jobs.has(name), `Workflow must define the ${name} job`).toBe(true);
  return jobs.get(name)!;
}

function property(source: string, name: string, indentation: number): string | undefined {
  const lines = source.split('\n');
  const pattern = new RegExp(`^ {${indentation}}${name}: *(.*)$`);
  const index = lines.findIndex((line) => pattern.test(line));
  if (index < 0) return undefined;
  const value = pattern.exec(lines[index])![1];
  const nested: string[] = [];
  for (const line of lines.slice(index + 1)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (line.length - line.trimStart().length <= indentation) break;
    nested.push(line);
  }
  return [value, ...nested].join('\n').trimEnd();
}

function scalar(source: string, name: string, indentation: number): string | undefined {
  return property(source, name, indentation)?.replace(/\s+#.*$/, '').replace(/^(['"])(.*)\1$/, '$2');
}

function mapping(source: string, name: string, indentation: number): Record<string, string> {
  const nested = property(source, name, indentation) ?? '';
  const entries = [...nested.matchAll(new RegExp(String.raw`^ {${indentation + 2}}([\w-]+): *(.*)$`, 'gm'))];
  return Object.fromEntries(entries.map((entry) => [
    entry[1], entry[2].replace(/^(['"])(.*)\1$/, '$2'),
  ]));
}

function steps(source: string): string[] {
  const nested = property(source, 'steps', 4) ?? '';
  const matches = [...nested.matchAll(/^      - (.+)$/gm)];
  return matches.map((match, index) => (
    nested.slice(match.index!, matches[index + 1]?.index ?? nested.length)
      .replace(/^      - /, '        ')
  ));
}

function runStep(source: string, command: string): string {
  const matching = steps(source).filter((step) => scalar(step, 'run', 8) === command);
  expect(matching, `Expected one step running ${command}`).toHaveLength(1);
  return matching[0];
}

const fixtureValues = {
  TSD_NEWSLETTER_SIGNUP_ENABLED: 'true',
  BUTTONDOWN_USERNAME: 'tsd-test',
  TSD_PUBLICATION_CONTACT_URL: 'mailto:privacy@example.test',
};

describe('newsletter workflow policy', () => {
  it('waits for the production deployment job, including its smoke check', () => {
    expect(scalar(job('send-newsletter'), 'needs', 4)).toBe('deploy-production');
    const productionSteps = steps(job('deploy-production'));
    const deploy = productionSteps.findIndex((step) => scalar(step, 'name', 8) === 'Deploy production');
    const smoke = productionSteps.findIndex((step) => scalar(step, 'name', 8) === 'Check production project');
    expect(deploy).toBeGreaterThanOrEqual(0);
    expect(smoke).toBeGreaterThan(deploy);
    expect(scalar(productionSteps[smoke], 'run', 8)).toContain('curl --fail');
  });

  it('requires a main push, all three exact true gates, and a successful deployment', () => {
    const condition = property(job('send-newsletter'), 'if', 4)?.replace(/^>-\s*/, '');
    expect(condition?.split('&&').map((clause) => clause.trim())).toEqual([
      "github.event_name == 'push'",
      "github.ref == 'refs/heads/main'",
      "vars.TSD_PRODUCTION_ENABLED == 'true'",
      "vars.TSD_NEWSLETTER_SIGNUP_ENABLED == 'true'",
      "vars.TSD_NEWSLETTER_SEND_ENABLED == 'true'",
      "needs.deploy-production.result == 'success'",
    ]);
  });

  it('uses the production environment with read-only contents permission', () => {
    const send = job('send-newsletter');
    expect(scalar(send, 'environment', 4)).toBe('production');
    expect(mapping(send, 'permissions', 4)).toEqual({ contents: 'read' });
  });

  it('serializes delivery without cancelling another send job', () => {
    expect(mapping(job('send-newsletter'), 'concurrency', 4)).toEqual({
      group: 'newsletter-production',
      'cancel-in-progress': 'false',
    });
  });

  it('retains queued main workflows without replacing a pending edition', () => {
    expect(mapping(workflow, 'concurrency', 0)).toEqual({
      group: 'validate-${{ github.event.pull_request.number || github.ref }}',
      queue: 'max',
    });
  });

  it('exposes the provider key only to the queue step of the send job', () => {
    const send = job('send-newsletter');
    const queue = runStep(send, 'npm run newsletter:send');
    expect(scalar(queue, 'name', 8)).toBe('Queue approved newsletter');
    expect(mapping(queue, 'env', 8)).toEqual({
      BUTTONDOWN_API_KEY: '${{ secrets.BUTTONDOWN_API_KEY }}',
      GITHUB_SHA: '${{ github.sha }}',
    });
    expect(workflow.replace(send, '')).not.toContain('BUTTONDOWN_API_KEY');
    expect(steps(send).filter((step) => step.includes('BUTTONDOWN_API_KEY'))).toEqual([queue]);
    expect(send.replace(property(send, 'steps', 4)!, '')).not.toContain('BUTTONDOWN_API_KEY');
  });

  it('keeps newsletter sends out of every pull-request or setup job', () => {
    expect([...jobs].filter(([, source]) => source.includes('newsletter:send')).map(([name]) => name))
      .toEqual(['send-newsletter']);
    for (const name of ['quality', 'secret-scan', 'preview', 'deploy-production', 'setup-cloudflare']) {
      expect(job(name)).not.toContain('newsletter:send');
    }
  });

  it('installs dependencies before sending using the existing pinned checkout and Node actions', () => {
    const sendSteps = steps(job('send-newsletter'));
    expect(sendSteps.map((step) => scalar(step, 'uses', 8)).filter(Boolean)).toEqual([
      'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
      'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
    ]);
    expect(mapping(sendSteps[0], 'with', 8)).toEqual({ 'persist-credentials': 'false' });
    expect(mapping(sendSteps[1], 'with', 8)).toEqual({ 'node-version-file': '.node-version', cache: 'npm' });
    expect(sendSteps.map((step) => scalar(step, 'run', 8)).filter(Boolean))
      .toEqual(['npm ci', 'npm run newsletter:send']);
  });

  it.each(['quality', 'preview'])('gives %s exactly the three public fixture signup values', (name) => {
    expect(mapping(job(name), 'env', 4)).toEqual(fixtureValues);
    for (const step of steps(job(name))) {
      const env = mapping(step, 'env', 8);
      expect(Object.keys(env).filter((key) => key in fixtureValues || key.startsWith('BUTTONDOWN_'))).toEqual([]);
    }
  });

  it.each(['quality', 'preview'])('generates the %s fixture email after the site build', (name) => {
    const source = job(name);
    const jobSteps = steps(source);
    const build = runStep(source, 'npm run build:fixture');
    const render = runStep(source, 'npm run newsletter:preview -- --mode fixture');
    expect(jobSteps.indexOf(render)).toBeGreaterThan(jobSteps.indexOf(build));
    if (name === 'preview') {
      const deploy = jobSteps.findIndex((step) => scalar(step, 'name', 8) === 'Deploy PR preview');
      expect(deploy).toBeGreaterThan(jobSteps.indexOf(render));
      expect(scalar(jobSteps[deploy], 'run', 8)).toContain('wrangler pages deploy dist');
    }
  });

  it('archives only the rendered HTML preview using the approved artifact action pin', () => {
    const qualitySteps = steps(job('quality'));
    const artifacts = qualitySteps.filter((step) => scalar(step, 'uses', 8)?.startsWith('actions/upload-artifact@'));
    expect(artifacts).toHaveLength(1);
    const artifact = artifacts[0];
    expect(scalar(artifact, 'uses', 8))
      .toBe('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02');
    expect(mapping(artifact, 'with', 8)).toMatchObject({
      path: 'dist/newsletter-preview.html',
      'if-no-files-found': 'error',
    });
    const render = runStep(job('quality'), 'npm run newsletter:preview -- --mode fixture');
    expect(qualitySteps.indexOf(artifact)).toBeGreaterThan(qualitySteps.indexOf(render));
  });

  it('gives the production build only public repository signup variables', () => {
    const production = job('deploy-production');
    const build = runStep(production, 'npm run build:production');
    expect(mapping(production, 'env', 4)).toEqual({});
    expect(mapping(build, 'env', 8)).toEqual({
      TSD_NEWSLETTER_SIGNUP_ENABLED: '${{ vars.TSD_NEWSLETTER_SIGNUP_ENABLED }}',
      BUTTONDOWN_USERNAME: '${{ vars.BUTTONDOWN_USERNAME }}',
      TSD_PUBLICATION_CONTACT_URL: '${{ vars.TSD_PUBLICATION_CONTACT_URL }}',
    });
  });
});
