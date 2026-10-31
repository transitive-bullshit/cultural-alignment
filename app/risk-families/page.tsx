import { ResourceIndexPage } from '@/features/content-navigation/resource-pages'
import { contentCatalog } from '@/lib/content/snapshot'
import { createPageMetadata } from '@/lib/page-metadata'

export const generateMetadata = createPageMetadata({
  title: 'AI Risk Families',
  description:
    'The major families of AI risk, illustrated with scenes from familiar movies and TV shows.',
  canonical: '/risk-families'
})

export default function RiskFamiliesPage() {
  return (
    <ResourceIndexPage
      kind='risk-family'
      resources={contentCatalog.listResources('risk-family')}
    />
  )
}
