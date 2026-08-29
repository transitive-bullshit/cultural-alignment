'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

import { Button } from '@/components/ui/button'
import type { SearchDocument, StaticContentKind } from '@/lib/content/catalog'

const GlobalSearchDialog = dynamic(() =>
  import('./global-search-dialog').then((module) => module.GlobalSearchDialog)
)

export type SearchLoadState = 'idle' | 'loading' | 'ready' | 'error'

export type GlobalSearchProps = {
  readonly className?: string
  readonly label?: string
}

export function GlobalSearch({
  className,
  label = 'Search'
}: GlobalSearchProps) {
  const openRef = useRef(false)
  const requestRef = useRef<Promise<void> | null>(null)
  const [activated, setActivated] = useState(false)
  const [open, setOpen] = useState(false)
  const [documents, setDocuments] = useState<readonly SearchDocument[]>([])
  const [loadState, setLoadState] = useState<SearchLoadState>('idle')
  const [shortcutReady, setShortcutReady] = useState(false)

  const loadDocuments = useCallback(() => {
    if (loadState === 'ready' || requestRef.current) return

    setLoadState('loading')
    requestRef.current = fetch('/content/search-index.json')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Search index request failed with ${response.status}`)
        }

        const input: unknown = await response.json()

        if (!isSearchDocumentList(input)) {
          throw new Error('Search index did not match the expected shape')
        }

        setDocuments(input)
        setLoadState('ready')
      })
      .catch(() => {
        requestRef.current = null
        setLoadState('error')
      })
  }, [loadState])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      openRef.current = nextOpen
      setOpen(nextOpen)

      if (!nextOpen) return

      preloadGlobalSearchDialog()
      setActivated(true)
      loadDocuments()
    },
    [loadDocuments]
  )

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (
        event.key.toLocaleLowerCase('en') !== 'k' ||
        (!event.metaKey && !event.ctrlKey) ||
        event.altKey
      ) {
        return
      }

      event.preventDefault()
      handleOpenChange(!openRef.current)
    }

    window.addEventListener('keydown', handleShortcut)
    setShortcutReady(true)

    return () => window.removeEventListener('keydown', handleShortcut)
  }, [handleOpenChange])

  return (
    <>
      <Button
        className={className}
        variant='ghost'
        size='sm'
        aria-expanded={open}
        aria-haspopup='dialog'
        aria-label={`${label} site (Command K or Control K)`}
        data-search-ready={shortcutReady ? 'true' : 'false'}
        onClick={() => handleOpenChange(true)}
        onFocus={preloadGlobalSearchDialog}
        onPointerEnter={preloadGlobalSearchDialog}
      >
        {label}
        <kbd>⌘K</kbd>
      </Button>

      {activated ? (
        <GlobalSearchDialog
          documents={documents}
          loadState={loadState}
          onOpenChange={handleOpenChange}
          open={open}
        />
      ) : null}
    </>
  )
}

function preloadGlobalSearchDialog() {
  void import('./global-search-dialog')
}

function isSearchDocumentList(input: unknown): input is SearchDocument[] {
  return Array.isArray(input) && input.every(isSearchDocument)
}

function isSearchDocument(input: unknown): input is SearchDocument {
  if (typeof input !== 'object' || input === null) return false

  const document = input as Record<string, unknown>

  return (
    isContentKind(document.kind) &&
    typeof document.title === 'string' &&
    typeof document.subtitle === 'string' &&
    Array.isArray(document.keywords) &&
    document.keywords.every((keyword) => typeof keyword === 'string') &&
    typeof document.href === 'string' &&
    document.href.startsWith('/')
  )
}

function isContentKind(input: unknown): input is StaticContentKind {
  return (
    input === 'scenario' ||
    input === 'source' ||
    input === 'risk-family' ||
    input === 'concept'
  )
}
