'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef } from 'react'

import { Slider } from '@/components/ui/slider'
import {
  setGalleryItemSizePreference,
  setGalleryItemSizeTransition,
  useGalleryItemSizePreference,
  type GalleryItemSizeTransition
} from '@/features/spatial-gallery/gallery-item-size-preference'
import {
  GALLERY_ITEM_SIZE_MAX,
  GALLERY_ITEM_SIZE_MIN,
  GALLERY_ITEM_SIZE_STEP
} from '@/features/spatial-gallery/gallery-sizing'
import type { ResourceSummary } from '@/lib/content/catalog'

import styles from '@/features/spatial-gallery/gallery-page-shell.module.css'

/**
 * The archive's title row: the page heading, links to each risk family's page,
 * the frame-size control, and the scenario count.
 */
export function BrowseToolbar({
  families,
  resultCount
}: {
  readonly families: readonly ResourceSummary[]
  readonly resultCount: number
}) {
  const activePointerIdRef = useRef<number | null>(null)
  const itemSizeTransitionRef = useRef<GalleryItemSizeTransition>('instant')
  const sizeControlRef = useRef<HTMLDivElement>(null)
  const transitionResetFrameRef = useRef<number | null>(null)
  const { hydrated, itemSize } = useGalleryItemSizePreference()

  const cancelTransitionReset = useCallback(() => {
    if (transitionResetFrameRef.current === null) return

    window.cancelAnimationFrame(transitionResetFrameRef.current)
    transitionResetFrameRef.current = null
  }, [])

  const publishInstantTransition = useCallback(() => {
    cancelTransitionReset()
    itemSizeTransitionRef.current = 'instant'
    setGalleryItemSizeTransition('instant')
  }, [cancelTransitionReset])

  const resetTransitionWhenGallerySettles = useCallback(() => {
    cancelTransitionReset()
    const deadline = window.performance.now() + 1_000

    const checkGalleryMotion = () => {
      transitionResetFrameRef.current = null
      if (activePointerIdRef.current !== null) return

      const canvas = document.querySelector<HTMLCanvasElement>(
        '#scenario-gallery canvas[data-gallery-sizing-motion]'
      )
      if (
        canvas?.dataset.gallerySizingMotion === 'running' &&
        window.performance.now() < deadline
      ) {
        transitionResetFrameRef.current =
          window.requestAnimationFrame(checkGalleryMotion)
        return
      }

      publishInstantTransition()
    }

    transitionResetFrameRef.current =
      window.requestAnimationFrame(checkGalleryMotion)
  }, [cancelTransitionReset, publishInstantTransition])

  const finishPointerSizing = useCallback(
    (pointerId: number | null, deferUntilAfterPointerEvent = false) => {
      const activePointerId = activePointerIdRef.current
      if (
        activePointerId === null ||
        (pointerId !== null && pointerId !== activePointerId)
      ) {
        return
      }

      activePointerIdRef.current = null
      sizeControlRef.current?.removeAttribute('data-size-dragging')

      const finish = () => {
        itemSizeTransitionRef.current = 'instant'
        resetTransitionWhenGallerySettles()
      }

      if (deferUntilAfterPointerEvent) queueMicrotask(finish)
      else finish()
    },
    [resetTransitionWhenGallerySettles]
  )

  const abortPointerSizing = useCallback(() => {
    activePointerIdRef.current = null
    sizeControlRef.current?.removeAttribute('data-size-dragging')
    publishInstantTransition()
  }, [publishInstantTransition])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') abortPointerSizing()
    }

    window.addEventListener('blur', abortPointerSizing)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('blur', abortPointerSizing)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      abortPointerSizing()
    }
  }, [abortPointerSizing])

  return (
    <div className={styles.browseToolbar} data-browse-toolbar>
      <div className={styles.filterList} data-scenario-family-filters>
        <h1 className={styles.filterLink} data-state='on'>
          All scenarios
        </h1>
        <nav className={styles.familyLinks} aria-label='Risk families'>
          {families.map((family) => (
            <Link
              key={family.id}
              className={styles.filterLink}
              href={family.href}
            >
              {family.title}
            </Link>
          ))}
        </nav>
      </div>

      <div
        ref={sizeControlRef}
        className={styles.sizeControl}
        data-gallery-size-control
      >
        <span className={styles.sizeLabel}>Size</span>
        <Slider
          className={styles.sizeSlider}
          disabled={!hydrated}
          min={GALLERY_ITEM_SIZE_MIN}
          max={GALLERY_ITEM_SIZE_MAX}
          step={GALLERY_ITEM_SIZE_STEP}
          value={[itemSize]}
          onKeyDownCapture={() => {
            publishInstantTransition()
            queueMicrotask(() => {
              if (activePointerIdRef.current !== null) {
                itemSizeTransitionRef.current = 'smooth'
              }
            })
          }}
          onPointerCancelCapture={(event) => {
            finishPointerSizing(event.pointerId)
          }}
          onPointerDownCapture={(event) => {
            if (
              event.button !== 0 ||
              !event.isPrimary ||
              activePointerIdRef.current !== null
            ) {
              event.preventDefault()
              event.stopPropagation()
              return
            }

            cancelTransitionReset()
            activePointerIdRef.current = event.pointerId
            itemSizeTransitionRef.current = 'smooth'
            sizeControlRef.current?.setAttribute('data-size-dragging', '')
          }}
          onPointerUpCapture={(event) => {
            finishPointerSizing(event.pointerId, true)
          }}
          onLostPointerCapture={(event) => {
            finishPointerSizing(event.pointerId)
          }}
          thumbProps={{
            'aria-controls': 'scenario-gallery',
            'aria-label': 'Scenario item size',
            'aria-valuetext': `${itemSize} percent`
          }}
          onValueChange={([nextItemSize]) => {
            if (nextItemSize !== undefined) {
              setGalleryItemSizePreference(
                nextItemSize,
                itemSizeTransitionRef.current
              )
            }
          }}
        />
        <span className={styles.sizeValue} aria-hidden='true'>
          {itemSize}%
        </span>
      </div>

      <p className={styles.resultCount}>
        <strong>{String(resultCount).padStart(3, '0')}</strong> scenarios
      </p>
    </div>
  )
}
