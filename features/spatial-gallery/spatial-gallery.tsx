'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ViewTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent
} from 'react'
import { flushSync } from 'react-dom'

import { focalPointToObjectPosition } from '@/lib/media/crop'
import { stageScenarioTransitionPreview } from '@/lib/media/scenario-transition-preview'
import { classifyGesture, shouldCaptureGalleryWheel } from '@/lib/spatial/field'

import { useGalleryItemSizePreference } from './gallery-item-size-preference'
import {
  GALLERY_FRAME_ASPECT,
  getGalleryViewportMetrics
} from './gallery-sizing'
import styles from './spatial-gallery.module.css'
import {
  mergeGalleryHistoryState,
  readGalleryHistoryState
} from './history-state'
import { isMobileGalleryViewport } from './texture-residency'
import type {
  SpatialFrameRect,
  SpatialGalleryController,
  SpatialGalleryItem,
  SpatialGalleryTopology
} from './types'

const SpatialGalleryCanvas = dynamic(
  () =>
    import('./spatial-gallery-canvas').then(
      ({ SpatialGalleryCanvas }) => SpatialGalleryCanvas
    ),
  {
    ssr: false,
    loading: () => <CanvasLoading />
  }
)

type RenderMode = 'checking' | 'webgl' | 'fallback'
type TransitionProxy = Readonly<{
  item: SpatialGalleryItem
  rect: SpatialFrameRect
}>

export function SpatialGallery({
  historyKey,
  inertiaBurst = false,
  initialItemId,
  items
}: {
  readonly historyKey: string
  readonly inertiaBurst?: boolean
  readonly initialItemId?: string
  readonly items: readonly SpatialGalleryItem[]
}) {
  const initialIndex = Math.max(
    0,
    items.findIndex(({ id }) => id === initialItemId)
  )
  const router = useRouter()
  const surfaceRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLSpanElement>(null)
  const controllerRef = useRef<SpatialGalleryController | null>(null)
  const pointerStartRef = useRef({ x: 0, y: 0 })
  const pointerPreviousRef = useRef({ x: 0, y: 0, time: 0 })
  const pressedIndexRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const navigatingRef = useRef(false)
  const [historyReady, setHistoryReady] = useState(false)
  const [sceneInitialIndex, setSceneInitialIndex] = useState(initialIndex)
  const [initialOffsetX, setInitialOffsetX] = useState<number | null>(null)
  const [initialTopology, setInitialTopology] =
    useState<SpatialGalleryTopology | null>(null)
  const [dragging, setDragging] = useState(false)
  const [renderMode, setRenderMode] = useState<RenderMode>('checking')
  const [reducedMotion, setReducedMotion] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [transitionReady, setTransitionReady] = useState(false)
  const [transitionProxy, setTransitionProxy] =
    useState<TransitionProxy | null>(null)
  const {
    hydrated: itemSizeHydrated,
    itemSize,
    itemSizeTransition
  } = useGalleryItemSizePreference()
  const selectedItem =
    selectedIndex === null ? null : (items[selectedIndex] ?? null)

  useEffect(() => {
    const itemIds = new Set(items.map(({ id }) => id))
    const restoredState = readGalleryHistoryState(
      window.history.state,
      historyKey,
      itemIds
    )

    if (restoredState) {
      const restoredIndex = items.findIndex(
        ({ id }) => id === restoredState.itemId
      )
      if (restoredIndex >= 0) {
        setSelectedIndex(restoredIndex)
        setSceneInitialIndex(restoredIndex)
      }
      setInitialOffsetX(restoredState.offsetX)
      setInitialTopology(restoredState.topology)
    }

    setHistoryReady(true)
  }, [historyKey, items])

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotionPreference = () => setReducedMotion(motionQuery.matches)

    updateMotionPreference()
    motionQuery.addEventListener('change', updateMotionPreference)

    const canvas = document.createElement('canvas')
    setRenderMode(canvas.getContext('webgl2') ? 'webgl' : 'fallback')

    return () =>
      motionQuery.removeEventListener('change', updateMotionPreference)
  }, [])

  const persistGalleryState = useCallback(
    (itemIndex?: number) => {
      const resolvedIndex = itemIndex ?? selectedIndex
      if (resolvedIndex === null) return

      const item = items[resolvedIndex]
      const sceneState = controllerRef.current?.getHistoryState()
      if (!item || !sceneState) return

      const nextHistoryState = mergeGalleryHistoryState(
        window.history.state,
        historyKey,
        {
          itemId: item.id,
          offsetX: sceneState.offsetX,
          topology: sceneState.topology,
          version: 2
        }
      )
      window.history.replaceState(nextHistoryState, '', window.location.href)
    },
    [historyKey, items, selectedIndex]
  )

  useEffect(() => {
    const persistBeforeLinkNavigation = (event: globalThis.MouseEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('a[href]')) {
        persistGalleryState()
      }
    }

    document.addEventListener('click', persistBeforeLinkNavigation, true)
    return () =>
      document.removeEventListener('click', persistBeforeLinkNavigation, true)
  }, [persistGalleryState])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const finePointerQuery = window.matchMedia(
      '(hover: hover) and (pointer: fine)'
    )

    const handleWheel = (event: WheelEvent) => {
      if (
        !shouldCaptureGalleryWheel(
          event.deltaX,
          event.deltaY,
          finePointerQuery.matches
        )
      ) {
        return
      }

      event.preventDefault()
      const multiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 20 : 1
      controllerRef.current?.wheelBy(
        event.deltaX * multiplier,
        event.deltaY * multiplier
      )
    }

    surface.addEventListener('wheel', handleWheel, { passive: false })
    return () => surface.removeEventListener('wheel', handleWheel)
  }, [])

  useEffect(() => {
    const cursor = cursorRef.current
    const galleryPage = surfaceRef.current?.closest('main')
    if (!cursor || !galleryPage) return

    let bounds = galleryPage.getBoundingClientRect()
    const updateBounds = () => {
      bounds = galleryPage.getBoundingClientRect()
    }
    const resizeObserver = new ResizeObserver(updateBounds)
    resizeObserver.observe(galleryPage)

    const moveCursor = (event: globalThis.PointerEvent) => {
      const target = event.target
      const overDialog =
        target instanceof Element &&
        Boolean(
          target.closest(
            '[data-slot="dialog-overlay"], [data-slot="dialog-content"]'
          )
        )
      const overSiteNavigation =
        target instanceof Element &&
        Boolean(
          target.closest(
            '[data-site-header], [data-site-navigation-popup], [data-site-navigation-panel="mobile"]'
          )
        )
      const insideGallery =
        !overDialog &&
        !overSiteNavigation &&
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom

      if (!insideGallery) {
        cursor.style.opacity = '0'
        return
      }

      cursor.style.setProperty('--cursor-x', `${event.clientX}px`)
      cursor.style.setProperty('--cursor-y', `${event.clientY}px`)
      cursor.style.opacity = '1'
    }
    const hideCursor = (event: globalThis.PointerEvent) => {
      if (event.relatedTarget === null) cursor.style.opacity = '0'
    }

    window.addEventListener('pointermove', moveCursor, { passive: true })
    window.addEventListener('pointerout', hideCursor, { passive: true })
    window.addEventListener('resize', updateBounds, { passive: true })

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', moveCursor)
      window.removeEventListener('pointerout', hideCursor)
      window.removeEventListener('resize', updateBounds)
    }
  }, [])

  const openItem = useCallback(
    (index: number) => {
      const item = items[index]
      if (!item || navigatingRef.current) return

      persistGalleryState(index)

      const rect = controllerRef.current?.getFrameRect(index)
      if (rect) {
        stageScenarioTransitionPreview({
          scenarioId: item.id,
          src: item.image.src
        })
        flushSync(() => setTransitionProxy({ item, rect }))
      }

      navigatingRef.current = true
      router.push(item.href, {
        scroll: false,
        transitionTypes: ['scenario-forward']
      })
    },
    [items, persistGalleryState, router]
  )

  const selectItem = useCallback((index: number) => {
    setSelectedIndex((current) => (current === index ? current : index))
  }, [])

  const markTransitionReady = useCallback(() => setTransitionReady(true), [])

  const beginPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return

    controllerRef.current?.cancelIntro()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerStartRef.current = { x: event.clientX, y: event.clientY }
    pointerPreviousRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp
    }
    pressedIndexRef.current = null
    draggingRef.current = false
    controllerRef.current?.pressAt(event.clientX, event.clientY)
  }

  const movePointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      if (event.pointerType === 'mouse') {
        controllerRef.current?.hoverAt(event.clientX, event.clientY)
      }
      return
    }

    const previous = pointerPreviousRef.current
    const deltaX = event.clientX - previous.x
    const deltaY = event.clientY - previous.y
    const deltaMilliseconds = Math.max(1, event.timeStamp - previous.time)
    pointerPreviousRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp
    }

    if (
      !draggingRef.current &&
      classifyGesture(pointerStartRef.current, {
        x: event.clientX,
        y: event.clientY
      }) === 'drag'
    ) {
      draggingRef.current = true
      setDragging(true)
    }

    if (draggingRef.current) {
      controllerRef.current?.dragBy(deltaX, deltaY, deltaMilliseconds)
    } else if (event.pointerType === 'mouse') {
      controllerRef.current?.hoverAt(event.clientX, event.clientY)
    }
  }

  const finishPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    controllerRef.current?.endDrag()
    const gesture = classifyGesture(pointerStartRef.current, {
      x: event.clientX,
      y: event.clientY
    })
    const pressedIndex = pressedIndexRef.current

    if (gesture === 'click' && pressedIndex !== null) {
      if (pressedIndex === selectedIndex) openItem(pressedIndex)
      else {
        selectItem(pressedIndex)
        controllerRef.current?.recenter(pressedIndex)
      }
    }

    pressedIndexRef.current = null
    draggingRef.current = false
    setDragging(false)
  }

  const cancelPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    controllerRef.current?.endDrag()
    pressedIndexRef.current = null
    draggingRef.current = false
    setDragging(false)
  }

  return (
    <section
      id='scenario-gallery'
      className={styles.gallery}
      data-spatial-gallery='browse'
      data-gallery-item-count={items.length}
      data-gallery-item-size={itemSize}
      data-gallery-item-size-transition={itemSizeTransition}
      data-gallery-transition-ready={transitionReady || undefined}
      data-selected-scenario-id={selectedItem?.id}
      aria-label='All cultural scenarios. Drag horizontally or scroll to explore.'
    >
      <div
        ref={surfaceRef}
        className={styles.surface}
        data-dragging={dragging || undefined}
        onPointerDownCapture={beginPointer}
        onPointerMove={movePointer}
        onPointerUp={finishPointer}
        onPointerCancel={cancelPointer}
        onPointerLeave={() => controllerRef.current?.clearHover()}
      >
        <div className={styles.rules} aria-hidden='true' />

        {!itemSizeHydrated || !historyReady || renderMode === 'checking' ? (
          <CanvasLoading />
        ) : renderMode === 'webgl' ? (
          <SpatialGalleryCanvas
            animateItemSize={itemSizeTransition === 'smooth'}
            controllerRef={controllerRef}
            inertiaBurst={inertiaBurst}
            initialIndex={sceneInitialIndex}
            initialOffsetX={initialOffsetX}
            initialTopology={initialTopology}
            itemSize={itemSize}
            items={items}
            onPressItem={(index) => {
              pressedIndexRef.current = index
            }}
            onSelectItem={selectItem}
            onTransitionReady={markTransitionReady}
            reducedMotion={reducedMotion}
          />
        ) : (
          <GalleryFallback
            animateItemSize={itemSizeTransition === 'smooth' && !reducedMotion}
            itemSize={itemSize}
            items={items}
            selectedIndex={selectedIndex}
          />
        )}
      </div>

      {transitionProxy ? (
        <ViewTransition
          name={`scenario-media-${transitionProxy.item.id}`}
          share='scenario-media'
          default='none'
        >
          <div
            className={styles.transitionProxy}
            style={{
              height: transitionProxy.rect.height,
              left: transitionProxy.rect.left,
              top: transitionProxy.rect.top,
              width: transitionProxy.rect.width
            }}
            aria-hidden='true'
          >
            {/* The proxy is a single-frame bridge from WebGL into the Dossier media. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={transitionProxy.item.image.src}
              alt=''
              style={{
                backgroundImage: `url(${transitionProxy.item.image.blurDataURL})`,
                backgroundPosition: focalPointToObjectPosition(
                  transitionProxy.item.image.focalPoint
                ),
                backgroundSize: 'cover',
                objectPosition: focalPointToObjectPosition(
                  transitionProxy.item.image.focalPoint
                )
              }}
            />
          </div>
        </ViewTransition>
      ) : null}

      {selectedItem === null || selectedIndex === null ? null : (
        <>
          <SelectedMetadata
            item={selectedItem}
            onOpen={() => openItem(selectedIndex)}
            position={selectedIndex + 1}
            total={items.length}
          />

          <MobileSelectedScenario
            item={selectedItem}
            onOpen={() => openItem(selectedIndex)}
          />
        </>
      )}

      <p className={styles.fieldHint}>
        <span className={styles.hintMark} aria-hidden='true'>
          ⊹
        </span>
        <span className={styles.desktopHint}>Drag · scroll</span>
        <span className={styles.mobileHint}>
          Tap once to select · again to open
        </span>
      </p>

      <p className={styles.selectionAnnouncement} aria-live='polite'>
        {selectedItem ? `Selected: ${selectedItem.title}` : ''}
      </p>

      <span
        ref={cursorRef}
        className={`${styles.crosshairCursor} ${dragging ? styles.cursorDragging : ''}`}
        data-gallery-cursor
        aria-hidden='true'
      />
    </section>
  )
}

function SelectedMetadata({
  item,
  onOpen,
  position,
  total
}: {
  readonly item: SpatialGalleryItem
  readonly onOpen: () => void
  readonly position: number
  readonly total: number
}) {
  return (
    <section
      className={styles.metadata}
      data-selected-scenario-metadata
      aria-labelledby='selected-scenario'
    >
      <div className={styles.metadataRail}>
        <span className={styles.metadataCrosshair} aria-hidden='true' />
        <span>Selected frame</span>
        <span>
          {String(position).padStart(2, '0')}—{String(total).padStart(2, '0')}
        </span>
      </div>

      <div className={styles.titleClip}>
        <h1 id='selected-scenario'>{item.title}</h1>
      </div>

      <dl className={styles.metadataFacts}>
        <div>
          <dt>Source</dt>
          <dd>{item.source}</dd>
        </div>
        <div>
          <dt>Released</dt>
          <dd>{item.releaseYear}</dd>
        </div>
        <div>
          <dt>Alignment lens</dt>
          <dd>{item.lens}</dd>
        </div>
      </dl>

      <Link
        className={styles.openStudy}
        data-selected-scenario-link='desktop'
        href={item.href}
        scroll={false}
        transitionTypes={['scenario-forward']}
        onClick={(event) => handleTransitionLink(event, onOpen)}
      >
        Open this scenario <span aria-hidden='true'>↗</span>
      </Link>
    </section>
  )
}

function MobileSelectedScenario({
  item,
  onOpen
}: {
  readonly item: SpatialGalleryItem
  readonly onOpen: () => void
}) {
  return (
    <section
      className={styles.mobileSelection}
      data-mobile-selected-scenario
      aria-labelledby='mobile-selected-scenario'
    >
      <h1 id='mobile-selected-scenario'>Selected scenario: {item.title}</h1>
      <Link
        className={styles.mobileSelectedLink}
        data-selected-scenario-link='mobile'
        href={item.href}
        scroll={false}
        transitionTypes={['scenario-forward']}
        onClick={(event) => handleTransitionLink(event, onOpen)}
      >
        Open {item.title} <span aria-hidden='true'>↗</span>
      </Link>
    </section>
  )
}

function handleTransitionLink(
  event: MouseEvent<HTMLAnchorElement>,
  open: () => void
) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return
  }

  event.preventDefault()
  open()
}

function CanvasLoading() {
  return (
    <div className={styles.canvasLoading} aria-hidden='true'>
      <span />
      <span />
      <span />
    </div>
  )
}

function GalleryFallback({
  animateItemSize,
  itemSize,
  items,
  selectedIndex
}: {
  readonly animateItemSize: boolean
  readonly itemSize: number
  readonly items: readonly SpatialGalleryItem[]
  readonly selectedIndex: number | null
}) {
  const fieldRef = useRef<HTMLOListElement>(null)
  const previousItemSizeRef = useRef(itemSize)
  const [layoutState, setLayoutState] =
    useState<GalleryFallbackLayoutState | null>(null)

  useEffect(() => {
    const field = fieldRef.current
    const surface = field?.parentElement
    if (!field || !surface) return
    const itemSizeChanged = previousItemSizeRef.current !== itemSize
    previousItemSizeRef.current = itemSize

    const updateLayout = (
      { height, width }: Readonly<{ height: number; width: number }>,
      motion: GalleryFallbackLayoutMotion
    ) => {
      if (width <= 0 || height <= 0) return

      const metrics = getGalleryViewportMetrics(
        isMobileGalleryViewport(width),
        width,
        height,
        itemSize
      )
      const frameHeightPixels = metrics.frameWidthPixels / GALLERY_FRAME_ASPECT
      const nextLayout = {
        columnGapPixels: Math.max(
          0,
          metrics.columnPitchPixels - metrics.frameWidthPixels
        ),
        frameHeightPixels,
        frameWidthPixels: metrics.frameWidthPixels,
        lanes: metrics.lanes,
        rowGapPixels: Math.max(0, metrics.rowPitchPixels - frameHeightPixels)
      }

      setLayoutState((currentState) => {
        if (
          currentState &&
          areFallbackLayoutsEqual(currentState.layout, nextLayout)
        ) {
          return currentState
        }

        return { layout: nextLayout, motion }
      })
    }
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) updateLayout(entry.contentRect, 'instant')
    })

    resizeObserver.observe(surface)
    updateLayout(
      surface.getBoundingClientRect(),
      itemSizeChanged && animateItemSize ? 'smooth' : 'instant'
    )

    return () => resizeObserver.disconnect()
  }, [animateItemSize, itemSize])

  const layout = layoutState?.layout ?? null

  return (
    <ol
      ref={fieldRef}
      className={styles.fallbackField}
      data-checking={layout ? undefined : true}
      data-gallery-fallback
      data-gallery-layout-motion={layoutState?.motion ?? 'instant'}
      data-gallery-lanes={layout?.lanes}
      aria-label='All scenarios'
      onTransitionEnd={(event) => {
        if (
          event.propertyName !== 'transform' ||
          event.target !== event.currentTarget.firstElementChild
        ) {
          return
        }

        setLayoutState((currentState) =>
          currentState?.motion === 'smooth'
            ? { ...currentState, motion: 'instant' }
            : currentState
        )
      }}
    >
      {items.slice(0, 10).map((item, index) => (
        <li
          key={item.id}
          className={styles.fallbackFrame}
          data-selected={index === selectedIndex || undefined}
          style={
            layout
              ? getFallbackFrameStyle(layout, index, Math.min(items.length, 10))
              : undefined
          }
        >
          <Link
            href={item.href}
            scroll={false}
            transitionTypes={['scenario-forward']}
          >
            {/* The no-WebGL fallback paints the same tiny placeholder behind its native image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.image.src}
              alt={item.image.alt}
              style={{
                backgroundImage: `url(${item.image.blurDataURL})`,
                backgroundPosition: focalPointToObjectPosition(
                  item.image.focalPoint
                ),
                backgroundSize: 'cover',
                objectPosition: focalPointToObjectPosition(
                  item.image.focalPoint
                )
              }}
            />
            <span>{item.source}</span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

type GalleryFallbackLayout = Readonly<{
  columnGapPixels: number
  frameHeightPixels: number
  frameWidthPixels: number
  lanes: number
  rowGapPixels: number
}>

type GalleryFallbackLayoutMotion = 'instant' | 'smooth'
type GalleryFallbackLayoutState = Readonly<{
  layout: GalleryFallbackLayout
  motion: GalleryFallbackLayoutMotion
}>

function areFallbackLayoutsEqual(
  first: GalleryFallbackLayout,
  second: GalleryFallbackLayout
) {
  return (
    first.columnGapPixels === second.columnGapPixels &&
    first.frameHeightPixels === second.frameHeightPixels &&
    first.frameWidthPixels === second.frameWidthPixels &&
    first.lanes === second.lanes &&
    first.rowGapPixels === second.rowGapPixels
  )
}

function getFallbackFrameStyle(
  layout: GalleryFallbackLayout,
  index: number,
  itemCount: number
) {
  const columns = Math.ceil(itemCount / layout.lanes)
  const column = Math.floor(index / layout.lanes)
  const lane = index % layout.lanes
  const columnPitch = layout.frameWidthPixels + layout.columnGapPixels
  const rowPitch = layout.frameHeightPixels + layout.rowGapPixels
  const x = (column - (columns - 1) / 2) * columnPitch
  const y = (lane - (layout.lanes - 1) / 2) * rowPitch

  return {
    '--gallery-fallback-frame-height': `${layout.frameHeightPixels}px`,
    '--gallery-fallback-frame-width': `${layout.frameWidthPixels}px`,
    '--gallery-fallback-x': `${x}px`,
    '--gallery-fallback-y': `${y}px`
  } as CSSProperties
}
