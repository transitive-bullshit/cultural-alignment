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
const connectedRecordsFixture = requireFixture(
  sources.find(
    (source) =>
      source.relatedSourceIds.length > 0 &&
      scenarios.some(
        (scenario) =>
          scenario.sourceId === source.id &&
          scenario.riskFamilyIds.length > 0 &&
          scenario.conceptIds.length > 0
      )
  ),
  'a source connected to a source, risk family, and concept'
)
const sourceDetailFixture = requireFixture(
  sources.find(
    (source) =>
      source.poster &&
      source.releaseDate &&
      scenarios.some((scenario) => scenario.sourceId === source.id) &&
      [source.imdbUrl, source.rottenTomatoesUrl, source.youtubeTrailerUrl].some(
        Boolean
      )
  ),
  'a source with a poster, release date, and external reference'
)
const sourceWithoutPoster = requireFixture(
  sources.find((source) => !source.poster),
  'a source without a poster'
)
const televisionScenarioWithEpisode = requireFixture(
  scenarios.find(
    (scenario) =>
      sourceById.get(scenario.sourceId)?.sourceType === 'tv-show' &&
      scenario.episode?.label.trim()
  ),
  'a TV scenario with an episode'
)
const movieScenario = requireFixture(
  scenarios.find(
    (scenario) => sourceById.get(scenario.sourceId)?.sourceType === 'movie'
  ),
  'a movie scenario'
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

const resourceBreadcrumbCases = [
  {
    indexHref: '/risk-families',
    detailHref: `/risk-families/${riskFamilies[0]!.slug}`
  },
  {
    indexHref: '/concepts',
    detailHref: `/concepts/${concepts[0]!.slug}`
  },
  {
    indexHref: '/sources',
    detailHref: `/sources/${sources[0]!.slug}`
  }
] as const

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

  await mediaToggle.click()
  await expect(media.locator('iframe')).toBeVisible()
  await expect(mediaToggle).toHaveAttribute('aria-pressed', 'true')

  const progress = media.locator('[data-scenario-media-progress]')
  await progress.hover()
  await expect(progress).toHaveCSS('cursor', 'ew-resize')
  await expect(media.locator('[data-scenario-media-crosshair]')).toHaveCSS(
    'visibility',
    'hidden'
  )

  await mediaToggle.click()
  await expect(mediaToggle).toHaveAttribute('aria-pressed', 'false')
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
  const expectedImage = new URL(socialScenario.image.detailSrc, page.url()).href
  expect(new URL(openGraphImage).href).toBe(expectedImage)
  expect(new URL(twitterImage).href).toBe(expectedImage)
})

test('resource detail breadcrumbs navigate back to each resource index', async ({
  page
}) => {
  for (const { detailHref, indexHref } of resourceBreadcrumbCases) {
    await page.goto(detailHref)

    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    const parent = breadcrumb.getByRole('link')
    const current = breadcrumb.locator('[aria-current="page"]')

    await expect(breadcrumb).toBeVisible()
    await expect(parent).toHaveAttribute('href', indexHref)
    await expect(current).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await parent.click()
    await expect(page).toHaveURL(indexHref)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
})

test('connected records support keyboard navigation', async ({ page }) => {
  await page.goto(`/sources/${connectedRecordsFixture.slug}`)

  const firstLink = page
    .locator('[data-connected-records]')
    .getByRole('link')
    .first()
  const href = await firstLink.getAttribute('href')

  expect(href).toBeTruthy()
  await firstLink.focus()
  await expect(firstLink).toBeFocused()
  await expect(firstLink).toHaveAccessibleName(/\S/)

  const destination = new URL(href!, page.url()).href
  await firstLink.press('Enter')
  await expect(page).toHaveURL(destination)
})

test('source detail projects its poster and CMS metadata', async ({ page }) => {
  await page.goto(`/sources/${sourceDetailFixture.slug}`)

  const detail = page.locator('[data-resource-detail="source"]')
  const poster = detail.locator('[data-source-poster] img')
  const expectedLinks = [
    sourceDetailFixture.imdbUrl,
    sourceDetailFixture.rottenTomatoesUrl,
    sourceDetailFixture.youtubeTrailerUrl
  ].filter((href): href is string => href !== null)
  const externalLinks = detail
    .getByRole('list', { name: 'External references' })
    .getByRole('link')

  await expect(detail).toBeVisible()
  await expect(detail.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(
    detail.locator(`[data-source-type="${sourceDetailFixture.sourceType}"]`)
  ).toBeVisible()
  await expect(detail.locator('[data-source-release-date]')).toHaveAttribute(
    'datetime',
    sourceDetailFixture.releaseDate!
  )
  await expect(poster).toBeVisible()
  await expect
    .poll(() =>
      poster.evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0
      )
    )
    .toBe(true)
  const renderedExternalHrefs = await externalLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute('href'))
  )
  for (const href of expectedLinks) {
    expect(renderedExternalHrefs).toContain(href)
  }

  await page.goto(`/sources/${sourceWithoutPoster.slug}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('[data-source-poster]')).toHaveCount(0)
})

test('source posters and scenario cards show blur placeholders while loading', async ({
  page
}) => {
  const releaseImages = await pauseOptimizedImages(page)

  try {
    await page.goto(`/sources/${sourceDetailFixture.slug}`, {
      waitUntil: 'domcontentloaded'
    })

    const poster = page.locator('[data-source-poster-image]')
    const card = page.locator('[data-scenario-card-image]').first()

    await expect(poster).toBeVisible()
    await expect(card).toBeVisible()
    await expect(poster).toHaveCSS('background-image', /data:image\/svg\+xml/)
    await expect(card).toHaveCSS('background-image', /data:image\/svg\+xml/)
  } finally {
    await releaseImages()
  }
})

test('taxonomy details expose current external references', async ({
  page
}) => {
  const cases = [
    {
      href: `/risk-families/${riskFamilies[0]!.slug}`,
      wikipediaUrl: riskFamilies[0]!.wikipediaUrl,
      citations: riskFamilies[0]!.citations
    },
    {
      href: `/concepts/${concepts[0]!.slug}`,
      wikipediaUrl: concepts[0]!.wikipediaUrl,
      citations: concepts[0]!.citations
    }
  ]

  for (const detailCase of cases) {
    await page.goto(detailCase.href)
    const references = page.getByRole('list', { name: 'External references' })
    const links = references.getByRole('link')
    const expectedHrefs = [
      detailCase.wikipediaUrl,
      ...detailCase.citations.map(({ href }) => href)
    ].filter((href): href is string => href !== null)
    const renderedHrefs = await links.evaluateAll((items) =>
      items.map((item) => item.getAttribute('href'))
    )

    await expect(references).toBeVisible()
    for (const href of expectedHrefs) expect(renderedHrefs).toContain(href)
  }
})

test('episode metadata appears only for TV scenarios', async ({ page }) => {
  await page.goto(`/scenarios/${televisionScenarioWithEpisode.slug}`)
  await expect(page.locator('[data-scenario-episode]')).toBeVisible()

  await page.goto(`/scenarios/${movieScenario.slug}`)
  await expect(page.locator('[data-scenario-episode]')).toHaveCount(0)
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

test('Command-K search navigates through the generated local index', async ({
  page
}) => {
  await page.goto('/')

  const searchTrigger = page.locator('[data-search-ready="true"]')
  await expect(searchTrigger).toBeVisible()
  await page.keyboard.press('ControlOrMeta+k')

  const searchInput = page.getByRole('combobox')
  await expect(searchInput).toBeFocused()
  await searchInput.fill(searchTarget.title)

  await expect(page.getByRole('option').first()).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(searchTarget.href)
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
