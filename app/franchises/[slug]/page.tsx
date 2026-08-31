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

type FranchisePageProps = {
  readonly params: Promise<{ slug: string }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return contentCatalog.getStaticSlugs('franchise').map((slug) => ({ slug }))
}

export async function generateMetadata(
  { params }: FranchisePageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params
  const franchise = contentCatalog.getResourcePage('franchise', slug)

  return franchise
    ? resolveContentSocialMetadata(getResourceSocialMetadata(franchise), parent)
    : {}
}

export default async function FranchisePage({ params }: FranchisePageProps) {
  const { slug } = await params
  const franchise = contentCatalog.getResourcePage('franchise', slug)

  if (!franchise) notFound()

  return (
    <>
      <JsonLd data={getResourceStructuredData(franchise)} scope='page' />
      <ResourceDetailPage resource={franchise} />
    </>
  )
}
