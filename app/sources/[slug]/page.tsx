import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'

import { ResourceDetailPage } from '@/features/content-navigation/resource-pages'
import {
  getResourceSocialMetadata,
  resolveContentSocialMetadata
} from '@/lib/content/social-metadata'
import { contentCatalog } from '@/lib/content/snapshot'

type SourcePageProps = {
  readonly params: Promise<{ slug: string }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return contentCatalog.getStaticSlugs('source').map((slug) => ({ slug }))
}

export async function generateMetadata(
  { params }: SourcePageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params
  const source = contentCatalog.getResourcePage('source', slug)

  return source
    ? resolveContentSocialMetadata(getResourceSocialMetadata(source), parent)
    : {}
}

export default async function SourcePage({ params }: SourcePageProps) {
  const { slug } = await params
  const source = contentCatalog.getResourcePage('source', slug)

  if (!source) notFound()

  return <ResourceDetailPage resource={source} />
}
