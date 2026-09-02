import type { Metadata } from 'next'

import {
  HomepageWords,
  type HomepageWordsItem
} from '@/features/homepage/homepage-words'
import { GalleryIntroDialog } from '@/features/spatial-gallery/gallery-intro-dialog'
import { galleryIntroExample } from '@/features/spatial-gallery/gallery-intro-example'
import { GalleryIntroMotionProvider } from '@/features/spatial-gallery/gallery-intro-motion'
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

const featuredItems: readonly HomepageWordsItem[] = toSpatialGalleryItems(
  contentCatalog.listScenarioCards({ featuredOnly: true })
).map((item) => {
  const concept = contentCatalog.getScenarioPage(item.slug)?.concepts[0]?.title

  if (!concept) {
    throw new Error(`Missing primary homepage concept: ${item.slug}`)
  }

  return { ...item, concept }
})
const initialItem = findInitialSpatialGalleryItem(featuredItems)

export default function HomePage() {
  if (!initialItem) {
    throw new Error('The homepage requires at least one featured scenario')
  }

  return (
    <GalleryIntroMotionProvider>
      <HomepageWords
        header={<GalleryHeader />}
        historyKey='archive:featured'
        initialItemId={initialItem.id}
        items={featuredItems}
      />
      <GalleryIntroDialog example={galleryIntroExample} mode='landing' />
    </GalleryIntroMotionProvider>
  )
}
