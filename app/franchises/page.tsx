import type { Metadata } from 'next'

import { ResourceIndexPage } from '@/features/content-navigation/resource-pages'
import { contentCatalog } from '@/lib/content/snapshot'

export const metadata: Metadata = {
  title: 'Film and TV Franchises',
  description:
    'Film and TV franchises and the AI safety lessons drawn from their scenes.',
  alternates: { canonical: '/franchises' }
}

export default function FranchisesPage() {
  return (
    <ResourceIndexPage
      kind='franchise'
      resources={contentCatalog.listFranchiseResources()}
      crossLink={{ href: '/sources', label: 'All media sources' }}
    />
  )
}
