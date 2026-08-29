'use client'

import { Fragment, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

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
  DialogTitle
} from '@/components/ui/dialog'
import type { SearchDocument } from '@/lib/content/catalog'
import {
  normalizeSearchText,
  searchDocumentGroups,
  splitSearchTextMatches
} from '@/lib/content/search'

import type { SearchLoadState } from './global-search'

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
            Search scenarios, risk families, AI safety concepts, and sources.
          </DialogDescription>
        </DialogHeader>

        <Command
          className='**:data-[slot=command-input-wrapper]:h-12 **:data-[slot=command-input-wrapper]:px-4 [&_[cmdk-group]]:px-1 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5'
          onValueChange={handleIntent}
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
            <CommandEmpty>
              {emptyMessage(loadState, deferredQuery)}
            </CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.kind} heading={group.label}>
                {group.documents.map((document) => {
                  const context = supportingKeyword(document, deferredQuery)

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
                            <span className='sr-only'>Matching context: </span>
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
