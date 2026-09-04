'use client'

import Image, { getImageProps } from 'next/image'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  DownloadIcon,
  XIcon
} from 'lucide-react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent
} from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { ContentImage } from '@/lib/content/catalog'

import { getNextVisibleMemeCount, MEME_BATCH_SIZE } from './meme-gallery-state'
import styles from './scenario-memes.module.css'

const MEME_DETAIL_SIZES =
  '(max-width: 620px) calc(100vw - 36px), (max-width: 1100px) calc(100vw - 9rem), 960px'
const MEME_DOWNLOAD_FEEDBACK_MILLISECONDS = 1_800
const MEME_PRELOAD_IDLE_TIMEOUT_MILLISECONDS = 500

type MemePreview = Readonly<{
  isBlurred: boolean
  src: string
}>

export type MemeDownloadState = 'error' | 'idle' | 'loading' | 'success'

type MediaRect = Readonly<{
  height: number
  left: number
  top: number
  width: number
}>

type MemeStageStyle = CSSProperties & {
  '--meme-stage-max-width': string
  '--meme-stage-mobile-max-width': string
}

export function ScenarioMemes({
  memes,
  scenarioSlug,
  scenarioTitle
}: {
  readonly memes: readonly ContentImage[]
  readonly scenarioSlug: string
  readonly scenarioTitle: string
}) {
  const headingId = useId()
  const gridId = useId()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const imageStageRef = useRef<HTMLDivElement | null>(null)
  const originatingButtonRef = useRef<HTMLButtonElement | null>(null)
  const memeButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const spatialOriginRectRef = useRef<MediaRect | null>(null)
  const spatialMotionEnabledRef = useRef(false)
  const openingMotionPendingRef = useRef(false)
  const preloadedDetailImagesRef = useRef(new Map<string, HTMLImageElement>())
  const pendingFocusIndexRef = useRef<number | null>(null)
  const downloadTokenRef = useRef(0)
  const [visibleCount, setVisibleCount] = useState(() =>
    getNextVisibleMemeCount(0, memes.length)
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const [loadedDetailSrc, setLoadedDetailSrc] = useState<string | null>(null)
  const [downloadState, setDownloadState] = useState<MemeDownloadState>('idle')
  const [preview, setPreview] = useState<MemePreview>(() => ({
    isBlurred: true,
    src: memes[0]?.blurDataURL ?? ''
  }))
  const [gridAnnouncement, setGridAnnouncement] = useState('')
  const [dialogAnnouncement, setDialogAnnouncement] = useState('')

  useEffect(() => {
    const pendingFocusIndex = pendingFocusIndexRef.current
    if (pendingFocusIndex === null) return

    memeButtonRefs.current[pendingFocusIndex]?.focus()
    pendingFocusIndexRef.current = null
  }, [visibleCount])

  useEffect(() => {
    if (!open || memes.length < 2) return

    return scheduleIdleWork(() => {
      for (const index of getMemePreloadOrder(activeIndex, memes.length)) {
        const meme = memes[index]!
        if (preloadedDetailImagesRef.current.has(meme.detailSrc)) continue

        const { props } = getImageProps({
          src: meme.detailSrc,
          alt: '',
          width: meme.width,
          height: meme.height,
          sizes: MEME_DETAIL_SIZES,
          unoptimized: true
        })
        const image = new window.Image()

        image.decoding = 'async'
        image.fetchPriority = 'low'
        image.sizes = props.sizes ?? MEME_DETAIL_SIZES
        image.srcset = props.srcSet ?? ''
        image.src = props.src
        image.addEventListener(
          'error',
          () => preloadedDetailImagesRef.current.delete(meme.detailSrc),
          { once: true }
        )
        preloadedDetailImagesRef.current.set(meme.detailSrc, image)
      }
    })
  }, [activeIndex, memes, open])

  useEffect(() => {
    if (downloadState !== 'success' && downloadState !== 'error') return

    const resetHandle = window.setTimeout(
      () => setDownloadState('idle'),
      MEME_DOWNLOAD_FEEDBACK_MILLISECONDS
    )

    return () => window.clearTimeout(resetHandle)
  }, [downloadState])

  const configureMemeStage = useCallback(() => {
    const result = configureMemeStageMotion(
      imageStageRef.current,
      spatialOriginRectRef.current,
      openingMotionPendingRef.current
    )

    if (result.configured) openingMotionPendingRef.current = false

    return result.cleanup
  }, [])

  useLayoutEffect(() => {
    if (!open) return

    return configureMemeStage()
  }, [activeIndex, configureMemeStage, open])

  if (memes.length === 0) return null

  const activeMeme = memes[activeIndex]!
  const visibleMemes = memes.slice(0, visibleCount)
  const remainingCount = Math.max(0, memes.length - visibleCount)
  const nextBatchCount = Math.min(MEME_BATCH_SIZE, remainingCount)

  const getPreview = (
    index: number,
    button = memeButtonRefs.current[index]
  ): MemePreview => {
    const image = button?.querySelector('img')
    const source = image?.currentSrc || image?.src

    return source
      ? { isBlurred: false, src: source }
      : { isBlurred: true, src: memes[index]!.blurDataURL }
  }

  const setSpatialOrigin = (
    index: number,
    button = memeButtonRefs.current[index]
  ) => {
    if (!button) {
      spatialOriginRectRef.current = null
      return
    }

    const meme = memes[index]!
    spatialOriginRectRef.current = getContainedMediaRect(
      button.getBoundingClientRect(),
      meme.width / meme.height
    )
  }

  const openMeme = (
    index: number,
    button: HTMLButtonElement,
    animateFromThumbnail: boolean
  ) => {
    originatingButtonRef.current = button
    spatialMotionEnabledRef.current = animateFromThumbnail
    if (animateFromThumbnail) {
      setSpatialOrigin(index, button)
    } else {
      spatialOriginRectRef.current = null
    }
    openingMotionPendingRef.current = animateFromThumbnail
    setActiveIndex(index)
    setLoadedDetailSrc(null)
    downloadTokenRef.current += 1
    setDownloadState('idle')
    setPreview(getPreview(index, button))
    setDialogAnnouncement('')
    setOpen(true)
  }

  const moveBy = (direction: -1 | 1) => {
    if (memes.length < 2) return

    const nextIndex = (activeIndex + direction + memes.length) % memes.length

    if (imageStageRef.current) {
      delete imageStageRef.current.dataset.openingMotion
    }
    openingMotionPendingRef.current = false
    if (spatialMotionEnabledRef.current) {
      setSpatialOrigin(nextIndex)
    } else {
      spatialOriginRectRef.current = null
    }
    setActiveIndex(nextIndex)
    setLoadedDetailSrc(null)
    downloadTokenRef.current += 1
    setDownloadState('idle')
    setPreview(getPreview(nextIndex))
    setDialogAnnouncement(`Meme ${nextIndex + 1} of ${memes.length}`)
  }

  const showNextBatch = () => {
    const nextVisibleCount = getNextVisibleMemeCount(visibleCount, memes.length)

    if (nextVisibleCount === memes.length) {
      pendingFocusIndexRef.current = visibleCount
    }
    setVisibleCount(nextVisibleCount)
    setGridAnnouncement(`Showing ${nextVisibleCount} of ${memes.length} memes`)
  }

  const downloadActiveMeme = async () => {
    const meme = activeMeme
    const memeIndex = activeIndex
    const token = ++downloadTokenRef.current

    setDownloadState('loading')
    setDialogAnnouncement(
      `Preparing meme ${memeIndex + 1} of ${memes.length} for download`
    )

    try {
      // The visible image may have populated a non-CORS cache entry. Reload so
      // this blob request receives the asset host's CORS response headers.
      const response = await fetch(meme.detailSrc, { cache: 'reload' })
      if (!response.ok) throw new Error(`Download failed: ${response.status}`)

      const objectUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')

      link.href = objectUrl
      link.download = getMemeDownloadFilename(
        scenarioSlug,
        memeIndex,
        meme.detailSrc
      )
      link.hidden = true
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
      if (isStaleDownload(token, downloadTokenRef.current)) return
      setDownloadState('success')
      setDialogAnnouncement(
        `Meme ${memeIndex + 1} of ${memes.length} download started`
      )
    } catch {
      if (isStaleDownload(token, downloadTokenRef.current)) return
      setDownloadState('error')
      setDialogAnnouncement(
        `Could not download meme ${memeIndex + 1}. Open the image in a new tab to save it instead.`
      )
    }
  }

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return
    }

    if (event.key.toLowerCase() === 'd') {
      event.preventDefault()
      if (event.repeat || downloadState === 'loading') return

      void downloadActiveMeme()
      return
    }

    if (
      memes.length < 2 ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    ) {
      return
    }

    event.preventDefault()
    moveBy(event.key === 'ArrowRight' ? 1 : -1)
  }

  return (
    <section
      className={styles.section}
      aria-labelledby={headingId}
      data-scenario-memes
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Scenario artifacts</p>
            <h2 id={headingId}>Memes</h2>
          </div>
          <p className={styles.count} aria-label={`${memes.length} memes`}>
            {String(memes.length).padStart(2, '0')} images
          </p>
        </header>

        <ul id={gridId} className={styles.grid} data-scenario-meme-grid>
          {visibleMemes.map((meme, index) => (
            <li key={`${meme.detailSrc}:${index}`}>
              <button
                ref={(button) => {
                  memeButtonRefs.current[index] = button
                }}
                className={styles.trigger}
                type='button'
                aria-label={`Open meme ${index + 1} of ${memes.length}`}
                data-scenario-meme-trigger
                onClick={(event) =>
                  openMeme(index, event.currentTarget, event.detail > 0)
                }
              >
                <span className={styles.thumbnailFrame}>
                  <Image
                    className={styles.thumbnailImage}
                    src={meme.gallerySrc}
                    alt={meme.alt}
                    fill
                    placeholder='blur'
                    blurDataURL={meme.blurDataURL}
                    sizes='(max-width: 620px) 45vw, (max-width: 820px) 30vw, (max-width: 1279px) 23vw, 250px'
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>

        {remainingCount > 0 ? (
          <div className={styles.moreAction}>
            <Button
              type='button'
              variant='outline'
              aria-controls={gridId}
              data-scenario-meme-load-more
              onClick={showNextBatch}
            >
              View {nextBatchCount} more
            </Button>
          </div>
        ) : null}

        <span className='sr-only' role='status' aria-live='polite'>
          {gridAnnouncement}
        </span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          ref={dialogRef}
          className={styles.dialog}
          motion='custom'
          overlayClassName={styles.dialogOverlay}
          showCloseButton={false}
          aria-keyshortcuts='ArrowLeft ArrowRight D'
          data-scenario-meme-lightbox
          data-scenario-meme-index={activeIndex}
          tabIndex={-1}
          onKeyDown={handleDialogKeyDown}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            configureMemeStage()
            dialogRef.current?.focus({ preventScroll: true })
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            originatingButtonRef.current?.focus()
          }}
        >
          <DialogHeader className='sr-only'>
            <DialogTitle>
              {scenarioTitle}: meme {activeIndex + 1} of {memes.length}
            </DialogTitle>
            <DialogDescription>
              Use the previous and next buttons or the Left and Right Arrow keys
              to browse. Press D to download the current meme or Escape to
              close.
            </DialogDescription>
          </DialogHeader>

          <DialogClose asChild>
            <Button
              className={styles.closeButton}
              type='button'
              variant='outline'
              size='icon-lg'
              aria-label='Close meme viewer'
            >
              <XIcon data-icon='inline-start' />
            </Button>
          </DialogClose>

          <div
            className={styles.dialogBody}
            data-single={memes.length === 1 || undefined}
          >
            {memes.length > 1 ? (
              <Button
                className={styles.previousButton}
                type='button'
                variant='outline'
                size='icon-lg'
                aria-label='Previous meme'
                onClick={() => moveBy(-1)}
              >
                <ChevronLeftIcon data-icon='inline-start' />
              </Button>
            ) : null}

            <figure className={styles.figure}>
              <div
                ref={imageStageRef}
                className={styles.imageStage}
                style={getMemeStageStyle(activeMeme)}
                data-scenario-meme-stage
              >
                <img
                  className={styles.blurPreviewImage}
                  src={activeMeme.blurDataURL}
                  alt=''
                  aria-hidden='true'
                />
                <img
                  className={styles.previewImage}
                  src={preview.src}
                  alt=''
                  aria-hidden='true'
                  data-blurred={preview.isBlurred || undefined}
                  data-scenario-meme-preview
                />
                <Image
                  key={activeMeme.detailSrc}
                  className={styles.focusedImage}
                  src={activeMeme.detailSrc}
                  alt={activeMeme.alt}
                  width={activeMeme.width}
                  height={activeMeme.height}
                  placeholder='blur'
                  blurDataURL={activeMeme.blurDataURL}
                  sizes={MEME_DETAIL_SIZES}
                  loading='eager'
                  unoptimized
                  data-loaded={
                    loadedDetailSrc === activeMeme.detailSrc || undefined
                  }
                  data-scenario-meme-image
                  onLoad={() => setLoadedDetailSrc(activeMeme.detailSrc)}
                />
              </div>
            </figure>

            {memes.length > 1 ? (
              <Button
                className={styles.nextButton}
                type='button'
                variant='outline'
                size='icon-lg'
                aria-label='Next meme'
                onClick={() => moveBy(1)}
              >
                <ChevronRightIcon data-icon='inline-start' />
              </Button>
            ) : null}
          </div>

          <DialogFooter className={styles.dialogFooter}>
            <p className={styles.counter} data-scenario-meme-counter>
              Meme {activeIndex + 1} of {memes.length}
            </p>
            <Button
              className={styles.downloadButton}
              type='button'
              variant={getDownloadButtonVariant(downloadState)}
              size='icon'
              aria-label={getDownloadButtonLabel(
                downloadState,
                activeIndex,
                memes.length
              )}
              aria-busy={downloadState === 'loading'}
              data-download-state={downloadState}
              data-scenario-meme-download
              disabled={downloadState === 'loading'}
              onClick={downloadActiveMeme}
            >
              {downloadState === 'success' ? (
                <CheckIcon
                  data-icon='inline-start'
                  data-scenario-meme-download-confirmation
                />
              ) : downloadState === 'error' ? (
                <CircleAlertIcon data-icon='inline-start' />
              ) : (
                <DownloadIcon data-icon='inline-start' />
              )}
            </Button>
          </DialogFooter>

          <span className='sr-only' role='status' aria-live='polite'>
            {dialogAnnouncement}
          </span>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function configureMemeStageMotion(
  imageStage: HTMLDivElement | null,
  originRect: MediaRect | null,
  animateOpening: boolean
) {
  if (!imageStage) return { configured: false }

  if (!originRect) {
    delete imageStage.dataset.openingMotion
    delete imageStage.dataset.spatialOrigin
    imageStage.style.removeProperty('--meme-origin-x')
    imageStage.style.removeProperty('--meme-origin-y')
    imageStage.style.removeProperty('--meme-origin-scale')
    return { configured: true }
  }

  const targetRect = imageStage.getBoundingClientRect()
  if (targetRect.width === 0 || targetRect.height === 0) {
    return { configured: false }
  }

  const translateX =
    originRect.left +
    originRect.width / 2 -
    (targetRect.left + targetRect.width / 2)
  const translateY =
    originRect.top +
    originRect.height / 2 -
    (targetRect.top + targetRect.height / 2)
  const scale = originRect.width / targetRect.width

  imageStage.style.setProperty('--meme-origin-x', `${translateX}px`)
  imageStage.style.setProperty('--meme-origin-y', `${translateY}px`)
  imageStage.style.setProperty('--meme-origin-scale', String(scale))
  imageStage.dataset.spatialOrigin = 'true'

  const shouldAnimateOpening =
    animateOpening || imageStage.dataset.openingMotion === 'true'

  if (
    !shouldAnimateOpening ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    delete imageStage.dataset.openingMotion
    return { configured: true }
  }

  imageStage.dataset.openingMotion = 'true'

  const clearOpeningMotion = () => {
    delete imageStage.dataset.openingMotion
  }

  imageStage.addEventListener('animationend', clearOpeningMotion, {
    once: true
  })

  return {
    configured: true,
    cleanup: () => {
      imageStage.removeEventListener('animationend', clearOpeningMotion)
    }
  }
}

function getContainedMediaRect(container: DOMRect, aspectRatio: number) {
  const containerAspectRatio = container.width / container.height

  if (containerAspectRatio > aspectRatio) {
    const width = container.height * aspectRatio

    return {
      left: container.left + (container.width - width) / 2,
      top: container.top,
      width,
      height: container.height
    }
  }

  const height = container.width / aspectRatio

  return {
    left: container.left,
    top: container.top + (container.height - height) / 2,
    width: container.width,
    height
  }
}

function getMemeStageStyle(meme: ContentImage): MemeStageStyle {
  const aspectRatio = meme.width / meme.height

  return {
    aspectRatio: `${meme.width} / ${meme.height}`,
    '--meme-stage-max-width': getViewportConstrainedWidth(aspectRatio, 9),
    '--meme-stage-mobile-max-width': getViewportConstrainedWidth(
      aspectRatio,
      11
    )
  }
}

function getViewportConstrainedWidth(aspectRatio: number, reservedRem: number) {
  return `calc(${aspectRatio * 100}svh - ${aspectRatio * reservedRem}rem)`
}

function getMemePreloadOrder(activeIndex: number, memeCount: number) {
  const indices: number[] = []
  const included = new Set([activeIndex])

  for (let distance = 1; indices.length < memeCount - 1; distance += 1) {
    for (const index of [
      (activeIndex + distance) % memeCount,
      (activeIndex - distance + memeCount) % memeCount
    ]) {
      if (included.has(index)) continue

      included.add(index)
      indices.push(index)
    }
  }

  return indices
}

export function isStaleDownload(
  capturedToken: number,
  currentToken: number
): boolean {
  return capturedToken !== currentToken
}

export function getMemeDownloadFilename(
  scenarioSlug: string,
  memeIndex: number,
  source: string
) {
  const extension = new URL(source).pathname.match(/\.([a-z0-9]+)$/i)?.[1]

  return `${scenarioSlug}-meme-${memeIndex + 1}.${extension ?? 'webp'}`
}

export function getDownloadButtonLabel(
  state: MemeDownloadState,
  memeIndex: number,
  memeCount: number
) {
  const position = `meme ${memeIndex + 1} of ${memeCount}`

  if (state === 'loading') return `Preparing ${position} for download`
  if (state === 'success') return `${position} download started`
  if (state === 'error') return `Retry downloading ${position}`
  return `Download ${position}`
}

export function getDownloadButtonVariant(state: MemeDownloadState) {
  if (state === 'success') return 'secondary' as const
  if (state === 'error') return 'destructive' as const
  return 'ghost' as const
}

function scheduleIdleWork(callback: () => void) {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(callback, {
      timeout: MEME_PRELOAD_IDLE_TIMEOUT_MILLISECONDS
    })

    return () => window.cancelIdleCallback(handle)
  }

  const handle = window.setTimeout(callback, 16)

  return () => window.clearTimeout(handle)
}
