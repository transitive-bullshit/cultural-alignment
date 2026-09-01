import { expect, test, type Page } from '@playwright/test'

import { mockOptimizedImages } from './image-fixtures'
import { disableWebGl2 } from './webgl-fixtures'

type LaneSequenceTestWindow = typeof window & {
  __galleryLaneSequence: number[]
}

test.use({ viewport: { height: 900, width: 1_440 } })

test('the no-WebGL gallery fallback reflows with the size preference', async ({
  page
}) => {
  await disableWebGl2(page)
  await mockOptimizedImages(page)
  await page.goto('/scenarios')

  const slider = page.getByRole('slider', { name: 'Scenario item size' })
  const fallback = page.locator('[data-gallery-fallback]')
  const firstFrame = fallback.locator('li').first()

  await expect(fallback).toHaveCSS('display', 'block')
  await expect(fallback).toHaveAttribute('data-gallery-lanes', '5')
  const defaultFrameBounds = await requiredBounds(firstFrame)

  await slider.press('Home')
  await expect(fallback).toHaveAttribute('data-gallery-lanes', '7')
  const compactFrameBounds = await requiredBounds(firstFrame)
  expect(compactFrameBounds.width).toBeLessThan(defaultFrameBounds.width)

  await slider.press('End')
  await expect(fallback).toHaveAttribute('data-gallery-lanes', '2')
  const expandedFrameBounds = await requiredBounds(firstFrame)
  expect(expandedFrameBounds.width).toBeGreaterThan(defaultFrameBounds.width)

  const sliderBounds = await requiredBounds(
    page.locator('[data-slot="slider"]')
  )
  const sliderY = sliderBounds.y + sliderBounds.height / 2
  await page.mouse.move(sliderBounds.x + sliderBounds.width - 1, sliderY)
  await page.mouse.down()
  await page.mouse.move(sliderBounds.x + sliderBounds.width / 2, sliderY)

  await expect(slider).toHaveAttribute('aria-valuenow', '135')
  await expect(fallback).toHaveAttribute('data-gallery-layout-motion', 'smooth')
  await expect(firstFrame).toHaveCSS(
    'transition-property',
    'width, height, transform'
  )
  await page.mouse.up()

  await expect(page.locator('[data-spatial-gallery="browse"]')).toHaveAttribute(
    'data-gallery-item-size-transition',
    'instant'
  )
  await expect(fallback).toHaveAttribute(
    'data-gallery-layout-motion',
    'instant'
  )
  await expect(firstFrame).toHaveCSS('transition-property', 'none')

  await page.setViewportSize({ height: 840, width: 1_400 })
  await expect(fallback).toHaveAttribute(
    'data-gallery-layout-motion',
    'instant'
  )
  await expect(firstFrame).toHaveCSS('transition-property', 'none')
})

test.describe('landscape phone gallery sizing', () => {
  test.use({ hasTouch: true, viewport: { height: 375, width: 667 } })

  test('keeps one complete lane visible at the maximum item size', async ({
    page
  }) => {
    await mockOptimizedImages(page)
    await page.goto('/scenarios')

    const slider = page.getByRole('slider', { name: 'Scenario item size' })
    const gallery = page.locator('[data-spatial-gallery="browse"]')

    await slider.press('End')
    await expect(gallery).toHaveAttribute('data-gallery-item-size', '200')
    await expect(gallery.locator('canvas')).toHaveAttribute(
      'data-gallery-lanes',
      '1',
      { timeout: 15_000 }
    )
  })
})

test.describe('portrait phone gallery sizing', () => {
  test.use({ viewport: { height: 844, width: 390 } })

  test('renders each intermediate row count during a pointer resize', async ({
    page
  }) => {
    await mockOptimizedImages(page)
    await page.goto('/scenarios')

    const slider = page.getByRole('slider', { name: 'Scenario item size' })
    const sliderRoot = page.locator('[data-slot="slider"]')
    const canvas = page.locator('[data-spatial-gallery="browse"] canvas')

    await slider.press('Home')
    await expect(canvas).toHaveAttribute('data-gallery-lanes', '5', {
      timeout: 15_000
    })
    await canvas.evaluate((element) => {
      const testWindow = window as LaneSequenceTestWindow
      const record = () => {
        const lanes = Number(element.dataset.galleryLanes)
        if (
          Number.isInteger(lanes) &&
          testWindow.__galleryLaneSequence.at(-1) !== lanes
        ) {
          testWindow.__galleryLaneSequence.push(lanes)
        }
      }

      testWindow.__galleryLaneSequence = []
      new MutationObserver(record).observe(element, {
        attributeFilter: ['data-gallery-lanes'],
        attributes: true
      })
      record()
    })

    const sliderBounds = await requiredBounds(sliderRoot)
    const sliderY = sliderBounds.y + sliderBounds.height / 2
    await page.mouse.move(sliderBounds.x + 1, sliderY)
    await page.mouse.down()
    await page.mouse.move(sliderBounds.x + sliderBounds.width - 1, sliderY)
    await page.mouse.up()

    await expect(slider).toHaveAttribute('aria-valuenow', '200')
    await expect(canvas).toHaveAttribute('data-gallery-lanes', '2', {
      timeout: 15_000
    })
    await expect(canvas).toHaveAttribute(
      'data-gallery-sizing-motion',
      'settled'
    )

    const laneSequence = await page.evaluate(
      () => (window as LaneSequenceTestWindow).__galleryLaneSequence
    )
    expect(laneSequence).toEqual([5, 4, 3, 2])
    expect(
      laneSequence.every(
        (lanes, index) =>
          index === 0 || Math.abs(lanes - laneSequence[index - 1]!) <= 1
      )
    ).toBe(true)
  })
})

test.describe('compact tablet gallery toolbar', () => {
  test.use({ viewport: { height: 800, width: 768 } })

  test('keeps the scrollable filters clear of the size control', async ({
    page
  }) => {
    await disableWebGl2(page)
    await mockOptimizedImages(page)
    await page.goto('/scenarios')

    const filters = await requiredBounds(
      page.locator('[data-scenario-family-filters]')
    )
    const sizeControl = await requiredBounds(
      page.locator('[data-gallery-size-control]')
    )

    expect(filters.x + filters.width).toBeLessThanOrEqual(sizeControl.x + 1)
  })
})

async function requiredBounds(locator: ReturnType<Page['locator']>) {
  const bounds = await locator.boundingBox()
  expect(bounds).not.toBeNull()
  return bounds!
}
