import Link from 'next/link'

import { IntentPrefetchLink } from '@/components/intent-prefetch-link'
import { SiteWordmark } from '@/components/site-wordmark'
import { GlobalSearch } from '@/features/search/global-search'
import { siteTagline } from '@/lib/site'
import { cn } from '@/lib/utils'

import styles from './site-header.module.css'

export type SiteHeaderProps = {
  readonly breadcrumb?: {
    readonly current: string
    readonly parent: {
      readonly href: string
      readonly label: string
    }
  }
  readonly className?: string
  readonly context?: string
  readonly galleryTransitionTypes?: string[]
  readonly inset?: boolean
  readonly tagline?: boolean
}

export function SiteHeader({
  breadcrumb,
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
        {breadcrumb ? (
          <nav className={styles.breadcrumb} aria-label='Breadcrumb'>
            <ol>
              <li>
                <Link
                  className={styles.breadcrumbLink}
                  href={breadcrumb.parent.href}
                >
                  {breadcrumb.parent.label}
                </Link>
              </li>
              <li className={styles.currentBreadcrumb}>
                <span className={styles.breadcrumbSeparator} aria-hidden='true'>
                  /
                </span>
                <span aria-current='page'>{breadcrumb.current}</span>
              </li>
            </ol>
          </nav>
        ) : tagline ? (
          <p className={styles.tagline}>{siteTagline}</p>
        ) : context ? (
          <p className={styles.context}>{context}</p>
        ) : null}
      </div>

      <nav className={styles.actions} aria-label='Primary navigation'>
        <GlobalSearch className={styles.searchTrigger} />
        <IntentPrefetchLink
          className={styles.galleryLink}
          href='/scenarios'
          transitionTypes={galleryTransitionTypes}
        >
          Gallery <span aria-hidden='true'>↗</span>
        </IntentPrefetchLink>
      </nav>
    </header>
  )
}
