'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef } from 'react'

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789/+=?'

type ScrambleLinkProps = {
  readonly children: string
  readonly className?: string
  readonly delay?: number
  readonly duration?: number
  readonly external?: boolean
  readonly href: string
  readonly label?: string
  readonly prefix?: string
}

/**
 * Keeps the accessible label stable while the decorative copy resolves in place.
 * The fixed character count avoids reflow in the ruled taxonomy lists.
 */
export function ScrambleLink({
  children,
  className,
  delay = 0,
  duration = 420,
  external = false,
  href,
  label,
  prefix = ''
}: ScrambleLinkProps) {
  const copyRef = useRef<HTMLSpanElement>(null)
  const frameRef = useRef<number | null>(null)
  const entryTimerRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    if (entryTimerRef.current !== null) clearTimeout(entryTimerRef.current)
    frameRef.current = null
    entryTimerRef.current = null
  }, [])

  const scramble = useCallback(() => {
    stop()

    const copy = copyRef.current
    if (!copy) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      copy.textContent = children
      return
    }

    const startedAt = performance.now()
    const draw = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const resolvedCharacters = Math.floor(eased * children.length)
      const frame = Math.floor((now - startedAt) / 36)

      copy.textContent = Array.from(children, (character, index) => {
        if (index < resolvedCharacters || !/[a-z0-9]/i.test(character)) {
          return character
        }

        return GLYPHS[(index * 11 + frame * 7) % GLYPHS.length]
      }).join('')

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(draw)
      } else {
        copy.textContent = children
        frameRef.current = null
      }
    }

    frameRef.current = requestAnimationFrame(draw)
  }, [children, duration, stop])

  useEffect(() => {
    const copy = copyRef.current
    if (!copy || !('IntersectionObserver' in window)) {
      entryTimerRef.current = window.setTimeout(scramble, delay)
      return stop
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        observer.disconnect()
        entryTimerRef.current = window.setTimeout(scramble, delay)
      },
      { threshold: 0.35 }
    )

    observer.observe(copy)

    return () => {
      observer.disconnect()
      stop()
    }
  }, [delay, scramble, stop])

  const content = (
    <>
      <span className='sr-only'>
        {prefix}
        {children}
      </span>
      <span aria-hidden='true'>
        {prefix}
        <span ref={copyRef}>{children}</span>
      </span>
    </>
  )

  const scrambleOnHover = () => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      scramble()
    }
  }

  const interactionProps = {
    'aria-label': label ?? `${prefix}${children}`,
    className,
    onPointerEnter: scrambleOnHover
  }

  if (external) {
    return (
      <a {...interactionProps} href={href} rel='noreferrer' target='_blank'>
        {content}
      </a>
    )
  }

  return (
    <Link {...interactionProps} href={href} prefetch={false}>
      {content}
    </Link>
  )
}
