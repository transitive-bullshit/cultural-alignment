import { expect, test } from '@playwright/test'

import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }

import { mockOptimizedImages, onePixelPng } from './image-fixtures'

const scenario = scenarios.find(
  ({ memes }) => Array.isArray(memes) && memes.length === 2
)!
const SLUG = scenario.slug
const ASSET_URL_A = scenario.memes[0]!.detailSrc

function createDeferredDownloadRoute(
  page: import('@playwright/test').Page,
  assetUrlA: string,
  fulfillStatus: number
) {
  let downloadArmed = false
  let downloadCaptured = false
  let resolveCaptured: () => void
  let resolveFulfill: () => void
  const capturedPromise = new Promise<void>((resolve) => {
    resolveCaptured = resolve
  })
  const fulfillPromise = new Promise<void>((resolve) => {
    resolveFulfill = resolve
  })

  void page.route(
    (url) => url.hostname === 'assets.cultural-alignment.com',
    async (route) => {
      const requestUrl = route.request().url()
      if (requestUrl === assetUrlA && downloadArmed && !downloadCaptured) {
        downloadCaptured = true
        resolveCaptured()
        await fulfillPromise
        await route.fulfill({
          status: fulfillStatus,
          contentType: 'image/png',
          body: onePixelPng
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: onePixelPng
      })
    }
  )

  return {
    armDownload: () => {
      downloadArmed = true
    },
    waitCaptured: () => capturedPromise,
    resolveFulfill: () => resolveFulfill()
  }
}

async function openLightbox(page: import('@playwright/test').Page) {
  await page.goto(`/scenarios/${SLUG}`)
  await expect(page.locator('[data-scenario-meme-grid]')).toBeVisible()
  await page.locator('[data-scenario-meme-trigger]').nth(0).click()
  const lightbox = page.locator('[data-scenario-meme-lightbox]')
  await expect(lightbox).toBeVisible()
  await expect(lightbox).toHaveAttribute('data-scenario-meme-index', '0')
  await expect(page.locator('[data-scenario-meme-download]')).toBeVisible()
  return { lightbox }
}

test.describe('scenario meme download race', () => {
  test.beforeEach(async ({ page }) => {
    await mockOptimizedImages(page)
  })

  test('2.2 + 2.8 success feedback is discarded when navigating during download (ArrowRight)', async ({
    page
  }) => {
    const route = createDeferredDownloadRoute(page, ASSET_URL_A, 200)

    const { lightbox } = await openLightbox(page)
    const downloadButton = page.locator('[data-scenario-meme-download]')
    const politeRegion = page.locator(
      '[data-scenario-meme-lightbox] [role="status"][aria-live="polite"]'
    )

    await expect(downloadButton).toHaveAttribute('data-download-state', 'idle')

    route.armDownload()
    await downloadButton.click()
    await expect(downloadButton).toHaveAttribute(
      'data-download-state',
      'loading'
    )
    await route.waitCaptured()

    await lightbox.focus()
    await page.keyboard.press('ArrowRight')
    await expect(lightbox).toHaveAttribute('data-scenario-meme-index', '1')
    await expect(page.locator('[data-scenario-meme-counter]')).toHaveText(
      'Meme 2 of 2'
    )

    route.resolveFulfill()
    await page.waitForTimeout(300)

    await expect(downloadButton).toHaveAttribute('data-download-state', 'idle')
    await expect(downloadButton).toHaveAttribute('aria-busy', 'false')
    await expect(
      page.locator('[data-scenario-meme-download-confirmation]')
    ).toHaveCount(0)
    await expect(politeRegion).toHaveText('Meme 2 of 2')
    await expect(downloadButton).toHaveAttribute(
      'aria-label',
      'Download meme 2 of 2'
    )
  })

  test('2.8 success feedback is discarded when navigating via the Next button', async ({
    page
  }) => {
    const route = createDeferredDownloadRoute(page, ASSET_URL_A, 200)

    const { lightbox } = await openLightbox(page)
    const downloadButton = page.locator('[data-scenario-meme-download]')
    const politeRegion = page.locator(
      '[data-scenario-meme-lightbox] [role="status"][aria-live="polite"]'
    )

    route.armDownload()
    await downloadButton.click()
    await expect(downloadButton).toHaveAttribute(
      'data-download-state',
      'loading'
    )
    await route.waitCaptured()

    await page.locator('[aria-label="Next meme"]').click()
    await expect(lightbox).toHaveAttribute('data-scenario-meme-index', '1')

    route.resolveFulfill()
    await page.waitForTimeout(300)

    await expect(downloadButton).toHaveAttribute('data-download-state', 'idle')
    await expect(
      page.locator('[data-scenario-meme-download-confirmation]')
    ).toHaveCount(0)
    await expect(politeRegion).toHaveText('Meme 2 of 2')
  })

  test('2.3 error feedback is discarded when navigating during download', async ({
    page
  }) => {
    const route = createDeferredDownloadRoute(page, ASSET_URL_A, 500)

    const { lightbox } = await openLightbox(page)
    const downloadButton = page.locator('[data-scenario-meme-download]')
    const politeRegion = page.locator(
      '[data-scenario-meme-lightbox] [role="status"][aria-live="polite"]'
    )

    route.armDownload()
    await downloadButton.click()
    await expect(downloadButton).toHaveAttribute(
      'data-download-state',
      'loading'
    )
    await route.waitCaptured()

    await lightbox.focus()
    await page.keyboard.press('ArrowRight')
    await expect(lightbox).toHaveAttribute('data-scenario-meme-index', '1')

    route.resolveFulfill()
    await page.waitForTimeout(300)

    await expect(downloadButton).toHaveAttribute('data-download-state', 'idle')
    await expect(downloadButton).toHaveAttribute('aria-busy', 'false')
    await expect(politeRegion).toHaveText('Meme 2 of 2')
  })

  test('2.4 re-navigation A->B->A still discards stale feedback', async ({
    page
  }) => {
    const route = createDeferredDownloadRoute(page, ASSET_URL_A, 200)

    const { lightbox } = await openLightbox(page)
    const downloadButton = page.locator('[data-scenario-meme-download]')
    const politeRegion = page.locator(
      '[data-scenario-meme-lightbox] [role="status"][aria-live="polite"]'
    )

    route.armDownload()
    await downloadButton.click()
    await expect(downloadButton).toHaveAttribute(
      'data-download-state',
      'loading'
    )
    await route.waitCaptured()

    await lightbox.focus()
    await page.keyboard.press('ArrowRight')
    await expect(lightbox).toHaveAttribute('data-scenario-meme-index', '1')
    await page.keyboard.press('ArrowRight')
    await expect(lightbox).toHaveAttribute('data-scenario-meme-index', '0')

    route.resolveFulfill()
    await page.waitForTimeout(300)

    await expect(lightbox).toHaveAttribute('data-scenario-meme-index', '0')
    await expect(downloadButton).toHaveAttribute('data-download-state', 'idle')
    await expect(
      page.locator('[data-scenario-meme-download-confirmation]')
    ).toHaveCount(0)
    await expect(politeRegion).toHaveText('Meme 1 of 2')
  })

  test('2.5 close-then-reopen invalidates the in-flight download', async ({
    page
  }) => {
    const route = createDeferredDownloadRoute(page, ASSET_URL_A, 200)

    const { lightbox } = await openLightbox(page)
    const downloadButton = page.locator('[data-scenario-meme-download]')
    const politeRegion = page.locator(
      '[data-scenario-meme-lightbox] [role="status"][aria-live="polite"]'
    )

    route.armDownload()
    await downloadButton.click()
    await expect(downloadButton).toHaveAttribute(
      'data-download-state',
      'loading'
    )
    await route.waitCaptured()

    await page.keyboard.press('Escape')
    await expect(lightbox).toBeHidden()

    await page.locator('[data-scenario-meme-trigger]').nth(1).click()
    await expect(lightbox).toBeVisible()
    await expect(lightbox).toHaveAttribute('data-scenario-meme-index', '1')

    route.resolveFulfill()
    await page.waitForTimeout(300)

    await expect(downloadButton).toHaveAttribute('data-download-state', 'idle')
    await expect(
      page.locator('[data-scenario-meme-download-confirmation]')
    ).toHaveCount(0)
    await expect(politeRegion).toHaveText('')
  })

  test('2.6 happy path success when not navigating', async ({ page }) => {
    const route = createDeferredDownloadRoute(page, ASSET_URL_A, 200)

    const { lightbox } = await openLightbox(page)
    const downloadButton = page.locator('[data-scenario-meme-download]')
    const politeRegion = page.locator(
      '[data-scenario-meme-lightbox] [role="status"][aria-live="polite"]'
    )
    await expect(lightbox).toHaveAttribute('data-scenario-meme-index', '0')

    route.armDownload()
    await downloadButton.click()
    await expect(downloadButton).toHaveAttribute(
      'data-download-state',
      'loading'
    )

    route.resolveFulfill()
    await expect(downloadButton).toHaveAttribute(
      'data-download-state',
      'success'
    )
    await expect(
      page.locator('[data-scenario-meme-download-confirmation]')
    ).toHaveCount(1)
    await expect(politeRegion).toHaveText('Meme 1 of 2 download started')
    await expect(downloadButton).toHaveAttribute(
      'aria-label',
      'meme 1 of 2 download started'
    )
  })

  test('2.7 happy path error when not navigating', async ({ page }) => {
    const route = createDeferredDownloadRoute(page, ASSET_URL_A, 500)

    const { lightbox } = await openLightbox(page)
    const downloadButton = page.locator('[data-scenario-meme-download]')
    const politeRegion = page.locator(
      '[data-scenario-meme-lightbox] [role="status"][aria-live="polite"]'
    )
    await expect(lightbox).toHaveAttribute('data-scenario-meme-index', '0')

    route.armDownload()
    await downloadButton.click()
    await expect(downloadButton).toHaveAttribute(
      'data-download-state',
      'loading'
    )

    route.resolveFulfill()
    await expect(downloadButton).toHaveAttribute('data-download-state', 'error')
    await expect(politeRegion).toHaveText(
      'Could not download meme 1. Open the image in a new tab to save it instead.'
    )
    await expect(downloadButton).toHaveAttribute(
      'aria-label',
      'Retry downloading meme 1 of 2'
    )
  })
})
