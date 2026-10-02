import { ArrowRightIcon } from 'lucide-react'

import { IntentPrefetchLink } from '@/components/intent-prefetch-link'
import { SiteHeader } from '@/components/site-header'
import { OpenSearchButton } from '@/features/search/open-search-button'

import styles from './not-found.module.css'

export default function NotFound() {
  return (
    <main className={`${styles.page} experience-scope`} data-not-found>
      <SiteHeader inset />

      <section className={styles.message}>
        <p className={styles.code}>404 / RECORD NOT FOUND</p>
        <h1>This scene isn&rsquo;t in the archive.</h1>
        <p className={styles.explanation}>
          The address may have changed, or the record may never have existed.
        </p>
        <nav className={styles.actions} aria-label='Not found recovery'>
          <IntentPrefetchLink
            className={styles.browseAction}
            data-not-found-browse
            href='/scenarios'
          >
            <span>Browse all scenarios</span>
            <ArrowRightIcon aria-hidden='true' />
          </IntentPrefetchLink>
          {/* Opens the header's search rather than mounting a second one. */}
          <OpenSearchButton
            className={styles.searchAction}
            data-not-found-search
          >
            <span>Search the archive</span>
            <kbd>⌘K</kbd>
          </OpenSearchButton>
        </nav>
      </section>

      <span className={styles.crosshair} aria-hidden='true'>
        +
      </span>
    </main>
  )
}
