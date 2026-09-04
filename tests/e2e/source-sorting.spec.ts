import { expect, test, type Page } from '@playwright/test'

import sources from '../../content/snapshot/sources.json' with { type: 'json' }

const sourceSortKey = 'cultural-alignment:media-source-collection-sort:v1'
const scenarioSortKey = 'cultural-alignment:scenario-collection-sort:v1'
const sourcesBySlug = new Map(sources.map((source) => [source.slug, source]))

test('media sources sort by age with an independent persisted preference', async ({
  page
}) => {
  await page.goto('/sources')
  await page.evaluate(
    ({ scenarioKey, sourceKey }) => {
      window.localStorage.setItem(scenarioKey, 'oldest')
      window.localStorage.removeItem(sourceKey)
    },
    { scenarioKey: scenarioSortKey, sourceKey: sourceSortKey }
  )
  await page.reload()

  const list = page.locator('[data-resource-list][data-resource-kind="source"]')
  const defaultOption = page.locator('[data-collection-sort-option="default"]')
  const newestOption = page.locator('[data-collection-sort-option="newest"]')
  const oldestOption = page.locator('[data-collection-sort-option="oldest"]')

  await expect(list).toHaveAttribute('data-resource-sort', 'default')
  await expect(defaultOption).toHaveAttribute('data-state', 'on')
  expectAlphabetical(await readOrderedSources(page))

  await newestOption.click()
  await expect(list).toHaveAttribute('data-resource-sort', 'newest')
  expectChronological(await readOrderedSources(page), 'newest')
  expect(
    await page.evaluate(
      ({ scenarioKey, sourceKey }) => ({
        scenario: window.localStorage.getItem(scenarioKey),
        source: window.localStorage.getItem(sourceKey)
      }),
      { scenarioKey: scenarioSortKey, sourceKey: sourceSortKey }
    )
  ).toEqual({ scenario: 'oldest', source: 'newest' })

  await page.reload()
  await expect(list).toHaveAttribute('data-resource-sort', 'newest')
  await expect(newestOption).toHaveAttribute('data-state', 'on')
  expectChronological(await readOrderedSources(page), 'newest')

  await oldestOption.click()
  await expect(list).toHaveAttribute('data-resource-sort', 'oldest')
  expectChronological(await readOrderedSources(page), 'oldest')

  await defaultOption.click()
  await expect(list).toHaveAttribute('data-resource-sort', 'default')
  expectAlphabetical(await readOrderedSources(page))
  expect(
    await page.evaluate(
      ({ scenarioKey, sourceKey }) => ({
        scenario: window.localStorage.getItem(scenarioKey),
        source: window.localStorage.getItem(sourceKey)
      }),
      { scenarioKey: scenarioSortKey, sourceKey: sourceSortKey }
    )
  ).toEqual({ scenario: 'oldest', source: null })
})

async function readOrderedSources(page: Page) {
  const hrefs = await page
    .locator('[data-resource-list][data-resource-kind="source"] > li > a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))

  return hrefs.map((href) => {
    const slug = href?.match(/^\/sources\/([^/]+)$/)?.[1]
    const source = slug ? sourcesBySlug.get(slug) : undefined

    if (!source) throw new Error(`Unknown media source link: ${href}`)

    return source
  })
}

function expectAlphabetical(orderedSources: typeof sources) {
  expectPairwise(orderedSources, (left, right) =>
    left.title.localeCompare(right.title, 'en', { sensitivity: 'base' })
  )
}

function expectChronological(
  orderedSources: typeof sources,
  direction: 'newest' | 'oldest'
) {
  expectPairwise(orderedSources, (left, right) => {
    if (left.releaseDate === right.releaseDate) {
      return left.title.localeCompare(right.title, 'en', {
        sensitivity: 'base'
      })
    }
    if (left.releaseDate === null) return 1
    if (right.releaseDate === null) return -1

    const dateOrder = left.releaseDate < right.releaseDate ? -1 : 1

    return direction === 'oldest' ? dateOrder : -dateOrder
  })
}

function expectPairwise<Item>(
  items: readonly Item[],
  compare: (left: Item, right: Item) => number
) {
  expect(items.length).toBeGreaterThan(1)

  for (let index = 1; index < items.length; index += 1) {
    expect(compare(items[index - 1]!, items[index]!)).toBeLessThanOrEqual(0)
  }
}
