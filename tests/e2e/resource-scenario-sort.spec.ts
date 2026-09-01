import { expect, test, type Locator } from '@playwright/test'

import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }
import sources from '../../content/snapshot/sources.json' with { type: 'json' }
import { FEATURED_SCENARIO_TAG } from '../../lib/content/catalog'
import { mockOptimizedImages } from './image-fixtures'

type ScenarioFixture = (typeof scenarios)[number]
type SortDirection = 'newest' | 'oldest'

const fixture = findResourceSortFixture()
const smallFixture = findSmallResourceSortFixture()

test('resource scenes default to featured first without changing date sorts', async ({
  page
}) => {
  await mockOptimizedImages(page)
  await page.goto(`/sources/${fixture.source.slug}`)

  await expect(page).toHaveURL(`/sources/${fixture.source.slug}`)
  await expect(page.locator('[data-resource-detail="source"]')).toBeVisible()

  const collection = page.locator('[data-scenario-collection]')
  const scenarioLinks = collection.locator(':scope > li > a')

  await expect(collection).toHaveCount(1)
  await expect(scenarioLinks).toHaveCount(fixture.scenarios.length)
  expectFeaturedFirst(await readHrefs(scenarioLinks), fixture.scenarios)

  const newestOption = sortOption(page.locator('body'), 'newest')
  await newestOption.click()
  await expect(newestOption).toHaveAttribute('data-state', 'on')
  expectDateOrder(await readHrefs(scenarioLinks), fixture.scenarios, 'newest')

  const oldestOption = sortOption(page.locator('body'), 'oldest')
  await oldestOption.click()
  await expect(oldestOption).toHaveAttribute('data-state', 'on')
  expectDateOrder(await readHrefs(scenarioLinks), fixture.scenarios, 'oldest')

  const defaultOption = sortOption(page.locator('body'), 'default')
  await defaultOption.click()
  await expect(defaultOption).toHaveAttribute('data-state', 'on')
  expectFeaturedFirst(await readHrefs(scenarioLinks), fixture.scenarios)

  await page.goto(`/sources/${smallFixture.source.slug}`)

  await expect(page).toHaveURL(`/sources/${smallFixture.source.slug}`)
  await expect(page.locator('[data-resource-detail="source"]')).toBeVisible()
  await expect(page.locator('[data-scenario-sort]')).toHaveCount(0)

  const smallCollection = page.locator('[data-scenario-collection]')
  const smallScenarioLinks = smallCollection.locator(':scope > li > a')

  await expect(smallCollection).toHaveCount(1)
  await expect(smallScenarioLinks).toHaveCount(smallFixture.scenarios.length)
  expectFeaturedFirst(
    await readHrefs(smallScenarioLinks),
    smallFixture.scenarios
  )
})

function findResourceSortFixture() {
  const candidate = sources
    .map((source) => ({
      source,
      scenarios: scenarios.filter(({ sourceId }) => sourceId === source.id)
    }))
    .filter(
      ({ scenarios: sourceScenarios }) =>
        sourceScenarios.length > 3 &&
        sourceScenarios.some(isFeatured) &&
        sourceScenarios.some((scenario) => !isFeatured(scenario)) &&
        hasDateConflict(sourceScenarios, 'newest') &&
        hasDateConflict(sourceScenarios, 'oldest')
    )
    .toSorted(
      (left, right) => left.scenarios.length - right.scenarios.length
    )[0]

  if (!candidate) {
    throw new Error(
      'Expected a source with featured and non-featured scenes that exercise both date sorts'
    )
  }

  return candidate
}

function findSmallResourceSortFixture() {
  const candidate = sources
    .map((source) => ({
      source,
      scenarios: scenarios.filter(({ sourceId }) => sourceId === source.id)
    }))
    .find(
      ({ scenarios: sourceScenarios }) =>
        sourceScenarios.length > 1 &&
        sourceScenarios.length <= 3 &&
        sourceScenarios.some(isFeatured) &&
        sourceScenarios.some((scenario) => !isFeatured(scenario)) &&
        sourceScenarios.some(
          (scenario, index) =>
            isFeatured(scenario) &&
            sourceScenarios
              .slice(0, index)
              .some((previous) => !isFeatured(previous))
        )
    )

  if (!candidate) {
    throw new Error(
      'Expected a small source whose listed scenes require featured-first ordering'
    )
  }

  return candidate
}

function hasDateConflict(
  sourceScenarios: readonly ScenarioFixture[],
  direction: SortDirection
) {
  const featuredDates = sourceScenarios
    .filter(isFeatured)
    .flatMap(({ releaseDate }) => (releaseDate ? [releaseDate] : []))
  const otherDates = sourceScenarios
    .filter((scenario) => !isFeatured(scenario))
    .flatMap(({ releaseDate }) => (releaseDate ? [releaseDate] : []))

  return otherDates.some((otherDate) =>
    featuredDates.some((featuredDate) =>
      direction === 'newest'
        ? otherDate > featuredDate
        : otherDate < featuredDate
    )
  )
}

function sortOption(root: Locator, value: 'default' | SortDirection) {
  return root.locator(`[data-scenario-sort="${value}"]`)
}

async function readHrefs(links: Locator) {
  return links.evaluateAll((elements) =>
    elements.map((element) => {
      const href = element.getAttribute('href')
      if (!href) throw new Error('Expected every scenario card to have an href')

      return href
    })
  )
}

function expectFeaturedFirst(
  orderedHrefs: readonly string[],
  listedScenarios: readonly ScenarioFixture[]
) {
  const orderedScenarios = resolveOrderedScenarios(
    orderedHrefs,
    listedScenarios
  )
  let foundOtherScenario = false

  for (const scenario of orderedScenarios) {
    if (isFeatured(scenario)) {
      expect(foundOtherScenario).toBe(false)
    } else {
      foundOtherScenario = true
    }
  }

  expect(orderedScenarios.filter(isFeatured).map(scenarioHref)).toEqual(
    listedScenarios.filter(isFeatured).map(scenarioHref)
  )
  expect(
    orderedScenarios
      .filter((scenario) => !isFeatured(scenario))
      .map(scenarioHref)
  ).toEqual(
    listedScenarios
      .filter((scenario) => !isFeatured(scenario))
      .map(scenarioHref)
  )
}

function expectDateOrder(
  orderedHrefs: readonly string[],
  listedScenarios: readonly ScenarioFixture[],
  direction: SortDirection
) {
  const orderedScenarios = resolveOrderedScenarios(
    orderedHrefs,
    listedScenarios
  )
  const listedIndexByHref = new Map(
    listedScenarios.map((scenario, index) => [scenarioHref(scenario), index])
  )

  for (let index = 1; index < orderedScenarios.length; index += 1) {
    const previous = orderedScenarios[index - 1]!
    const current = orderedScenarios[index]!

    if (previous.releaseDate === current.releaseDate) {
      expect(listedIndexByHref.get(scenarioHref(previous))!).toBeLessThan(
        listedIndexByHref.get(scenarioHref(current))!
      )
    } else if (previous.releaseDate === null) {
      expect(current.releaseDate).toBeNull()
    } else if (current.releaseDate !== null) {
      expect(
        direction === 'newest'
          ? previous.releaseDate > current.releaseDate
          : previous.releaseDate < current.releaseDate
      ).toBe(true)
    }
  }
}

function resolveOrderedScenarios(
  orderedHrefs: readonly string[],
  listedScenarios: readonly ScenarioFixture[]
) {
  const scenarioByHref = new Map(
    listedScenarios.map((scenario) => [scenarioHref(scenario), scenario])
  )

  expect(orderedHrefs).toHaveLength(listedScenarios.length)
  expect(new Set(orderedHrefs)).toEqual(new Set(scenarioByHref.keys()))

  return orderedHrefs.map((href) => {
    const scenario = scenarioByHref.get(href)
    if (!scenario) throw new Error(`Unexpected scenario href: ${href}`)

    return scenario
  })
}

function isFeatured(scenario: ScenarioFixture) {
  return scenario.tags.some((tag) => tag === FEATURED_SCENARIO_TAG)
}

function scenarioHref(scenario: ScenarioFixture) {
  return `/scenarios/${scenario.slug}`
}
