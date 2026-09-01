import { expect, test } from '@playwright/test'

import { GALLERY_ITEM_SIZE_STORAGE_KEY } from '../../features/spatial-gallery/gallery-item-size-preference'
import { enterHomepageArchive } from './homepage-helpers'
import { mockOptimizedImages } from './image-fixtures'
import { disableWebGl2 } from './webgl-fixtures'

type PreferenceTestWindow = typeof window & {
  __galleryItemSizeWrites: string[]
}

type SizingMotionTestWindow = typeof window & {
  __gallerySizingStates: Array<{
    itemSize: string | undefined
    lanes: string | undefined
    motion: string | undefined
    targetLanes: string | undefined
  }>
}

test.use({ viewport: { height: 900, width: 1_440 } })

test('persists gallery density and applies it to the control-free homepage', async ({
  page
}) => {
  await page.addInitScript(
    ({ storageKey }) => {
      const testWindow = window as PreferenceTestWindow
      const storage = window.localStorage
      const setItem = storage.setItem.bind(storage)
      testWindow.__galleryItemSizeWrites = []

      storage.setItem = (key, value) => {
        if (key === storageKey) testWindow.__galleryItemSizeWrites.push(value)
        setItem(key, value)
      }
    },
    { storageKey: GALLERY_ITEM_SIZE_STORAGE_KEY }
  )
  await mockOptimizedImages(page)
  await page.goto('/scenarios')

  const slider = page.getByRole('slider', { name: 'Scenario item size' })
  const gallery = page.locator('[data-spatial-gallery="browse"]')

  await expect(slider).toHaveAttribute('aria-valuenow', '100')
  await slider.press('End')
  await slider.press('ArrowLeft')

  await expect(slider).toHaveAttribute('aria-valuenow', '195')
  await expect(gallery).toHaveAttribute('data-gallery-item-size', '195')
  await expect(gallery.locator('canvas')).toHaveAttribute(
    'data-gallery-lanes',
    '2',
    { timeout: 15_000 }
  )
  await expect
    .poll(() =>
      page.evaluate(
        (storageKey) => window.localStorage.getItem(storageKey),
        GALLERY_ITEM_SIZE_STORAGE_KEY
      )
    )
    .toBe('195')
  const persistedValues = await page.evaluate(
    () => (window as PreferenceTestWindow).__galleryItemSizeWrites
  )
  expect(persistedValues.at(-1)).toBe('195')

  await page.reload()
  await expect(slider).toHaveAttribute('aria-valuenow', '195')
  await expect(gallery).toHaveAttribute('data-gallery-item-size', '195')

  const familyFilter = page
    .locator('[data-scenario-family-filters] a[href^="/scenarios?family="]')
    .first()
  const filterNavigation = page.waitForURL(
    (url) => url.pathname === '/scenarios' && url.searchParams.has('family'),
    { timeout: 15_000, waitUntil: 'commit' }
  )
  await familyFilter.click()
  await filterNavigation

  await expect(slider).toHaveAttribute('aria-valuenow', '195')
  await expect(gallery).toHaveAttribute('data-gallery-item-size', '195')

  await page.goto('/')
  await expect(page.locator('[data-gallery-size-control]')).toHaveCount(0)
  await expect(page.getByRole('slider')).toHaveCount(0)
  await expect(gallery).toHaveAttribute('data-gallery-item-size', '195')
  await enterHomepageArchive(page)
  await expect(gallery.locator('canvas')).toHaveAttribute(
    'data-gallery-lanes',
    '2',
    { timeout: 15_000 }
  )
})

test('flushes an in-flight gallery size when the page hides', async ({
  page
}) => {
  await mockOptimizedImages(page)
  await page.goto('/scenarios')

  const slider = page.getByRole('slider', { name: 'Scenario item size' })
  await expect(slider).toHaveAttribute('aria-valuenow', '100')

  const storedValueAtPageHide = await slider.evaluate((element, storageKey) => {
    element.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'End' })
    )
    window.dispatchEvent(new PageTransitionEvent('pagehide'))

    return window.localStorage.getItem(storageKey)
  }, GALLERY_ITEM_SIZE_STORAGE_KEY)
  expect(storedValueAtPageHide).toBe('200')

  await page.reload()
  await expect(slider).toHaveAttribute('aria-valuenow', '200')
})

test('debounces rapid gallery size storage writes', async ({ page }) => {
  await page.addInitScript(
    ({ storageKey }) => {
      const testWindow = window as PreferenceTestWindow
      const storage = window.localStorage
      const setItem = storage.setItem.bind(storage)
      testWindow.__galleryItemSizeWrites = []

      storage.setItem = (key, value) => {
        if (key === storageKey) testWindow.__galleryItemSizeWrites.push(value)
        setItem(key, value)
      }
    },
    { storageKey: GALLERY_ITEM_SIZE_STORAGE_KEY }
  )
  await disableWebGl2(page)
  await mockOptimizedImages(page)
  await page.goto('/scenarios')
  await page.clock.install()
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100)

  const slider = page.getByRole('slider', { name: 'Scenario item size' })
  await slider.press('End')
  await slider.press('ArrowLeft')
  await slider.press('ArrowLeft')
  await expect(slider).toHaveAttribute('aria-valuenow', '190')
  expect(
    await page.evaluate(
      () => (window as PreferenceTestWindow).__galleryItemSizeWrites
    )
  ).toEqual([])

  await page.clock.fastForward(249)
  expect(
    await page.evaluate(
      () => (window as PreferenceTestWindow).__galleryItemSizeWrites
    )
  ).toEqual([])

  await page.clock.fastForward(1)
  expect(
    await page.evaluate(
      () => (window as PreferenceTestWindow).__galleryItemSizeWrites
    )
  ).toEqual(['190'])
})

test('keeps the selected scenario centered across lane-count changes', async ({
  page
}) => {
  await mockOptimizedImages(page)
  await page.goto('/scenarios')

  const gallery = page.locator('[data-spatial-gallery="browse"]')
  const canvas = gallery.locator('canvas')
  const slider = page.getByRole('slider', { name: 'Scenario item size' })
  await expect(canvas).toHaveAttribute('data-gallery-lanes', '5', {
    timeout: 15_000
  })
  await expect(canvas).toHaveAttribute('data-gallery-intro-motion', 'settled', {
    timeout: 15_000
  })
  const canvasBounds = await canvas.boundingBox()
  expect(canvasBounds).not.toBeNull()
  await canvas.hover({
    position: {
      x: canvasBounds!.width * 0.55,
      y: canvasBounds!.height / 2
    }
  })
  await expect(gallery).toHaveAttribute('data-selected-scenario-id', /.+/, {
    timeout: 15_000
  })
  const selectedScenarioId = await gallery.getAttribute(
    'data-selected-scenario-id'
  )

  await slider.focus()
  await slider.press('Home')
  await expect(canvas).toHaveAttribute('data-gallery-lanes', '7')
  await expect(gallery).toHaveAttribute(
    'data-selected-scenario-id',
    selectedScenarioId!,
    { timeout: 15_000 }
  )

  await slider.press('End')
  await expect(canvas).toHaveAttribute('data-gallery-lanes', '2')
  await expect(gallery).toHaveAttribute(
    'data-selected-scenario-id',
    selectedScenarioId!,
    { timeout: 15_000 }
  )
})

test('smoothly retargets an interrupted pointer resize', async ({ page }) => {
  await mockOptimizedImages(page)
  await page.goto('/scenarios')

  const slider = page.getByRole('slider', { name: 'Scenario item size' })
  const sliderRoot = page.locator('[data-slot="slider"]')
  const gallery = page.locator('[data-spatial-gallery="browse"]')
  const canvas = gallery.locator('canvas')
  await expect(canvas).toHaveAttribute('data-gallery-lanes', '5', {
    timeout: 15_000
  })

  const sliderBounds = await sliderRoot.boundingBox()
  expect(sliderBounds).not.toBeNull()
  await canvas.evaluate((element) => {
    const testWindow = window as SizingMotionTestWindow
    const record = () => {
      testWindow.__gallerySizingStates.push({
        itemSize: element.dataset.galleryItemSize,
        lanes: element.dataset.galleryLanes,
        motion: element.dataset.gallerySizingMotion,
        targetLanes: element.dataset.galleryTargetLanes
      })
    }
    testWindow.__gallerySizingStates = []
    new MutationObserver(record).observe(element, {
      attributeFilter: [
        'data-gallery-item-size',
        'data-gallery-lanes',
        'data-gallery-sizing-motion',
        'data-gallery-target-lanes'
      ],
      attributes: true
    })
    record()
  })
  const sliderY = sliderBounds!.y + sliderBounds!.height / 2
  await page.mouse.move(sliderBounds!.x + sliderBounds!.width / 2, sliderY)
  await page.mouse.down()
  await page.mouse.move(sliderBounds!.x + sliderBounds!.width - 1, sliderY)
  await page.waitForTimeout(50)
  await page.mouse.move(sliderBounds!.x + 1, sliderY)
  await page.mouse.up()

  await expect(slider).toHaveAttribute('aria-valuenow', '70')
  await expect(gallery).toHaveAttribute(
    'data-gallery-item-size-transition',
    'smooth'
  )
  await expect(canvas).toHaveAttribute('data-gallery-lanes', '7')
  await expect(canvas).toHaveAttribute('data-gallery-sizing-motion', 'settled')

  const sizingStates = await page.evaluate(
    () => (window as SizingMotionTestWindow).__gallerySizingStates
  )
  const expansionIndex = sizingStates.findIndex(
    ({ itemSize, motion, targetLanes }) =>
      itemSize === '200' && motion === 'running' && targetLanes === '2'
  )
  const reversalIndex = sizingStates.findIndex(
    ({ itemSize, motion, targetLanes }, index) =>
      index > expansionIndex &&
      itemSize === '70' &&
      motion === 'running' &&
      targetLanes === '7'
  )
  expect(expansionIndex).toBeGreaterThanOrEqual(0)
  expect(reversalIndex).toBeGreaterThan(expansionIndex)
})
