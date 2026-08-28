import type { Metadata } from 'next'

import { ResourceIndexPage } from '@/features/content-navigation/resource-pages'
import { contentCatalog } from '@/lib/content/snapshot'

export const metadata: Metadata = {
  title: 'AI Safety Concepts',
  description:
    'Browse the AI safety and alignment concepts indexed by the collection.',
  alternates: { canonical: '/concepts' }
}

export default function ConceptsPage() {
  return (
    <ResourceIndexPage
      kind='concept'
      resources={contentCatalog.listResources('concept')}
    />
  )
}
