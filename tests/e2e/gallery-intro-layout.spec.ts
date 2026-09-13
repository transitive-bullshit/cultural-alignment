import { expect, test, type Page } from '@playwright/test'

import { mockOptimizedImages } from './image-fixtures'
import { disableWebGl2 } from './webgl-fixtures'

test.describe('gallery introduction phone layout', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
    viewport: { width: 390, height: 690 }
  })

  test('keeps the introduction and its actions reachable as the viewport changes', async ({
    page
  }) => {
    await disableWebGl2(page)
    await mockOptimizedImages(page)
    await page.goto('/')

    const introduction = page.locator('[data-gallery-intro]')
    const dialog = page.locator('[data-gallery-intro-dialog]')
    const image = dialog.locator('[data-gallery-intro-example-image]')
    const content = dialog.locator('[data-gallery-intro-scroll]')

    await expect(introduction).toHaveAttribute('data-state', 'visible')
    await page.evaluate(() => document.fonts.ready)

    // Check the initial composition before any action can scroll it into view.
    await expect
      .poll(() => content.evaluate((element) => element.scrollTop))
      .toBe(0)
    await expectIntroductionInViewport(page)

    for (const viewport of [
      { width: 390, height: 600 },
      { width: 320, height: 480 },
      { width: 375, height: 600 },
      { width: 390, height: 844 },
      { width: 844, height: 390 }
    ]) {
      await page.setViewportSize(viewport)
      await expectIntroductionInViewport(page)

      if (viewport.width > viewport.height) {
        await expect
          .poll(() =>
            content.evaluate(
              (element) => element.scrollHeight - element.clientHeight
            )
          )
          .toBeGreaterThan(0)

        await content.evaluate((element) => {
          element.scrollTop = 0
        })
        await dialog.focus()
        await page.keyboard.press('Tab')
        await expect(content).toBeFocused()
        await page.keyboard.press('PageDown')
        await expect
          .poll(() => content.evaluate((element) => element.scrollTop))
          .toBeGreaterThan(0)
        await expectIntroductionInViewport(page)
      }

      await content.evaluate((element) => {
        element.scrollTop = element.scrollHeight
      })
      await expect
        .poll(() =>
          content.evaluate(
            (element) =>
              element.scrollHeight - element.clientHeight - element.scrollTop
          )
        )
        .toBeLessThanOrEqual(1)
      await expectIntroductionInViewport(page)

      await image.scrollIntoViewIfNeeded()
      await expect(image).toBeInViewport()
      await expectIntroductionInViewport(page)
    }

    await page.locator('[data-gallery-intro-dismiss]').click()
    await expect(introduction).toHaveAttribute('data-state', 'dismissed')
    await expect(dialog).toBeHidden()
  })
})

async function expectIntroductionInViewport(page: Page) {
  await expect(page.locator('[data-gallery-intro-dialog]')).toBeInViewport({
    ratio: 1
  })
  await expect(
    page.locator('[data-gallery-intro-dialog] [data-slot="dialog-title"]')
  ).toBeInViewport({ ratio: 1 })
  await expect(page.locator('[data-gallery-intro-close]')).toBeInViewport({
    ratio: 1
  })
  await expect(page.locator('[data-gallery-intro-dismiss]')).toBeInViewport({
    ratio: 1
  })
}
