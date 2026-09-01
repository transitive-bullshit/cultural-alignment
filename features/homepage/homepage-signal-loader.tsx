'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { GalleryExperience } from '@/features/spatial-gallery/gallery-experience'
import type { SpatialGalleryItem } from '@/features/spatial-gallery/types'
import { cn } from '@/lib/utils'

import styles from './homepage-signal-loader.module.css'

type IntroPhase = 'intro' | 'exiting' | 'gallery'

const headlineFont = '800 1em "Barlow Condensed"'

export function HomepageSignalLoader({
  className,
  header,
  historyKey,
  initialItemId,
  items,
  mainId = 'home-gallery-main',
  totalSceneCount
}: {
  readonly className?: string
  readonly header: ReactNode
  readonly historyKey: string
  readonly initialItemId: string
  readonly items: readonly SpatialGalleryItem[]
  readonly mainId?: string
  readonly totalSceneCount: number
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [galleryReady, setGalleryReady] = useState(false)
  const [headlineFontReady, setHeadlineFontReady] = useState(false)
  const [phase, setPhase] = useState<IntroPhase>('intro')

  const beginExit = useCallback(() => {
    setPhase((current) => (current === 'intro' ? 'exiting' : current))
  }, [])

  const finishExit = useCallback((focusGallery = false) => {
    const root = rootRef.current
    const intro = root?.querySelector('[data-signal-loader-intro]')
    const restoreFocus =
      focusGallery || Boolean(intro?.contains(document.activeElement))

    setPhase('gallery')
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
    const headline = rootRef.current?.querySelector<HTMLElement>(
      '#signal-loader-title'
    )
    if (!headline) return

    let active = true
    const markReady = () => {
      if (active) setHeadlineFontReady(true)
    }

    void document.fonts
      .load(headlineFont, headline.textContent ?? '')
      .then(markReady, markReady)

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (phase !== 'exiting') return

    const timer = window.setTimeout(() => finishExit(), 360)
    return () => window.clearTimeout(timer)
  }, [finishExit, phase])

  useEffect(() => {
    if (phase === 'gallery') return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        event.isComposing ||
        document.querySelector(
          '[data-slot="dialog-content"][data-state="open"]'
        )
      ) {
        return
      }

      event.preventDefault()
      finishExit(true)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
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
        inertiaBurst={phase !== 'intro'}
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

              <div
                className={styles.introBody}
                data-signal-loader-font-ready={headlineFontReady || undefined}
              >
                <p className={styles.eyebrow}>A field guide to AI risk</p>

                <h1 id='signal-loader-title'>
                  Familiar stories.
                  <em>Real AI risks.</em>
                </h1>

                <p className={styles.summary}>
                  Film and TV give us a shared language for abstract AI safety
                  problems. Start with a scene you recognize, then follow the
                  pattern into the real world.
                </p>

                <ol className={styles.sequence} aria-label='How the site works'>
                  <li>
                    <span>01</span>
                    <strong>Recognize a scene</strong>
                    <small>Film · television · anime</small>
                  </li>
                  <li>
                    <span>02</span>
                    <strong>See the pattern</strong>
                    <small>Goals · incentives · unintended behavior</small>
                  </li>
                  <li>
                    <span>03</span>
                    <strong>Name the AI risk</strong>
                    <small>Concepts · research · alignment</small>
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
                  <span data-signal-loader-scene-count={totalSceneCount}>
                    {totalSceneCount}{' '}
                    {totalSceneCount === 1 ? 'scene' : 'scenes'}
                  </span>
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
