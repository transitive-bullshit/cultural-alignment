import { expect, test } from '@playwright/test'

import { mockOptimizedImages } from './image-fixtures'
import { disableWebGl2 } from './webgl-fixtures'

const storageKey = 'cultural-alignment:gallery-item-size:v1'

test('hydrates and persists size across pointer changes, keyboard changes, and reload', async ({
  page
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript((key) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, '110')
  }, storageKey)
  await disableWebGl2(page)
  await mockOptimizedImages(page)
  await page.goto('/scenarios')

  const gallery = page.locator('[data-spatial-gallery="browse"]')
  const slider = page.getByRole('slider', { name: 'Scenario item size' })
  await page.locator('[data-gallery-intro-dismiss]').click()
  await expect(slider).toBeEnabled()
  await expect(slider).toHaveAttribute('aria-valuenow', '110')
  await expect(gallery).toHaveAttribute('data-gallery-item-size', '110')

  const thumb = await slider.boundingBox()
  const track = await page
    .locator('[data-gallery-size-control] [data-slot="slider-track"]')
    .boundingBox()
  if (!thumb || !track) throw new Error('Expected a measured size slider')
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    thumb.x + thumb.width / 2 + track.width * 0.15,
    thumb.y + thumb.height / 2
  )
  const pointerValue = Number(await slider.getAttribute('aria-valuenow'))
  expect(pointerValue).toBeGreaterThan(110)
  expect(pointerValue).toBeLessThan(195)
  await expect(gallery).toHaveAttribute(
    'data-gallery-item-size',
    String(pointerValue)
  )
  await expect(gallery).toHaveAttribute(
    'data-gallery-item-size-transition',
    'smooth'
  )

  await page.mouse.up()
  await slider.press('ArrowRight')
  const keyboardValue = pointerValue + 5
  await expect(slider).toHaveAttribute('aria-valuenow', String(keyboardValue))
  await expect(gallery).toHaveAttribute(
    'data-gallery-item-size',
    String(keyboardValue)
  )
  await expect(gallery).toHaveAttribute(
    'data-gallery-item-size-transition',
    'instant'
  )
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
    .toBe(String(keyboardValue))

  await page.reload()
  await expect(slider).toHaveAttribute('aria-valuenow', String(keyboardValue))
  await expect(gallery).toHaveAttribute(
    'data-gallery-item-size',
    String(keyboardValue)
  )
  await expect(gallery).toHaveAttribute(
    'data-gallery-item-size-transition',
    'instant'
  )
  expect(errors).toEqual([])
})
