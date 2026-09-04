'use client'

import { useEffect } from 'react'

import styles from './meme-review.module.css'

export default function MemeReviewError({
  error,
  reset
}: Readonly<{
  error: Error & { digest?: string }
  reset: () => void
}>) {
  useEffect(() => {
    console.error('[meme-review] Review surface render failed', error)
  }, [error])

  return (
    <div
      className={`experience-scope ${styles.root}`}
      data-site-footer='hidden'
      data-meme-review
      data-review-status='recovering'
    >
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            Internal taste-capture tool · unlisted
          </p>
          <h1>Meme review lab</h1>
          <p>
            The review surface hit a rendering problem. Your saved feedback was
            not changed.
          </p>
        </div>
      </header>

      <aside className={styles.readinessNotice} role='alert'>
        <div>
          <strong>MEME REVIEW STAYED AVAILABLE</strong>
          <p>Retry after the current draft update finishes.</p>
          <button type='button' onClick={reset}>
            Retry loading the review queue
          </button>
        </div>
      </aside>
    </div>
  )
}
