import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/incidents-e2e',
  use: { baseURL: 'http://127.0.0.1:43871', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 43871 --ignore-lock',
    url: 'http://127.0.0.1:43871', reuseExistingServer: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
});
