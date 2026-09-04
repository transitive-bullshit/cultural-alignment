import { expect, test, type Locator } from '@playwright/test'

import { mockOptimizedImages } from './image-fixtures'

test.describe('gallery introduction motion', () => {
  test.describe.configure({ mode: 'serial' })

  test('reloading the scenarios gallery keeps moving left through its initial layout correction', async ({
    page
  }) => {
    const targetURL = process.env.GALLERY_MOTION_URL ?? '/scenarios'

    if (targetURL.startsWith('/')) await mockOptimizedImages(page)
    await page.clock.install()
    await page.goto(targetURL)

    const introduction = page.locator('[data-gallery-intro]')

    await expect(introduction).toHaveAttribute('data-state', 'visible')
    await page.locator('[data-gallery-intro-dismiss]').click()
    await expect(introduction).toHaveAttribute('data-state', 'dismissed')
    await page.reload({ waitUntil: 'commit' })

    const gallery = page.locator('[data-spatial-gallery="browse"]')
    const canvas = gallery.locator('canvas')

    await expect(introduction).toHaveAttribute('data-state', 'dismissed', {
      timeout: 15_000
    })
    await expect(canvas).toBeVisible({ timeout: 15_000 })
    await expect(canvas).toHaveAttribute('data-gallery-intro-motion', 'running')
    // Keep the target ahead of a slow protocol round trip. The render loop caps
    // the resulting frame delta, and the assertion below guards the test state.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 5_000))
    await expect(canvas).toHaveAttribute('data-gallery-intro-motion', 'running')

    const viewport = page.viewportSize()
    const canvasWidth = await canvas.getAttribute('width')
    const previousLayoutCorrectionCount = Number(
      (await canvas.getAttribute('data-gallery-auto-motion-layout-count')) ?? 0
    )
    if (!viewport || !canvasWidth) {
      throw new Error('Expected a measured gallery viewport')
    }
    await page.setViewportSize({
      height: viewport.height,
      width: viewport.width - 1
    })

    await expect.poll(() => canvas.getAttribute('width')).not.toBe(canvasWidth)
    await page.clock.runFor(32)
    await expect
      .poll(async () =>
        Number(
          (await canvas.getAttribute(
            'data-gallery-auto-motion-layout-count'
          )) ?? 0
        )
      )
      .toBeGreaterThan(previousLayoutCorrectionCount)
    await expect(canvas).toHaveAttribute(
      'data-gallery-auto-motion-layout-direction',
      'left'
    )
  })

  test('dismissing the introduction launches an inertia burst', async ({
    page
  }) => {
    await mockOptimizedImages(page)
    await page.goto('/')

    const gallery = page.locator('[data-spatial-gallery="browse"]')
    const canvas = gallery.locator('canvas')

    await expect(canvas).toHaveAttribute(
      'data-gallery-inertia-burst',
      'pending',
      { timeout: 15_000 }
    )

    await page.locator('[data-gallery-intro-dismiss]').click()

    await expect(page.locator('[data-gallery-intro]')).toHaveAttribute(
      'data-state',
      'dismissed'
    )
    await expect(gallery).toHaveAttribute(
      'data-gallery-inertia-burst-requested',
      'true'
    )
    await expect(canvas).toHaveAttribute(
      'data-gallery-inertia-burst',
      /^(launched|settled)$/
    )
  })

  test('reduced motion dismisses without positional movement', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockOptimizedImages(page)
    await page.goto('/')

    const canvas = page.locator('[data-spatial-gallery="browse"] canvas')

    await expect(canvas).toHaveAttribute(
      'data-gallery-inertia-burst',
      'pending',
      { timeout: 15_000 }
    )
    await page.locator('[data-gallery-intro-dismiss]').click()

    await expect(canvas).toHaveAttribute(
      'data-gallery-inertia-burst',
      'skipped'
    )
  })

  test('a scenario filter remount does not replay the dismissal burst', async ({
    page
  }) => {
    await mockOptimizedImages(page)
    await page.goto('/scenarios')

    const gallery = page.locator('[data-spatial-gallery="browse"]')
    const canvas = gallery.locator('canvas')

    await expect(canvas).toHaveAttribute(
      'data-gallery-inertia-burst',
      'pending',
      { timeout: 15_000 }
    )
    await page.locator('[data-gallery-intro-dismiss]').click()
    await expect(canvas).toHaveAttribute(
      'data-gallery-inertia-burst',
      /^(launched|settled)$/
    )

    const filter = page
      .locator('[data-scenario-family-filters] a[href^="/scenarios?family="]')
      .first()
    const filterHref = await requiredInternalHref(filter)
    const navigation = page.waitForURL(
      (url) => `${url.pathname}${url.search}${url.hash}` === filterHref,
      { waitUntil: 'commit' }
    )

    await filter.click()
    await navigation

    await expect(gallery).not.toHaveAttribute(
      'data-gallery-inertia-burst-requested'
    )
    await expect(gallery.locator('canvas')).toHaveAttribute(
      'data-gallery-inertia-burst',
      'pending',
      { timeout: 15_000 }
    )
  })

  test.describe('phone viewport', () => {
    test.use({ hasTouch: true, viewport: { height: 844, width: 390 } })

    test('keeps the homepage gallery paintable after the introduction closes', async ({
      page
    }) => {
      await mockOptimizedImages(page)
      await page.goto('/')

      const introduction = page.locator('[data-gallery-intro]')
      await expect(introduction).toHaveAttribute('data-state', 'visible')
      await page.locator('[data-gallery-intro-dismiss]').click()
      await expect(introduction).toHaveAttribute('data-state', 'dismissed')

      const gallery = page.locator('[data-spatial-gallery="browse"]')
      const canvas = gallery.locator('canvas')

      await expect(gallery).toBeVisible()
      await expect
        .poll(async () => (await canvas.boundingBox())?.height ?? 0)
        .toBeGreaterThan(0)
      await expect
        .poll(async () =>
          Number(await canvas.getAttribute('data-gallery-bound-textures'))
        )
        .toBeGreaterThan(0)
    })
  })
})

async function requiredInternalHref(locator: Locator) {
  const href = await locator.getAttribute('href')

  if (!href?.startsWith('/')) {
    throw new Error('Expected an internal navigation link')
  }

  return href
}
