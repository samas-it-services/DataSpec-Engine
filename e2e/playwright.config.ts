import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for DataSpec Engine E2E tests.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './tests',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',

    // API base URL for direct API testing
    extraHTTPHeaders: {
      'X-API-Base-URL': process.env.E2E_API_URL || 'http://localhost:3000',
    },

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot for all tests (for documentation)
    screenshot: 'on',

    // Video recording for debugging
    video: 'on-first-retry',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Test against mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },

    // API-only tests (no browser)
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      use: {
        baseURL: process.env.E2E_API_URL || 'http://localhost:3000',
      },
    },
  ],

  // Run your local dev server before starting the tests
  // Note: Set SKIP_WEBSERVER=true to run API tests against an already-running server
  webServer: process.env.SKIP_WEBSERVER ? undefined : [
    {
      command: 'cd ../examples/full-stack-demo/api && npm run dev',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'cd ../examples/full-stack-demo/frontend && npm run dev',
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],

  // Timeout for each test
  timeout: 30 * 1000,

  // Timeout for expect() assertions
  expect: {
    timeout: 5 * 1000,
  },

  // Output directory for test artifacts
  outputDir: 'test-results',

  // Global setup and teardown
  globalSetup: require.resolve('./helpers/global-setup.ts'),
  globalTeardown: require.resolve('./helpers/global-teardown.ts'),
});
