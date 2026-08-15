import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables (.env.test has highest priority, falling back to .env)
config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

export default defineConfig({
  testDir: './e2e',
  /* Maximum time one test can run for. */
  timeout: 30000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * AI/LLM routes can take a bit longer, so we set a generous 10s default.
     */
    timeout: 10000,
  },
  /* Run tests in files in parallel */
  fullyParallel: false, // Set to false to avoid race conditions with database mutations
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1, // Keep single worker for database mutation predictability
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Global setup hook to reset and seed the database once before all tests */
  globalSetup: require.resolve('./e2e/global-setup'),

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    env: {
      NEXT_PUBLIC_E2E_TESTING: 'true',
      MONGODB_URI: process.env.MONGODB_URI || '',
      MONGODB_DB_TEST: process.env.MONGODB_DB_TEST || '',
      MONGODB_DB_PROD: process.env.MONGODB_DB_PROD || '',
    }
  },
});
