import { expect, test, type Page } from '@playwright/test'

import concepts from '../../content/snapshot/concepts.json' with { type: 'json' }
import riskFamilies from '../../content/snapshot/risk-families.json' with { type: 'json' }
import scenarios from '../../content/snapshot/scenarios.json' with { type: 'json' }
import sources from '../../content/snapshot/sources.json' with { type: 'json' }

type StructuredDataDocument = {
  readonly '@context'?: string
  readonly '@graph'?: readonly StructuredDataDocument[]
  readonly '@id'?: string
  readonly '@type'?: string
  readonly about?: StructuredDataDocument
  readonly headline?: string
  readonly name?: string
  readonly url?: string
}

const scenario = scenarios[0]!
const scenarioSource = sources.find(({ id }) => id === scenario.sourceId)!

const resourceCases = [
  {
    href: `/risk-families/${riskFamilies[0]!.slug}`,
    entityName: riskFamilies[0]!.fullName,
    entityType: 'DefinedTerm'
  },
  {
    href: `/concepts/${concepts[0]!.slug}`,
    entityName: concepts[0]!.longName,
    entityType: 'DefinedTerm'
  },
  {
    href: `/sources/${sources[0]!.slug}`,
    entityName: sources[0]!.title,
    entityType: sources[0]!.sourceType === 'movie' ? 'Movie' : 'TVSeries'
  }
] as const

test('the root layout publishes website structured data', async ({ page }) => {
  await page.goto('/')

  const structuredData = await readJsonLd(page, 'site')
  const website = structuredData['@graph']?.find(
    (entity) => entity['@type'] === 'WebSite'
  )

  expect(structuredData['@context']).toBe('https://schema.org')
  expect(website).toBeDefined()
  expect(website?.name).toBeTruthy()
  expect(new URL(website!.url!).pathname).toBe('/')
})

test('dynamic metadata routes publish content-specific structured data', async ({
  page
}) => {
  const scenarioHref = `/scenarios/${scenario.slug}`

  await page.goto(scenarioHref)
  const scenarioData = await readJsonLd(page, 'page')

  expect(scenarioData['@type']).toBe('Article')
  expect(scenarioData.headline).toBe(
    `${scenarioSource.title} / ${scenario.title}`
  )
  expect(new URL(scenarioData.url!).pathname).toBe(scenarioHref)

  for (const resourceCase of resourceCases) {
    await page.goto(resourceCase.href)
    const resourceData = await readJsonLd(page, 'page')

    expect(resourceData['@type']).toBe('CollectionPage')
    expect(new URL(resourceData.url!).pathname).toBe(resourceCase.href)
    expect(resourceData.about?.['@type']).toBe(resourceCase.entityType)
    expect(resourceData.about?.name).toBe(resourceCase.entityName)
  }
})

async function readJsonLd(page: Page, scope: 'page' | 'site') {
  const script = page.locator(
    `script[type="application/ld+json"][data-json-ld="${scope}"]`
  )

  await expect(script).toHaveCount(1)

  return JSON.parse(
    (await script.textContent()) ?? ''
  ) as StructuredDataDocument
}
