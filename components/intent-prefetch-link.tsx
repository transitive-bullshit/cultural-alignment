'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { useState } from 'react'

type IntentPrefetchLinkProps = Omit<
  ComponentProps<typeof Link>,
  'href' | 'prefetch'
> & {
  readonly href: string
}

/**
 * Fully prefetches a route after hover, focus, or touch intent. This is reserved
 * for dynamic routes that Next.js cannot prefetch through Link's default mode.
 */
export function IntentPrefetchLink({
  href,
  onFocus,
  onMouseEnter,
  onTouchStart,
  ...props
}: IntentPrefetchLinkProps) {
  const [shouldPrefetch, setShouldPrefetch] = useState(false)

  const activatePrefetch = () => setShouldPrefetch(true)

  return (
    <Link
      {...props}
      href={href}
      prefetch={shouldPrefetch}
      onFocus={(event) => {
        activatePrefetch()
        onFocus?.(event)
      }}
      onMouseEnter={(event) => {
        activatePrefetch()
        onMouseEnter?.(event)
      }}
      onTouchStart={(event) => {
        activatePrefetch()
        onTouchStart?.(event)
      }}
    />
  )
}
