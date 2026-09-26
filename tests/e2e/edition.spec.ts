import { expect, test } from '@playwright/test';

test('renders a complete newspaper edition', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The Security Diff', exact: true })).toBeVisible();
  await expect(page.getByText('Fixture preview', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: "Today's Vulnerability Watch" })).toBeVisible();
  await expect(page.getByRole('link', { name: /Read the full brief/ }).first()).toHaveAttribute('href', /\/article\//);
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
