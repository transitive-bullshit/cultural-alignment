import type { Metadata } from 'next'

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

const families = contentCatalog.listResources('risk-family')
const items = toSpatialGalleryItems(contentCatalog.listScenarioCards())
const initialItem = findInitialSpatialGalleryItem(items)

export const metadata: Metadata = {
  title: 'AI Safety Scenarios',
  description:
    'Movie and TV scenes mapped to AI safety concepts, with why each analogy works and where it breaks.',
  alternates: { canonical: '/scenarios' }
}

export default function ScenariosPage() {
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
        <BrowseToolbar families={families} resultCount={items.length} />
        <SpatialGallery
          historyKey='archive:all'
          index={{
            title: 'Scenario index',
            description:
              'Each scenario pairs a familiar film or TV scene with the AI risks it illustrates. Open one to read why the analogy works and where it breaks.'
          }}
          items={items}
          initialItemId={initialItem.id}
        />
        <GalleryIntroDialog example={galleryIntroExample} mode='once' />
      </main>
    </GalleryIntroMotionProvider>
  )
}
