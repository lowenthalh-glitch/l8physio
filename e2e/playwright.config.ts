import { defineConfig, devices } from '@playwright/test';

// One web server serves the desktop portal (/app.html) and the mobile bundle (/m/app.html).
// The server always terminates TLS with a self-signed certificate.
const baseURL = process.env.BASE_URL || 'https://localhost:8088';

export default defineConfig({
  testDir: './tests',
  // Specs share one live database; serial execution keeps data assertions deterministic.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'api', testDir: './tests/api', use: { ...devices['Desktop Chrome'] } },
    { name: 'desktop', testDir: './tests/desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // Real mobile bundle: the Android UA makes login.js redirect to /m/app.html.
    { name: 'mobile', testDir: './tests/mobile', use: { ...devices['Pixel 7'] } },
    { name: 'kind', testDir: './tests/kind', use: { ...devices['Desktop Chrome'] } },
  ],
});
