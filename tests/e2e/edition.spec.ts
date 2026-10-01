import { expect, test } from '@playwright/test';

test('renders a complete newspaper edition', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The Security Diff', exact: true })).toBeVisible();
  await expect(page.getByText('Fixture preview', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vulnerability Watch', exact: true })).toBeVisible();
  await expect(page.locator('.story-card h3 a').first()).toHaveAttribute('href', /\/article\//);
});

test('uses a clearly labeled external destination in research indexes and filtered results', async ({ page }) => {
  const title = 'Research notes should separate demonstrated results from editorial interpretation';
  for (const path of ['/category/research', '/?topic=research']) {
    await page.goto(path);
    const link = page.getByRole('link', { name: title });
    await expect(link).toHaveAttribute('href', 'https://example.com/research-paper');
    await expect(link).not.toHaveAttribute('target', '_blank');
    await expect(page.locator('.story-card:visible .story-destination-label').first()).toHaveText('External research ↗');
  }
});

test('loads the production masthead and editorial typography on editions and articles', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const homepageType = await page.evaluate(() => ({
    masthead: getComputedStyle(document.querySelector('.masthead')!).fontFamily,
    headline: getComputedStyle(document.querySelector('.lead h2')!).fontFamily,
    headlineWeight: getComputedStyle(document.querySelector('.lead h2')!).fontWeight,
    mastheadSize: Number.parseFloat(getComputedStyle(document.querySelector('.masthead')!).fontSize),
    headlineSize: Number.parseFloat(getComputedStyle(document.querySelector('.lead h2')!).fontSize),
    body: getComputedStyle(document.body).fontFamily,
    mastheadLoaded: document.fonts.check('700 72px "Grenze Gotisch Masthead"'),
    mediumDisplayLoaded: document.fonts.check('500 48px "Newsreader Display"'),
    headlineLoaded: document.fonts.check('600 48px "Newsreader Display"'),
    textLoaded: document.fonts.check('400 18px "Newsreader Text"'),
    preloads: [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')].map((link) => link.getAttribute('href')),
  }));

  expect(homepageType.masthead).toContain('Grenze Gotisch Masthead');
  expect(homepageType.headline).toContain('Newsreader Display');
  expect(homepageType.headlineWeight).toBe('500');
  expect(homepageType.mastheadSize / homepageType.headlineSize).toBeGreaterThanOrEqual(1.9);
  expect(homepageType.body).toContain('Newsreader Text');
  expect(homepageType.mastheadLoaded).toBe(true);
  expect(homepageType.mediumDisplayLoaded).toBe(true);
  expect(homepageType.headlineLoaded).toBe(true);
  expect(homepageType.textLoaded).toBe(true);
  expect(homepageType.preloads).toContain('/fonts/grenze-gotisch-masthead-bold.woff2');
  expect(homepageType.preloads).toContain('/fonts/newsreader-display-semibold.woff2');

  await page.goto('/article/patching-the-edge');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.article-opening h1')).toHaveCSS('font-family', /Newsreader Display/);
  await expect(page.locator('.article-body')).toHaveCSS('font-family', /Newsreader Text/);
});

test('supports archive, article, and CVE journeys', async ({ page }) => {
  await page.goto('/archive');
  await page.getByRole('link', { name: /September 26, 2026/ }).click();
  await expect(page).toHaveURL(/\/2026\/09\/26$/);
  await page.goto('/article/patching-the-edge');
  await expect(page.getByRole('heading', { name: /Patching the edge/ })).toBeVisible();
  await page.goto('/cve/CVE-2021-44228');
  await expect(page.getByRole('heading', { name: 'CVE-2021-44228' })).toBeVisible();
});

test('keeps the mobile edition inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const widths = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(widths.page).toBeLessThanOrEqual(widths.viewport);
});

test('sizes the paper sheet to its content in a tall viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 4000 });
  await page.goto('/article/patching-the-edge');

  const trailingPaper = await page.evaluate(() => {
    const paper = document.querySelector('.paper')!.getBoundingClientRect();
    const footer = document.querySelector('.page-footer')!.getBoundingClientRect();
    return paper.bottom - footer.bottom;
  });

  expect(trailingPaper).toBeLessThanOrEqual(64);
});
