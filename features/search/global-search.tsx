'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import type { SearchDocument, StaticContentKind } from '@/lib/content/catalog'
import { searchDocumentGroups } from '@/lib/content/search'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export type GlobalSearchProps = {
  readonly className?: string
  readonly label?: string
}

export function GlobalSearch({
  className,
  label = 'Search'
}: GlobalSearchProps) {
  const router = useRouter()
  const requestRef = useRef<Promise<void> | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [documents, setDocuments] = useState<readonly SearchDocument[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [shortcutReady, setShortcutReady] = useState(false)
  const groups = useMemo(
    () => searchDocumentGroups(documents, query),
    [documents, query]
  )

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
      setOpen((wasOpen) => {
        const nextOpen = !wasOpen

        if (nextOpen) loadDocuments()

        return nextOpen
      })
    }

    window.addEventListener('keydown', handleShortcut)
    setShortcutReady(true)

    return () => window.removeEventListener('keydown', handleShortcut)
  }, [loadDocuments])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) loadDocuments()
  }

  function handleSelect(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className={className}
          variant='ghost'
          size='sm'
          aria-label={`${label} site (Command K or Control K)`}
          data-search-ready={shortcutReady ? 'true' : 'false'}
        >
          {label}
          <kbd>⌘K</kbd>
        </Button>
      </DialogTrigger>

      <DialogContent
        className='gap-0 overflow-hidden p-0 sm:max-w-2xl'
        showCloseButton={false}
      >
        <DialogHeader className='sr-only'>
          <DialogTitle>Search Cultural Alignment</DialogTitle>
          <DialogDescription>
            Search scenarios, risk families, AI safety concepts, and sources.
          </DialogDescription>
        </DialogHeader>

        <Command shouldFilter={false} loop>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder='Search the cultural archive…'
            autoFocus
          />
          <CommandList className='max-h-[min(62vh,35rem)]'>
            <CommandEmpty>{emptyMessage(loadState, query)}</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.kind} heading={group.label}>
                {group.documents.map((document) => (
                  <CommandItem
                    key={`${document.kind}:${document.href}`}
                    value={document.href}
                    onSelect={() => handleSelect(document.href)}
                  >
                    <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
                      <span className='truncate'>{document.title}</span>
                      <span className='truncate text-xs text-muted-foreground'>
                        {document.subtitle}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function emptyMessage(loadState: LoadState, query: string) {
  if (loadState === 'loading') return 'Loading the archive…'
  if (loadState === 'error') return 'Search is unavailable. Close and retry.'
  if (!query.trim()) return 'Type a title, source, risk, or concept.'

  return 'No matching records.'
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
