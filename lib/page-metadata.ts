import type { Metadata, ResolvingMetadata } from 'next'

import { siteName } from '@/lib/site'

/** Keep a static page's sharing identity aligned with its canonical URL. */
export function createPageMetadata({
  canonical,
  description,
  title
}: {
  readonly canonical: string
  readonly description: string
  readonly title: string
}) {
  return async function generateMetadata(
    _props: unknown,
    parent: ResolvingMetadata
  ): Promise<Metadata> {
    return {
      title,
      description,
      alternates: { canonical },
      // Open Graph is shallowly merged: preserve the root's file-based image.
      // Next.js copies the resolved title and description into sharing tags.
      openGraph: {
        url: canonical,
        siteName,
        locale: 'en_US',
        type: 'website',
        images: (await parent).openGraph?.images
      }
    }
  }
}
