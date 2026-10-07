import type { Metadata } from 'next'

import { ResourceIndexPage } from '@/features/content-navigation/resource-pages'
import { contentCatalog } from '@/lib/content/snapshot'

export const metadata: Metadata = {
  title: 'Movies and TV Shows',
  description:
    'The movies and TV shows in the archive and the AI safety lessons their scenes illustrate.',
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
