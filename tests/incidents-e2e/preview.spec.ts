import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const evidence = '/private/tmp/tsd-incident-ui';
mkdirSync(evidence, { recursive: true });

for (const width of [320, 390, 768, 1024, 1440]) for (const theme of ['light', 'dark'] as const) {
  test(`candidate preview at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: theme });
    await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const path of ['/', '/article/synthetic-release-alert']) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
      await expect(page.locator('.fixture-notice')).toContainText('Synthetic fixture');
      await expect(page.locator('.fixture-notice')).toContainText('Unreviewed');
      await expect(page.getByRole('heading', { name: 'Synthetic release incident for preview verification', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `${evidence}/${path === '/' ? 'home' : 'article'}-${width}-${theme}.png`, fullPage: true });
    }
    await expect(page.getByText('Incident date: Unknown.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Synthetic maintainer statement' }).first()).toHaveAttribute('href', 'https://example.com/security/synthetic-release');
    await page.keyboard.press('Tab');
    const focus = await page.locator(':focus').evaluate((node) => getComputedStyle(node).outlineStyle);
    expect(focus).not.toBe('none');
    expect(errors).toEqual([]);
  });
}

test('candidate is in preview feeds while archived editions stay unchanged', async ({ request }) => {
  const feed = await (await request.get('/feed.json')).json();
  expect(feed.title).toContain('Unreviewed Incident Preview');
  expect(feed.items.some((item: { id: string }) => item.id.endsWith('/article/synthetic-release-alert'))).toBe(true);
  const archive = await (await request.get('/2026/10/02')).text();
  expect(archive).not.toContain('Synthetic release incident for preview verification');
});

test('incident topic filters support an empty result and keyboard reset', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Supply Chain', exact: true }).click();
  await expect(page.locator('[data-filtered-results] [data-story]:visible')).toHaveCount(1);
  await page.getByRole('button', { name: 'Must Read', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No stories match' })).toBeVisible();
  const reset = page.getByRole('button', { name: 'Reset filters' });
  await reset.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-group="topic"] [data-value="all"]')).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Showing the full edition');
});
