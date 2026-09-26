import { expect, test } from '@playwright/test';

test('combines topic and signal filters and restores the edition', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'AI & Agent Security' }).click();
  await page.getByRole('button', { name: 'Must Read' }).click();
  await expect(page).toHaveURL(/topic=ai-security/);
  await expect(page).toHaveURL(/signal=must-read/);
  await expect(page.getByRole('status')).toContainText(/stor/);
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page).not.toHaveURL(/topic=|signal=/);
  await expect(page.getByRole('heading', { name: "Today's Vulnerability Watch" })).toBeVisible();
});
