import { ResourceIndexPage } from '@/features/content-navigation/resource-pages'
import { contentCatalog } from '@/lib/content/snapshot'
import { createPageMetadata } from '@/lib/page-metadata'

export const generateMetadata = createPageMetadata({
  title: 'Movies and TV Shows',
  description:
    'What popular movies and TV shows can teach us about AI safety, risks, and alignment.',
  canonical: '/sources'
})

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
