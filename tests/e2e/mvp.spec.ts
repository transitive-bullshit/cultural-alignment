import { expect, test, type Locator } from '@playwright/test'

import { mockOptimizedImages } from './image-fixtures'
import { disableWebGl2 } from './webgl-fixtures'

test('homepage keeps a curated gallery while the archive exposes the full collection', async ({
  page
}) => {
  await disableWebGl2(page)
  await mockOptimizedImages(page)
  await page.goto('/')

  const gallery = page.locator('[data-spatial-gallery="browse"]')

  await expect(page).toHaveURL('/')
  await expect(page.locator('[data-homepage-signal-loader]')).toBeVisible()
  const homepageItemCount = await readGalleryItemCount(gallery)

  await page.goto('/scenarios')

  await expect(page).toHaveURL('/scenarios')
  await expect(page.locator('[data-scenario-family-filters]')).toBeVisible()
  const archiveItemCount = await readGalleryItemCount(gallery)

  expect(archiveItemCount).toBeGreaterThan(homepageItemCount)
})

test('gallery fallback completes a dossier round trip', async ({ page }) => {
  await disableWebGl2(page)
  await mockOptimizedImages(page)
  await page.goto('/scenarios')

  const gallery = page.locator('[data-spatial-gallery="browse"]')
  const selectedLink = gallery.locator('[data-gallery-fallback] a').first()
  await expect(selectedLink).toBeVisible()
  const selectedHref = await requiredInternalHref(selectedLink)
  const dossierNavigation = page.waitForURL((url) => isScenarioDetail(url), {
    timeout: 15_000,
    waitUntil: 'commit'
  })

  await selectedLink.press('Enter')
  await dossierNavigation
  await expect(page).toHaveURL(selectedHref)
  await expect(page.locator('[data-scenario-dossier]')).toBeVisible()

  const galleryNavigation = page.waitForURL(
    (url) => `${url.pathname}${url.search}${url.hash}` === '/scenarios',
    { timeout: 15_000, waitUntil: 'commit' }
  )
  await page.goBack()
  await galleryNavigation

  await expect(
    gallery.locator(`[data-gallery-fallback] a[href="${selectedHref}"]`)
  ).toBeVisible()
})

test.describe('functional phone viewport', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })

  test('filters the scenario gallery through the URL', async ({ page }) => {
    await disableWebGl2(page)
    await mockOptimizedImages(page)
    await page.goto('/scenarios')

    const gallery = page.locator('[data-spatial-gallery="browse"]')

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

async function readGalleryItemCount(gallery: Locator) {
  const count = Number(await gallery.getAttribute('data-gallery-item-count'))

  expect(Number.isInteger(count)).toBe(true)
  expect(count).toBeGreaterThan(0)
  return count
}

function matchesInternalHref(url: URL, href: string) {
  return `${url.pathname}${url.search}${url.hash}` === href
}

function isScenarioDetail(url: URL) {
  return /^\/scenarios\/[^/]+$/.test(url.pathname)
}
