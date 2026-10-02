'use client'

import type { ComponentProps } from 'react'

import { requestGlobalSearch } from './search-request'

/** Opens the page's existing header search. */
export function OpenSearchButton(props: ComponentProps<'button'>) {
  return (
    <button
      type='button'
      aria-haspopup='dialog'
      {...props}
      onClick={(event) => {
        props.onClick?.(event)
        if (!event.defaultPrevented) requestGlobalSearch()
      }}
    />
  )
}
