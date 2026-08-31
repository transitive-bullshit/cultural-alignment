import type { Metadata } from 'next'

import { SiteHeader } from '@/components/site-header'
import { toSpatialGalleryItems } from '@/features/spatial-gallery/gallery-items'
import { SpatialGallery } from '@/features/spatial-gallery/spatial-gallery'
import { contentCatalog } from '@/lib/content/snapshot'
import { siteName, siteSummary } from '@/lib/site'

import styles from '@/features/spatial-gallery/gallery-page-shell.module.css'

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
const initialItem =
  featuredItems.find(({ slug }) => slug.startsWith('lacie-games')) ??
  featuredItems[0]

export default function HomePage() {
  if (!initialItem) {
    throw new Error('The featured gallery requires at least one scenario')
  }

  return (
    <main
      className={`experience-scope ${styles.page}`}
      data-site-footer='hidden'
    >
      <SiteHeader className={styles.galleryHeader} />
      <SpatialGallery
        historyKey='featured'
        items={featuredItems}
        initialItemId={initialItem.id}
        mode='featured'
      />
    </main>
  )
}
