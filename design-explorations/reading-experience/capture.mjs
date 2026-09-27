import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const baseURL = process.env.TSD_URL ?? 'http://127.0.0.1:4322';
const output = '/private/tmp/tsd-reading-experience/after';
const routes = [
  ['essay', '/article/agent-tool-boundaries'],
  ['brief', '/article/patching-the-edge'],
  ['cve', '/cve/CVE-2021-44228'],
];
const widths = [320, 390, 768, 1024, 1069, 1440];
const themes = ['light', 'dark'];
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const manifest = [];

for (const [sample, path] of routes) {
  for (const width of widths) {
    for (const theme of themes) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      const page = await context.newPage();
      await page.goto(`${baseURL}${path}`);
      await page.evaluate(() => document.fonts.ready);
      const name = `${sample}-${width}-${theme}`;
      await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
      const metrics = await page.evaluate(() => ({
        h1: document.querySelectorAll('h1').length,
        sections: document.querySelectorAll('.article-body > h2').length,
        citations: document.querySelectorAll('a[data-footnote-ref]').length,
        viewport: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        proseWidth: document.querySelector('.article-body')?.getBoundingClientRect().width ?? 0,
        fontStatus: document.fonts.status,
      }));
      manifest.push({ name, path, width, theme, browser: 'Chrome', zoom: 1, ...metrics, overflow: metrics.scrollWidth > metrics.viewport });
      await context.close();
    }
  }
}

await browser.close();
await fs.writeFile(`${output}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ captures: manifest.length, overflow: manifest.filter((item) => item.overflow).length }, null, 2));
