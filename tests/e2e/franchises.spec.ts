import { expect, test } from '@playwright/test'

import franchises from '../../content/snapshot/franchises.json' with { type: 'json' }
import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }
import sources from '../../content/snapshot/sources.json' with { type: 'json' }

const sourceById = new Map(sources.map((source) => [source.id, source]))
const franchiseById = new Map(
  franchises.map((franchise) => [franchise.id, franchise])
)
const scenarioByHref = new Map(
  scenarios.map((scenario) => [`/scenarios/${scenario.slug}`, scenario])
)

const fixture = deriveFranchiseJourneyFixture()
const franchiseHref = `/franchises/${fixture.franchise.slug}`
const sourceHref = `/sources/${fixture.source.slug}`
const scenarioHref = `/scenarios/${fixture.scenario.slug}`

test('franchise overview reaches a detail with its image and source links', async ({
  page
}) => {
  await page.goto('/franchises')

  const franchiseList = page.locator(
    '[data-resource-list][data-resource-kind="franchise"]'
  )
  await expect(franchiseList).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const overviewHrefs = await readLinkHrefs(franchiseList.getByRole('link'))
  expect(new Set(overviewHrefs)).toEqual(
    new Set(franchises.map(({ slug }) => `/franchises/${slug}`))
  )

  await franchiseList.locator(`a[href="${franchiseHref}"]`).click()
  await expect(page).toHaveURL(franchiseHref)

  const detail = page.locator('[data-resource-detail="franchise"]')
  await expect(detail).toBeVisible()

  const image = detail.locator(
    '[data-franchise-image] img[data-resource-image-element="franchise"]'
  )
  await expect(image).toBeVisible()
  await expect
    .poll(() =>
      image.evaluate((element) =>
        element instanceof HTMLImageElement && element.complete
          ? element.naturalWidth
          : 0
      )
    )
    .toBeGreaterThan(0)

  const renderedImageSource = await requiredAttribute(image, 'src')
  expect(readOptimizedImageSource(renderedImageSource, page.url())).toBe(
    fixture.franchise.image.detailSrc
  )

  const sourceList = detail.locator(
    '[data-franchise-sources] [data-resource-list][data-resource-kind="source"]'
  )
  await expect(sourceList).toBeVisible()

  const sourceHrefs = await readLinkHrefs(sourceList.getByRole('link'))
  expect(new Set(sourceHrefs)).toEqual(
    new Set(fixture.franchiseSources.map(({ slug }) => `/sources/${slug}`))
  )

  await sourceList.locator(`a[href="${sourceHref}"]`).click()
  await expect(page).toHaveURL(sourceHref)
  await expect(page.locator('[data-resource-detail="source"]')).toBeVisible()
})

test('scenario metadata and discovery follow the ordered first franchise', async ({
  page
}) => {
  await page.goto(scenarioHref)

  const dossier = page.locator('[data-scenario-dossier]')
  await expect(dossier).toBeVisible()

  const franchiseMetadata = dossier.locator('[data-scenario-franchises]')
  const franchiseLinks = franchiseMetadata.locator('a[data-scenario-franchise]')
  await expect(franchiseLinks).toHaveCount(fixture.source.franchiseIds.length)
  expect(await readLinkHrefs(franchiseLinks)).toEqual(
    fixture.source.franchiseIds.map((id) => {
      const franchise = franchiseById.get(id)

      if (!franchise) {
        throw new Error(`Expected source franchise ${id} in the snapshot`)
      }

      return `/franchises/${franchise.slug}`
    })
  )

  await expect(
    dossier.locator(`[data-scenario-source] a[href="${sourceHref}"]`)
  ).toHaveCount(1)
  expect(
    await dossier
      .locator('[data-scenario-franchises], [data-scenario-source]')
      .evaluateAll((elements) =>
        elements.map((element) =>
          element.hasAttribute('data-scenario-franchises')
            ? 'franchises'
            : 'source'
        )
      )
  ).toEqual(['franchises', 'source'])

  const continuation = dossier.locator(
    '[data-scenario-continuation="franchise"]'
  )
  await expect(continuation).toBeVisible()
  await expect(
    continuation.locator('[data-scenario-continuation-action]')
  ).toHaveAttribute('href', franchiseHref)

  const cards = continuation
    .locator('[data-scenario-collection]')
    .getByRole('link')
  const cardHrefs = await readLinkHrefs(cards)
  expect(cardHrefs).toEqual(fixture.continuationHrefs)
  expect(new Set(cardHrefs).size).toBe(cardHrefs.length)

  for (const href of cardHrefs) {
    expect(fixture.franchiseScenarioHrefs.has(href)).toBe(true)
  }

  expect(
    cardHrefs.some(
      (href) => scenarioByHref.get(href)?.sourceId !== fixture.source.id
    )
  ).toBe(true)

  await cards.first().click()
  await expect(page).toHaveURL(cardHrefs[0]!)
  await expect(page.locator('[data-scenario-dossier]')).toBeVisible()
})

function deriveFranchiseJourneyFixture() {
  for (const scenario of scenarios) {
    const source = sourceById.get(scenario.sourceId)
    if (!source || source.franchiseIds.length < 2) continue

    const franchise = franchiseById.get(source.franchiseIds[0]!)
    if (!franchise) continue

    const franchiseSources = sources.filter(({ franchiseIds }) =>
      (franchiseIds as readonly string[]).includes(franchise.id)
    )
    const franchiseSourceIds = new Set(franchiseSources.map(({ id }) => id))
    const franchiseScenarios = scenarios.filter(
      (candidate) =>
        candidate.id !== scenario.id &&
        franchiseSourceIds.has(candidate.sourceId)
    )
    const continuationScenarios = franchiseScenarios.slice(0, 3)

    if (
      continuationScenarios.every(
        (candidate) => candidate.sourceId === source.id
      )
    ) {
      continue
    }

    return {
      continuationHrefs: continuationScenarios.map(
        ({ slug }) => `/scenarios/${slug}`
      ),
      franchise,
      franchiseScenarioHrefs: new Set(
        franchiseScenarios.map(({ slug }) => `/scenarios/${slug}`)
      ),
      franchiseSources,
      scenario,
      source
    }
  }

  throw new Error(
    'Expected a multi-franchise scenario with cross-source first-franchise discovery content'
  )
}

async function readLinkHrefs(locator: import('@playwright/test').Locator) {
  return locator.evaluateAll((links) =>
    links.map((link) => {
      if (!(link instanceof HTMLAnchorElement)) {
        throw new Error('Expected franchise journey links to be anchors')
      }

      return new URL(link.href).pathname
    })
  )
}

async function requiredAttribute(
  locator: import('@playwright/test').Locator,
  attribute: string
) {
  const value = await locator.getAttribute(attribute)

  if (value === null) {
    throw new Error(`Expected franchise image to have ${attribute}`)
  }

  return value
}

function readOptimizedImageSource(src: string, pageUrl: string) {
  const url = new URL(src, pageUrl)

  return url.pathname === '/_next/image'
    ? url.searchParams.get('url')
    : url.href
}
