'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode
} from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const CARD_WIDTH = 288
const CARD_HEIGHT_FALLBACK = 160
const VIEWPORT_GUTTER = 16
const CURSOR_OFFSET = 20
const FOCUS_OFFSET = 12

type CardAnchor = Readonly<{
  aboveBottom: number
  belowTop: number
  horizontalCenter: number
}>

export interface CursorCardProps {
  readonly children: ReactNode
  readonly className?: string
  readonly contentId?: string
  readonly description: string
  readonly image?: string
  readonly imageAlt?: string
}

/**
 * Adds a cursor-following preview to an existing trigger without introducing
 * another link or button around it.
 */
export function CursorCard({
  children,
  className,
  contentId,
  description,
  image,
  imageAlt = ''
}: CursorCardProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const lastAnchorRef = useRef<CardAnchor>(null)
  const generatedContentId = useId()
  const prefersReducedMotion = useReducedMotion()
  const isOpen = isFocused || isHovered
  const resolvedContentId = contentId ?? generatedContentId

  const positionCard = useCallback((anchor: CardAnchor) => {
    lastAnchorRef.current = anchor

    const width = Math.min(
      CARD_WIDTH,
      Math.max(0, window.innerWidth - VIEWPORT_GUTTER * 2)
    )
    const height = cardRef.current?.offsetHeight ?? CARD_HEIGHT_FALLBACK
    const maxLeft = Math.max(
      VIEWPORT_GUTTER,
      window.innerWidth - width - VIEWPORT_GUTTER
    )
    const left = clamp(
      anchor.horizontalCenter - width / 2,
      VIEWPORT_GUTTER,
      maxLeft
    )
    const belowFits =
      anchor.belowTop + height <= window.innerHeight - VIEWPORT_GUTTER
    const top = belowFits
      ? anchor.belowTop
      : Math.max(VIEWPORT_GUTTER, anchor.aboveBottom - height)

    setPosition({ left, top })
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen || !lastAnchorRef.current) return

    const frame = requestAnimationFrame(() => {
      if (lastAnchorRef.current) positionCard(lastAnchorRef.current)
    })

    return () => cancelAnimationFrame(frame)
  }, [description, image, isOpen, positionCard])

  const handlePointerEnter = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!canHover(event)) return

    setIsHovered(true)
    positionCard(pointerAnchor(event))
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!canHover(event)) return

    positionCard(pointerAnchor(event))
  }

  const handleFocus = (event: ReactFocusEvent<HTMLSpanElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()

    setIsFocused(true)
    positionCard({
      aboveBottom: bounds.top - FOCUS_OFFSET,
      belowTop: bounds.bottom + FOCUS_OFFSET,
      horizontalCenter: bounds.left + bounds.width / 2
    })
  }

  const handleBlur = (event: ReactFocusEvent<HTMLSpanElement>) => {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return
    }

    setIsFocused(false)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== 'Escape') return

    setIsFocused(false)
    setIsHovered(false)
  }

  return (
    <>
      <span
        className={className}
        data-cursor-card-trigger
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={() => setIsHovered(false)}
        onPointerMove={handlePointerMove}
      >
        {children}
      </span>

      {mounted
        ? createPortal(
            <AnimatePresence>
              {isOpen ? (
                <motion.div
                  ref={cardRef}
                  id={resolvedContentId}
                  role='tooltip'
                  data-cursor-card-content
                  initial={
                    prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }
                  }
                  animate={{ opacity: 1, scale: 1 }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.96 }
                  }
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: 0.15, ease: 'easeOut' }
                  }
                  style={position}
                  className='pointer-events-none fixed w-72 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover p-4 text-popover-foreground shadow-xl'
                >
                  {image ? (
                    // This primitive accepts arbitrary local or remote preview URLs.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className='mb-3 h-auto w-full rounded-md object-cover'
                      src={image}
                      alt={imageAlt}
                    />
                  ) : null}
                  <p className='m-0 text-sm leading-relaxed text-muted-foreground'>
                    {description}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </>
  )
}

function canHover(event: ReactPointerEvent<HTMLSpanElement>) {
  return event.pointerType !== 'touch'
}

function pointerAnchor(event: ReactPointerEvent<HTMLSpanElement>): CardAnchor {
  return {
    aboveBottom: event.clientY - CURSOR_OFFSET,
    belowTop: event.clientY + CURSOR_OFFSET,
    horizontalCenter: event.clientX
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}
