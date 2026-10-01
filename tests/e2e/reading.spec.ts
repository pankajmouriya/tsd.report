import { expect, test } from '@playwright/test';

test('renders an essay with one primary heading and continuous semantic content', async ({ page }) => {
  await page.goto('/article/agent-tool-boundaries');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.reader-header')).toBeVisible();
  await expect(page.locator('.reader-nameplate')).toHaveText('The Security Diff');
  await expect(page.locator('.reader-header')).not.toContainText(/stories|Saturday|September 26, 2026/i);
  await expect(page.locator('.article-body > h2')).toHaveCount(6);
  await expect(page.locator('.article-body figure')).toHaveCount(1);
  await expect(page.locator('.article-body pre code')).toHaveCount(1);
  await expect(page.getByText('In this article', { exact: true })).toBeVisible();
  await expect(page.locator('.footnotes li')).toHaveCount(2);
  await expect(page.locator('.evidence-note')).toHaveCount(2);
  await expect(page.locator('.evidence-note a').first()).toHaveAttribute('href', /csrc\.nist\.gov/);
  await expect(page.getByText('Editorial prototype', { exact: true })).toBeVisible();
});

test('renders a concise historical brief with evidence and no contents disclosure', async ({ page }) => {
  await page.goto('/article/patching-the-edge');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByText('Historical fixture', { exact: true })).toBeVisible();
  await expect(page.getByText('In this article', { exact: true })).toHaveCount(0);
  await expect(page.locator('.article-body > h2')).toHaveCount(3);
  await expect(page.locator('.article-body figure')).toHaveCount(1);
  await expect(page.locator('.footnotes li')).toHaveCount(2);
  await expect(page.locator('.evidence-note')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'CVE-2021-44228' })).toBeVisible();
});

test('keeps an internal provenance page for external research', async ({ page }) => {
  await page.goto('/article/research-claims-and-interpretation');
  await expect(page).toHaveURL(/\/article\/research-claims-and-interpretation$/);
  await expect(page.getByRole('heading', { name: /Research notes should separate/ })).toBeVisible();
  const original = page.getByRole('link', { name: 'Read original research ↗' });
  await expect(original).toHaveAttribute('href', 'https://example.com/research-paper');
  await expect(original).not.toHaveAttribute('target', '_blank');
  await expect(page.locator('.external-provenance').getByRole('heading', { name: 'TSD Fixture Lab' })).toBeVisible();
  await expect(page.locator('.external-provenance').getByText(/Retrieved Sep 26, 2026/)).toBeVisible();
});

test('uses the external destination for related research coverage', async ({ page }) => {
  await page.goto('/article/agent-tool-boundaries');
  await expect(page.getByRole('link', { name: /Research notes should separate/ })).toHaveAttribute(
    'href',
    'https://example.com/research-paper',
  );
});

test('keeps evidence notes beside prose when space permits and inline on phones', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/article/agent-tool-boundaries');
  await expect(page.locator('.evidence-note').first()).toHaveCSS('float', 'right');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.evidence-note').first()).toHaveCSS('float', 'none');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('keeps wide figures clear of adjacent evidence notes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/article/patching-the-edge');
  const overlap = await page.evaluate(() => {
    const note = document.querySelector('.evidence-note');
    const figure = document.querySelector('.article-figure');
    if (!note || !figure) return true;
    const a = note.getBoundingClientRect();
    const b = figure.getBoundingClientRect();
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  });
  expect(overlap).toBe(false);
});

test('handles a short JSON-backed article without invented structure', async ({ page }) => {
  await page.goto('/article/signed-build-evidence');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByText('In this article', { exact: true })).toHaveCount(0);
  await expect(page.locator('.article-body figure')).toHaveCount(0);
  await expect(page.locator('.article-related[aria-labelledby="related-heading"]')).toHaveCount(0);
});

test('preserves reading content in print and system accessibility modes', async ({ page }) => {
  await page.goto('/article/patching-the-edge');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.fixture-notice')).toBeHidden();
  await expect(page.locator('.article-opening h1')).toBeVisible();
  await expect(page.locator('.footnotes')).toBeVisible();

  await page.emulateMedia({ media: 'screen', forcedColors: 'active', reducedMotion: 'reduce' });
  await expect(page.locator('.article-opening h1')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('keeps the article readable when local fonts are blocked', async ({ page }) => {
  let blockedFonts = 0;
  await page.route('**/*.woff2', async (route) => {
    blockedFonts += 1;
    await route.abort();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/article/agent-tool-boundaries');
  await expect(page.locator('.article-opening h1')).toBeVisible();
  await expect.poll(() => blockedFonts).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('keeps citation and return navigation usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/article/agent-tool-boundaries');
  const citation = page.locator('a[data-footnote-ref]').first();
  await citation.focus();
  await citation.press('Enter');
  await expect(page).toHaveURL(/#user-content-fn-/);
  const backlink = page.locator('.footnotes a[data-footnote-backref]').first();
  await backlink.focus();
  await backlink.press('Enter');
  await expect(page).toHaveURL(/#user-content-fnref-/);
  await context.close();
});

test('presents CVE facts independently and links back to coverage', async ({ page }) => {
  await page.goto('/cve/CVE-2021-44228');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.cve-facts')).toBeVisible();
  await expect(page.locator('.cve-facts dt')).toContainText(['CVSS', 'EPSS', 'KEV', 'Known exploitation']);
  await expect(page.getByRole('link', { name: /Patching the edge/ })).toHaveAttribute('href', '/article/patching-the-edge');
});

for (const path of ['/about', '/editorial-policy', '/archive', '/category/vulnerabilities', '/tag/cve']) {
  test(`uses the compact reading header on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('.reader-header')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('.reader-header')).not.toContainText(/stories|September 26, 2026/i);
  });
}
