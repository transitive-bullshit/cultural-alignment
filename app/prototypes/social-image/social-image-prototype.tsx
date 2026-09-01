'use client'

import { useCallback, useEffect, useState } from 'react'

import type { SocialImagePrototypeData } from './prototype-types'
import { socialImageVariants } from './social-image-variants'

import styles from './social-image-prototype.module.css'

export function SocialImagePrototype({
  data,
  initialVariant,
  renderScale,
  renderTile
}: {
  readonly data: SocialImagePrototypeData
  readonly initialVariant: number
  readonly renderScale: 1 | 2
  readonly renderTile: 'left' | 'right'
}) {
  const safeInitialVariant = Math.min(
    socialImageVariants.length - 1,
    Math.max(0, initialVariant)
  )
  const [activeVariant, setActiveVariant] = useState(safeInitialVariant)
  const definition = socialImageVariants[activeVariant]!

  const writeVariantToUrl = useCallback((index: number) => {
    const url = new URL(window.location.href)
    url.searchParams.set('v', String(index + 1))
    window.history.replaceState(window.history.state, '', url)
  }, [])

  const selectVariant = useCallback(
    (index: number) => {
      if (index < 0 || index >= socialImageVariants.length) return
      setActiveVariant(index)
      writeVariantToUrl(index)
    },
    [writeVariantToUrl]
  )

  useEffect(() => {
    writeVariantToUrl(activeVariant)
  }, [activeVariant, writeVariantToUrl])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const number = Number.parseInt(event.key, 10)
      if (number >= 1 && number <= socialImageVariants.length) {
        selectVariant(number - 1)
      } else if (event.key === 'ArrowRight') {
        selectVariant((activeVariant + 1) % socialImageVariants.length)
      } else if (event.key === 'ArrowLeft') {
        selectVariant(
          (activeVariant - 1 + socialImageVariants.length) %
            socialImageVariants.length
        )
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeVariant, selectVariant])

  return (
    <div
      className={`experience-scope ${styles.root}`}
      data-export-scale={renderScale}
      data-export-tile={renderTile}
      data-site-footer='hidden'
      data-social-image-prototype
    >
      <header className={styles.context}>
        <div>
          <p>Primary social image · 1200 × 630</p>
          <h1>
            {String(activeVariant + 1).padStart(2, '0')} / {definition.name}
          </h1>
        </div>
        <p className={styles.rationale}>{definition.rationale}</p>
      </header>

      <main className={styles.stage}>
        <div
          className={styles.preview}
          data-social-image-artboard
          data-social-image-variant={definition.name}
        >
          <definition.Component data={data} />
        </div>
      </main>

      <nav className={styles.picker} aria-label='Social image directions'>
        {socialImageVariants.map(({ name }, index) => (
          <button
            key={name}
            type='button'
            data-active={activeVariant === index || undefined}
            aria-current={activeVariant === index ? 'true' : undefined}
            aria-label={`${index + 1}: ${name}`}
            onClick={() => selectVariant(index)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{name}</strong>
          </button>
        ))}
      </nav>
    </div>
  )
}
