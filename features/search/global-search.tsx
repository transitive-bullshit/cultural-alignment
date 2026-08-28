'use client'

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
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
import {
  normalizeSearchText,
  searchDocumentGroups,
  splitSearchTextMatches
} from '@/lib/content/search'

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
        className='gap-0 overflow-hidden p-2 sm:max-w-2xl sm:p-3'
        disableMotion
        showCloseButton={false}
      >
        <DialogHeader className='sr-only'>
          <DialogTitle>Search Cultural Alignment</DialogTitle>
          <DialogDescription>
            Search scenarios, risk families, AI safety concepts, and sources.
          </DialogDescription>
        </DialogHeader>

        <Command
          className='**:data-[slot=command-input-wrapper]:h-12 **:data-[slot=command-input-wrapper]:px-4 [&_[cmdk-group]]:px-1 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5'
          shouldFilter={false}
          loop
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder='Search the cultural archive…'
            autoFocus
          />
          <CommandList className='max-h-[min(62vh,35rem)] py-1'>
            <CommandEmpty>{emptyMessage(loadState, query)}</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.kind} heading={group.label}>
                {group.documents.map((document) => {
                  const context = supportingKeyword(document, query)

                  return (
                    <CommandItem
                      key={`${document.kind}:${document.href}`}
                      value={document.href}
                      onSelect={() => handleSelect(document.href)}
                    >
                      <span className='flex min-w-0 flex-1 flex-col gap-1'>
                        <span className='truncate font-medium'>
                          <HighlightedSearchText
                            value={document.title}
                            query={query}
                          />
                        </span>
                        <span className='truncate text-xs text-muted-foreground'>
                          <HighlightedSearchText
                            value={document.subtitle}
                            query={query}
                          />
                        </span>
                        {context ? (
                          <span className='truncate text-xs text-muted-foreground'>
                            <span className='sr-only'>Matching context: </span>
                            <HighlightedSearchText
                              value={context}
                              query={query}
                            />
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  )
                })}
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

function HighlightedSearchText({
  value,
  query
}: {
  readonly value: string
  readonly query: string
}) {
  return splitSearchTextMatches(value, query).map((segment) => (
    <Fragment key={`${segment.start}:${segment.isMatch}`}>
      {segment.isMatch ? (
        <mark className='rounded-sm bg-ring/20 px-0.5 text-inherit'>
          {segment.text}
        </mark>
      ) : (
        segment.text
      )}
    </Fragment>
  ))
}

function supportingKeyword(document: SearchDocument, query: string) {
  const queryTokens = normalizeSearchText(query).split(' ').filter(Boolean)
  const visibleText = normalizeSearchText(
    `${document.title} ${document.subtitle}`
  )
  const missingTokens = queryTokens.filter(
    (token) => !visibleText.includes(token)
  )

  if (missingTokens.length === 0) return null

  const keywordMatch = document.keywords
    .map((keyword, index) => {
      const normalizedKeyword = normalizeSearchText(keyword)

      return {
        index,
        keyword,
        matchingTokenCount: missingTokens.filter((token) =>
          normalizedKeyword.includes(token)
        ).length
      }
    })
    .filter(({ matchingTokenCount }) => matchingTokenCount > 0)
    .toSorted(
      (left, right) =>
        right.matchingTokenCount - left.matchingTokenCount ||
        left.keyword.length - right.keyword.length ||
        left.index - right.index
    )[0]

  if (!keywordMatch) return null

  return searchSnippet(keywordMatch.keyword, missingTokens.join(' '))
}

function searchSnippet(value: string, query: string, maxLength = 128) {
  if (value.length <= maxLength) return value

  const firstMatch = splitSearchTextMatches(value, query).find(
    ({ isMatch }) => isMatch
  )

  if (!firstMatch) return `${value.slice(0, maxLength).trimEnd()}…`

  const matchLength = firstMatch.text.length
  const desiredStart =
    firstMatch.start - Math.max(0, Math.floor((maxLength - matchLength) / 2))
  const start = Math.max(0, Math.min(desiredStart, value.length - maxLength))
  const end = Math.min(value.length, start + maxLength)
  const excerpt = value.slice(start, end).trim()

  return `${start > 0 ? '…' : ''}${excerpt}${end < value.length ? '…' : ''}`
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
