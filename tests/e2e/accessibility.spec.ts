import { expect, test } from '@playwright/test';

test('keeps core landmarks and controls accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('img:not([alt])')).toHaveCount(0);
  await expect(page.locator('button:not([aria-label]):empty')).toHaveCount(0);
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`reflows without page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const sizes = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(sizes.page).toBeLessThanOrEqual(sizes.viewport);
  });
}

test('honors dark color preference and permits an explicit toggle', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Toggle dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
