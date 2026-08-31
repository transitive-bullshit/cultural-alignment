'use client'

import { useState } from 'react'

import { IntentPrefetchLink } from '@/components/intent-prefetch-link'
import { SiteHeader } from '@/components/site-header'
import { GalleryExperience } from '@/features/spatial-gallery/gallery-experience'
import { GalleryHeader } from '@/features/spatial-gallery/gallery-header'

import type { HomepageVariantProps } from './prototype-types'
import styles from './variant-split-lens.module.css'

const MAXIMUM_EXAMPLES = 4

export function SplitLensVariant({
  examples,
  galleryItems,
  initialItemId,
  scenarioCount
}: HomepageVariantProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const visibleExamples = examples.slice(0, MAXIMUM_EXAMPLES)
  const selectedExample =
    visibleExamples[selectedIndex] ?? visibleExamples[0] ?? null

  if (galleryOpen || selectedExample === null) {
    return (
      <div
        className={`experience-scope ${styles.galleryMode}`}
        data-site-footer='hidden'
      >
        <GalleryExperience
          header={<GalleryHeader />}
          historyKey='prototype-split-lens'
          initialItemId={initialItemId}
          items={galleryItems}
          mainId='prototype-main'
        />
      </div>
    )
  }

  return (
    <div
      className={`experience-scope ${styles.variant}`}
      data-prototype-variant='split-lens'
      data-site-footer='hidden'
      data-split-lens-selected={selectedExample.id}
    >
      <SiteHeader className={styles.header} />

      <main
        id='prototype-main'
        className={styles.content}
        aria-labelledby='split-lens-title'
        tabIndex={-1}
      >
        <div className={styles.introduction}>
          <div>
            <p className={styles.eyebrow}>Pop culture × AI safety</p>
            <h1 id='split-lens-title'>
              AI safety, explained through scenes you already know.
            </h1>
          </div>

          <p className={styles.lede}>
            Choose a familiar moment from film or television. See the real risk
            or alignment concept it helps make concrete—then open the full
            dossier.
          </p>
        </div>

        <div className={styles.translator}>
          <aside className={styles.exampleRail}>
            <div className={styles.railHeading}>
              <span>Four ways in</span>
              <span aria-hidden='true'>01—04</span>
            </div>

            <div
              className={styles.exampleList}
              role='group'
              aria-label='Choose a cultural analogy'
            >
              {visibleExamples.map((example, index) => {
                const selected = index === selectedIndex

                return (
                  <button
                    key={example.id}
                    id={`split-lens-example-${index}`}
                    className={styles.exampleTab}
                    type='button'
                    data-split-lens-example
                    aria-controls='split-lens-example-panel'
                    aria-pressed={selected}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <span className={styles.exampleIndex} aria-hidden='true'>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={styles.exampleThumbnail}
                      aria-hidden='true'
                    >
                      {/* Content-addressed CDN imagery keeps this prototype self-contained. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={example.image.src}
                        alt=''
                        width={example.image.width}
                        height={example.image.height}
                      />
                    </span>
                    <span className={styles.exampleCopy}>
                      <small>
                        {example.source} · {example.releaseYear}
                      </small>
                      <strong>{example.title}</strong>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          <article
            id='split-lens-example-panel'
            className={styles.scenePanel}
            aria-labelledby={`split-lens-example-${selectedIndex}`}
            aria-live='polite'
          >
            <div className={styles.panelHeading}>
              <span>01 / The familiar scene</span>
              <span>{selectedExample.source}</span>
            </div>

            <figure className={styles.sceneFigure}>
              <div className={styles.imageFrame}>
                {/* Content-addressed CDN imagery keeps this prototype self-contained. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedExample.image.src}
                  alt={selectedExample.image.alt}
                  width={selectedExample.image.width}
                  height={selectedExample.image.height}
                  style={{
                    backgroundImage: `url(${selectedExample.image.blurDataURL})`
                  }}
                />
                <span className={styles.frameMarker} aria-hidden='true'>
                  Scene
                </span>
              </div>

              <figcaption>
                <span className={styles.captionLabel}>What happens</span>
                <p>{selectedExample.scene}</p>
              </figcaption>
            </figure>
          </article>

          <article className={styles.lensPanel}>
            <div className={styles.panelHeading}>
              <span>02 / The AI safety lens</span>
              <span>Translated</span>
            </div>

            <div className={styles.translationMark} aria-hidden='true'>
              <span />
              <strong>→</strong>
            </div>

            <div className={styles.lensBody}>
              <p className={styles.lensEyebrow}>The same behavior, reframed</p>
              <p className={styles.analogy}>{selectedExample.analogy}</p>

              <dl className={styles.taxonomy}>
                <div>
                  <dt>Risk family</dt>
                  <dd>
                    {selectedExample.riskFamilies.join(' · ') || 'Unclassified'}
                  </dd>
                </div>
                <div>
                  <dt>Concepts</dt>
                  <dd>
                    {selectedExample.concepts.join(' · ') || 'Unclassified'}
                  </dd>
                </div>
              </dl>

              <p className={styles.caveat}>
                A cultural analogy—not a prediction or proof.
              </p>
            </div>

            <div className={styles.actions}>
              <IntentPrefetchLink
                className={styles.dossierLink}
                href={selectedExample.href}
                scroll={false}
              >
                Open this dossier <span aria-hidden='true'>↗</span>
              </IntentPrefetchLink>
              <button
                className={styles.galleryButton}
                data-split-lens-gallery
                type='button'
                onClick={() => setGalleryOpen(true)}
              >
                Explore all {scenarioCount} scenarios
                <span aria-hidden='true'>→</span>
              </button>
            </div>
          </article>
        </div>
      </main>
    </div>
  )
}
