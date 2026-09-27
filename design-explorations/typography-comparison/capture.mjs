import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = '/private/tmp/tsd-typography-comparison';
const fonts = ['georgia', 'source', 'newsreader'];
const themes = ['light', 'dark'];
const widths = [390, 1440];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = [];

for (const font of fonts) for (const theme of themes) for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1000 } });
  await page.goto(`http://127.0.0.1:4322/comparison.html?font=${font}&theme=${theme}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const metrics = await page.evaluate(() => {
    const lead = document.querySelector('.lead h2');
    const style = getComputedStyle(lead);
    const lineHeight = Number.parseFloat(style.lineHeight);
    const resources = performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/fonts/'));
    return {
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      family: style.fontFamily,
      displayWeight: style.fontWeight,
      leadLines: Math.round(lead.getBoundingClientRect().height / lineHeight),
      fontResources: resources.length,
      encodedFontBytes: Math.round(resources.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0)),
      fontsReady: document.fonts.status,
    };
  });
  await page.screenshot({ path: `${output}/${font}-${theme}-${width}.png`, fullPage: true });
  report.push({ font, theme, width, ...metrics, overflow: metrics.scrollWidth > metrics.viewport });
  await page.close();
}

await browser.close();
await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
