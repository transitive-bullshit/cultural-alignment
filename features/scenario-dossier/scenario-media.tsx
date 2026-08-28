'use client'

import Image from 'next/image'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'

import type { ScenarioPage } from '@/lib/content/catalog'

import {
  clampMediaTime,
  formatMediaTime,
  MEDIA_SEEK_STEP_SECONDS
} from './scenario-media-state'
import styles from './scenario-dossier.module.css'

const YOUTUBE_IFRAME_API_ID = 'youtube-iframe-api'
const YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api'
const PROGRESS_POLL_INTERVAL_MS = 250

type YouTubePlayer = {
  readonly destroy: () => void
  readonly getCurrentTime: () => number
  readonly getDuration: () => number
  readonly pauseVideo: () => void
  readonly playVideo: () => void
  readonly seekTo: (seconds: number, allowSeekAhead: boolean) => void
  readonly stopVideo: () => void
}

type YouTubePlayerEvent = {
  readonly target: YouTubePlayer
}

type YouTubePlayerStateEvent = YouTubePlayerEvent & {
  readonly data: number
}

type YouTubePlayerOptions = {
  readonly events: {
    readonly onReady: (event: YouTubePlayerEvent) => void
    readonly onStateChange: (event: YouTubePlayerStateEvent) => void
  }
}

type YouTubeIframeApi = {
  readonly Player: new (
    iframe: HTMLIFrameElement,
    options: YouTubePlayerOptions
  ) => YouTubePlayer
}

declare global {
  interface Window {
    YT?: YouTubeIframeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

let youtubeIframeApiPromise: Promise<YouTubeIframeApi> | null = null

function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (youtubeIframeApiPromise) return youtubeIframeApiPromise

  youtubeIframeApiPromise = new Promise<YouTubeIframeApi>((resolve, reject) => {
    const resolveIfReady = () => {
      if (window.YT?.Player) resolve(window.YT)
    }
    const previousReady = window.onYouTubeIframeAPIReady

    window.onYouTubeIframeAPIReady = () => {
      try {
        previousReady?.()
      } finally {
        resolveIfReady()
      }
    }

    const existingScript = document.getElementById(
      YOUTUBE_IFRAME_API_ID
    ) as HTMLScriptElement | null
    const script = existingScript ?? document.createElement('script')

    script.addEventListener('load', resolveIfReady, { once: true })
    script.addEventListener(
      'error',
      () => reject(new Error('Unable to load the YouTube IFrame API')),
      { once: true }
    )

    if (!existingScript) {
      script.id = YOUTUBE_IFRAME_API_ID
      script.src = YOUTUBE_IFRAME_API_SRC
      document.head.append(script)
    }

    resolveIfReady()
  })

  return youtubeIframeApiPromise
}

type CursorPosition = {
  readonly cursorX: number
  readonly cursorY: number
  readonly labelX: number
  readonly labelY: number
}

type ScenarioMediaModel = Pick<ScenarioPage, 'image' | 'title' | 'video'> & {
  readonly sourceTitle: string
}

export function ScenarioMedia({ media }: { media: ScenarioMediaModel }) {
  const { image, sourceTitle, title, video } = media
  const [hasActivatedVideo, setHasActivatedVideo] = useState(false)
  const [isShowingStill, setIsShowingStill] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const clipStart = video?.startSeconds ?? 0
  const [currentTime, setCurrentTime] = useState(clipStart)
  const [duration, setDuration] = useState(0)
  const frameRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentTimeRef = useRef(clipStart)
  const durationRef = useRef(0)
  const playbackIntentRef = useRef(false)
  const showingStillRef = useRef(true)
  const isScrubbingRef = useRef(false)
  const crosshairRef = useRef<HTMLSpanElement>(null)
  const floatingLabelRef = useRef<HTMLSpanElement>(null)
  const cursorFrameRef = useRef<number | null>(null)
  const cursorPositionRef = useRef<CursorPosition | null>(null)
  const frameBoundsRef = useRef<DOMRect | null>(null)
  const customCursorEnabledRef = useRef(false)
  const pointerInsideFrameRef = useRef(false)
  const pointerOverForegroundControlRef = useRef(false)
  const objectPosition = image.focalPoint
    ? `${image.focalPoint.x * 100}% ${image.focalPoint.y * 100}%`
    : '50% 50%'
  const hasVideo = video !== null
  const actionLabel = isPlaying ? 'Pause clip' : 'Play clip'
  const explicitActionLabel = isPlaying
    ? 'Pause clip'
    : isShowingStill
      ? 'Play clip'
      : 'Resume clip'

  const syncProgress = useCallback((player: YouTubePlayer) => {
    if (showingStillRef.current || isScrubbingRef.current) return

    const nextDuration = player.getDuration()
    const nextTime = clampMediaTime(player.getCurrentTime(), nextDuration)

    if (Number.isFinite(nextDuration) && nextDuration > 0) {
      durationRef.current = nextDuration
      setDuration((previousDuration) =>
        Math.abs(previousDuration - nextDuration) < 0.05
          ? previousDuration
          : nextDuration
      )
    }

    currentTimeRef.current = nextTime
    setCurrentTime((previousTime) =>
      Math.abs(previousTime - nextTime) < 0.05 ? previousTime : nextTime
    )
  }, [])

  const seekTo = useCallback((time: number, allowSeekAhead = true) => {
    const nextTime = clampMediaTime(time, durationRef.current)

    currentTimeRef.current = nextTime
    setCurrentTime(nextTime)
    playerRef.current?.seekTo(nextTime, allowSeekAhead)
  }, [])

  const togglePlayback = () => {
    if (!hasVideo) return

    const shouldPlay = isShowingStill || !isPlaying
    playbackIntentRef.current = shouldPlay
    showingStillRef.current = false
    if (!hasActivatedVideo) setHasActivatedVideo(true)
    setIsShowingStill(false)
    setIsPlaying(shouldPlay)

    const player = playerRef.current
    if (!player) return

    if (isShowingStill) {
      seekTo(clipStart)
    }

    if (shouldPlay) {
      player.playVideo()
    } else {
      player.pauseVideo()
    }
  }

  const returnToStill = () => {
    playerRef.current?.stopVideo()
    playbackIntentRef.current = false
    showingStillRef.current = true
    currentTimeRef.current = clipStart
    setCurrentTime(clipStart)
    setIsPlaying(false)
    setIsShowingStill(true)
    pointerOverForegroundControlRef.current = false
    syncCursorVisibility()
  }

  const seekByKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      isShowingStill ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    ) {
      return
    }

    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    seekTo(currentTimeRef.current + direction * MEDIA_SEEK_STEP_SECONDS)
  }

  const scrubProgress = (event: ChangeEvent<HTMLInputElement>) => {
    seekTo(Number(event.currentTarget.value), !isScrubbingRef.current)
  }

  const startScrubbing = () => {
    isScrubbingRef.current = true
    enterForegroundControl()
  }

  const finishScrubbing = () => {
    isScrubbingRef.current = false
    playerRef.current?.seekTo(currentTimeRef.current, true)
  }

  const syncCursorVisibility = () => {
    const cursorVisible =
      customCursorEnabledRef.current && pointerInsideFrameRef.current

    if (crosshairRef.current) {
      crosshairRef.current.style.opacity = cursorVisible ? '1' : '0'
    }
    if (floatingLabelRef.current) {
      floatingLabelRef.current.style.opacity =
        cursorVisible && !pointerOverForegroundControlRef.current ? '1' : '0'
    }
  }

  const enterForegroundControl = () => {
    pointerOverForegroundControlRef.current = true
    syncCursorVisibility()
  }

  const leaveForegroundControl = () => {
    pointerOverForegroundControlRef.current = false
    syncCursorVisibility()
  }

  const paintCursor = () => {
    cursorFrameRef.current = null
    const position = cursorPositionRef.current
    if (!position) return

    if (crosshairRef.current) {
      crosshairRef.current.style.transform = `translate3d(${position.cursorX}px, ${position.cursorY}px, 0) translate(-50%, -50%)`
    }
    if (floatingLabelRef.current) {
      floatingLabelRef.current.style.transform = `translate3d(${position.labelX}px, ${position.labelY}px, 0)`
    }
  }

  const queueCursorPosition = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hasVideo || !customCursorEnabledRef.current) return

    const bounds =
      frameBoundsRef.current ?? event.currentTarget.getBoundingClientRect()
    const cursorX = event.clientX - bounds.left
    const cursorY = event.clientY - bounds.top

    cursorPositionRef.current = {
      cursorX,
      cursorY,
      labelX: Math.min(
        Math.max(cursorX + 18, 8),
        Math.max(8, bounds.width - 92)
      ),
      labelY: Math.min(
        Math.max(cursorY + 16, 8),
        Math.max(8, bounds.height - 32)
      )
    }

    if (cursorFrameRef.current === null) {
      cursorFrameRef.current = requestAnimationFrame(paintCursor)
    }
  }

  const showCursor = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hasVideo || !customCursorEnabledRef.current) return
    pointerInsideFrameRef.current = true
    frameBoundsRef.current = event.currentTarget.getBoundingClientRect()
    syncCursorVisibility()
    queueCursorPosition(event)
  }

  const hideCursor = () => {
    pointerInsideFrameRef.current = false
    pointerOverForegroundControlRef.current = false
    frameBoundsRef.current = null
    syncCursorVisibility()
  }

  useEffect(() => {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const syncCustomCursor = () => {
      customCursorEnabledRef.current =
        finePointer.matches && !reducedMotion.matches

      if (!customCursorEnabledRef.current) hideCursor()
    }

    syncCustomCursor()
    finePointer.addEventListener('change', syncCustomCursor)
    reducedMotion.addEventListener('change', syncCustomCursor)

    return () => {
      finePointer.removeEventListener('change', syncCustomCursor)
      reducedMotion.removeEventListener('change', syncCustomCursor)
      if (cursorFrameRef.current !== null) {
        cancelAnimationFrame(cursorFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!hasActivatedVideo || !video) return

    let disposed = false
    let player: YouTubePlayer | null = null

    void loadYouTubeIframeApi()
      .then(({ Player }) => {
        const iframe = iframeRef.current
        if (disposed || !iframe) return

        player = new Player(iframe, {
          events: {
            onReady: ({ target }) => {
              if (disposed) return

              playerRef.current = target
              syncProgress(target)

              if (showingStillRef.current) {
                target.stopVideo()
              } else if (playbackIntentRef.current) {
                target.seekTo(clipStart, true)
                target.playVideo()
              } else {
                target.pauseVideo()
              }

              progressTimerRef.current = setInterval(
                () => syncProgress(target),
                PROGRESS_POLL_INTERVAL_MS
              )
            },
            onStateChange: ({ data, target }) => {
              if (disposed || showingStillRef.current) return

              if (data === 1) setIsPlaying(true)
              if (data === 0 || data === 2 || data === 5) {
                setIsPlaying(false)
              }
              syncProgress(target)
            }
          }
        })
      })
      .catch(() => {
        // The visual fallback and whole-frame controls remain available if the
        // API script is blocked, while the embedded player still autoplays.
      })

    return () => {
      disposed = true
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
      playerRef.current = null
      player?.destroy()
    }
  }, [clipStart, hasActivatedVideo, syncProgress, video])

  const start = video?.startSeconds ? `&start=${video.startSeconds}` : ''
  const origin =
    typeof window === 'undefined'
      ? ''
      : `&origin=${encodeURIComponent(window.location.origin)}`
  const progressMax =
    duration > 0 ? duration : Math.max(currentTime, clipStart + 1)
  const progressPercent =
    progressMax > 0 ? (currentTime / progressMax) * 100 : 0
  const progressStyle = {
    '--media-progress': `${progressPercent}%`
  } as CSSProperties
  const formattedCurrentTime = formatMediaTime(currentTime)
  const formattedDuration = duration > 0 ? formatMediaTime(duration) : '--:--'

  return (
    <div
      ref={frameRef}
      className={styles.mediaFrame}
      data-interactive={hasVideo || undefined}
      data-playing={isPlaying || undefined}
      onPointerEnter={showCursor}
      onPointerLeave={hideCursor}
      onPointerMove={queueCursorPosition}
    >
      {hasActivatedVideo && video ? (
        <iframe
          ref={iframeRef}
          src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&controls=0&enablejsapi=1&playsinline=1&rel=0${start}${origin}`}
          title={`${title} video clip`}
          tabIndex={-1}
          allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
          allowFullScreen
        />
      ) : null}

      {isShowingStill ? (
        <Image
          src={image.detailSrc}
          alt={image.alt}
          fill
          preload
          sizes='(max-width: 820px) 100vw, 57vw'
          style={{ objectPosition }}
        />
      ) : null}

      {isShowingStill ? (
        <span className={styles.mediaIndex}>Scene still / {sourceTitle}</span>
      ) : null}

      {hasVideo ? (
        <>
          <button
            className={styles.mediaToggle}
            type='button'
            aria-label={actionLabel}
            aria-pressed={isPlaying}
            aria-keyshortcuts='ArrowLeft ArrowRight'
            onClick={togglePlayback}
            onKeyDown={seekByKeyboard}
          />

          <span
            ref={crosshairRef}
            className={styles.mediaCrosshair}
            aria-hidden='true'
          >
            <span />
          </span>
          <span
            ref={floatingLabelRef}
            className={styles.floatingMediaLabel}
            aria-hidden='true'
          >
            {actionLabel}
          </span>

          <button
            className={styles.playButton}
            type='button'
            aria-label={explicitActionLabel}
            aria-pressed={isPlaying}
            onClick={togglePlayback}
            onPointerEnter={enterForegroundControl}
            onPointerLeave={leaveForegroundControl}
          >
            <span aria-hidden='true'>{isPlaying ? 'Ⅱ' : '▶'}</span>
            {explicitActionLabel}
          </button>

          {hasActivatedVideo && !isShowingStill ? (
            <div
              className={styles.mediaProgress}
              onPointerEnter={enterForegroundControl}
              onPointerLeave={leaveForegroundControl}
            >
              <input
                className={styles.mediaProgressInput}
                type='range'
                min={0}
                max={progressMax}
                step={1}
                value={clampMediaTime(currentTime, progressMax)}
                aria-label='Clip progress'
                aria-valuetext={`${formattedCurrentTime} of ${formattedDuration}`}
                disabled={duration <= 0}
                style={progressStyle}
                onChange={scrubProgress}
                onPointerDown={startScrubbing}
                onPointerUp={finishScrubbing}
                onPointerCancel={finishScrubbing}
              />
              <span className={styles.mediaProgressTime} aria-hidden='true'>
                {formattedCurrentTime} / {formattedDuration}
              </span>
            </div>
          ) : null}

          {hasActivatedVideo && !isShowingStill ? (
            <button
              className={styles.stopButton}
              type='button'
              onClick={returnToStill}
              onPointerEnter={enterForegroundControl}
              onPointerLeave={leaveForegroundControl}
            >
              Return to still
            </button>
          ) : null}
        </>
      ) : (
        <div className={styles.missingVideo} role='status'>
          <span>Archive note</span>
          <strong>No clip in the collection</strong>
          <small>The scene analysis remains available in full.</small>
        </div>
      )}
    </div>
  )
}
