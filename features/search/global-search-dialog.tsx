'use client'

import {
  Fragment,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useRouter } from 'next/navigation'
import { XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { SearchDocument } from '@/lib/content/catalog'
import {
  normalizeSearchText,
  searchDocumentGroups,
  splitSearchTextMatches
} from '@/lib/content/search'
import { cn } from '@/lib/utils'

import type { SearchLoadState } from './global-search'
import styles from './global-search-dialog.module.css'

export type GlobalSearchDialogProps = {
  readonly documents: readonly SearchDocument[]
  readonly loadState: SearchLoadState
  readonly onOpenChange: (open: boolean) => void
  readonly open: boolean
}

export function GlobalSearchDialog({
  documents,
  loadState,
  onOpenChange,
  open
}: GlobalSearchDialogProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const groups = useMemo(
    () => searchDocumentGroups(documents, deferredQuery),
    [documents, deferredQuery]
  )

  useEffect(() => {
    const firstResultHref = groups[0]?.documents[0]?.href

    if (firstResultHref) router.prefetch(firstResultHref)
  }, [groups, router])

  function handleSelect(href: string) {
    onOpenChange(false)
    router.push(href)
  }

  function handleIntent(href: string) {
    router.prefetch(href)
  }

  function handleQueryChange(nextQuery: string) {
    resultsRef.current?.scrollTo({ top: 0 })
    setQuery(nextQuery)
  }

  function handleClear() {
    handleQueryChange('')
    inputRef.current?.focus()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='gap-0 overflow-hidden p-2 sm:max-w-2xl sm:p-3'
        disableMotion
        showCloseButton={false}
      >
        <DialogHeader className='sr-only'>
          <DialogTitle>Search Cultural Alignment</DialogTitle>
          <DialogDescription>
            Search scenarios, franchises, risk families, AI safety concepts, and
            sources.
          </DialogDescription>
        </DialogHeader>

        <Command
          className='relative **:data-[slot=command-input-wrapper]:h-12 **:data-[slot=command-input-wrapper]:px-4 [&_[cmdk-group]]:px-1 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5'
          onValueChange={handleIntent}
          shouldFilter={false}
          loop
        >
          <CommandInput
            ref={inputRef}
            className='pr-8'
            value={query}
            onValueChange={handleQueryChange}
            placeholder='Search the cultural archive…'
            autoFocus
          />
          {query.length > 0 ? (
            <Button
              className='absolute top-3 right-4'
              variant='ghost'
              size='icon-xs'
              type='button'
              aria-label='Clear search'
              onClick={handleClear}
            >
              <XIcon data-icon='inline-start' />
            </Button>
          ) : null}
          <CommandList
            ref={resultsRef}
            className='max-h-[min(62vh,35rem)] py-1'
            data-search-results
          >
            <CommandEmpty>
              {emptyMessage(loadState, deferredQuery)}
            </CommandEmpty>
            {groups.map((group, groupIndex) => (
              <Fragment key={group.kind}>
                {groupIndex > 0 ? (
                  <CommandSeparator
                    className='mx-3 my-3'
                    variant='accent'
                    data-search-result-divider
                    alwaysRender
                  />
                ) : null}
                <CommandGroup heading={group.label}>
                  {group.documents.map((document) => {
                    const context = supportingKeyword(document, deferredQuery)

                    return (
                      <CommandItem
                        className={styles.result}
                        data-search-result-href={document.href}
                        key={`${document.kind}:${document.href}`}
                        value={document.href}
                        onSelect={() => handleSelect(document.href)}
                      >
                        <span className='flex min-w-0 flex-1 flex-col gap-1'>
                          <span
                            className={cn(
                              'truncate font-medium',
                              styles.resultTitle
                            )}
                            data-search-result-title
                          >
                            <HighlightedSearchText
                              value={document.title}
                              query={deferredQuery}
                            />
                          </span>
                          <span className='truncate text-xs text-muted-foreground'>
                            <HighlightedSearchText
                              value={document.subtitle}
                              query={deferredQuery}
                            />
                          </span>
                          {context ? (
                            <span className='truncate text-xs text-muted-foreground'>
                              <span className='sr-only'>
                                Matching context:{' '}
                              </span>
                              <HighlightedSearchText
                                value={context}
                                query={deferredQuery}
                              />
                            </span>
                          ) : null}
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </Fragment>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function emptyMessage(loadState: SearchLoadState, query: string) {
  if (loadState === 'loading') return 'Loading the archive…'
  if (loadState === 'error') return 'Search is unavailable. Close and retry.'
  if (!query.trim()) return 'Type a title, franchise, source, risk, or concept.'

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
        <mark className='rounded-sm bg-ring/20 px-1 text-inherit'>
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

  const keywordMatch = [
    ...document.keywords,
    ...(document.supplementalKeywords ?? [])
  ]
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
