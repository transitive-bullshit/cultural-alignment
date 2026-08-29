'use client'

import Image from 'next/image'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'

import type { ScenarioPage } from '@/lib/content/catalog'
import {
  clearScenarioTransitionPreview,
  readScenarioTransitionPreview
} from '@/lib/media/scenario-transition-preview'

import {
  clampMediaTime,
  formatMediaTime,
  MEDIA_SEEK_STEP_SECONDS
} from './scenario-media-state'
import styles from './scenario-dossier.module.css'

const YOUTUBE_IFRAME_API_ID = 'youtube-iframe-api'
const YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api'
const PROGRESS_POLL_INTERVAL_MS = 250
const CHROME_IDLE_DELAY_MS = 2_800

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

type ScenarioMediaModel = Pick<
  ScenarioPage,
  'id' | 'image' | 'title' | 'video'
> & {
  readonly sourceTitle: string
  readonly eager?: boolean
}

function PlaybackGlyph({ isPlaying }: { readonly isPlaying: boolean }) {
  return (
    <svg
      className={styles.playbackGlyph}
      viewBox='0 0 24 24'
      aria-hidden='true'
      focusable='false'
    >
      {isPlaying ? (
        <path d='M7 5.5h3.5v13H7zm6.5 0H17v13h-3.5z' />
      ) : (
        <path d='m8 5.25 10.5 6.75L8 18.75z' />
      )}
    </svg>
  )
}

export function ScenarioMedia({ media }: { media: ScenarioMediaModel }) {
  const { id, image, sourceTitle, title, video, eager } = media
  const [transitionPreview, setTransitionPreview] = useState(() =>
    typeof window === 'undefined' ? null : readScenarioTransitionPreview(id)
  )
  const [hasActivatedVideo, setHasActivatedVideo] = useState(false)
  const [isShowingStill, setIsShowingStill] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isChromeVisible, setIsChromeVisible] = useState(true)
  const clipStart = video?.startSeconds ?? 0
  const [currentTime, setCurrentTime] = useState(clipStart)
  const [duration, setDuration] = useState(0)
  const frameRef = useRef<HTMLDivElement>(null)
  const mediaToggleRef = useRef<HTMLButtonElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chromeHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentTimeRef = useRef(clipStart)
  const durationRef = useRef(0)
  const playbackIntentRef = useRef(false)
  const isPlayingRef = useRef(false)
  const showingStillRef = useRef(true)
  const isScrubbingRef = useRef(false)
  const fineHoverRef = useRef(false)
  const pointerHoverPinnedRef = useRef(false)
  const chromeControlFocusedRef = useRef(false)
  const pointerRef = useRef<HTMLSpanElement>(null)
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

  const clearChromeHideTimer = useCallback(() => {
    if (chromeHideTimerRef.current === null) return

    clearTimeout(chromeHideTimerRef.current)
    chromeHideTimerRef.current = null
  }, [])

  const showChrome = useCallback(() => {
    clearChromeHideTimer()
    setIsChromeVisible(true)
  }, [clearChromeHideTimer])

  const scheduleChromeHide = useCallback(() => {
    clearChromeHideTimer()

    if (
      !isPlayingRef.current ||
      showingStillRef.current ||
      pointerHoverPinnedRef.current ||
      chromeControlFocusedRef.current ||
      isScrubbingRef.current
    ) {
      setIsChromeVisible(true)
      return
    }

    chromeHideTimerRef.current = setTimeout(() => {
      chromeHideTimerRef.current = null

      if (
        isPlayingRef.current &&
        !showingStillRef.current &&
        !pointerHoverPinnedRef.current &&
        !chromeControlFocusedRef.current &&
        !isScrubbingRef.current
      ) {
        setIsChromeVisible(false)
      }
    }, CHROME_IDLE_DELAY_MS)
  }, [clearChromeHideTimer])

  const hideChromeImmediately = useCallback(() => {
    clearChromeHideTimer()

    if (
      !isPlayingRef.current ||
      showingStillRef.current ||
      pointerHoverPinnedRef.current ||
      chromeControlFocusedRef.current ||
      isScrubbingRef.current
    ) {
      setIsChromeVisible(true)
      return
    }

    setIsChromeVisible(false)
  }, [clearChromeHideTimer])

  const setPlaybackState = useCallback((playing: boolean) => {
    isPlayingRef.current = playing
    setIsPlaying(playing)
  }, [])

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
    setPlaybackState(shouldPlay)
    showChrome()

    if (shouldPlay) {
      scheduleChromeHide()
    }

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
    setPlaybackState(false)
    setIsShowingStill(true)
    showChrome()
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
    showChrome()
    enterForegroundControl()
  }

  const finishScrubbing = () => {
    isScrubbingRef.current = false
    playerRef.current?.seekTo(currentTimeRef.current, true)

    if (pointerInsideFrameRef.current) {
      scheduleChromeHide()
    } else {
      hideChromeImmediately()
    }
  }

  const syncCursorVisibility = () => {
    const cursorVisible =
      customCursorEnabledRef.current && pointerInsideFrameRef.current

    if (pointerRef.current) {
      pointerRef.current.style.opacity = cursorVisible ? '1' : '0'
    }
    if (floatingLabelRef.current) {
      floatingLabelRef.current.style.opacity =
        cursorVisible && !pointerOverForegroundControlRef.current ? '1' : '0'
    }
  }

  const enterForegroundControl = () => {
    pointerOverForegroundControlRef.current = true
    showChrome()
    syncCursorVisibility()
  }

  const leaveForegroundControl = () => {
    pointerOverForegroundControlRef.current = false
    syncCursorVisibility()
    scheduleChromeHide()
  }

  const paintCursor = () => {
    cursorFrameRef.current = null
    const position = cursorPositionRef.current
    if (!position) return

    if (pointerRef.current) {
      pointerRef.current.style.transform = `translate3d(${position.cursorX}px, ${position.cursorY}px, 0) translate(-50%, -50%)`
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
    pointerInsideFrameRef.current = true
    if (!hasVideo || !customCursorEnabledRef.current) return
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

  const enterMediaFrame = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerHoverPinnedRef.current =
      fineHoverRef.current && event.pointerType === 'mouse'
    showChrome()

    if (!pointerHoverPinnedRef.current) scheduleChromeHide()
    showCursor(event)
  }

  const moveWithinMediaFrame = (event: ReactPointerEvent<HTMLDivElement>) => {
    showChrome()

    if (!pointerHoverPinnedRef.current) scheduleChromeHide()
    queueCursorPosition(event)
  }

  const leaveMediaFrame = () => {
    pointerHoverPinnedRef.current = false
    hideCursor()
    hideChromeImmediately()
  }

  const focusMediaControl = (event: ReactFocusEvent<HTMLDivElement>) => {
    const focusedTarget = event.target as EventTarget

    chromeControlFocusedRef.current = focusedTarget !== mediaToggleRef.current
    showChrome()

    if (!chromeControlFocusedRef.current) scheduleChromeHide()
  }

  const blurMediaControl = (event: ReactFocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget
    const frame = frameRef.current

    chromeControlFocusedRef.current = Boolean(
      frame &&
      nextTarget instanceof Node &&
      frame.contains(nextTarget) &&
      nextTarget !== mediaToggleRef.current
    )

    if (!chromeControlFocusedRef.current) hideChromeImmediately()
  }

  const handleMediaKeyActivity = () => {
    showChrome()
    scheduleChromeHide()
  }

  const handleMediaPointerActivity = () => {
    showChrome()
    scheduleChromeHide()
  }

  useEffect(() => {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const syncCustomCursor = () => {
      fineHoverRef.current = finePointer.matches
      customCursorEnabledRef.current =
        finePointer.matches && !reducedMotion.matches

      if (!customCursorEnabledRef.current) hideCursor()
      if (!finePointer.matches) {
        pointerHoverPinnedRef.current = false
        scheduleChromeHide()
      }
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
  }, [scheduleChromeHide])

  useEffect(() => {
    if (!isPlaying || isShowingStill) {
      showChrome()
      return
    }

    scheduleChromeHide()
  }, [isPlaying, isShowingStill, scheduleChromeHide, showChrome])

  useEffect(() => clearChromeHideTimer, [clearChromeHideTimer])

  useEffect(() => {
    if (transitionPreview) {
      clearScenarioTransitionPreview(transitionPreview.token)
    }
  }, [transitionPreview])

  useEffect(() => {
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const frame = frameRef.current
      if (!frame || event.composedPath().includes(frame)) return

      pointerHoverPinnedRef.current = false
      hideChromeImmediately()
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown, true)

    return () => {
      document.removeEventListener(
        'pointerdown',
        handleOutsidePointerDown,
        true
      )
    }
  }, [hideChromeImmediately])

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

              if (showingStillRef.current) {
                target.stopVideo()
              } else {
                target.seekTo(currentTimeRef.current, true)

                if (playbackIntentRef.current) {
                  target.playVideo()
                } else {
                  target.pauseVideo()
                }
              }

              progressTimerRef.current = setInterval(
                () => syncProgress(target),
                PROGRESS_POLL_INTERVAL_MS
              )
            },
            onStateChange: ({ data, target }) => {
              if (disposed || showingStillRef.current) return

              if (data === 1) setPlaybackState(true)
              if (data === 0 || data === 2 || data === 5) {
                playbackIntentRef.current = false
                setPlaybackState(false)
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
  }, [hasActivatedVideo, setPlaybackState, syncProgress, video])

  const start = clipStart > 0 ? `&start=${clipStart}` : ''
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
  const playControl = (
    <button
      className={styles.playButton}
      type='button'
      data-scenario-media-playback-control
      aria-label={explicitActionLabel}
      aria-pressed={isPlaying}
      onClick={togglePlayback}
      onPointerEnter={enterForegroundControl}
      onPointerLeave={leaveForegroundControl}
    >
      <span aria-hidden='true'>{isPlaying ? 'Ⅱ' : '▶'}</span>
      {explicitActionLabel}
    </button>
  )

  return (
    <div
      ref={frameRef}
      className={styles.mediaFrame}
      data-scenario-media
      data-interactive={hasVideo || undefined}
      data-playing={isPlaying || undefined}
      data-showing-still={isShowingStill || undefined}
      data-controls-visible={isChromeVisible}
      onFocusCapture={focusMediaControl}
      onBlurCapture={blurMediaControl}
      onKeyDownCapture={handleMediaKeyActivity}
      onPointerDownCapture={handleMediaPointerActivity}
      onPointerEnter={enterMediaFrame}
      onPointerLeave={leaveMediaFrame}
      onPointerMove={moveWithinMediaFrame}
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
        <>
          {transitionPreview ? (
            // This exact optimizer URL is already decoded by the WebGL proxy.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={styles.transitionPreview}
              src={transitionPreview.src}
              alt=''
              aria-hidden='true'
              data-scenario-transition-preview
              style={{ objectPosition }}
            />
          ) : null}

          <Image
            src={image.detailSrc}
            alt={image.alt}
            fill
            preload
            placeholder='blur'
            blurDataURL={image.blurDataURL}
            sizes='(max-width: 820px) 100vw, 57vw'
            style={{ objectPosition }}
            loading={eager ? 'eager' : undefined}
            onLoad={() => setTransitionPreview(null)}
            data-scenario-still
          />
        </>
      ) : null}

      {!hasVideo ? (
        <span className={styles.mediaIndex} data-scenario-media-still-label>
          Scene still / {sourceTitle}
        </span>
      ) : null}

      {hasVideo ? (
        <>
          <button
            ref={mediaToggleRef}
            className={styles.mediaToggle}
            type='button'
            data-scenario-media-toggle
            aria-label={actionLabel}
            aria-pressed={isPlaying}
            aria-keyshortcuts='ArrowLeft ArrowRight'
            onClick={togglePlayback}
            onKeyDown={seekByKeyboard}
          >
            {isShowingStill ? (
              <span
                className={styles.posterPlayAction}
                data-scenario-media-poster-action
                aria-hidden='true'
              >
                <span className={styles.posterPlayIcon}>
                  <PlaybackGlyph isPlaying={false} />
                </span>
              </span>
            ) : null}
          </button>

          <span
            ref={pointerRef}
            className={styles.mediaPointer}
            data-scenario-media-cursor
            aria-hidden='true'
          >
            <span className={styles.mediaPointerSurface}>
              <PlaybackGlyph isPlaying={isPlaying} />
            </span>
          </span>
          <span
            ref={floatingLabelRef}
            className={styles.floatingMediaLabel}
            aria-hidden='true'
          >
            {actionLabel}
          </span>

          {hasActivatedVideo && !isShowingStill ? (
            <div
              className={styles.mediaControlBar}
              onPointerEnter={enterForegroundControl}
              onPointerLeave={leaveForegroundControl}
            >
              <div className={styles.mediaProgress}>
                <input
                  className={styles.mediaProgressInput}
                  data-scenario-media-progress
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
              {playControl}
            </div>
          ) : (
            playControl
          )}

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
