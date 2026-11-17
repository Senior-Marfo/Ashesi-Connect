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
    env: { PORT: '3000', STATIC_DIR: '../frontend/out' },
    url: 'http://localhost:3000/health',
    reuseExistingServer: false,
    timeout: 60_000
  }
});
