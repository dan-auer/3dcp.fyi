// Playwright smoke run against serve.py (the same server the README points
// local use at, so the 404 router is exercised the way GitHub Pages runs it).
// Run from the root: npm run test:smoke (playwright test -c
// tests/playwright.config.mjs). Paths here are relative to this file: the
// specs beside it, the results and serve.py in the root.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.mjs/,
  outputDir: "../test-results",
  timeout: 120000,
  expect: { timeout: 60000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:8000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "python3 ../serve.py 8000",
    url: "http://127.0.0.1:8000/",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
