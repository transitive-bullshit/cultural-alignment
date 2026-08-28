import Link from 'next/link'

import { SiteWordmark } from '@/components/site-wordmark'
import { GlobalSearch } from '@/features/search/global-search'
import { cn } from '@/lib/utils'

import styles from './site-header.module.css'

export type SiteHeaderProps = {
  readonly className?: string
  readonly context?: string
  readonly galleryTransitionTypes?: string[]
  readonly inset?: boolean
  readonly tagline?: boolean
}

export function SiteHeader({
  className,
  context,
  galleryTransitionTypes,
  inset = false,
  tagline = false
}: SiteHeaderProps) {
  return (
    <header
      className={cn(styles.header, className)}
      data-inset={inset || undefined}
    >
      <SiteWordmark className={styles.wordmark} />

      <div className={styles.center}>
        {tagline ? (
          <p className={styles.tagline}>
            Familiar stories <span aria-hidden='true'>/</span> unfamiliar AI
            problems
          </p>
        ) : context ? (
          <p className={styles.context}>{context}</p>
        ) : null}
      </div>

      <nav className={styles.actions} aria-label='Primary navigation'>
        <GlobalSearch className={styles.searchTrigger} />
        <Link
          className={styles.galleryLink}
          href='/scenarios'
          transitionTypes={galleryTransitionTypes}
        >
          Gallery <span aria-hidden='true'>↗</span>
        </Link>
      </nav>
    </header>
  )
}
