import { expect, test } from '@playwright/test';

// Build with signup disabled and the synthetic public contact retained:
// TSD_NEWSLETTER_SIGNUP_ENABLED=false TSD_PUBLICATION_CONTACT_URL=mailto:privacy@example.test npm run build:fixture
test.skip(process.env.TSD_NEWSLETTER_SIGNUP_ENABLED !== 'false', 'Requires a signup-disabled build with the configured test contact.');

test.beforeEach(async ({ context, baseURL }) => {
  await context.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin === new URL(baseURL!).origin) await route.continue();
    else await route.abort();
  });
});

for (const theme of ['light', 'dark'] as const) {
  test(`keeps the privacy request contact available during an acquisition pause in ${theme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    for (const path of ['/', '/2026/09/26', '/article/agent-tool-boundaries', '/subscribe', '/privacy']) {
      await page.goto(path);
      await expect(page.locator('.newsletter-signup')).toHaveCount(0);
      await expect(page.locator('.newsletter-prompt')).toHaveCount(0);
      await expect(page.locator('[data-newsletter-link]')).toHaveCount(0);
      await expect(page.locator('form[action*="buttondown.com"]')).toHaveCount(0);
    }
    const contact = page.getByRole('link', { name: 'monitored publication contact' });
    await expect(contact).toBeVisible();
    await expect(contact).toHaveAttribute('href', 'mailto:privacy@example.test');
    await expect(page.locator('.article-body')).toContainText('export or delete subscriber information');
    await expect(page.locator('.article-body')).not.toContainText('will be provided when signup opens');
  });
}
