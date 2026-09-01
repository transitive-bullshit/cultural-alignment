import { expect, test } from '@playwright/test'

import { mockOptimizedImages } from './image-fixtures'
import { disableWebGl2 } from './webgl-fixtures'

test('homepage headline does not paint with fallback font metrics', async ({
  page
}) => {
  const fontRequested = Promise.withResolvers<void>()
  const releaseFont = Promise.withResolvers<void>()

  await page.route(
    /barlow-condensed-latin-800-normal.*\.woff2(?:\?.*)?$/,
    async (route) => {
      fontRequested.resolve()
      await releaseFont.promise
      await route.continue()
    }
  )
  await disableWebGl2(page)
  await mockOptimizedImages(page)
  await page.setViewportSize({ height: 900, width: 1_440 })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await fontRequested.promise
  // Wait past the headline's normal reveal delay while its display face is held.
  await page.waitForTimeout(450)

  const headline = page.locator('#signal-loader-title')
  const pendingState = await headline.evaluate((element) => {
    const style = getComputedStyle(element)

    return {
      fontStatuses: [...document.fonts]
        .filter(
          (font) => font.family === 'Barlow Condensed' && font.weight === '800'
        )
        .map((font) => font.status),
      visibility: style.visibility
    }
  })

  releaseFont.resolve()
  await page.evaluate(async () => {
    await document.fonts.ready
  })

  expect(pendingState.fontStatuses).toContain('loading')
  expect(pendingState.visibility).toBe('hidden')
  await expect(headline).toBeVisible()
})
