import { defineConfig, devices } from "@playwright/test"

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  // webServer: {
  //   command: !process.env.CI
  //     ? "npm run start:e2e"
  //     : "cd ../../apps/web && npm run start:e2e",
  //   url: "http://localhost:5173",
  //   // timeout: 480000,
  //   reuseExistingServer: true,
  // },
  testDir: "./src",
  globalSetup: require.resolve("./global-setup"),
  timeout: process.env.CI ? 480000 : 1200000, // 20 minutes in dev for long AI responses
  /* Run tests in files in parallel */
  // fullyParallel: true,
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: false, //!!process.env.CI,
  // forbidOnly: false,

  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  // workers: process.env.CI ? 1 : undefined,
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["list"], ["html", { outputFolder: "./playwright-report" }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    launchOptions: { slowMo: 200 },
    headless: true, //!!process.env.CI, // Run headless in CI, headed locally
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: !process.env.CI ? "http://localhost:5173" : "http://e2e.chrry.ai",
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
    /* Grant clipboard permissions by default */
    permissions: ["clipboard-read", "clipboard-write"],
    /* Always record video in dev, only on failure in CI */
    video: process.env.CI ? "retain-on-failure" : "on",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },

    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
})
