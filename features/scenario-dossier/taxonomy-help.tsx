'use client'

import { CircleQuestionMarkIcon } from 'lucide-react'
import { useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

export function TaxonomyHelp({
  description,
  label
}: {
  readonly description: string
  readonly label: string
}) {
  const [open, setOpen] = useState(false)
  const descriptionId = useId()
  const touchOpenIntentRef = useRef<boolean | null>(null)

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon-xs'
          data-taxonomy-help
          aria-label={`About ${label.toLowerCase()}`}
          aria-describedby={descriptionId}
          onPointerDown={(event) => {
            if (event.pointerType === 'touch') {
              event.preventDefault()
              touchOpenIntentRef.current = !open
            }
          }}
          onPointerUp={(event) => {
            if (event.pointerType === 'touch') {
              setOpen(touchOpenIntentRef.current ?? true)
              touchOpenIntentRef.current = null
            }
          }}
          onPointerCancel={() => {
            touchOpenIntentRef.current = null
          }}
          onClick={(event) => event.preventDefault()}
        >
          <CircleQuestionMarkIcon aria-hidden='true' />
        </Button>
      </TooltipTrigger>
      <TooltipContent className='max-w-64' sideOffset={6}>
        <p>{description}</p>
      </TooltipContent>
      <span id={descriptionId} className='sr-only'>
        {description}
      </span>
    </Tooltip>
  )
}
