'use client'

import { useEffect, useState } from 'react'

import { IntentPrefetchLink } from '@/components/intent-prefetch-link'
import { SiteHeader } from '@/components/site-header'

import type { HomepageVariantProps } from './prototype-types'
import styles from './variant-match-cuts.module.css'

const MAXIMUM_EXAMPLES = 4
const CUT_DWELL_MILLISECONDS = 2200

export function MatchCutsVariant({ examples }: HomepageVariantProps) {
  const visibleExamples = examples.slice(0, MAXIMUM_EXAMPLES)
  const exampleCount = visibleExamples.length
  const [activeIndex, setActiveIndex] = useState(0)
  const [motionAllowed, setMotionAllowed] = useState(false)
  const [autoplayInterrupted, setAutoplayInterrupted] = useState(false)
  const activeExample =
    visibleExamples[activeIndex] ?? visibleExamples[0] ?? null
  const autoplayRunning =
    motionAllowed &&
    !autoplayInterrupted &&
    activeIndex < Math.max(0, exampleCount - 1)

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotionPreference = () => setMotionAllowed(!motionQuery.matches)

    updateMotionPreference()
    motionQuery.addEventListener('change', updateMotionPreference)

    return () =>
      motionQuery.removeEventListener('change', updateMotionPreference)
  }, [])

  useEffect(() => {
    if (!autoplayRunning) return

    const cutTimer = window.setTimeout(() => {
      setActiveIndex((currentIndex) =>
        Math.min(currentIndex + 1, exampleCount - 1)
      )
    }, CUT_DWELL_MILLISECONDS)

    return () => window.clearTimeout(cutTimer)
  }, [activeIndex, autoplayRunning, exampleCount])

  if (activeExample === null) return null

  const selectExample = (index: number) => {
    setAutoplayInterrupted(true)
    setActiveIndex(index)
  }

  return (
    <div
      className={`experience-scope ${styles.variant}`}
      data-prototype-variant='match-cuts'
      data-site-footer='hidden'
      data-match-cuts-active={activeExample.slug}
      data-match-cuts-autoplay={autoplayRunning ? 'playing' : 'stopped'}
    >
      <SiteHeader className={styles.header} />

      <main
        id='prototype-main'
        className={styles.content}
        aria-labelledby='match-cuts-title'
        tabIndex={-1}
      >
        <header className={styles.hero}>
          <h1 id='match-cuts-title'>
            AI safety, explained through scenes you already know.
          </h1>

          <IntentPrefetchLink
            className={styles.galleryLink}
            data-match-cuts-gallery
            data-homepage-primary-cta
            href='/scenarios'
          >
            <span>Explore the gallery</span>
            <strong aria-hidden='true'>→</strong>
          </IntentPrefetchLink>
        </header>

        <section
          className={styles.stage}
          data-match-cuts-stage
          aria-label='Scene and AI safety pattern'
          onFocusCapture={() => setAutoplayInterrupted(true)}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') setAutoplayInterrupted(true)
          }}
        >
          {visibleExamples.map((example, index) => {
            const selected = index === activeIndex

            return (
              <article
                key={example.id}
                id={`match-cuts-panel-${index}`}
                className={styles.cut}
                data-active={selected || undefined}
                data-match-cuts-panel={example.slug}
                aria-hidden={!selected}
                inert={selected ? undefined : true}
              >
                <figure>
                  {/* Content-addressed CDN imagery keeps this prototype self-contained. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={example.image.src}
                    alt={example.image.alt}
                    width={example.image.width}
                    height={example.image.height}
                    style={{
                      backgroundImage: `url(${example.image.blurDataURL})`
                    }}
                  />
                </figure>

                <p className={styles.source}>{example.source}</p>

                <div className={styles.mapping}>
                  <p>{example.splitLens.sceneCue}</p>
                  <span aria-hidden='true'>→</span>
                  <h2>{example.splitLens.concept}</h2>
                </div>
              </article>
            )
          })}
        </section>

        <div
          className={styles.selector}
          role='group'
          aria-label='Choose a familiar scene'
        >
          {visibleExamples.map((example, index) => {
            const selected = index === activeIndex

            return (
              <button
                key={example.id}
                className={styles.selectorButton}
                type='button'
                data-homepage-example
                data-homepage-example-concept={example.splitLens.concept}
                data-homepage-example-scene={example.splitLens.sceneCue}
                data-match-cuts-example={example.slug}
                data-scenario-id={example.id}
                aria-controls={`match-cuts-panel-${index}`}
                aria-pressed={selected}
                onClick={() => selectExample(index)}
                onFocus={() => setAutoplayInterrupted(true)}
              >
                <span className={styles.thumbnail} aria-hidden='true'>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={example.image.src}
                    alt=''
                    width={example.image.width}
                    height={example.image.height}
                  />
                </span>
                <span>{example.source}</span>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
