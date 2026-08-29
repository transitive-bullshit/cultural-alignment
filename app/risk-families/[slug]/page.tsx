import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'

import { JsonLd } from '@/components/json-ld'
import { ResourceDetailPage } from '@/features/content-navigation/resource-pages'
import {
  getResourceSocialMetadata,
  resolveContentSocialMetadata
} from '@/lib/content/social-metadata'
import { contentCatalog } from '@/lib/content/snapshot'
import { getResourceStructuredData } from '@/lib/structured-data'

type RiskFamilyPageProps = {
  readonly params: Promise<{ slug: string }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return contentCatalog.getStaticSlugs('risk-family').map((slug) => ({ slug }))
}

export async function generateMetadata(
  { params }: RiskFamilyPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params
  const family = contentCatalog.getResourcePage('risk-family', slug)

  return family
    ? resolveContentSocialMetadata(getResourceSocialMetadata(family), parent)
    : {}
}

export default async function RiskFamilyPage({ params }: RiskFamilyPageProps) {
  const { slug } = await params
  const family = contentCatalog.getResourcePage('risk-family', slug)

  if (!family) notFound()

  return (
    <>
      <JsonLd data={getResourceStructuredData(family)} scope='page' />
      <ResourceDetailPage resource={family} />
    </>
  )
}
