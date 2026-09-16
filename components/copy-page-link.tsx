'use client'

import { CheckIcon, CopyIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'

import styles from './copy-page-link.module.css'

type CopyState = 'idle' | 'success' | 'error'

export function CopyPageLink() {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attempt = useRef(0)

  useEffect(
    () => () => {
      attempt.current += 1
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  async function copyLink() {
    const currentAttempt = ++attempt.current
    if (timer.current) clearTimeout(timer.current)

    let nextState: CopyState
    try {
      await navigator.clipboard.writeText(window.location.href)
      nextState = 'success'
    } catch {
      nextState = 'error'
    }

    // Ignore stale clipboard responses, including after leaving this page.
    if (currentAttempt !== attempt.current) return
    setState(nextState)
    timer.current = setTimeout(() => setState('idle'), 2500)
  }

  const label =
    state === 'success'
      ? 'Link copied'
      : state === 'error'
        ? 'Couldn’t copy link. Try again.'
        : 'Copy link'

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon-lg'
            className={styles.button}
            aria-label={label}
            data-copy-page-link
            data-state={state}
            onClick={copyLink}
          >
            <span
              className={styles.icon}
              data-visible={state === 'idle'}
              aria-hidden='true'
            >
              <CopyIcon />
            </span>
            <span
              className={styles.icon}
              data-visible={state === 'success'}
              aria-hidden='true'
            >
              <CheckIcon />
            </span>
            <span
              className={styles.icon}
              data-visible={state === 'error'}
              aria-hidden='true'
            >
              <XIcon />
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side='top' sideOffset={6}>
          {label}
        </TooltipContent>
      </Tooltip>
      <span className='sr-only' role='status'>
        {state === 'success'
          ? 'Link copied to clipboard'
          : state === 'error'
            ? 'Unable to copy link. Try again or copy the URL from your address bar.'
            : ''}
      </span>
    </TooltipProvider>
  )
}
