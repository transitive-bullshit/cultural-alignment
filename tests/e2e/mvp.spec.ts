import { expect, test } from '@playwright/test'

import concepts from '../../content/snapshot/concepts.json' with { type: 'json' }
import riskFamilies from '../../content/snapshot/risk-families.json' with { type: 'json' }
import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }
import searchDocuments from '../../content/snapshot/search-documents.json' with { type: 'json' }
import sources from '../../content/snapshot/sources.json' with { type: 'json' }

const videoScenario = scenarios.find(
  (scenario) => scenario.featured && scenario.video
)!
const searchTarget = searchDocuments.find(
  (document) => document.kind === 'concept'
)!

const resourceBreadcrumbCases = [
  {
    indexHref: '/risk-families',
    resource: riskFamilies[0]!
  },
  {
    indexHref: '/concepts',
    resource: concepts[0]!
  },
  {
    indexHref: '/sources',
    resource: sources[0]!
  }
] as const

const longestConcept = concepts.reduce((longest, concept) =>
  concept.title.length > longest.title.length ? concept : longest
)

test('gallery state, Markdown copy, and media controls work across a dossier round trip', async ({
  context,
  page
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')

  const gallery = page.locator('[data-spatial-gallery="featured"]')
  const selectedLink = page.locator('[data-selected-scenario-link="desktop"]')

  await expect(gallery).toBeVisible()
  await expect(gallery.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(selectedLink).toBeVisible()

  const initialHref = await selectedLink.getAttribute('href')
  const bounds = await gallery.boundingBox()

  expect(bounds).not.toBeNull()
  await page.mouse.move(
    (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2,
    (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2
  )
  await page.mouse.wheel(0, 1_200)
  await expect
    .poll(() => selectedLink.getAttribute('href'), { timeout: 5_000 })
    .not.toBe(initialHref)

  await selectedLink.click()
  await expect(page).toHaveURL(/\/scenarios\/[a-z0-9-]+$/)
  const selectedHref = new URL(page.url()).pathname

  const copyButton = page.locator('[data-copy-scenario-markdown]')
  await copyButton.click()
  await expect(copyButton).toHaveAttribute('data-state', 'success')
  expect(
    (await page.evaluate(() => navigator.clipboard.readText())).length
  ).toBeGreaterThan(100)

  await page.goBack()
  await expect(page).toHaveURL('/')
  await expect(selectedLink).toHaveAttribute('href', selectedHref)

  await page.goto(`/scenarios/${videoScenario.slug}`)
  const media = page.locator('[data-scenario-media]')
  await media.locator('[data-scenario-media-toggle]').click()
  await expect(media.locator('iframe')).toBeVisible()
  await expect(media).toHaveAttribute('data-playing', 'true')

  await page.mouse.move(0, 0)
  await expect(media).toHaveAttribute('data-controls-visible', 'false', {
    timeout: 5_000
  })
  await media.hover()
  await expect(media).toHaveAttribute('data-controls-visible', 'true')

  await media.locator('[data-scenario-media-toggle]').click()
  await expect(media).not.toHaveAttribute('data-playing', 'true')
  await expect(media).toHaveAttribute('data-controls-visible', 'true')
})

test('resource detail breadcrumbs identify current records and navigate up', async ({
  page
}) => {
  for (const { indexHref, resource } of resourceBreadcrumbCases) {
    await page.goto(`${indexHref}/${resource.slug}`)

    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    const parent = breadcrumb.getByRole('link')
    const current = breadcrumb.locator('[aria-current="page"]')

    await expect(breadcrumb).toBeVisible()
    await expect(parent).toHaveAttribute('href', indexHref)
    await expect(current).toHaveText(resource.title)

    await parent.click()
    await expect(page).toHaveURL(indexHref)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
})

test('long resource breadcrumbs stay within the desktop header', async ({
  page
}) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto(`/concepts/${longestConcept.slug}`)

  const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
  await expect(breadcrumb).toBeVisible()

  const layout = await breadcrumb.evaluate((element) => {
    const header = element.closest('header')
    const wordmark = header?.querySelector<HTMLAnchorElement>('a[href="/"]')
    const primaryNavigation = header?.querySelector<HTMLElement>(
      'nav[aria-label="Primary navigation"]'
    )
    const parent = element.querySelector<HTMLAnchorElement>('a')
    const current = element.querySelector<HTMLElement>('[aria-current="page"]')

    if (!wordmark || !primaryNavigation || !parent || !current) return null

    const breadcrumbBounds = element.getBoundingClientRect()
    const parentText = document.createRange()
    parentText.selectNodeContents(parent)

    return {
      clearsPrimaryNavigation:
        breadcrumbBounds.right <=
        primaryNavigation.getBoundingClientRect().left,
      clearsWordmark:
        breadcrumbBounds.left >= wordmark.getBoundingClientRect().right,
      currentIsTruncated: current.scrollWidth > current.clientWidth,
      parentIsUnderlined:
        getComputedStyle(parent).textDecorationLine.includes('underline'),
      parentLineCount: parentText.getClientRects().length
    }
  })

  expect(layout).toEqual({
    clearsPrimaryNavigation: true,
    clearsWordmark: true,
    currentIsTruncated: true,
    parentIsUnderlined: true,
    parentLineCount: 1
  })
  expect(await hasHorizontalOverflow(page)).toBe(false)
})

test('Command-K search navigates through the generated local index', async ({
  page
}) => {
  await page.goto('/')

  const searchTrigger = page.locator('[data-search-ready="true"]')
  await expect(searchTrigger).toBeVisible()
  await page.keyboard.press('ControlOrMeta+k')

  const searchInput = page.locator('[cmdk-input]')
  await expect(searchInput).toBeFocused()
  await searchInput.fill(searchTarget.title)

  const result = page.locator(`[cmdk-item][data-value="${searchTarget.href}"]`)
  await expect(result).toBeVisible()
  await result.click()
  await expect(page).toHaveURL(searchTarget.href)
})

test('spoiler dismissal persists across reloads', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    window.localStorage.removeItem('cultural-alignment:spoiler-warning:v2')
  })
  await page.reload()

  const spoiler = page.locator('[data-spoiler-warning]')
  await expect(spoiler).toBeVisible()
  await spoiler.click()
  await expect(spoiler).toBeHidden()

  await page.reload()
  await expect(spoiler).toBeHidden()
})

test.describe('functional phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('filtering, gallery selection, and dossier layout stay within the viewport', async ({
    page
  }) => {
    await page.goto('/scenarios')

    const familyFilter = page
      .locator('[data-scenario-family-filters] a[href^="/scenarios?family="]')
      .first()
    const familyHref = await familyFilter.getAttribute('href')
    await familyFilter.click()
    await expect(page).toHaveURL(
      (url) => `${url.pathname}${url.search}` === familyHref
    )
    await expect(familyFilter).toHaveAttribute('data-state', 'on')

    await page.goto('/')
    await expect(
      page.locator('[data-spatial-gallery="featured"]')
    ).toBeVisible()
    await expect(page.locator('[data-selected-scenario-metadata]')).toBeHidden()
    expect(await hasHorizontalOverflow(page)).toBe(false)

    await page.goto(`/scenarios/${videoScenario.slug}`)
    await expect(page.locator('[data-scenario-dossier]')).toBeVisible()
    expect(await hasHorizontalOverflow(page)).toBe(false)
  })
})

async function hasHorizontalOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  )
}
