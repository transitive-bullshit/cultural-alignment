import { dirname, join, sep } from 'node:path'

import { defineConfig, devices } from '@playwright/test'

// verify.ts drive supplies these after its doctor passes; never run this
// config directly against a server the run did not launch.
const baseURL = process.env.VERIFY_BASE_URL
const evidenceDir = process.env.VERIFY_EVIDENCE_DIR
const journeys = JSON.parse(process.env.VERIFY_JOURNEYS ?? '[]') as string[]

if (!baseURL || !evidenceDir || journeys.length === 0) {
  throw new Error(
    'Run journeys with .agents/skills/verify-cultural-alignment/verify.ts drive'
  )
}

export default defineConfig({
  testDir: commonDirectory(journeys),
  testMatch: journeys.map((file) => new RegExp(`^${escapeRegExp(file)}$`)),
  outputDir: join(evidenceDir, 'playwright'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Real media loads over the network; mocks would hide what users see.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: join(evidenceDir, 'report.json') }]
  ],
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    ignoreHTTPSErrors: true,
    screenshot: 'on',
    trace: 'on',
    video: 'off'
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 }
      }
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true
      }
    }
  ]
})

function commonDirectory(files: string[]) {
  const [first, ...others] = files.map((file) => dirname(file).split(sep))
  const shared: string[] = []
  for (const [index, segment] of first!.entries()) {
    if (!others.every((parts) => parts[index] === segment)) break
    shared.push(segment)
  }
  return shared.join(sep) || sep
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
