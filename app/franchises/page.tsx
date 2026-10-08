import type { Metadata } from 'next'

import { ResourceIndexPage } from '@/features/content-navigation/resource-pages'
import { contentCatalog } from '@/lib/content/snapshot'

export const metadata: Metadata = {
  title: 'Film and TV Franchises',
  description:
    'What popular film and TV franchises can teach us about AI safety, risks, and alignment.',
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
