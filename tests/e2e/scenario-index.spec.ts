import { expect, test } from '@playwright/test'

import { mockOptimizedImages } from './image-fixtures'

// Each gallery page ships a server-rendered index of its scenarios. It is the
// visible gallery without scripting and the canvas's text equivalent with it.
test.describe('server-rendered scenario index', () => {
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    for (const route of ['/', '/scenarios']) {
      test(`${route} lists every gallery scenario as a visible link`, async ({
        page
      }) => {
        await page.goto(route)

        const gallery = page.locator('[data-spatial-gallery="browse"]')
        const index = page.locator('[data-scenario-index]')
        const links = index.locator('a[href^="/scenarios/"]')
        const itemCount = Number(
          await gallery.getAttribute('data-gallery-item-count')
        )

        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(index).toBeVisible()
        await expect(links).toHaveCount(itemCount)
        await expect(links.first()).toBeVisible()
        await expect(links.first()).not.toHaveText('')
      })
    }
  })

  test('yields to the gallery and returns for keyboard focus', async ({
    page
  }) => {
    await mockOptimizedImages(page)
    await page.goto('/scenarios')
    await page.locator('[data-gallery-intro-dismiss]').click()

    const index = page.locator('[data-scenario-index]')
    const firstLink = index.locator('a[href^="/scenarios/"]').first()

    await expect(page.locator('[data-spatial-gallery] canvas')).toBeVisible({
      timeout: 15_000
    })
    await expect(index).toHaveAttribute('data-enhanced', 'true')
    await expect
      .poll(() => index.evaluate((element) => element.clientWidth))
      .toBeLessThanOrEqual(1)

    await firstLink.focus()
    await expect(firstLink).toBeFocused()
    await expect
      .poll(() => index.evaluate((element) => element.clientWidth))
      .toBeGreaterThan(200)
  })

  test('returns when the gallery never hydrates', async ({ page }) => {
    await page.route('**/_next/static/chunks/**', (route) => route.abort())
    await page.goto('/scenarios')

    const index = page.locator('[data-scenario-index]')

    await expect(index).not.toHaveAttribute('data-enhanced')
    await expect
      .poll(() => index.evaluate((element) => element.clientWidth), {
        timeout: 15_000
      })
      .toBeGreaterThan(200)
    await expect(index.locator('a[href^="/scenarios/"]').first()).toBeVisible()
  })
})
