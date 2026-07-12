import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3013',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm exec next dev --turbopack -p 3013',
    url: 'http://localhost:3013',
    reuseExistingServer: false,
    env: {
      ...process.env,
      SKIP_AUTH_LOCAL: '1',
      ACT_E2E_FIXTURES: '1',
    },
  },
});
