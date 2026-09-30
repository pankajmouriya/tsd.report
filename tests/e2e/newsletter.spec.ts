import { expect, test, type Locator } from '@playwright/test';

// Build first with the public fixture values from the newsletter delivery plan.
const action = 'https://buttondown.com/api/emails/embed-subscribe/tsd-test';
const signupRoutes = ['/', '/2026/09/26', '/article/agent-tool-boundaries', '/subscribe'];
const readerRoutes = [...signupRoutes, '/privacy'];

// Fail closed: no test in this file may contact an external service.
test.beforeEach(async ({ context, baseURL }) => {
  await context.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin === new URL(baseURL!).origin) await route.continue();
    else await route.abort();
  });
});

async function expectVisibleFocus(control: Locator) {
  await expect(control).toBeFocused();
  const focus = await control.evaluate((element) => {
    const style = getComputedStyle(element);
    return { visible: element.matches(':focus-visible'), width: parseFloat(style.outlineWidth), style: style.outlineStyle, color: style.outlineColor };
  });
  expect(focus.visible).toBe(true);
  expect(focus.width).toBeGreaterThanOrEqual(2);
  expect(focus.style).not.toBe('none');
  expect(focus.color).not.toBe('rgba(0, 0, 0, 0)');
}

for (const path of signupRoutes) {
  test(`has one native, consent-backed signup after editorial content on ${path}`, async ({ page }) => {
    await page.goto(path);
    const signup = page.getByRole('region', { name: 'Receive the email edition' });
    await expect(signup).toHaveCount(1);
    await expect(signup).toBeVisible();
    const form = signup.locator('form');
    await expect(form).toHaveAttribute('method', 'post');
    await expect(form).toHaveAttribute('action', action);
    await expect(form).toHaveAttribute('aria-describedby', 'newsletter-consent');
    await expect(form.locator('input[type="hidden"][name="embed"]')).toHaveValue('1');
    const email = signup.getByRole('textbox', { name: 'Email address' });
    await expect(email).toHaveAttribute('type', 'email');
    await expect(email).toHaveAttribute('name', 'email');
    await expect(email).toHaveAttribute('autocomplete', 'email');
    await expect(email).toHaveAttribute('required', '');
    await expect(signup).toContainText(/Buttondown.*Confirmation.*unsubscribe/s);
    await expect(signup.getByRole('link', { name: 'Privacy', exact: true })).toHaveAttribute('href', '/privacy');
    await expect(signup.getByRole('link', { name: 'Read via RSS' })).toHaveAttribute('href', '/rss.xml');
    expect(await signup.evaluate((element) => {
      const content = document.querySelector('.article-body, [data-lead]');
      return !!content && !!(content.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING);
    })).toBe(true);
  });
}

test('footer navigation reaches subscription and privacy information', async ({ page }) => {
  await page.goto('/article/agent-tool-boundaries');
  await page.getByRole('navigation', { name: 'Publication links' }).getByRole('link', { name: 'Subscribe', exact: true }).click();
  await expect(page).toHaveURL(/\/subscribe\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The email edition');
  await page.getByRole('navigation', { name: 'Publication links' }).getByRole('link', { name: 'Privacy', exact: true }).click();
  await expect(page).toHaveURL(/\/privacy\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy notice');
  await expect(page.locator('.newsletter-signup')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'monitored publication contact' })).toHaveAttribute('href', 'mailto:privacy@example.test');
});

for (const theme of ['light', 'dark'] as const) {
  test(`keyboard order and visible focus in ${theme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/subscribe');
    await page.keyboard.press('Tab');
    await expectVisibleFocus(page.getByRole('link', { name: 'Skip to content' }));
    const email = page.getByRole('textbox', { name: 'Email address' });
    // Traverse from the start rather than assigning focus to skip prior controls.
    for (let i = 0; i < 20 && !(await email.evaluate((element) => element === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expectVisibleFocus(email);
    await page.keyboard.press('Tab');
    await expectVisibleFocus(page.getByRole('button', { name: 'Subscribe', exact: true }));
    await page.keyboard.press('Tab');
    await expectVisibleFocus(page.locator('.newsletter-signup').getByRole('link', { name: 'Privacy', exact: true }));
    await page.keyboard.press('Tab');
    await expectVisibleFocus(page.locator('.newsletter-signup').getByRole('link', { name: 'Read via RSS' }));
    await page.keyboard.press('Shift+Tab');
    await expectVisibleFocus(page.locator('.newsletter-signup').getByRole('link', { name: 'Privacy', exact: true }));
  });

  test(`native validation and intercepted POST work without JavaScript in ${theme} mode`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: theme, baseURL });
    const submissions: { url: string; method: string; contentType: string; body: string | null }[] = [];
    await context.route('**/*', async (route) => {
      const request = route.request();
      if (request.url() === action) {
        submissions.push({ url: request.url(), method: request.method(), contentType: request.headers()['content-type'], body: request.postData() });
        await route.fulfill({ contentType: 'text/html', body: '<h1>Locally intercepted signup</h1>' });
      } else if (new URL(request.url()).origin === new URL(baseURL!).origin) await route.continue();
      else await route.abort();
    });
    try {
      const page = await context.newPage();
      await page.goto('/subscribe');
      const email = page.getByRole('textbox', { name: 'Email address' });
      await email.fill('malformed-address');
      // Exercise native keyboard submission, including the browser's validation bubble.
      await email.press('Enter');
      expect(await email.evaluate((element: HTMLInputElement) => element.validity.typeMismatch)).toBe(true);
      await expect(email).toBeFocused();
      await expect(page).toHaveURL(/\/subscribe\/?$/);
      expect(submissions).toHaveLength(0);
      await email.fill('reader@example.test');
      await email.press('Enter');
      await expect(page.getByRole('heading', { name: 'Locally intercepted signup' })).toBeVisible();
      expect(submissions).toHaveLength(1);
      expect(submissions[0]).toMatchObject({ url: action, method: 'POST', contentType: 'application/x-www-form-urlencoded' });
      expect([...new URLSearchParams(submissions[0].body!).entries()].sort()).toEqual([['email', 'reader@example.test'], ['embed', '1']]);
    } finally {
      await context.close();
    }
  });

  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`reader routes reflow with readable controls at ${width}px in ${theme} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      for (const path of readerRoutes) {
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(width);
        for (const control of await page.locator('.newsletter-fields input, .newsletter-fields button').all()) {
          const box = await control.boundingBox();
          expect(box!.height, path).toBeGreaterThanOrEqual(44);
          expect(box!.width, path).toBeGreaterThanOrEqual(44);
          await expect(control).toHaveCSS('border-radius', '0px');
        }
        const contrasts = await page.locator('.newsletter-description, .newsletter-consent, .newsletter-fields input, .newsletter-fields button, .article-body').evaluateAll((elements) => {
          const luminance = (color: string) => {
            const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
            return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
          };
          return elements.map((element) => {
            const style = getComputedStyle(element);
            let background = style.backgroundColor;
            for (let parent = element.parentElement; background === 'rgba(0, 0, 0, 0)' && parent; parent = parent.parentElement) background = getComputedStyle(parent).backgroundColor;
            const values = [luminance(style.color), luminance(background)].sort((a, b) => a - b);
            return (values[1] + .05) / (values[0] + .05);
          });
        });
        expect(contrasts.length, path).toBeGreaterThan(0);
        for (const contrast of contrasts) expect(contrast, path).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
}
