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

const featuredItems = toSpatialGalleryItems(
  contentCatalog.listScenarioCards({ featuredOnly: true })
)
const initialItem = findInitialSpatialGalleryItem(featuredItems)
const totalSceneCount = contentCatalog.listScenarioCards().length

export default function HomePage() {
  if (!initialItem) {
    throw new Error('The homepage requires at least one featured scenario')
  }

  return (
    <HomepageSignalLoader
      header={<GalleryHeader />}
      historyKey='archive:featured'
      initialItemId={initialItem.id}
      items={featuredItems}
      totalSceneCount={totalSceneCount}
    />
  )
}
