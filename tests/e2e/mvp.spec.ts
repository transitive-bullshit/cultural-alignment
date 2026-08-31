import { expect, test, type Locator } from '@playwright/test'

import { enterHomepageArchive } from './homepage-helpers'
import { mockOptimizedImages } from './image-fixtures'

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
  await expect(
    page.locator('[data-selected-scenario-link="desktop"]')
  ).toHaveAttribute('href', selectedHref)
})

test.describe('functional phone viewport', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })

  test('filters the scenario gallery through the URL', async ({ page }) => {
    await mockOptimizedImages(page)
    await page.goto('/scenarios')

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
    await expect(page.locator('[data-spatial-gallery="browse"]')).toBeVisible()
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
