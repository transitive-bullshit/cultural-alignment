import { defineConfig, devices } from '@playwright/test'

import { archiveComparisonTestMatch } from './playwright.artifacts.config'

const baseURL = process.env.PORTLESS_URL
const port = process.env.PORT

if (!baseURL || !port) {
  throw new Error('Run browser journeys with pnpm test:e2e to start Portless')
}
const isCI = Boolean(process.env.CI)
const useDevelopmentServer = process.env.PLAYWRIGHT_SERVER === 'development'
const useExistingBuild = process.env.PLAYWRIGHT_SERVER === 'production'
const productionCommand = 'pnpm start --hostname 127.0.0.1'

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
    baseURL,
    ignoreHTTPSErrors: true,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? (isCI ? undefined : 'chrome'),
    screenshot: 'only-on-failure',
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',
    video: 'off'
  },
  webServer: {
    // Compile before parallel journeys, rather than on demand during reloads.
    command: useDevelopmentServer
      ? 'pnpm exec next dev --hostname 127.0.0.1'
      : useExistingBuild
        ? productionCommand
        : `pnpm build && ${productionCommand}`,
    reuseExistingServer: false,
    timeout: 300_000,
    // Probe Next directly so readiness does not depend on Node resolving .localhost.
    url: `http://127.0.0.1:${port}`
  },
  workers: isCI ? 1 : undefined
})
