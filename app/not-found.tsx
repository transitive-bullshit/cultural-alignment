import Link from 'next/link'

import styles from './not-found.module.css'

export default function NotFound() {
  return (
    <main className={`${styles.page} experience-scope`}>
      <header className={styles.header}>
        <Link href='/'>Cultural Alignment</Link>
        <span>Archive exception / 404</span>
      </header>

      <section className={styles.message}>
        <p className={styles.code}>404 / RECORD NOT FOUND</p>
        <h1>This scene isn&rsquo;t in the archive.</h1>
        <p className={styles.explanation}>
          The address may have changed, or the record may never have existed.
        </p>
        <nav aria-label='Not found recovery'>
          <Link href='/scenarios'>Browse all scenarios</Link>
          <Link href='/search'>Search the archive</Link>
        </nav>
      </section>

      <span className={styles.crosshair} aria-hidden='true'>
        +
      </span>
    </main>
  )
}
