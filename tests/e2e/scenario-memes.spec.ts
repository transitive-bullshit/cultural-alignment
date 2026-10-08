import { expect, test } from '@playwright/test'

import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }

import { mockOptimizedImages } from './image-fixtures'

const scenario = scenarios.find(({ memes }) => memes.length > 1)

if (!scenario) throw new Error('Expected a scenario with multiple memes')

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 900, height: 900 },
  { width: 390, height: 844 }
]) {
  test(`meme viewer keeps Close in its corner at ${viewport.width}px`, async ({
    page
  }) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      localStorage.setItem('cultural-alignment:spoiler-warning:v2', 'dismissed')
    })
    await mockOptimizedImages(page)
    await page.route(
      (url) => scenario.memes.some(({ detailSrc }) => detailSrc === url.href),
      (route) =>
        route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
        })
    )
    await page.goto(`/scenarios/${scenario.slug}`)
    const trigger = page.locator('[data-scenario-meme-trigger]').first()
    await trigger.click()
    const dialog = page.locator('[data-scenario-meme-lightbox]')
    const close = dialog.getByRole('button', { name: 'Close meme viewer' })
    await expect(dialog).toBeVisible()
    await expect(close).toHaveCSS('position', 'absolute')
    const dialogBox = await dialog.boundingBox()
    const closeBox = await close.boundingBox()
    const footerBox = await dialog
      .locator('[data-slot="dialog-footer"]')
      .boundingBox()
    if (!dialogBox || !closeBox || !footerBox) {
      throw new Error('Expected the lightbox controls to have layout bounds')
    }
    expect(closeBox.width).toBeGreaterThanOrEqual(44)
    expect(closeBox.height).toBeGreaterThanOrEqual(44)
    expect(closeBox.y - dialogBox.y).toBeGreaterThanOrEqual(0)
    expect(closeBox.y - dialogBox.y).toBeLessThanOrEqual(12)
    expect(
      dialogBox.x + dialogBox.width - (closeBox.x + closeBox.width)
    ).toBeGreaterThanOrEqual(0)
    expect(
      dialogBox.x + dialogBox.width - (closeBox.x + closeBox.width)
    ).toBeLessThanOrEqual(12)
    expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(
      dialogBox.y + dialogBox.height + 1
    )
    expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(viewport.height)
    if (viewport.width <= 620) {
      const imageBox = await dialog
        .locator('[data-scenario-meme-stage]')
        .boundingBox()
      if (!imageBox) throw new Error('Expected a meme image stage')
      expect(
        imageBox.y - (closeBox.y + closeBox.height)
      ).toBeGreaterThanOrEqual(8)
    }
    await dialog.getByRole('button', { name: 'Next meme', exact: true }).click()
    await expect(dialog).toHaveAttribute('data-scenario-meme-index', '1')
    await close.click()
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })
}
