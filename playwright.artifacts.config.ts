import { defineConfig, devices } from '@playwright/test'

export const archiveComparisonTestMatch = '**/archive-*-comparison.spec.ts'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: archiveComparisonTestMatch,
  outputDir: './test-results/playwright-artifacts',
  reporter: 'line',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:1',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off'
  }
})
