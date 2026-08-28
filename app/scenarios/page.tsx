import type { Metadata } from 'next'

import { GalleryPageHeader } from '@/features/spatial-gallery/gallery-page-header'
import {
  parseBrowseGalleryParams,
  type BrowseSearchParams
} from '@/features/spatial-gallery/browse-params'
import { toSpatialGalleryItems } from '@/features/spatial-gallery/gallery-items'
import { SpatialGallery } from '@/features/spatial-gallery/spatial-gallery'
import { contentCatalog } from '@/lib/content/snapshot'

import styles from '@/features/spatial-gallery/gallery-page-shell.module.css'
import { BrowseToolbar } from './browse-toolbar'

export const metadata: Metadata = {
  title: 'All scenarios',
  description: 'Browse every cultural analogy by risk family and release date.'
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
    riskFamilySlug: params.family ?? undefined,
    sort: params.sort
  })
  const items = toSpatialGalleryItems(scenarios)
  const galleryIdentity = `browse:${params.family ?? 'all'}:${params.sort}`
  const initialItem = items[0]

  if (!initialItem) {
    throw new Error('The all-scenarios gallery requires at least one scenario')
  }

  return (
    <main className={`experience-scope ${styles.page} ${styles.browsePage}`}>
      <GalleryPageHeader page='browse' />
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
        mode='browse'
      />
    </main>
  )
}
