import type { Metadata } from 'next'

import { ResourceIndexPage } from '@/features/content-navigation/resource-pages'
import { contentCatalog } from '@/lib/content/snapshot'

export const metadata: Metadata = {
  title: 'AI Safety Concepts',
  description:
    'AI safety and alignment concepts in plain language, each illustrated with familiar movie and TV scenes.',
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
