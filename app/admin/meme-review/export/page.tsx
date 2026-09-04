import type { Metadata } from 'next'

import { loadMemeReviewCatalog } from '@/lib/meme-review/catalog'
import { resolveFinalizedMemeRenderTargets } from '@/lib/meme-review/finalized-renders'
import {
  getMemeReviewStatePath,
  readMemeReviewState
} from '@/lib/meme-review/store'

import { MemePreview } from '../meme-preview'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Finalized meme export surface',
  robots: { index: false, follow: false }
}

export default async function FinalizedMemeExportPage() {
  const catalog = await loadMemeReviewCatalog()
  const state = await readMemeReviewState(
    getMemeReviewStatePath(catalog.feedbackPath),
    catalog.activeBatch
  )
  const targets = resolveFinalizedMemeRenderTargets({
    sources: catalog.sources,
    historyByIdeaId: catalog.historyByIdeaId,
    feedback: state.feedback,
    activeRevisionKey: catalog.activeRevisionKey,
    activeRevisionLabel: catalog.activeRevisionLabel
  })

  return (
    <main
      className={styles.root}
      data-finalized-meme-export-surface
      data-finalized-meme-count={targets.length}
      data-site-footer='hidden'
    >
      {targets.map((target) => (
        <article
          className={styles.item}
          key={target.ideaId}
          data-finalized-meme-export={target.ideaId}
          data-scenario-slug={target.scenarioSlug}
          data-source-slug={target.sourceSlug}
          data-revision-key={target.revisionKey}
          data-payload-fingerprint={target.payloadFingerprint}
          data-rendered-payload-fingerprint={target.renderedPayloadFingerprint}
          data-terminal-periods-normalized={
            target.terminalPeriodNormalization.applied ? 'true' : 'false'
          }
        >
          {target.renderer === 1 ? (
            <MemePreview
              mode='archived'
              idea={target.idea}
              image={target.image}
            />
          ) : (
            <MemePreview
              mode='current'
              idea={target.idea}
              assets={target.assets}
            />
          )}
        </article>
      ))}
    </main>
  )
}
