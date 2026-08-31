import { HomepageSignalLoader } from '@/features/homepage/homepage-signal-loader'
import { GalleryHeader } from '@/features/spatial-gallery/gallery-header'

import type { HomepageVariantProps } from './prototype-types'

import styles from './homepage-prototype.module.css'

export function SignalLoaderVariant({
  galleryItems,
  initialItemId
}: HomepageVariantProps) {
  return (
    <div data-prototype-variant='signal-loader'>
      <HomepageSignalLoader
        className={styles.signalLoader}
        header={<GalleryHeader />}
        historyKey='prototype-signal-loader'
        initialItemId={initialItemId}
        items={galleryItems}
        mainId='prototype-main'
      />
    </div>
  )
}
