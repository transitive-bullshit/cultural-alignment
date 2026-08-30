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
  type MouseEvent,
  type PointerEvent
} from 'react'
import { flushSync } from 'react-dom'

import { SpoilerWarning } from '@/features/spoiler/spoiler-warning'
import { focalPointToObjectPosition } from '@/lib/media/crop'
import { stageScenarioTransitionPreview } from '@/lib/media/scenario-transition-preview'
import { classifyGesture, shouldCaptureGalleryWheel } from '@/lib/spatial/field'

import styles from './spatial-gallery.module.css'
import {
  mergeGalleryHistoryState,
  readGalleryHistoryState
} from './history-state'
import type {
  SpatialFrameRect,
  SpatialGalleryController,
  SpatialGalleryItem
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
export type SpatialGalleryMode = 'featured' | 'browse'
type TransitionProxy = Readonly<{
  item: SpatialGalleryItem
  rect: SpatialFrameRect
}>

export function SpatialGallery({
  historyKey,
  initialItemId,
  items,
  mode
}: {
  readonly historyKey: string
  readonly initialItemId?: string
  readonly items: readonly SpatialGalleryItem[]
  readonly mode: SpatialGalleryMode
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
  const [dragging, setDragging] = useState(false)
  const [renderMode, setRenderMode] = useState<RenderMode>('checking')
  const [reducedMotion, setReducedMotion] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [transitionReady, setTransitionReady] = useState(false)
  const [transitionProxy, setTransitionProxy] =
    useState<TransitionProxy | null>(null)
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
          version: 1
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
      const overSpoilerWarning =
        target instanceof Element &&
        Boolean(target.closest('[data-spoiler-warning]'))
      const insideGallery =
        !overDialog &&
        !overSpoilerWarning &&
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
      className={styles.gallery}
      data-spatial-gallery={mode}
      data-gallery-transition-ready={transitionReady || undefined}
      data-selected-scenario-id={selectedItem?.id}
      aria-label={`${mode === 'featured' ? 'Featured' : 'All'} cultural scenarios. Drag horizontally or scroll to explore.`}
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

        {!historyReady || renderMode === 'checking' ? (
          <CanvasLoading />
        ) : renderMode === 'webgl' ? (
          <SpatialGalleryCanvas
            controllerRef={controllerRef}
            initialIndex={sceneInitialIndex}
            initialOffsetX={initialOffsetX}
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
            items={items}
            mode={mode}
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

      {mode === 'featured' ? (
        <SpoilerWarning className={styles.spoilerWarning} />
      ) : null}

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
  items,
  mode,
  selectedIndex
}: {
  readonly items: readonly SpatialGalleryItem[]
  readonly mode: SpatialGalleryMode
  readonly selectedIndex: number | null
}) {
  return (
    <ol
      className={styles.fallbackField}
      aria-label={mode === 'featured' ? 'Featured scenarios' : 'All scenarios'}
    >
      {items.slice(0, 10).map((item, index) => (
        <li
          key={item.id}
          className={styles.fallbackFrame}
          data-selected={index === selectedIndex || undefined}
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
