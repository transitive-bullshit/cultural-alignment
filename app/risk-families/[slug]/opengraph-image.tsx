import { notFound } from 'next/navigation'

import {
  taxonomyOpenGraphImageContentType,
  taxonomyOpenGraphImageSize,
  renderTaxonomyOpenGraphImage
} from '@/features/content-navigation/taxonomy-opengraph-image'
import { contentCatalog } from '@/lib/content/snapshot'

export const alt = 'A Cultural Alignment AI risk family with its full name'
export const size = taxonomyOpenGraphImageSize
export const contentType = taxonomyOpenGraphImageContentType

export default async function Image({
  params
}: {
  readonly params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const resource = contentCatalog.getResourcePage('risk-family', slug)

  if (!resource) notFound()

  return renderTaxonomyOpenGraphImage({
    category: 'AI risk family',
    title: resource.detailTitle
  })
}
