import type { Metadata } from 'next'

import { HomepageSignalLoader } from '@/features/homepage/homepage-signal-loader'
import { GalleryHeader } from '@/features/spatial-gallery/gallery-header'
import {
  findInitialSpatialGalleryItem,
  toSpatialGalleryItems
} from '@/features/spatial-gallery/gallery-items'
import { contentCatalog } from '@/lib/content/snapshot'
import { siteName, siteSummary } from '@/lib/site'

export const metadata: Metadata = {
  title: siteName,
  description: siteSummary,
  alternates: { canonical: '/' },
  openGraph: {
    title: siteName,
    description: siteSummary,
    url: '/',
    siteName,
    locale: 'en_US',
    type: 'website'
  }
}

const archiveItems = toSpatialGalleryItems(contentCatalog.listScenarioCards())
const initialItem = findInitialSpatialGalleryItem(archiveItems)

export default function HomePage() {
  if (!initialItem) {
    throw new Error('The scenario archive requires at least one scenario')
  }

  return (
    <HomepageSignalLoader
      header={<GalleryHeader />}
      historyKey='archive:all'
      initialItemId={initialItem.id}
      items={archiveItems}
    />
  )
}
