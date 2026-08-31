import { describe, expect, it } from 'vitest'

import { contentCatalog } from '@/lib/content/snapshot'
import {
  getResourceSocialMetadata,
  getScenarioSocialMetadata
} from '@/lib/content/social-metadata'
import { siteName, siteUrl } from '@/lib/site'

import {
  getResourceStructuredData,
  getScenarioStructuredData,
  siteStructuredData
} from './structured-data'

describe('structured data', () => {
  it('describes the website with stable absolute identifiers', () => {
    const website = siteStructuredData['@graph'].find(
      (entity) => entity['@type'] === 'WebSite'
    )!

    expect(website.name).toBe(siteName)
    expect(website['@id']).toBe(new URL('/#website', siteUrl).href)
    expect(website.url).toBe(new URL('/', siteUrl).href)
  })

  it('aligns scenario articles with their dynamic social metadata', () => {
    const scenario = contentCatalog.getScenarioPage(
      contentCatalog.getStaticSlugs('scenario')[0]!
    )!
    const social = getScenarioSocialMetadata(scenario)
    const structuredData = getScenarioStructuredData(scenario)

    expect(structuredData['@type']).toBe('Article')
    expect(structuredData.headline).toBe(social.title)
    expect(structuredData.description).toBe(social.description)
    expect(structuredData.url).toBe(new URL(social.canonical, siteUrl).href)
    expect(structuredData.image.url).toBe(
      new URL(scenario.image.detailSrc, siteUrl).href
    )
    expect(structuredData.about).toHaveLength(
      scenario.franchises.length +
        1 +
        scenario.riskFamilies.length +
        scenario.concepts.length
    )
  })

  it.each(['risk-family', 'concept', 'source', 'franchise'] as const)(
    'aligns %s collection pages with their dynamic social metadata',
    (kind) => {
      const resource = contentCatalog.getResourcePage(
        kind,
        contentCatalog.getStaticSlugs(kind)[0]!
      )!
      const social = getResourceSocialMetadata(resource)
      const structuredData = getResourceStructuredData(resource)

      expect(structuredData['@type']).toBe('CollectionPage')
      expect(structuredData.name).toBe(social.title)
      expect(structuredData.description).toBe(social.description)
      expect(structuredData.url).toBe(new URL(resource.href, siteUrl).href)
      expect(structuredData.hasPart).toHaveLength(resource.scenarios.length)
    }
  )
})
