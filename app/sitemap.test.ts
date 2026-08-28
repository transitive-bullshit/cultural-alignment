import { describe, expect, it } from 'vitest'

import { contentCatalog } from '@/lib/content/snapshot'
import { siteUrl } from '@/lib/site'

import sitemap from './sitemap'

describe('sitemap', () => {
  it('publishes each browseable static content URL exactly once', () => {
    const entries = sitemap()
    const expectedCount =
      5 +
      contentCatalog.getStaticSlugs('scenario').length +
      contentCatalog.getStaticSlugs('source').length +
      contentCatalog.getStaticSlugs('risk-family').length +
      contentCatalog.getStaticSlugs('concept').length
    const urls = entries.map(({ url }) => url)

    expect(entries).toHaveLength(expectedCount)
    expect(new Set(urls).size).toBe(expectedCount)
    expect(urls).toContain(
      new URL('/scenarios/lacie-games-her-rating', siteUrl).toString()
    )
    expect(urls).toContain(
      new URL('/concepts/goodharts-law', siteUrl).toString()
    )
  })
})
