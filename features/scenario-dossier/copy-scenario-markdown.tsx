'use client'

import { CheckIcon, CopyIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

const FEEDBACK_DURATION_MS = 2000

type CopyState = 'idle' | 'success' | 'error'

export function CopyScenarioMarkdown({
  markdown
}: {
  readonly markdown: string
}) {
  const [state, setState] = useState<CopyState>('idle')
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    },
    []
  )

  const copyMarkdown = async () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)

    try {
      await navigator.clipboard.writeText(markdown)
      setState('success')
    } catch {
      setState('error')
    }

    resetTimerRef.current = setTimeout(
      () => setState('idle'),
      FEEDBACK_DURATION_MS
    )
  }

  const label =
    state === 'success'
      ? 'Copied'
      : state === 'error'
        ? "Couldn't copy"
        : 'Copy scenario as Markdown'

  return (
    <div>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        data-copy-scenario-markdown
        data-state={state}
        onClick={copyMarkdown}
      >
        {state === 'success' ? (
          <CheckIcon data-icon='inline-start' />
        ) : state === 'error' ? (
          <XIcon data-icon='inline-start' />
        ) : (
          <CopyIcon data-icon='inline-start' />
        )}
        {label}
      </Button>
      <span className='sr-only' role='status' aria-live='polite'>
        {state === 'success'
          ? 'Scenario Markdown copied to clipboard'
          : state === 'error'
            ? 'Unable to copy scenario Markdown'
            : ''}
      </span>
    </div>
  )
}
