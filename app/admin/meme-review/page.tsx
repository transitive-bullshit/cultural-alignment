import type { Metadata } from 'next'

import { loadMemeReviewCatalog } from '@/lib/meme-review/catalog'
import {
  getMemeReviewStatePath,
  readMemeReviewState
} from '@/lib/meme-review/store'

import { MemeReviewClient } from './meme-review-client'
import styles from './meme-review.module.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Meme review lab',
  description: 'Internal review surface for AI-safety meme directions.',
  robots: { index: false, follow: false }
}

export default async function MemeReviewPage() {
  const pageData = await loadMemeReviewPageData()

  if (!pageData) {
    return <MemeReviewRecovery />
  }

  return <MemeReviewClient {...pageData} />
}

async function loadMemeReviewPageData() {
  try {
    const catalog = await loadMemeReviewCatalog()
    const initialState = await readMemeReviewState(
      getMemeReviewStatePath(catalog.feedbackPath),
      catalog.activeBatch
    )

    return {
      sources: catalog.sources,
      activeBatch: catalog.activeBatch,
      activeRevisionKey: catalog.activeRevisionKey,
      activeRevisionLabel: catalog.activeRevisionLabel,
      batchStatus: catalog.status,
      initialState,
      historyByIdeaId: catalog.historyByIdeaId
    }
  } catch (err) {
    console.error('[meme-review] Failed to reconcile review data', err)

    return null
  }
}

function MemeReviewRecovery() {
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
            The queue data is between revisions. The review surface stayed up,
            and no feedback was changed.
          </p>
        </div>
      </header>

      <aside className={styles.readinessNotice} role='alert'>
        <div>
          <strong>REVIEW DATA COULD NOT BE RECONCILED</strong>
          <p>
            Refresh once the current publish finishes. If this remains visible,
            the draft needs repair; the page itself will remain available.
          </p>
          <a href='/admin/meme-review'>Retry loading the review queue</a>
        </div>
      </aside>
    </div>
  )
}
