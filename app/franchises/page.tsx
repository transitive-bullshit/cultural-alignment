import type { Metadata } from 'next'

import { ResourceIndexPage } from '@/features/content-navigation/resource-pages'
import { contentCatalog } from '@/lib/content/snapshot'

export const metadata: Metadata = {
  title: 'Media Franchises',
  description:
    'Browse the media franchises represented across the cultural alignment collection.',
  alternates: { canonical: '/franchises' }
}

export default function FranchisesPage() {
  return (
    <ResourceIndexPage
      kind='franchise'
      resources={contentCatalog.listResources('franchise')}
    />
  )
}
