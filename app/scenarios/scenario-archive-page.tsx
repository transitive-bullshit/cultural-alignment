import { notFound } from 'next/navigation'

import { SiteHeader } from '@/components/site-header'
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

export const scenarioFamilies = contentCatalog.listResources('risk-family')

export function getScenarioFamily(slug: string) {
  return scenarioFamilies.find((family) => family.slug === slug) ?? null
}

export function ScenarioArchivePage({
  familySlug
}: {
  readonly familySlug: string | null
}) {
  if (familySlug && !getScenarioFamily(familySlug)) notFound()

  const params = { family: familySlug }
  const scenarios = contentCatalog.listScenarioCards({
    riskFamilySlug: familySlug ?? undefined
  })
  const items = toSpatialGalleryItems(scenarios)
  const galleryIdentity = `archive:${familySlug ?? 'all'}`
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
          families={scenarioFamilies}
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
