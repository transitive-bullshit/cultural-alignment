import { defineConfig, devices } from '@playwright/test'

import { archiveComparisonTestMatch } from './playwright.artifacts.config'

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100)
const isCI = Boolean(process.env.CI)
const useProductionServer = process.env.PLAYWRIGHT_SERVER === 'production'

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: archiveComparisonTestMatch,
  outputDir: './test-results/playwright',
  expect: {
    timeout: isCI ? 10_000 : 5_000
  },
  failOnFlakyTests: isCI,
  forbidOnly: isCI,
  fullyParallel: !isCI,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'line',
  retries: isCI ? 1 : 0,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${port}`,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? (isCI ? undefined : 'chrome'),
    screenshot: 'only-on-failure',
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',
    video: 'off'
  },
  webServer: {
    command: useProductionServer
      ? `pnpm start --hostname 127.0.0.1 --port ${port}`
      : `pnpm exec next dev --hostname 127.0.0.1 --port ${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    url: `http://127.0.0.1:${port}`
  },
  workers: isCI ? 1 : undefined
})
