import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import galleryShellStyles from './gallery-page-shell.module.css'
import styles from './gallery-experience.module.css'
import { SpatialGallery } from './spatial-gallery'
import type { SpatialGalleryItem } from './types'

export function GalleryExperience({
  className,
  contentInert = false,
  header,
  headerInert = false,
  historyKey,
  initialItemId,
  items,
  mainId = 'gallery-main',
  overlay
}: {
  readonly className?: string
  readonly contentInert?: boolean
  readonly header: ReactNode
  readonly headerInert?: boolean
  readonly historyKey: string
  readonly initialItemId: string
  readonly items: readonly SpatialGalleryItem[]
  readonly mainId?: string
  readonly overlay?: ReactNode
}) {
  return (
    <div
      className={cn(galleryShellStyles.page, styles.experience, className)}
      data-gallery-experience
    >
      <div
        className={styles.headerSlot}
        aria-hidden={headerInert || undefined}
        inert={headerInert ? true : undefined}
      >
        {header}
      </div>
      <main id={mainId} className={styles.main} data-gallery-main tabIndex={-1}>
        <div
          className={styles.content}
          aria-hidden={contentInert || undefined}
          inert={contentInert ? true : undefined}
        >
          <SpatialGallery
            historyKey={historyKey}
            items={items}
            initialItemId={initialItemId}
          />
        </div>
        {overlay}
      </main>
    </div>
  )
}
