import { expect, test, type Locator, type Page } from '@playwright/test'

import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }
import { GALLERY_ITEM_SIZE_STORAGE_KEY } from '../../features/spatial-gallery/gallery-item-size-preference'
import { FEATURED_SCENARIO_TAG } from '../../lib/content/catalog'
import { getGalleryViewportMetrics } from '../../features/spatial-gallery/gallery-sizing'
import { isMobileGalleryViewport } from '../../features/spatial-gallery/texture-residency'
import { enterHomepageArchive } from './homepage-helpers'
import { mockOptimizedImages } from './image-fixtures'
import { disableWebGl2 } from './webgl-fixtures'

test('homepage shows Notion-featured scenarios while the archive keeps all scenarios', async ({
  page
}) => {
  const featuredScenarioCount = scenarios.filter(({ tags }) =>
    tags.some((tag) => tag === FEATURED_SCENARIO_TAG)
  ).length

  expect(featuredScenarioCount).toBeGreaterThan(0)
  expect(featuredScenarioCount).toBeLessThan(scenarios.length)

  await disableWebGl2(page)
  await mockOptimizedImages(page)
  await page.goto('/')

  const gallery = page.locator('[data-spatial-gallery="browse"]')

  await expect(page).toHaveURL('/')
  await expect(page.locator('[data-homepage-signal-loader]')).toBeVisible()
  await expect(
    page.locator('[data-signal-loader-scene-count]')
  ).toHaveAttribute('data-signal-loader-scene-count', String(scenarios.length))
  await expect(gallery).toHaveAttribute(
    'data-gallery-item-count',
    String(featuredScenarioCount)
  )

  await page.goto('/scenarios')

  await expect(page).toHaveURL('/scenarios')
  await expect(page.locator('[data-scenario-family-filters]')).toBeVisible()
  await expect(gallery).toHaveAttribute(
    'data-gallery-item-count',
    String(scenarios.length)
  )
})

test('gallery navigation restores the selected scenario after a dossier round trip', async ({
  page
}) => {
  await mockOptimizedImages(page)
  await page.goto('/')
  await enterHomepageArchive(page)

  const gallery = page.locator('[data-spatial-gallery="browse"]')
  const canvas = gallery.locator('canvas')

  await canvas.waitFor({ state: 'visible', timeout: 15_000 })
  await page.mouse.move(0, 0)
  await canvas.hover()
  await expect(gallery).toHaveAttribute('data-selected-scenario-id', /.+/, {
    timeout: 15_000
  })

  const selectedLink = page.locator('[data-selected-scenario-link="desktop"]')
  const dossierNavigation = page.waitForURL((url) => isScenarioDetail(url), {
    timeout: 15_000,
    waitUntil: 'commit'
  })

  await selectedLink.click()
  await dossierNavigation
  const selectedHref = new URL(page.url()).pathname
  await expect(page.locator('[data-scenario-dossier]')).toBeVisible()

  const galleryNavigation = page.waitForURL(
    (url) => `${url.pathname}${url.search}${url.hash}` === '/',
    { timeout: 15_000, waitUntil: 'commit' }
  )
  await page.goBack()
  await galleryNavigation
  await enterHomepageArchive(page)

  await expect(gallery).toHaveAttribute('data-selected-scenario-id', /.+/, {
    timeout: 15_000
  })
  const restoredScenarioId = await gallery.getAttribute(
    'data-selected-scenario-id'
  )
  await expect(
    page.locator('[data-selected-scenario-link="desktop"]')
  ).toHaveAttribute('href', selectedHref)

  await page.evaluate((storageKey) => {
    window.localStorage.setItem(storageKey, '200')
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: storageKey,
        newValue: '200',
        storageArea: window.localStorage
      })
    )
  }, GALLERY_ITEM_SIZE_STORAGE_KEY)
  await expect(gallery).toHaveAttribute('data-gallery-item-size', '200')
  await expect(canvas).toHaveAttribute('data-gallery-sizing-motion', 'settled')
  await expect(gallery).toHaveAttribute(
    'data-selected-scenario-id',
    restoredScenarioId!
  )
})

test('restores a desktop selection into the visible mobile gallery', async ({
  page
}) => {
  await mockOptimizedImages(page)
  await page.setViewportSize({ height: 900, width: 1_440 })
  await page.goto('/scenarios')

  const gallery = page.locator('[data-spatial-gallery="browse"]')
  const canvas = gallery.locator('canvas')

  await expect(canvas).toHaveAttribute('data-gallery-lanes', '5', {
    timeout: 15_000
  })
  await canvas.hover()
  await expect(gallery).toHaveAttribute('data-selected-scenario-id', /.+/, {
    timeout: 15_000
  })

  const initialScenarioId = await gallery.getAttribute(
    'data-selected-scenario-id'
  )
  await hoverAnotherVisibleScenario(page, gallery, canvas, initialScenarioId!)
  const selectedScenarioId = await gallery.getAttribute(
    'data-selected-scenario-id'
  )
  expect(selectedScenarioId).not.toBe(initialScenarioId)
  const selectedLink = page.locator('[data-selected-scenario-link="desktop"]')
  const selectedHref = await requiredInternalHref(selectedLink)
  const dossierNavigation = page.waitForURL((url) => isScenarioDetail(url), {
    timeout: 15_000,
    waitUntil: 'commit'
  })

  await selectedLink.click()
  await dossierNavigation
  await expect(page.locator('[data-scenario-dossier]')).toBeVisible()

  await page.setViewportSize({ height: 844, width: 390 })
  const galleryNavigation = page.waitForURL(
    (url) => `${url.pathname}${url.search}${url.hash}` === '/scenarios',
    { timeout: 15_000, waitUntil: 'commit' }
  )
  await page.goBack()
  await galleryNavigation

  await expect(canvas).toHaveAttribute('data-gallery-lanes', '4', {
    timeout: 15_000
  })
  await expect(canvas).toHaveAttribute('data-gallery-intro-motion', 'skipped')
  await expect(gallery).toHaveAttribute(
    'data-selected-scenario-id',
    selectedScenarioId!
  )
  await expect(
    page.locator('[data-selected-scenario-link="mobile"]')
  ).toHaveAttribute('href', selectedHref)

  await hoverAnotherVisibleScenario(page, gallery, canvas, selectedScenarioId!)
  const restoredFramePoint = await findVisibleScenario(
    page,
    gallery,
    canvas,
    selectedScenarioId!
  )

  expect(restoredFramePoint).not.toBeNull()
  expect(restoredFramePoint!.xFraction).toBeGreaterThanOrEqual(0.35)
  expect(restoredFramePoint!.xFraction).toBeLessThanOrEqual(0.65)
})

test.describe('functional phone viewport', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })

  test('filters the scenario gallery through the URL', async ({ page }) => {
    await mockOptimizedImages(page)
    await page.goto('/scenarios')

    const sizeSlider = page.getByRole('slider', {
      name: 'Scenario item size'
    })
    const sizeControl = page.locator('[data-gallery-size-control]')
    const gallery = page.locator('[data-spatial-gallery="browse"]')
    await expect(sizeSlider).toBeVisible()
    const sizeControlBounds = await sizeControl.boundingBox()
    expect(sizeControlBounds).not.toBeNull()
    expect(sizeControlBounds!.x).toBeGreaterThanOrEqual(0)
    expect(sizeControlBounds!.x + sizeControlBounds!.width).toBeLessThanOrEqual(
      390
    )

    await sizeSlider.press('Home')
    await expect(gallery).toHaveAttribute('data-gallery-item-size', '70')
    await expect(gallery.locator('canvas')).toHaveAttribute(
      'data-gallery-lanes',
      '5',
      { timeout: 15_000 }
    )

    const familyFilter = page
      .locator('[data-scenario-family-filters] a[href^="/scenarios?family="]')
      .first()

    const familyHref = await requiredInternalHref(familyFilter)
    const navigation = page.waitForURL(
      (url) => matchesInternalHref(url, familyHref),
      { timeout: 15_000, waitUntil: 'commit' }
    )

    await familyFilter.click()
    await navigation

    await expect(
      page.locator(`[data-scenario-family-filters] a[href="${familyHref}"]`)
    ).toHaveAttribute('data-state', 'on')
    await expect(sizeSlider).toHaveAttribute('aria-valuenow', '70')
    await expect(gallery).toHaveAttribute('data-gallery-item-size', '70')
    await expect(gallery).toBeVisible()
  })
})

async function requiredInternalHref(locator: Locator) {
  const href = await locator.getAttribute('href')

  if (!href?.startsWith('/')) {
    throw new Error('Expected an internal navigation link')
  }

  return href
}

function matchesInternalHref(url: URL, href: string) {
  return `${url.pathname}${url.search}${url.hash}` === href
}

function isScenarioDetail(url: URL) {
  return /^\/scenarios\/[^/]+$/.test(url.pathname)
}

async function hoverAnotherVisibleScenario(
  page: Page,
  gallery: Locator,
  canvas: Locator,
  scenarioId: string
) {
  const canvasBounds = await canvas.boundingBox()
  expect(canvasBounds).not.toBeNull()
  const laneProbes = await getLaneProbeFractions(canvas, canvasBounds!)

  for (const xFraction of [0.12, 0.88]) {
    for (const yFraction of laneProbes) {
      await page.mouse.move(
        canvasBounds!.x + canvasBounds!.width * xFraction,
        canvasBounds!.y + canvasBounds!.height * yFraction
      )
      await page.waitForTimeout(80)
      const hoveredScenarioId = await gallery.getAttribute(
        'data-selected-scenario-id'
      )
      if (hoveredScenarioId && hoveredScenarioId !== scenarioId) return
    }
  }

  throw new Error(
    'Expected another scenario to be visible beside the selection'
  )
}

async function findVisibleScenario(
  page: Page,
  gallery: Locator,
  canvas: Locator,
  scenarioId: string
) {
  const canvasBounds = await canvas.boundingBox()
  expect(canvasBounds).not.toBeNull()
  const laneProbes = await getLaneProbeFractions(canvas, canvasBounds!)

  for (const xFraction of [0.5, 0.35, 0.65]) {
    for (const yFraction of laneProbes) {
      await page.mouse.move(
        canvasBounds!.x + canvasBounds!.width * xFraction,
        canvasBounds!.y + canvasBounds!.height * yFraction
      )
      await page.waitForTimeout(80)
      if (
        (await gallery.getAttribute('data-selected-scenario-id')) === scenarioId
      ) {
        return { xFraction, yFraction }
      }
    }
  }

  return null
}

async function getLaneProbeFractions(
  canvas: Locator,
  canvasBounds: Readonly<{ height: number; width: number }>
) {
  const itemSize = Number(
    (await canvas.getAttribute('data-gallery-item-size')) ?? Number.NaN
  )
  expect(itemSize).toBeGreaterThan(0)

  const { lanes, rowPitchPixels } = getGalleryViewportMetrics(
    isMobileGalleryViewport(canvasBounds.width),
    canvasBounds.width,
    canvasBounds.height,
    itemSize
  )

  return Array.from(
    { length: lanes },
    (_, lane) =>
      0.5 + ((lane - (lanes - 1) / 2) * rowPitchPixels) / canvasBounds.height
  )
}
