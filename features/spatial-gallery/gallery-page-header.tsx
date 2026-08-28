import Link from 'next/link'

import { GlobalSearch } from '@/features/search/global-search'

import styles from './gallery-page-shell.module.css'

export function GalleryPageHeader({
  page
}: {
  readonly page: 'featured' | 'browse'
}) {
  return (
    <header className={styles.header}>
      <Link
        className={styles.wordmark}
        href='/'
        aria-label='Cultural Alignment home'
      >
        Cultural Alignment
      </Link>

      <p className={styles.tagline}>
        Familiar stories <span aria-hidden='true'>/</span> unfamiliar AI
        problems
      </p>

      <nav className={styles.headerActions} aria-label='Primary navigation'>
        <GlobalSearch />
        <Link
          className={styles.routeLink}
          href={page === 'featured' ? '/scenarios' : '/'}
        >
          {page === 'featured' ? 'Explore all' : 'Featured'}{' '}
          <span aria-hidden='true'>↗</span>
        </Link>
      </nav>
    </header>
  )
}
