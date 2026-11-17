import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'off' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } }
  ],
  // Mirrors production: one server delivers the API and the static export from the same origin.
  webServer: {
    command: 'npm run dev:demo',
    cwd: '../backend',
    // The suite signs in as the same admin many times; the production limit (10 per 15 minutes) would block it.
    env: { PORT: '3000', STATIC_DIR: '../frontend/out', LOGIN_RATE_LIMIT_MAX: '200', ENABLE_CURRICULUM_REVIEW: 'yes', CURRICULUM_REVIEWER_IDS: 'demo-admin-1' },
    url: 'http://localhost:3000/health',
    reuseExistingServer: false,
    timeout: 60_000
  }
});
