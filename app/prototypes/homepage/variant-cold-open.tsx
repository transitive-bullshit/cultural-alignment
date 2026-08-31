'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { SiteHeader } from '@/components/site-header'
import { GalleryExperience } from '@/features/spatial-gallery/gallery-experience'
import { GalleryHeader } from '@/features/spatial-gallery/gallery-header'

import type { HomepageVariantProps } from './prototype-types'

import styles from './variant-cold-open.module.css'

const phaseCount = 3
const phaseLabels = [
  'A familiar scene',
  'The pattern underneath',
  'The real safety lens'
] as const

export function ColdOpenVariant({
  examples,
  galleryItems,
  initialItemId,
  scenarioCount
}: HomepageVariantProps) {
  const example =
    examples.find(({ slug }) => slug === 'keep-summer-safe') ?? examples[0]
  const [activePhase, setActivePhase] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  const [exploring, setExploring] = useState(false)

  useEffect(() => {
    if (!autoplay || exploring) return

    const secondPhase = window.setTimeout(() => setActivePhase(1), 1500)
    const thirdPhase = window.setTimeout(() => setActivePhase(2), 3100)

    return () => {
      window.clearTimeout(secondPhase)
      window.clearTimeout(thirdPhase)
    }
  }, [autoplay, exploring])

  if (!example) return null

  if (exploring) {
    return (
      <GalleryExperience
        header={<GalleryHeader />}
        historyKey='prototype-cold-open'
        initialItemId={initialItemId}
        items={galleryItems}
        mainId='prototype-main'
      />
    )
  }

  return (
    <div className={styles.root} data-prototype-variant='cold-open'>
      <SiteHeader className={styles.header} />

      <main id='prototype-main' className={styles.main} tabIndex={-1}>
        <div className={styles.media} aria-hidden='true'>
          {/* This direct CDN image keeps the cinematic prototype independent of a production image API. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={example.image.src}
            alt=''
            width={example.image.width}
            height={example.image.height}
            style={{ backgroundImage: `url(${example.image.blurDataURL})` }}
          />
        </div>
        <div className={styles.veil} aria-hidden='true' />
        <div className={styles.frame} aria-hidden='true' />

        <section
          className={styles.story}
          aria-labelledby={`cold-open-phase-title-${activePhase}`}
        >
          <p className={styles.eyebrow}>
            Cultural Alignment presents
            <span>{example.source}</span>
          </p>

          <div className={styles.phases}>
            <div
              className={styles.phase}
              data-active={activePhase === 0 || undefined}
              aria-hidden={activePhase !== 0}
              inert={activePhase !== 0 ? true : undefined}
            >
              <p>01 / A familiar scene</p>
              <h1 id='cold-open-phase-title-0'>
                &ldquo;Keep Summer safe.&rdquo;
              </h1>
              <span>{example.scene}</span>
            </div>

            <div
              className={styles.phase}
              data-active={activePhase === 1 || undefined}
              aria-hidden={activePhase !== 1}
              inert={activePhase !== 1 ? true : undefined}
            >
              <p>02 / The pattern underneath</p>
              <h2 id='cold-open-phase-title-1'>
                It obeys the words. It ignores the intent.
              </h2>
              <span>{example.analogy}</span>
            </div>

            <div
              className={styles.phase}
              data-active={activePhase === 2 || undefined}
              aria-hidden={activePhase !== 2}
              inert={activePhase !== 2 ? true : undefined}
            >
              <p>03 / The real safety lens</p>
              <h2 id='cold-open-phase-title-2'>
                {example.concepts.slice(0, 2).join(' + ')}
              </h2>
              <span>
                One remembered scene becomes a mental model for a real AI safety
                problem—and a path into the research behind it.
              </span>
            </div>
          </div>

          <div
            className={styles.actions}
            data-visible={activePhase === 2 || undefined}
            aria-hidden={activePhase !== 2}
            inert={activePhase !== 2 ? true : undefined}
          >
            <button type='button' onClick={() => setExploring(true)}>
              Explore {scenarioCount} scenarios{' '}
              <span aria-hidden='true'>↗</span>
            </button>
            <Link href={example.href}>Open this example</Link>
          </div>
        </section>

        <nav className={styles.timeline} aria-label='Intro sequence'>
          {Array.from({ length: phaseCount }, (_, index) => (
            <button
              key={index}
              type='button'
              data-cold-open-phase={index + 1}
              data-active={activePhase === index || undefined}
              aria-current={activePhase === index ? 'step' : undefined}
              aria-label={`Show step ${index + 1}: ${phaseLabels[index]}`}
              onClick={() => {
                setAutoplay(false)
                setActivePhase(index)
              }}
            >
              <span aria-hidden='true'>
                {String(index + 1).padStart(2, '0')}
              </span>
              <i aria-hidden='true' />
            </button>
          ))}
        </nav>

        <button
          className={styles.skip}
          data-cold-open-gallery
          type='button'
          onClick={() => setExploring(true)}
        >
          Skip to the field
        </button>

        <p className={styles.caption}>
          Familiar culture <span>→</span> visible behavior <span>→</span> AI
          risk
        </p>
      </main>
    </div>
  )
}
