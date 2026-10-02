'use client'

import { useCallback, useEffect, useRef } from 'react'

import { IntentPrefetchLink } from '@/components/intent-prefetch-link'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  createBrowseGalleryHref,
  type BrowseGalleryParams
} from '@/features/spatial-gallery/browse-params'
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

export function BrowseToolbar({
  families,
  params,
  resultCount
}: {
  readonly families: readonly ResourceSummary[]
  readonly params: BrowseGalleryParams
  readonly resultCount: number
}) {
  const activeFilterRef = useRef<HTMLAnchorElement>(null)
  const filterListRef = useRef<HTMLDivElement>(null)
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

  // Reveal the active chip with the least scrolling. The list's
  // scroll-padding keeps a whole neighbor beside it, so "All" stays in reach.
  useEffect(() => {
    const activeFilter = activeFilterRef.current
    const filterList = filterListRef.current

    if (!filterList || !activeFilter) return

    const style = getComputedStyle(filterList)
    const start =
      activeFilter.offsetLeft -
      (Number.parseFloat(style.scrollPaddingInlineStart) || 0)
    const end =
      activeFilter.offsetLeft +
      activeFilter.offsetWidth +
      (Number.parseFloat(style.scrollPaddingInlineEnd) || 0) -
      filterList.clientWidth

    filterList.scrollLeft = Math.max(
      0,
      Math.min(start, Math.max(end, filterList.scrollLeft))
    )
  }, [params.family])

  // Mark which edges have more chips so CSS fades only those edges.
  useEffect(() => {
    const filterList = filterListRef.current
    if (!filterList) return

    const updateOverflow = () => {
      const { clientWidth, scrollLeft, scrollWidth } = filterList
      filterList.toggleAttribute('data-overflow-start', scrollLeft > 1)
      filterList.toggleAttribute(
        'data-overflow-end',
        scrollLeft + clientWidth < scrollWidth - 1
      )
    }

    // Chips resize when fonts load, which changes overflow without resizing
    // the list itself.
    const resizeObserver = new ResizeObserver(updateOverflow)
    resizeObserver.observe(filterList)
    for (const chip of filterList.children) resizeObserver.observe(chip)
    filterList.addEventListener('scroll', updateOverflow, { passive: true })
    updateOverflow()

    return () => {
      resizeObserver.disconnect()
      filterList.removeEventListener('scroll', updateOverflow)
    }
  }, [])

  return (
    <nav
      className={styles.browseToolbar}
      aria-label='Scenario gallery controls'
    >
      <ToggleGroup
        ref={filterListRef}
        className={styles.filterList}
        data-scenario-family-filters
        type='single'
        value={params.family ?? 'all'}
        variant='outline'
        size='sm'
        aria-label='Filter by risk family'
      >
        <ToggleGroupItem className={styles.filterLink} value='all' asChild>
          <IntentPrefetchLink
            ref={params.family === null ? activeFilterRef : undefined}
            href={createBrowseGalleryHref({ ...params, family: null })}
            scroll={false}
          >
            All
          </IntentPrefetchLink>
        </ToggleGroupItem>
        {families.map((family) => (
          <ToggleGroupItem
            key={family.id}
            className={styles.filterLink}
            value={family.slug}
            asChild
          >
            <IntentPrefetchLink
              ref={params.family === family.slug ? activeFilterRef : undefined}
              href={createBrowseGalleryHref({
                ...params,
                family: family.slug
              })}
              scroll={false}
            >
              {family.title}
            </IntentPrefetchLink>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

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

      <p className={styles.resultCount} aria-live='polite'>
        <strong>{String(resultCount).padStart(3, '0')}</strong> scenarios
      </p>
    </nav>
  )
}
