import { notFound } from 'next/navigation'

import {
  mediaResourceOpenGraphImageContentType,
  mediaResourceOpenGraphImageSize,
  renderMediaResourceOpenGraphImage
} from '@/features/content-navigation/media-resource-opengraph-image'
import { contentCatalog } from '@/lib/content/snapshot'

export const alt = 'A Cultural Alignment media franchise image'
export const size = mediaResourceOpenGraphImageSize
export const contentType = mediaResourceOpenGraphImageContentType

export default async function Image({
  params
}: {
  readonly params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const franchise = contentCatalog.getResourcePage('franchise', slug)

  if (!franchise || franchise.kind !== 'franchise') notFound()

  return renderMediaResourceOpenGraphImage({
    image: franchise.image,
    title: franchise.title
  })
}
