import { ResourceIndexPage } from '@/features/content-navigation/resource-pages'
import { contentCatalog } from '@/lib/content/snapshot'
import { createPageMetadata } from '@/lib/page-metadata'

export const generateMetadata = createPageMetadata({
  title: 'Film and TV Franchises',
  description:
    'What popular film and TV franchises can teach us about AI safety, risks, and alignment.',
  canonical: '/franchises'
})

export default function FranchisesPage() {
  return (
    <ResourceIndexPage
      kind='franchise'
      resources={contentCatalog.listFranchiseResources()}
      crossLink={{ href: '/sources', label: 'All media sources' }}
    />
  )
}
