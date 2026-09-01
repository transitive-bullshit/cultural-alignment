import { expect, test } from '@playwright/test'

import { mockOptimizedImages } from './image-fixtures'

test('reserves the slider accent for interaction states', async ({ page }) => {
  await mockOptimizedImages(page)
  await page.goto('/scenarios')

  const slider = page.getByRole('slider', { name: 'Scenario item size' })
  const sliderRoot = page.locator('[data-slot="slider"]')
  const sliderRange = page.locator('[data-slot="slider-range"]')
  const sliderThumb = page.locator('[data-slot="slider-thumb"]')
  const sizeControl = page.locator('[data-gallery-size-control]')
  const accentColor = 'rgb(255, 77, 31)'

  await expect(sliderRange).not.toHaveCSS('background-color', accentColor)
  await expect(sliderThumb).not.toHaveCSS('background-color', accentColor)

  await sliderRoot.hover()
  await expect(sliderRange).toHaveCSS('background-color', accentColor)
  await expect(sliderThumb).toHaveCSS('background-color', accentColor)

  await page.mouse.move(0, 0)
  await expect(sliderRange).not.toHaveCSS('background-color', accentColor)
  await expect(sliderThumb).not.toHaveCSS('background-color', accentColor)

  await slider.focus()
  await expect(sliderRange).toHaveCSS('background-color', accentColor)
  await expect(sliderThumb).toHaveCSS('background-color', accentColor)
  await slider.blur()

  const sliderBounds = await sliderRoot.boundingBox()
  expect(sliderBounds).not.toBeNull()
  await page.mouse.move(
    sliderBounds!.x + sliderBounds!.width / 2,
    sliderBounds!.y + sliderBounds!.height / 2
  )
  await page.mouse.down()
  await page.mouse.move(0, 0)
  await expect(sizeControl).toHaveAttribute('data-size-dragging', '')
  await expect(sliderRange).toHaveCSS('background-color', accentColor)
  await expect(sliderThumb).toHaveCSS('background-color', accentColor)
  await page.mouse.up()
  await slider.blur()

  await expect(sliderRange).not.toHaveCSS('background-color', accentColor)
  await expect(sliderThumb).not.toHaveCSS('background-color', accentColor)
})

test('uses native slider feedback without replacing the gallery cursor', async ({
  page
}) => {
  await mockOptimizedImages(page)
  await page.goto('/scenarios')

  const slider = page.getByRole('slider', { name: 'Scenario item size' })
  const sliderRoot = page.locator('[data-slot="slider"]')
  const sizeControl = page.locator('[data-gallery-size-control]')
  const galleryCursor = page.locator('[data-gallery-cursor]')
  const canvas = page.locator('[data-spatial-gallery="browse"] canvas')

  await slider.hover()
  await expect(slider).toHaveCSS('cursor', 'ew-resize')
  await expect(galleryCursor).toHaveCSS('opacity', '0')

  const initialValue = await slider.getAttribute('aria-valuenow')
  const sliderBounds = await sliderRoot.boundingBox()
  expect(sliderBounds).not.toBeNull()
  await page.mouse.click(
    sliderBounds!.x + sliderBounds!.width - 1,
    sliderBounds!.y + sliderBounds!.height / 2,
    { button: 'right' }
  )
  await expect(slider).toHaveAttribute('aria-valuenow', initialValue!)

  await canvas.waitFor({ state: 'visible', timeout: 15_000 })
  const canvasBounds = await canvas.boundingBox()
  expect(canvasBounds).not.toBeNull()
  await page.mouse.move(
    sliderBounds!.x + sliderBounds!.width / 2,
    sliderBounds!.y + sliderBounds!.height / 2
  )
  await page.mouse.down()
  await page.mouse.move(
    canvasBounds!.x + canvasBounds!.width / 2,
    canvasBounds!.y + canvasBounds!.height / 2
  )
  await expect(sizeControl).toHaveAttribute('data-size-dragging', '')
  await expect(canvas).toHaveCSS('cursor', 'ew-resize')
  await expect(galleryCursor).toHaveCSS('opacity', '0')
  await page.mouse.up()

  await expect(sizeControl).not.toHaveAttribute('data-size-dragging', '')
  await expect(canvas).toHaveCSS('cursor', 'none')
  await expect(galleryCursor).toHaveCSS('opacity', '1')
})

test('cleans up only the active slider pointer when capture is interrupted', async ({
  page
}) => {
  await mockOptimizedImages(page)
  await page.goto('/scenarios')

  const sliderRoot = page.locator('[data-slot="slider"]')
  const sizeControl = page.locator('[data-gallery-size-control]')
  const sliderBounds = await sliderRoot.boundingBox()
  expect(sliderBounds).not.toBeNull()

  await sliderRoot.evaluate((element) => {
    element.addEventListener(
      'pointerdown',
      (event) => {
        const pointerEvent = event as PointerEvent
        element.setAttribute(
          'data-test-active-pointer-id',
          String(pointerEvent.pointerId)
        )
      },
      { capture: true, once: true }
    )
  })
  await page.mouse.move(
    sliderBounds!.x + sliderBounds!.width / 2,
    sliderBounds!.y + sliderBounds!.height / 2
  )
  await page.mouse.down()
  await expect(sizeControl).toHaveAttribute('data-size-dragging', '')

  const activePointerId = Number(
    await sliderRoot.getAttribute('data-test-active-pointer-id')
  )
  await sliderRoot.evaluate((element, pointerId) => {
    element.dispatchEvent(
      new PointerEvent('pointercancel', {
        bubbles: true,
        pointerId: pointerId + 1
      })
    )
  }, activePointerId)
  await expect(sizeControl).toHaveAttribute('data-size-dragging', '')

  await sliderRoot.evaluate((element, pointerId) => {
    element.dispatchEvent(
      new PointerEvent('lostpointercapture', {
        bubbles: true,
        pointerId
      })
    )
  }, activePointerId)
  await expect(sizeControl).not.toHaveAttribute('data-size-dragging', '')
  await page.mouse.up()

  await page.mouse.down()
  await expect(sizeControl).toHaveAttribute('data-size-dragging', '')
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(sizeControl).not.toHaveAttribute('data-size-dragging', '')
  await page.mouse.up()
})
