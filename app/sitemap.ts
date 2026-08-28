import type { MetadataRoute } from 'next'

import type { ResourceKind } from '@/lib/content/catalog'
import { contentCatalog } from '@/lib/content/snapshot'
import { siteUrl } from '@/lib/site'

const resourceSegments = [
  ['source', 'sources'],
  ['risk-family', 'risk-families'],
  ['concept', 'concepts']
] as const satisfies readonly (readonly [ResourceKind, string])[]

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    '/',
    '/scenarios',
    '/sources',
    '/risk-families',
    '/concepts',
    ...contentCatalog
      .getStaticSlugs('scenario')
      .map((slug) => `/scenarios/${slug}`),
    ...resourceSegments.flatMap(([kind, segment]) =>
      contentCatalog.getStaticSlugs(kind).map((slug) => `/${segment}/${slug}`)
    )
  ]

  return paths.map((path) => ({
    url: new URL(path, siteUrl).toString()
  }))
}
