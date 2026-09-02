'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { GalleryExperience } from '@/features/spatial-gallery/gallery-experience'
import type { SpatialGalleryDesktopSelection } from '@/features/spatial-gallery/spatial-gallery'
import type { SpatialGalleryItem } from '@/features/spatial-gallery/types'
import { cn } from '@/lib/utils'

import styles from './homepage-words.module.css'

export type HomepageWordsItem = SpatialGalleryItem &
  Readonly<{
    concept: string
  }>

function WordsContextCard({ item }: { readonly item: HomepageWordsItem }) {
  return (
    <article
      className={styles.contextCard}
      data-words-context-card
      aria-labelledby={`words-context-source-${item.id}`}
    >
      <div data-words-reference>
        <h2 id={`words-context-source-${item.id}`} data-words-source>
          {item.source}
        </h2>
        <p data-words-scenario>{item.title}</p>
      </div>
      <div data-words-analogy>
        <p data-words-relation>This scene is an example of</p>
        <p data-words-concept>{item.concept}</p>
      </div>
    </article>
  )
}

function renderWordsDesktopSelection({
  item,
  onOpen
}: SpatialGalleryDesktopSelection<HomepageWordsItem>) {
  return (
    <>
      <WordsContextCard item={item} />
      <button
        className={styles.keyboardOpen}
        data-homepage-selected-scenario-open
        type='button'
        onClick={onOpen}
      >
        Open selected scenario: {item.title}
      </button>
    </>
  )
}

export function HomepageWords({
  className,
  header,
  historyKey,
  initialItemId,
  inlineIntroduction,
  items,
  mainId = 'home-gallery-main'
}: {
  readonly className?: string
  readonly header: ReactNode
  readonly historyKey: string
  readonly initialItemId: string
  readonly inlineIntroduction?: ReactNode
  readonly items: readonly HomepageWordsItem[]
  readonly mainId?: string
}) {
  const galleryItems = useMemo(
    () => items.map((item) => ({ ...item, lens: item.concept })),
    [items]
  )

  return (
    <div
      className={cn('experience-scope', styles.root, className)}
      data-homepage-words
      data-site-footer='hidden'
    >
      {inlineIntroduction === undefined ? (
        <h1 className={styles.srOnly}>
          Understand AI safety through scenes you already know.
        </h1>
      ) : null}
      <GalleryExperience
        className={styles.gallery}
        header={header}
        historyKey={historyKey}
        initialItemId={initialItemId}
        items={galleryItems}
        mainId={mainId}
        renderDesktopSelection={renderWordsDesktopSelection}
      />
      {inlineIntroduction}
    </div>
  )
}

export function HomepageWordsInlineIntroduction({
  introDismissed: controlledIntroDismissed,
  onDismissIntro
}: {
  readonly introDismissed?: boolean
  readonly onDismissIntro?: () => void
}) {
  const [internalIntroDismissed, setInternalIntroDismissed] = useState(false)
  const introDismissed = controlledIntroDismissed ?? internalIntroDismissed
  const dismissIntro = useCallback(() => {
    if (controlledIntroDismissed === undefined) {
      setInternalIntroDismissed(true)
    }
    onDismissIntro?.()
  }, [controlledIntroDismissed, onDismissIntro])

  return (
    <div
      className={styles.guideLayer}
      data-dismissed={introDismissed || undefined}
      data-homepage-intro
    >
      <aside
        aria-describedby='homepage-words-inline-instruction'
        aria-hidden={introDismissed || undefined}
        aria-labelledby='homepage-words-inline-heading'
        className={styles.panel}
        inert={introDismissed ? true : undefined}
      >
        <button
          className={styles.dismissButton}
          data-homepage-intro-dismiss
          type='button'
          aria-label='Dismiss introduction'
          onClick={dismissIntro}
        >
          <span aria-hidden='true'>×</span>
        </button>
        <h1 id='homepage-words-inline-heading'>
          Understand AI safety through scenes you already know.
        </h1>
        <p
          className={styles.instruction}
          id='homepage-words-inline-instruction'
        >
          <span aria-hidden='true'>⊹</span>
          Drag or scroll. Hover a scene to reveal its AI safety concept.
        </p>
      </aside>
    </div>
  )
}
