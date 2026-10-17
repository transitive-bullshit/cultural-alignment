import concepts from '../../../../content/snapshot/concepts.json' with { type: 'json' }
import franchises from '../../../../content/snapshot/franchises.json' with { type: 'json' }
import families from '../../../../content/snapshot/risk-families.json' with { type: 'json' }
import scenarios from '../../../../content/snapshot/scenarios.json' with { type: 'json' }
import sources from '../../../../content/snapshot/sources.json' with { type: 'json' }

import {
  expect,
  openFromHeader,
  readLocalStorage,
  storageKeys,
  test
} from './fixtures'

// Visitors reach franchises from the media-source index, the rest from the header.
const indexes = [
  { route: 'sources', kind: 'source', records: sources, via: 'header' },
  {
    route: 'franchises',
    kind: 'franchise',
    records: franchises,
    via: 'sources'
  },
  {
    route: 'risk-families',
    kind: 'risk-family',
    records: families,
    via: 'header'
  },
  { route: 'concepts', kind: 'concept', records: concepts, via: 'header' }
] as const

const largeConcept = concepts
  .map((concept) => ({
    concept,
    count: scenarios.filter(({ conceptIds }) => conceptIds.includes(concept.id))
      .length
  }))
  .toSorted((a, b) => b.count - a.count)[0]!

test('each resource index links every snapshot record', async ({
  page,
  evidence
}, testInfo) => {
  await page.goto('/about')

  for (const { route, kind, records, via } of indexes) {
    if (via === 'header') {
      await openFromHeader(
        page,
        `/${route}`,
        testInfo.project.name === 'mobile'
      )
    } else {
      await page.locator(`main a[href="/${route}"]`).first().click()
      await page.waitForURL((url) => url.pathname === `/${route}`)
    }
    await expect(
      page.locator(`[data-resource-list][data-resource-kind="${kind}"]`).first()
    ).toBeVisible()

    const pattern = new RegExp(`^/${route}/[^/]+$`)
    const hrefs = new Set(
      (
        await page
          .locator(`main a[href^="/${route}/"]`)
          .evaluateAll((links) =>
            links.map((link) => link.getAttribute('href'))
          )
      ).filter((href): href is string => !!href && pattern.test(href))
    )
    const missing = records
      .map(({ slug }) => `/${route}/${slug}`)
      .filter((href) => !hrefs.has(href))

    expect(missing, `${route} links every record`).toEqual([])
    expect(hrefs.size).toBe(records.length)
    await evidence.capture(`${route} index`)
  }
})

test('media sources sort by age and remember the choice', async ({
  page,
  evidence
}) => {
  await page.goto('/sources')
  const list = page.locator('[data-resource-list][data-resource-kind="source"]')
  await expect(list).toHaveAttribute('data-resource-sort', 'default')

  await page.locator('[data-collection-sort-option="newest"]').click()
  await expect(list).toHaveAttribute('data-resource-sort', 'newest')
  const newest = sources
    .filter(({ releaseDate }) => releaseDate)
    .toSorted((a, b) => b.releaseDate!.localeCompare(a.releaseDate!))[0]!
  await expect(list.locator('li > a').first()).toHaveAttribute(
    'href',
    `/sources/${newest.slug}`
  )
  await evidence.capture('sources sorted newest first')
  await evidence.record(
    'sort preference in storage',
    await readLocalStorage(page, [
      storageKeys.sourceSort,
      storageKeys.scenarioSort
    ])
  )

  await page.reload()
  await expect(list).toHaveAttribute('data-resource-sort', 'newest')
  await expect(
    page.locator('[data-collection-sort-option="newest"]')
  ).toHaveAttribute('data-state', 'on')
  await evidence.capture('newest sort survives reload')
})

test('a concept page expands its full scene collection', async ({
  page,
  evidence
}) => {
  const { concept, count } = largeConcept
  expect(
    count,
    'the largest concept needs more than 12 scenes'
  ).toBeGreaterThan(12)

  await page.goto(`/concepts/${concept.slug}`)
  await expect(page.locator('[data-resource-detail="concept"]')).toBeVisible()

  const cards = page.locator('[data-scenario-collection] > li')
  await expect(cards).toHaveCount(12)
  const expand = page.locator('[data-scenario-collection-expand]')
  await expect(expand).toHaveText(new RegExp(`Show all ${count} scenes`))
  await expand.scrollIntoViewIfNeeded()
  await evidence.capture('collapsed collection')

  await expand.click()
  await expect(cards).toHaveCount(count)
  await expect(cards.nth(12).locator(':focus')).toHaveCount(1)
  await evidence.capture('expanded collection focuses card 13')

  const cardLink = cards.nth(12).locator('a[href^="/scenarios/"]').first()
  const href = (await cardLink.getAttribute('href'))!
  await cardLink.click()
  await page.waitForURL((url) => url.pathname === href)
  await expect(page.locator('[data-scenario-dossier]')).toBeVisible()
  await evidence.capture('scenario card opens its dossier')
})
