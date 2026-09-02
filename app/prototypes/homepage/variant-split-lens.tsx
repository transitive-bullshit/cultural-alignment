'use client'

import { useState } from 'react'

import { IntentPrefetchLink } from '@/components/intent-prefetch-link'
import { SiteHeader } from '@/components/site-header'

import type { HomepageVariantProps } from './prototype-types'
import styles from './variant-split-lens.module.css'

const MAXIMUM_EXAMPLES = 4

export function SplitLensVariant({ examples }: HomepageVariantProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const visibleExamples = examples.slice(0, MAXIMUM_EXAMPLES)
  const selectedExample =
    visibleExamples[selectedIndex] ?? visibleExamples[0] ?? null

  if (selectedExample === null) return null

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
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Pop culture × AI safety</p>
            <h1 id='split-lens-title'>
              AI safety, explained through scenes you already know.
            </h1>
          </div>

          <IntentPrefetchLink
            className={styles.archiveLink}
            data-homepage-primary-cta
            data-split-lens-gallery
            href='/scenarios'
          >
            <span>Explore the gallery</span>
            <strong aria-hidden='true'>→</strong>
          </IntentPrefetchLink>
        </header>

        <section
          className={styles.explainer}
          aria-labelledby='split-lens-examples-title'
        >
          <div className={styles.selectorHeading}>
            <h2 id='split-lens-examples-title'>Four scenes. Four patterns.</h2>
          </div>

          <div className={styles.workbench}>
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
                    data-homepage-example
                    data-homepage-example-concept={example.splitLens.concept}
                    data-homepage-example-scene={example.splitLens.sceneCue}
                    data-scenario-id={example.id}
                    data-split-lens-example
                    aria-controls='split-lens-example-panel'
                    aria-label={`${example.source}: ${example.splitLens.sceneCue}`}
                    aria-pressed={selected}
                    onClick={() => setSelectedIndex(index)}
                  >
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
                    <strong>{example.source}</strong>
                  </button>
                )
              })}
            </div>

            <p className='sr-only' role='status' aria-live='polite'>
              {selectedExample.splitLens.sceneCue}{' '}
              {selectedExample.splitLens.concept}.{' '}
              {selectedExample.splitLens.connection}
            </p>

            <article
              key={selectedExample.id}
              id='split-lens-example-panel'
              className={styles.selection}
              aria-labelledby={`split-lens-example-${selectedIndex}`}
              data-split-lens-panel
            >
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
                </div>

                <figcaption>
                  <span className={styles.sceneMeta}>
                    {selectedExample.source}
                  </span>
                  <p>{selectedExample.splitLens.sceneCue}</p>
                </figcaption>
              </figure>

              <div className={styles.bridge} aria-hidden='true'>
                <span />
                <strong>→</strong>
                <span />
              </div>

              <div className={styles.lensBody}>
                <p className={styles.lensLabel}>The AI safety pattern</p>
                <h3>{selectedExample.splitLens.concept}</h3>
                <p className={styles.connection}>
                  {selectedExample.splitLens.connection}
                </p>
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}
