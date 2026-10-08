import type { Metadata } from 'next'

import { ResourceIndexPage } from '@/features/content-navigation/resource-pages'
import { contentCatalog } from '@/lib/content/snapshot'

export const metadata: Metadata = {
  title: 'AI Risk Families',
  description:
    'The major families of AI risk, illustrated with scenes from familiar movies and TV shows.',
  alternates: { canonical: '/risk-families' }
}

export default function RiskFamiliesPage() {
  return (
    <ResourceIndexPage
      kind='risk-family'
      resources={contentCatalog.listResources('risk-family')}
    />
  )
}
