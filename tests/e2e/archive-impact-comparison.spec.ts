import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'

import { expect, test, type Locator } from '@playwright/test'

const reportPath = new URL(
  '../../docs/skills/ai-safety-meme-creator/archive-impact-comparison.html',
  import.meta.url
)
const reportRoute = '/archive-impact-comparison.html'

let reportServer: Server | undefined
let reportUrl = process.env.MEME_IMPACT_COMPARISON_URL

test.beforeAll(async () => {
  if (reportUrl) return
  reportServer = createServer(async (request, response) => {
    if (request.url !== reportRoute) {
      response.writeHead(404).end()
      return
    }
    try {
      const html = await readFile(reportPath)
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(html)
    } catch {
      response.writeHead(500).end()
    }
  })
  reportUrl = await listen(reportServer)
})

test.afterAll(async () => {
  if (!reportServer) return
  await new Promise<void>((resolve, reject) => {
    reportServer!.close((error) => (error ? reject(error) : resolve()))
  })
})

test('V3/V4 report filters incomplete pairs before image review', async ({
  page
}) => {
  test.setTimeout(120_000)
  await page.goto(reportUrl!, { waitUntil: 'domcontentloaded' })

  const summary = page.locator('[data-report-summary]')
  const list = page.locator('[data-comparison-list]')
  const status = page.locator('#status')
  const rows = list.locator('[data-comparison-row]')
  const readyRows = list.locator(
    '[data-comparison-row][data-pair-status="ready"]'
  )
  const wipRows = list.locator('[data-comparison-row][data-pair-status="wip"]')

  await expect(summary).toBeVisible()
  await expect(list).toBeVisible()
  await expect(status).toHaveValue('ready')
  await expect(summary).toHaveAttribute('data-ready-count', /^\d+$/)
  await expect(summary).toHaveAttribute('data-wip-count', /^\d+$/)

  const readyCount = Number(await summary.getAttribute('data-ready-count'))
  const wipCount = Number(await summary.getAttribute('data-wip-count'))
  const rowCount = await rows.count()
  expect(rowCount).toBeGreaterThan(0)
  expect(readyCount).toBeGreaterThan(0)
  expect(readyCount + wipCount).toBe(rowCount)
  await expect(list.locator('[data-version="v3"]')).toHaveCount(rowCount)
  await expect(list.locator('[data-version="v4"]')).toHaveCount(rowCount)

  await expect.poll(() => visibleCount(readyRows)).toBe(readyCount)
  await expect.poll(() => visibleCount(wipRows)).toBe(0)
  await expectLoadedImages(readyRows, readyCount * 2)

  await status.selectOption('wip')

  await expect.poll(() => visibleCount(readyRows)).toBe(0)
  await expect.poll(() => visibleCount(wipRows)).toBe(wipCount)
  await expectLoadedImages(wipRows)

  await status.selectOption('all')

  await expect.poll(() => visibleCount(rows)).toBe(rowCount)
  await expectLoadedImages(rows)
})

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error)
    server.once('error', onError)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError)
      resolve()
    })
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Comparison report server did not bind a TCP port')
  }
  return `http://127.0.0.1:${address.port}${reportRoute}`
}

async function visibleCount(locator: Locator): Promise<number> {
  return locator.evaluateAll(
    (elements) =>
      elements.filter(
        (element) =>
          !element.hasAttribute('hidden') &&
          getComputedStyle(element).display !== 'none'
      ).length
  )
}

async function expectLoadedImages(
  rows: Locator,
  expectedCount?: number
): Promise<void> {
  const images = rows.locator('img:visible')
  if (expectedCount !== undefined) {
    await expect(images).toHaveCount(expectedCount)
  }
  await images.evaluateAll((elements) => {
    for (const element of elements) {
      const image = element as HTMLImageElement
      image.loading = 'eager'
    }
  })
  await expect
    .poll(
      () =>
        images.evaluateAll(
          (elements) =>
            elements.filter((element) => {
              const image = element as HTMLImageElement
              return !image.complete || image.naturalWidth === 0
            }).length
        ),
      { timeout: 30_000 }
    )
    .toBe(0)
}
