import { describe, expect, it } from 'vitest'

import { contentCatalog } from '@/lib/content/snapshot'
import { siteUrl } from '@/lib/site'

import sitemap from './sitemap'

describe('sitemap', () => {
  it('publishes the catalog-backed public route set without duplicates', () => {
    const fixedPaths = [
      '/',
      '/scenarios',
      '/sources',
      '/risk-families',
      '/concepts',
      '/about',
      '/privacy'
    ]
    const contentPaths = [
      ...contentCatalog
        .getStaticSlugs('scenario')
        .map((slug) => `/scenarios/${slug}`),
      ...contentCatalog
        .getStaticSlugs('source')
        .map((slug) => `/sources/${slug}`),
      ...contentCatalog
        .getStaticSlugs('risk-family')
        .map((slug) => `/risk-families/${slug}`),
      ...contentCatalog
        .getStaticSlugs('concept')
        .map((slug) => `/concepts/${slug}`)
    ]
    const expectedUrls = new Set(
      [...fixedPaths, ...contentPaths].map((path) =>
        new URL(path, siteUrl).toString()
      )
    )
    const entries = sitemap()
    const urls = entries.map(({ url }) => url)

    expect(new Set(urls)).toEqual(expectedUrls)
    expect(urls).toHaveLength(expectedUrls.size)
  })
})
