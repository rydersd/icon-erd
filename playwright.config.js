import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1,
  use: { baseURL: process.env.TEST_URL || 'http://127.0.0.1:8010', viewport: { width: 1500, height: 1100 } },
  webServer: process.env.TEST_URL ? undefined : { command: 'python3 scripts/serve-static.py', url: 'http://127.0.0.1:8010', reuseExistingServer: true },
});
