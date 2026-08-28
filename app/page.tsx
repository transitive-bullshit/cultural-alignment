import type { Metadata } from 'next'

import { GalleryPageHeader } from '@/features/spatial-gallery/gallery-page-header'
import { toSpatialGalleryItems } from '@/features/spatial-gallery/gallery-items'
import { SpatialGallery } from '@/features/spatial-gallery/spatial-gallery'
import { contentCatalog } from '@/lib/content/snapshot'

import styles from '@/features/spatial-gallery/gallery-page-shell.module.css'

export const metadata: Metadata = {
  title: 'Cultural Alignment',
  description:
    'Explore familiar film and television scenes as analogies for unfamiliar AI safety problems.'
}

const featuredItems = toSpatialGalleryItems(
  contentCatalog.listScenarioCards({ featuredOnly: true })
)
const initialItem =
  featuredItems.find(({ slug }) => slug.startsWith('lacie-games')) ??
  featuredItems[0]

export default function HomePage() {
  if (!initialItem) {
    throw new Error('The featured gallery requires at least one scenario')
  }

  return (
    <main className={`experience-scope ${styles.page}`}>
      <GalleryPageHeader page='featured' />
      <SpatialGallery
        historyKey='featured'
        items={featuredItems}
        initialItemId={initialItem.id}
        mode='featured'
      />
    </main>
  )
}
