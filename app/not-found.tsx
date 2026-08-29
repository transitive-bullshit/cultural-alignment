import Link from 'next/link'

import { SiteHeader } from '@/components/site-header'

import styles from './not-found.module.css'

export default function NotFound() {
  return (
    <main className={`${styles.page} experience-scope`} data-not-found>
      <SiteHeader inset context='Archive exception / 404' />

      <section className={styles.message}>
        <p className={styles.code}>404 / RECORD NOT FOUND</p>
        <h1>This scene isn&rsquo;t in the archive.</h1>
        <p className={styles.explanation}>
          The address may have changed, or the record may never have existed.
        </p>
        <nav aria-label='Not found recovery'>
          <Link href='/scenarios'>Browse all scenarios</Link>
        </nav>
      </section>

      <span className={styles.crosshair} aria-hidden='true'>
        +
      </span>
    </main>
  )
}
