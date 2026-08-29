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

type ConceptPageProps = {
  readonly params: Promise<{ slug: string }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return contentCatalog.getStaticSlugs('concept').map((slug) => ({ slug }))
}

export async function generateMetadata(
  { params }: ConceptPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params
  const concept = contentCatalog.getResourcePage('concept', slug)

  return concept
    ? resolveContentSocialMetadata(getResourceSocialMetadata(concept), parent)
    : {}
}

export default async function ConceptPage({ params }: ConceptPageProps) {
  const { slug } = await params
  const concept = contentCatalog.getResourcePage('concept', slug)

  if (!concept) notFound()

  return (
    <>
      <JsonLd data={getResourceStructuredData(concept)} scope='page' />
      <ResourceDetailPage resource={concept} />
    </>
  )
}
