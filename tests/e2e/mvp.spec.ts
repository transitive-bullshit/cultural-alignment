import { expect, test, type Locator, type Page } from '@playwright/test'

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
  await expectGalleryIntroComposition(page)
  await expect(gallery).not.toHaveAttribute(
    'data-gallery-inertia-burst-requested'
  )
  await acknowledgeGalleryIntro(page)
  await expect(gallery).toHaveAttribute(
    'data-gallery-inertia-burst-requested',
    'true'
  )
  const homepageItemCount = await readGalleryItemCount(gallery)

  await openScenariosFromHeader(page)

  await expect(page).toHaveURL('/scenarios')
  await expectGalleryIntroDismissed(page)
  await expect(page.locator('[data-scenario-family-filters]')).toBeVisible()
  const archiveItemCount = await readGalleryItemCount(gallery)

  expect(archiveItemCount).toBeGreaterThan(homepageItemCount)

  await page.goBack()
  await expect(page).toHaveURL('/')
  await expectGalleryIntroVisible(page)
})

test('scenario acknowledgement does not suppress the landing introduction', async ({
  page
}) => {
  await disableWebGl2(page)
  await mockOptimizedImages(page)
  await page.goto('/scenarios')

  await expectGalleryIntroVisible(page)
  await page.keyboard.press('Escape')
  await expectGalleryIntroDismissed(page)
  await page.reload()

  await expectGalleryIntroDismissed(page)
  await openHomeFromHeader(page)

  await expectGalleryIntroVisible(page)
  await expect(page.locator('[data-homepage-words]')).toBeVisible()
})

test('explicit dismissal suppresses the introduction across both galleries', async ({
  page
}) => {
  await disableWebGl2(page)
  await mockOptimizedImages(page)
  await page.goto('/scenarios')

  await explicitlyDismissGalleryIntro(page)
  await openHomeFromHeader(page)
  await expectGalleryIntroDismissed(page)

  await page.reload()
  await expectGalleryIntroDismissed(page)
})

test('gallery fallback completes a dossier round trip', async ({ page }) => {
  await disableWebGl2(page)
  await mockOptimizedImages(page)
  await page.goto('/scenarios')
  await acknowledgeGalleryIntro(page)

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
    await acknowledgeGalleryIntro(page)

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

async function acknowledgeGalleryIntro(page: Page) {
  const introduction = page.locator('[data-gallery-intro]')

  await expectGalleryIntroVisible(page)
  await page.locator('[data-gallery-intro-dismiss]').click()
  await expect(introduction).toHaveAttribute('data-state', 'dismissed')
}

async function explicitlyDismissGalleryIntro(page: Page) {
  const introduction = page.locator('[data-gallery-intro]')

  await expectGalleryIntroVisible(page)
  await page.locator('[data-gallery-intro-close]').click()
  await expect(introduction).toHaveAttribute('data-state', 'dismissed')
}

async function expectGalleryIntroVisible(page: Page) {
  await expect(page.locator('[data-gallery-intro]')).toHaveAttribute(
    'data-state',
    'visible'
  )
  await expect(page.locator('[data-gallery-intro-dialog]')).toBeVisible()
}

async function expectGalleryIntroComposition(page: Page) {
  const dialog = page.locator('[data-gallery-intro-dialog]')
  const exampleImage = dialog.locator('[data-gallery-intro-example-image]')

  await expect(dialog.locator('[data-slot="dialog-title"]')).toBeVisible()
  await expect(
    dialog.locator('[data-gallery-intro-example-label]')
  ).toBeVisible()
  await expect(exampleImage).toBeVisible()
  await expect(exampleImage).toHaveAttribute('src', /\S/)
  await expect(exampleImage).toHaveAttribute('alt', /\S/)
  await expect(dialog.locator('[data-gallery-intro-dismiss]')).toHaveAttribute(
    'data-slot',
    'button'
  )
}

async function expectGalleryIntroDismissed(page: Page) {
  await expect(page.locator('[data-gallery-intro]')).toHaveAttribute(
    'data-state',
    'dismissed'
  )
  await expect(page.locator('[data-gallery-intro-dialog]')).toBeHidden()
}

async function openHomeFromHeader(page: Page) {
  const navigation = page.waitForURL((url) => url.pathname === '/', {
    waitUntil: 'commit'
  })

  await page.locator('[data-site-header] a[href="/"]').first().click()
  await navigation
}

async function openScenariosFromHeader(page: Page) {
  const navigation = page.waitForURL((url) => url.pathname === '/scenarios', {
    waitUntil: 'commit'
  })

  await page
    .locator(
      '[data-site-navigation="desktop"] [data-site-navigation-link="/scenarios"]'
    )
    .click()
  await navigation
}

function matchesInternalHref(url: URL, href: string) {
  return `${url.pathname}${url.search}${url.hash}` === href
}

function isScenarioDetail(url: URL) {
  return /^\/scenarios\/[^/]+$/.test(url.pathname)
}
