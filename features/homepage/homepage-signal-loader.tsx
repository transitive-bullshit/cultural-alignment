'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { GalleryExperience } from '@/features/spatial-gallery/gallery-experience'
import type { SpatialGalleryItem } from '@/features/spatial-gallery/types'
import { cn } from '@/lib/utils'

import styles from './homepage-signal-loader.module.css'

type IntroPhase = 'intro' | 'exiting' | 'gallery'

export function HomepageSignalLoader({
  className,
  header,
  historyKey,
  initialItemId,
  items,
  mainId = 'home-gallery-main'
}: {
  readonly className?: string
  readonly header: ReactNode
  readonly historyKey: string
  readonly initialItemId: string
  readonly items: readonly SpatialGalleryItem[]
  readonly mainId?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [galleryReady, setGalleryReady] = useState(false)
  const [phase, setPhase] = useState<IntroPhase>('intro')

  const beginExit = useCallback(() => {
    setPhase((current) => (current === 'intro' ? 'exiting' : current))
  }, [])

  const finishExit = useCallback(() => {
    const root = rootRef.current
    const intro = root?.querySelector('[data-signal-loader-intro]')
    const restoreFocus = Boolean(intro?.contains(document.activeElement))

    setPhase((current) => (current === 'exiting' ? 'gallery' : current))
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        root?.querySelector<HTMLElement>('[data-gallery-main]')?.focus()
      })
    }
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const readReadyState = () => {
      if (root.querySelector('[data-gallery-transition-ready]')) {
        setGalleryReady(true)
      }
    }
    const observer = new MutationObserver(readReadyState)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-gallery-transition-ready'],
      subtree: true
    })
    readReadyState()

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (phase !== 'exiting') return

    const timer = window.setTimeout(finishExit, 360)
    return () => window.clearTimeout(timer)
  }, [finishExit, phase])

  return (
    <div
      ref={rootRef}
      className={cn('experience-scope', styles.root, className)}
      data-site-footer='hidden'
      data-intro-active={phase === 'gallery' ? undefined : ''}
      data-homepage-signal-loader
    >
      <GalleryExperience
        className={styles.gallery}
        contentInert={phase !== 'gallery'}
        header={header}
        headerInert={phase !== 'gallery'}
        historyKey={historyKey}
        initialItemId={initialItemId}
        items={items}
        mainId={mainId}
        overlay={
          phase === 'gallery' ? null : (
            <section
              className={styles.intro}
              data-phase={phase}
              data-signal-loader-intro
              aria-labelledby='signal-loader-title'
              onTransitionEnd={(event) => {
                if (event.currentTarget === event.target) finishExit()
              }}
            >
              <div className={styles.grid} aria-hidden='true' />

              <div className={styles.introBody}>
                <p className={styles.eyebrow}>
                  <span>CA—001</span>
                  A field guide to AI risk
                </p>

                <h1 id='signal-loader-title'>
                  Familiar stories.
                  <em>Real AI risks.</em>
                </h1>

                <p className={styles.summary}>
                  Film and television give us a shared language for abstract AI
                  safety problems. Start with a scene you remember, then follow
                  the pattern into the real world.
                </p>

                <ol className={styles.sequence} aria-label='How the site works'>
                  <li>
                    <span>01</span>
                    <strong>Recognize a scene</strong>
                    <small>Film · television · shared memory</small>
                  </li>
                  <li>
                    <span>02</span>
                    <strong>See the pattern</strong>
                    <small>Goals · incentives · unintended behavior</small>
                  </li>
                  <li>
                    <span>03</span>
                    <strong>Name the risk</strong>
                    <small>Concepts · research · further paths</small>
                  </li>
                </ol>
              </div>

              <div className={styles.loadingRail}>
                <div
                  className={styles.loadingMeta}
                  role='status'
                  aria-live='polite'
                >
                  <span>
                    {galleryReady
                      ? 'First frame ready'
                      : 'Preparing scenario field'}
                  </span>
                  <span>{items.length} scenes</span>
                </div>
                <div
                  className={styles.progress}
                  data-ready={galleryReady || undefined}
                  aria-hidden='true'
                >
                  <span />
                </div>
                <button
                  className={styles.enterArchive}
                  data-signal-loader-enter
                  type='button'
                  onClick={beginExit}
                >
                  Explore the archive <span aria-hidden='true'>↗</span>
                </button>
              </div>
            </section>
          )
        }
      />
    </div>
  )
}
