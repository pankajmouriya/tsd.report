import { expect, test } from '@playwright/test';

test('offers reset only for active filters and preserves a keyboard focus target', async ({ page }) => {
  await page.goto('/');
  const reset = page.locator('[data-reset]');
  await expect(reset).toBeHidden();
  const topic = page.getByRole('button', { name: 'Research', exact: true });
  await topic.focus();
  await page.keyboard.press('Enter');
  await expect(topic).toBeFocused();
  await expect(reset).toBeVisible();
  await reset.focus();
  await page.keyboard.press('Enter');
  await expect(reset).toBeHidden();
  await expect(page.locator('[data-group="topic"] [data-value="all"]')).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Showing the full edition');
});

test('combines topic and signal filters and restores the edition', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'AI & Agent Security' }).click();
  await page.getByRole('button', { name: 'Must Read' }).click();
  await expect(page).toHaveURL(/topic=ai-security/);
  await expect(page).toHaveURL(/signal=must-read/);
  await expect(page.getByRole('status')).toContainText(/stor/);
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page).not.toHaveURL(/topic=|signal=/);
  await expect(page.getByRole('heading', { name: 'Vulnerability Watch', exact: true })).toBeVisible();
});

test('counts unique matching stories and uses one filtered results list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Vulnerabilities', exact: true }).click();

  await expect(page.getByRole('status')).toHaveText('4 stories match');
  await expect(page.locator('[data-editorial-view]')).toBeHidden();
  await expect(page.locator('[data-filtered-results]')).toBeVisible();
  await expect(page.locator('[data-filtered-results] [data-story]:visible')).toHaveCount(4);

  const ids = await page.locator('[data-filtered-results] [data-story]:visible').evaluateAll((items) => items.map((item) => item.getAttribute('data-story-id')));
  expect(new Set(ids).size).toBe(4);
});

test('validates direct and history URL state', async ({ page }) => {
  await page.goto('/?topic=invalid&signal=urgent');
  await expect(page.getByRole('button', { name: 'All', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'All', exact: true }).nth(1)).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Cloud & Kubernetes' }).click();
  await page.getByRole('button', { name: 'Must Read' }).click();
  await expect(page.getByRole('heading', { name: 'No stories match' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Cloud & Kubernetes' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'No stories match' })).toBeHidden();
});

test('keeps the full edition and category navigation when JavaScript is disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');

  await expect(page.locator('[data-editorial-view]')).toBeVisible();
  await expect(page.locator('[data-filter-controls]')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Browse edition topics' })).toBeVisible();
  await page.getByRole('link', { name: 'Vulnerabilities', exact: true }).click();
  await expect(page).toHaveURL(/\/category\/vulnerabilities$/);

  await context.close();
});
