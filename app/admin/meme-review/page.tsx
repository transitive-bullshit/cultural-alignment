import type { Metadata } from 'next'

import { buildMemeReviewSources } from '@/lib/meme-review/catalog'
import { readMemeFeedback } from '@/lib/meme-review/store'

import { MemeReviewClient } from './meme-review-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Meme review lab',
  description: 'Internal review surface for AI-safety meme directions.',
  robots: { index: false, follow: false }
}

export default async function MemeReviewPage() {
  const feedbackPromise = readMemeFeedback()
  const sources = buildMemeReviewSources()
  const feedbackDocument = await feedbackPromise

  return (
    <MemeReviewClient
      sources={sources}
      initialFeedback={feedbackDocument.feedback}
      initialSavedAt={feedbackDocument.updatedAt}
    />
  )
}
