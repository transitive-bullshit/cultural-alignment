'use client'

import { useId, useRef, useState } from 'react'

import { GalleryExperience } from '@/features/spatial-gallery/gallery-experience'
import { GalleryHeader } from '@/features/spatial-gallery/gallery-header'

import type { HomepageVariantProps } from './prototype-types'

import styles from './variant-field-guide.module.css'

export function FieldGuideVariant({
  galleryItems,
  initialItemId,
  scenarioCount
}: HomepageVariantProps) {
  const variantRef = useRef<HTMLDivElement>(null)
  const [dismissed, setDismissed] = useState(false)
  const headingId = useId()
  const descriptionId = useId()
  const formattedScenarioCount = new Intl.NumberFormat('en-US').format(
    scenarioCount
  )

  return (
    <div
      ref={variantRef}
      className={styles.variant}
      data-homepage-variant='field-guide'
    >
      <GalleryExperience
        className={styles.experience}
        header={<GalleryHeader />}
        historyKey='prototype-field-guide'
        initialItemId={initialItemId}
        items={galleryItems}
        mainId='prototype-main'
      />

      <div className={styles.guideLayer}>
        <aside
          aria-describedby={descriptionId}
          aria-hidden={dismissed || undefined}
          aria-labelledby={headingId}
          className={styles.panel}
          data-field-guide
          data-state={dismissed ? 'dismissed' : 'open'}
          inert={dismissed ? true : undefined}
        >
          <div className={styles.rail}>
            <p className={styles.eyebrow}>
              <span className={styles.railMark} aria-hidden='true' />
              Field guide · {formattedScenarioCount} cultural scenarios
            </p>
            <span className={styles.railIndex} aria-hidden='true'>
              Scene → concept
            </span>
          </div>

          <h1 id={headingId}>Recognize the scene. Learn the risk.</h1>
          <p className={styles.introduction} id={descriptionId}>
            Cultural Alignment uses familiar moments from film and television to
            make AI risk and alignment concepts concrete—then shows where each
            analogy holds and where it breaks.
          </p>

          <ol className={styles.path} aria-label='How each scenario works'>
            <li>
              <span className={styles.stepNumber}>01</span>
              <strong>Familiar scene</strong>
              <span>A moment you already know</span>
            </li>
            <li>
              <span className={styles.stepNumber}>02</span>
              <strong>Behavior pattern</strong>
              <span>What the system is doing</span>
            </li>
            <li>
              <span className={styles.stepNumber}>03</span>
              <strong>Safety concept</strong>
              <span>The real research vocabulary</span>
            </li>
          </ol>

          <div className={styles.actions}>
            <p className={styles.instruction}>
              <span aria-hidden='true'>⊹</span>
              Drag or scroll. Hover a frame, then open the scene you recognize.
            </p>
            <button
              className={styles.dismiss}
              data-field-guide-dismiss
              type='button'
              onClick={() => {
                setDismissed(true)
                window.requestAnimationFrame(() => {
                  variantRef.current
                    ?.querySelector<HTMLElement>('[data-gallery-main]')
                    ?.focus()
                })
              }}
            >
              Explore the field
              <span aria-hidden='true'>↘</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
