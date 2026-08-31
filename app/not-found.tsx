import { IntentPrefetchLink } from '@/components/intent-prefetch-link'
import { SiteHeader } from '@/components/site-header'

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
        <nav aria-label='Not found recovery'>
          <IntentPrefetchLink href='/scenarios'>
            Browse all scenarios
          </IntentPrefetchLink>
        </nav>
      </section>

      <span className={styles.crosshair} aria-hidden='true'>
        +
      </span>
    </main>
  )
}
