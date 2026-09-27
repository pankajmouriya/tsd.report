import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = '/private/tmp/tsd-homepage-compositions';
const cases = [
  { composition: 'a', theme: 'light', width: 1440, height: 1000 },
  { composition: 'a', theme: 'light', width: 390, height: 844 },
  { composition: 'a', theme: 'dark', width: 1440, height: 1000 },
  { composition: 'b', theme: 'light', width: 1440, height: 1000 },
  { composition: 'b', theme: 'light', width: 390, height: 844 },
  { composition: 'b', theme: 'dark', width: 1440, height: 1000 },
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const report = [];

for (const item of cases) {
  const page = await browser.newPage({ viewport: { width: item.width, height: item.height } });
  const url = `http://127.0.0.1:4322/composition-${item.composition}.html?theme=${item.theme}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({
    path: `${output}/composition-${item.composition}-${item.theme}-${item.width}.png`,
    fullPage: true,
  });

  const metrics = await page.evaluate(() => ({
    title: document.title,
    theme: document.documentElement.dataset.theme,
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    storyCount: document.querySelectorAll('[data-story-id]').length,
    headingCount: document.querySelectorAll('h1, h2, h3').length,
    hasMain: Boolean(document.querySelector('main')),
    hasSkipLink: Boolean(document.querySelector('.skip-link')),
    imageLabels: Array.from(document.querySelectorAll('svg[role="img"]')).map((svg) => svg.getAttribute('aria-labelledby')),
  }));

  await page.keyboard.press('Tab');
  const firstFocus = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    className: document.activeElement?.className,
    text: document.activeElement?.textContent?.trim(),
  }));

  report.push({ ...item, url, ...metrics, overflow: metrics.scrollWidth > metrics.viewportWidth, firstFocus });
  await page.close();
}

await browser.close();
await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
