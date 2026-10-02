import type { Metadata } from 'next'

import { ResourceIndexPage } from '@/features/content-navigation/resource-pages'
import { contentCatalog } from '@/lib/content/snapshot'

export const metadata: Metadata = {
  title: 'Sources',
  description: 'Browse every cultural source represented in the collection.',
  alternates: { canonical: '/sources' }
}

export default function SourcesPage() {
  const franchiseCount = contentCatalog.listFranchiseResources().length

  return (
    <ResourceIndexPage
      kind='source'
      resources={contentCatalog.listSourceResources()}
      crossLink={{
        href: '/franchises',
        label: `Browse all ${franchiseCount} franchises`
      }}
    />
  )
}
