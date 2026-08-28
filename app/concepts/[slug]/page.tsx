import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ResourceDetailPage } from '@/features/content-navigation/resource-pages'
import { contentCatalog } from '@/lib/content/snapshot'

type ConceptPageProps = {
  readonly params: Promise<{ slug: string }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return contentCatalog.getStaticSlugs('concept').map((slug) => ({ slug }))
}

export async function generateMetadata({
  params
}: ConceptPageProps): Promise<Metadata> {
  const { slug } = await params
  const concept = contentCatalog.getResourcePage('concept', slug)

  return concept
    ? {
        title: concept.detailTitle,
        description: concept.description,
        alternates: { canonical: concept.href }
      }
    : {}
}

export default async function ConceptPage({ params }: ConceptPageProps) {
  const { slug } = await params
  const concept = contentCatalog.getResourcePage('concept', slug)

  if (!concept) notFound()

  return <ResourceDetailPage resource={concept} />
}
