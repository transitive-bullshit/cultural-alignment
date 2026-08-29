import { expect, test } from '@playwright/test'
import sharp from 'sharp'

import concepts from '../../content/snapshot/concepts.json' with { type: 'json' }
import riskFamilies from '../../content/snapshot/risk-families.json' with { type: 'json' }
import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }
import searchDocuments from '../../content/snapshot/search-documents.json' with { type: 'json' }
import sources from '../../content/snapshot/sources.json' with { type: 'json' }

const videoScenario = scenarios.find(
  (scenario) => scenario.featured && scenario.video
)!
const stillOnlyScenario = requireFixture(
  scenarios.find((scenario) => !scenario.video),
  'a scenario without video'
)
const searchTarget = searchDocuments.find(
  (document) => document.kind === 'concept'
)!
const sourceById = new Map(sources.map((source) => [source.id, source]))
const socialScenario = requireFixture(
  scenarios.find(
    (scenario) => scenario.image.detailSrc && scenario.image.alt.trim()
  ),
  'a scenario with a social image'
)
const socialScenarioSource = requireFixture(
  sourceById.get(socialScenario.sourceId),
  'the social scenario source'
)
const sourceScenarioCases = sources.map((source) => ({
  href: `/sources/${source.slug}`,
  items: scenarios.filter((scenario) => scenario.sourceId === source.id)
}))
const sortableScenarioCollection = requireFixture(
  sourceScenarioCases.find(({ items }) => {
    if (items.length <= 3 || items.some(({ releaseDate }) => !releaseDate)) {
      return false
    }

    const dates = items.map(({ releaseDate }) => releaseDate!)

    return (
      new Set(dates).size > 1 &&
      !isReleaseDateOrder(dates, 'newest') &&
      !isReleaseDateOrder(dates, 'oldest')
    )
  }),
  'a source with more than three scenarios and distinguishable date orders'
)
const compactScenarioCollection = requireFixture(
  sourceScenarioCases.find(({ items }) => {
    const dates = items.map(({ releaseDate }) => releaseDate)

    return (
      dates.length === 3 &&
      dates.every((date): date is string => date !== null) &&
      isReleaseDateOrder(dates, 'newest') &&
      !isReleaseDateOrder(dates, 'oldest')
    )
  }),
  'a source with exactly three scenarios listed newest first'
)
const scenarioReleaseDateByHref = new Map(
  scenarios.map((scenario) => [
    `/scenarios/${scenario.slug}`,
    scenario.releaseDate
  ])
)

const taxonomyPageWithLongestCitation = requireFixture(
  [
    ...riskFamilies.map((resource) => ({
      href: `/risk-families/${resource.slug}`,
      citations: resource.citations
    })),
    ...concepts.map((resource) => ({
      href: `/concepts/${resource.slug}`,
      citations: resource.citations
    }))
  ].toSorted(
    (left, right) =>
      Math.max(...right.citations.map(({ title }) => title.length)) -
      Math.max(...left.citations.map(({ title }) => title.length))
  )[0],
  'a taxonomy page with citations'
)

test('gallery navigation and Markdown copy work across a dossier round trip', async ({
  context,
  page
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')

  const gallery = page.locator('[data-spatial-gallery="featured"]')
  const selectedLink = page.locator('[data-selected-scenario-link="desktop"]')

  await expect(gallery).toBeVisible()
  await expect(selectedLink).toBeVisible()

  await selectedLink.click()
  await expect(page).toHaveURL(/\/scenarios\/[a-z0-9-]+$/)

  const copyButton = page.locator('[data-copy-scenario-markdown]')
  await copyButton.click()
  await expect(copyButton).toHaveAttribute('data-state', 'success')
  expect(
    (await page.evaluate(() => navigator.clipboard.readText())).trim()
  ).not.toBe('')

  await page.goBack()
  await expect(page).toHaveURL('/')
  await expect(gallery).toBeVisible()
})

test('scenario media can be played and paused', async ({ page }) => {
  await page.goto(`/scenarios/${videoScenario.slug}`)
  const media = page.locator('[data-scenario-media]')
  const mediaToggle = media.locator('[data-scenario-media-toggle]')
  const posterAction = media.locator('[data-scenario-media-poster-action]')

  await expect(posterAction).toBeVisible()
  await expect(media.locator('[data-scenario-media-still-label]')).toHaveCount(
    0
  )

  const cursor = media.locator('[data-scenario-media-cursor]')
  await media.hover({ position: { x: 80, y: 80 } })
  await expect(cursor).toHaveCSS('opacity', '1')

  await mediaToggle.click()
  await expect(media.locator('iframe')).toBeVisible()
  await expect(mediaToggle).toHaveAttribute('aria-pressed', 'true')
  await expect(posterAction).toHaveCount(0)

  const progress = media.locator('[data-scenario-media-progress]')
  await progress.hover()
  await expect(progress).toHaveCSS('cursor', 'ew-resize')
  await expect(cursor).toHaveCSS('visibility', 'hidden')

  await mediaToggle.click()
  await expect(mediaToggle).toHaveAttribute('aria-pressed', 'false')
})

test('scenario media keeps the still label when no video is available', async ({
  page
}) => {
  await page.goto(`/scenarios/${stillOnlyScenario.slug}`)
  const media = page.locator('[data-scenario-media]')

  await expect(media.locator('[data-scenario-media-still-label]')).toBeVisible()
  await expect(
    media.locator('[data-scenario-media-poster-action]')
  ).toHaveCount(0)
  await expect(media.locator('[data-scenario-media-toggle]')).toHaveCount(0)
})

test('scenario details show a blur placeholder while the still loads', async ({
  page
}) => {
  const releaseImages = await pauseOptimizedImages(page)

  try {
    await page.goto(`/scenarios/${videoScenario.slug}`, {
      waitUntil: 'domcontentloaded'
    })

    const still = page.locator('[data-scenario-still]')
    await expect(still).toBeVisible()
    await expect(still).toHaveCSS('background-image', /data:image\/svg\+xml/)
  } finally {
    await releaseImages()
  }
})

test('scenario detail publishes content-derived social metadata', async ({
  page
}) => {
  const href = `/scenarios/${socialScenario.slug}`
  const title = `${socialScenarioSource.title} / ${socialScenario.title}`

  await page.goto(href)

  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    title
  )
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    'content',
    socialScenario.scene
  )
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
    'content',
    title
  )
  await expect(
    page.locator('meta[name="twitter:description"]')
  ).toHaveAttribute('content', socialScenario.scene)
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image'
  )

  const canonical = await requiredAttribute(
    page.locator('link[rel="canonical"]'),
    'href'
  )
  const openGraphImage = await requiredAttribute(
    page.locator('meta[property="og:image"]'),
    'content'
  )
  const twitterImage = await requiredAttribute(
    page.locator('meta[name="twitter:image"]'),
    'content'
  )

  expect(new URL(canonical).pathname).toBe(href)
  expect(new URL(openGraphImage).pathname).toBe(`${href}/opengraph-image`)
  expect(new URL(twitterImage).href).toBe(new URL(openGraphImage).href)

  const imageResponse = await page.request.get(openGraphImage)
  const imageBody = await imageResponse.body()
  const imageMetadata = await sharp(imageBody).metadata()
  const stillCrop = await sharp(imageBody)
    .extract({ left: 485, top: 223, width: 272, height: 154 })
    .toBuffer()
  const frameCrop = await sharp(imageBody)
    .extract({ left: 485, top: 215, width: 272, height: 8 })
    .toBuffer()
  const stillStats = await sharp(stillCrop).stats()
  const frameStats = await sharp(frameCrop).stats()

  expect(imageResponse.ok()).toBe(true)
  expect(imageResponse.headers()['content-type']).toContain('image/png')
  expect(imageMetadata).toMatchObject({ width: 1200, height: 630 })
  expect(stillStats.entropy).toBeGreaterThan(1)
  expect(
    Math.max(...frameStats.channels.slice(0, 3).map(({ stdev }) => stdev))
  ).toBeLessThan(1)
})

test('eligible resource scenario sorting persists locally', async ({
  page
}) => {
  await page.goto(sortableScenarioCollection.href)

  const sortGroup = page.getByRole('radiogroup', { name: 'Sort scenes' })

  await expect(sortGroup.getByRole('radio', { name: 'Default' })).toBeChecked()

  await sortGroup.getByRole('radio', { name: 'Newest first' }).click()
  expectScenarioReleaseDateOrder(
    await getControlledScenarioHrefs(page, sortGroup),
    'newest'
  )

  await page.reload()

  const persistedSortGroup = page.getByRole('radiogroup', {
    name: 'Sort scenes'
  })
  await expect(
    persistedSortGroup.getByRole('radio', { name: 'Newest first' })
  ).toBeChecked()
  expectScenarioReleaseDateOrder(
    await getControlledScenarioHrefs(page, persistedSortGroup),
    'newest'
  )

  await persistedSortGroup.getByRole('radio', { name: 'Oldest first' }).click()
  expectScenarioReleaseDateOrder(
    await getControlledScenarioHrefs(page, persistedSortGroup),
    'oldest'
  )

  await page.goto(compactScenarioCollection.href)
  await expect(
    page.getByRole('radiogroup', { name: 'Sort scenes' })
  ).toHaveCount(0)
  expectScenarioReleaseDateOrder(
    await page
      .locator('[data-scenario-collection]')
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')!)),
    'newest'
  )

  await page.goto(sortableScenarioCollection.href)

  const restoredSortGroup = page.getByRole('radiogroup', {
    name: 'Sort scenes'
  })
  await expect(
    restoredSortGroup.getByRole('radio', { name: 'Oldest first' })
  ).toBeChecked()
  await restoredSortGroup.getByRole('radio', { name: 'Default' }).click()
  await expect(
    restoredSortGroup.getByRole('radio', { name: 'Default' })
  ).toBeChecked()

  await page.reload()
  await expect(
    page
      .getByRole('radiogroup', { name: 'Sort scenes' })
      .getByRole('radio', { name: 'Default' })
  ).toBeChecked()
})

test('global search opens by button and shortcut, then navigates', async ({
  page
}) => {
  await page.goto('/')

  const searchTrigger = page.locator('[data-search-ready="true"]')
  await expect(searchTrigger).toBeVisible()

  await searchTrigger.click()
  await expect(page.getByRole('combobox')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.keyboard.press('ControlOrMeta+k')

  const searchInput = page.getByRole('combobox')
  await expect(searchInput).toBeFocused()
  await searchInput.fill(searchTarget.title)

  await expect(page.getByRole('option').first()).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(searchTarget.href)
})

test('the removed search route resolves through not-found', async ({
  page
}) => {
  const response = await page.goto('/search')

  expect(response?.status()).toBe(404)
})

test('spoiler dismissal persists across reloads', async ({ page }) => {
  await page.goto('/')

  const spoiler = page.locator('[data-spoiler-warning]')
  await expect(spoiler).toBeVisible()
  await spoiler.click()
  await expect(spoiler).toBeHidden()

  await page.reload()
  await expect(spoiler).toBeHidden()
})

test.describe('functional phone viewport', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })

  test('filtering and taxonomy help remain usable on a phone viewport', async ({
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

    await page.goto(`/scenarios/${videoScenario.slug}`)
    await expect(page.locator('[data-scenario-dossier]')).toBeVisible()
    await expect(page.locator('[data-search-ready="true"]')).toBeVisible()
    await page.locator('[data-taxonomy-help]').first().tap()
    await expect(page.getByRole('tooltip')).toBeVisible()

    await page.goto(taxonomyPageWithLongestCitation.href)
    await expect(
      page.getByRole('list', { name: 'External references' })
    ).toBeVisible()
    expect(await hasHorizontalOverflow(page)).toBe(false)
  })
})

function requireFixture<Value>(
  value: Value | undefined,
  description: string
): Value {
  if (value === undefined) {
    throw new Error(`Expected the content snapshot to include ${description}`)
  }

  return value
}

async function requiredAttribute(
  locator: import('@playwright/test').Locator,
  attribute: string
) {
  const value = await locator.getAttribute(attribute)

  if (value === null) {
    throw new Error(`Expected ${attribute} on social metadata element`)
  }

  return value
}

async function pauseOptimizedImages(page: import('@playwright/test').Page) {
  const pendingRoutes = new Set<import('@playwright/test').Route>()
  const imageRoute = /\/_next\/image(?:\?|$)/
  const holdImage = (route: import('@playwright/test').Route) => {
    pendingRoutes.add(route)
  }

  await page.route(imageRoute, holdImage)

  return async () => {
    await Promise.allSettled(
      [...pendingRoutes].map((route) => route.abort('blockedbyclient'))
    )
    await page.unroute(imageRoute, holdImage)
  }
}

async function getControlledScenarioHrefs(
  page: import('@playwright/test').Page,
  sortGroup: import('@playwright/test').Locator
) {
  const collectionId = await sortGroup.getAttribute('aria-controls')

  if (!collectionId) {
    throw new Error('Expected scenario sort controls to identify their list')
  }

  return page
    .locator(`[id="${collectionId}"]`)
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')!))
}

function expectScenarioReleaseDateOrder(
  hrefs: readonly string[],
  order: 'newest' | 'oldest'
) {
  const releaseDates = hrefs.map((href) => {
    const releaseDate = scenarioReleaseDateByHref.get(href)

    if (!releaseDate) {
      throw new Error(`Expected a dated scenario for ${href}`)
    }

    return releaseDate
  })

  expect(isReleaseDateOrder(releaseDates, order)).toBe(true)
}

function isReleaseDateOrder(
  releaseDates: readonly string[],
  order: 'newest' | 'oldest'
) {
  const expected = releaseDates.toSorted()

  if (order === 'newest') expected.reverse()

  return releaseDates.every(
    (releaseDate, index) => releaseDate === expected[index]
  )
}

async function hasHorizontalOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  )
}
