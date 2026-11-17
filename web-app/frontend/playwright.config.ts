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
  webServer: [
    { command: 'npm run dev:demo', cwd: '../backend', url: 'http://localhost:4000/health', reuseExistingServer: false, timeout: 60_000 },
    { command: 'node e2e/static-server.mjs out', url: 'http://localhost:3000/', reuseExistingServer: false }
  ]
});
