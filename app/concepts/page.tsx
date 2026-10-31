import { ResourceIndexPage } from '@/features/content-navigation/resource-pages'
import { contentCatalog } from '@/lib/content/snapshot'
import { createPageMetadata } from '@/lib/page-metadata'

export const generateMetadata = createPageMetadata({
  title: 'AI Safety Concepts',
  description:
    'Key AI safety and alignment concepts, explained through familiar movie and TV scenes.',
  canonical: '/concepts'
})

export default function ConceptsPage() {
  return (
    <ResourceIndexPage
      kind='concept'
      resources={contentCatalog.listResources('concept')}
    />
  )
}
