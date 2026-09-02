import type { Metadata } from 'next'

import { SiteHeader } from '@/components/site-header'
import {
  parseBrowseGalleryParams,
  type BrowseSearchParams
} from '@/features/spatial-gallery/browse-params'
import {
  findInitialSpatialGalleryItem,
  toSpatialGalleryItems
} from '@/features/spatial-gallery/gallery-items'
import { GalleryIntroDialog } from '@/features/spatial-gallery/gallery-intro-dialog'
import { galleryIntroExample } from '@/features/spatial-gallery/gallery-intro-example'
import { GalleryIntroMotionProvider } from '@/features/spatial-gallery/gallery-intro-motion'
import { SpatialGallery } from '@/features/spatial-gallery/spatial-gallery'
import { contentCatalog } from '@/lib/content/snapshot'

import styles from '@/features/spatial-gallery/gallery-page-shell.module.css'
import { BrowseToolbar } from './browse-toolbar'

export const metadata: Metadata = {
  title: 'All scenarios',
  description: 'Browse every cultural analogy by risk family.'
}

export default async function ScenariosPage({
  searchParams
}: {
  readonly searchParams: Promise<BrowseSearchParams>
}) {
  const requestedParams = await searchParams
  const families = contentCatalog.listResources('risk-family')
  const params = parseBrowseGalleryParams(
    requestedParams,
    new Set(families.map(({ slug }) => slug))
  )
  const scenarios = contentCatalog.listScenarioCards({
    riskFamilySlug: params.family ?? undefined
  })
  const items = toSpatialGalleryItems(scenarios)
  const galleryIdentity = `archive:${params.family ?? 'all'}`
  const initialItem = findInitialSpatialGalleryItem(items)

  if (!initialItem) {
    throw new Error('The scenario archive requires at least one scenario')
  }

  return (
    <GalleryIntroMotionProvider>
      <main
        className={`experience-scope ${styles.page} ${styles.browsePage}`}
        data-gallery-main
        data-site-footer='hidden'
        tabIndex={-1}
      >
        <SiteHeader className={styles.galleryHeader} />
        <BrowseToolbar
          families={families}
          params={params}
          resultCount={items.length}
        />
        <SpatialGallery
          key={galleryIdentity}
          historyKey={galleryIdentity}
          items={items}
          initialItemId={initialItem.id}
        />
        <GalleryIntroDialog example={galleryIntroExample} mode='once' />
      </main>
    </GalleryIntroMotionProvider>
  )
}
