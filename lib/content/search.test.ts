import { describe, expect, it } from 'vitest'

import type { SearchDocument } from './catalog'
import {
  groupSearchResults,
  normalizeSearchText,
  searchDocumentGroups,
  searchDocuments,
  splitSearchTextMatches
} from './search'

const documents = [
  createDocument({
    kind: 'scenario',
    title: 'The Rating Game',
    subtitle: 'Black Mirror',
    keywords: ['social scoring and proxy optimization']
  }),
  createDocument({
    kind: 'source',
    title: 'Black Mirror',
    subtitle: 'Source'
  }),
  createDocument({
    kind: 'concept',
    title: "Goodhart's law",
    subtitle: 'AI safety concept',
    keywords: ['When a measure becomes a target']
  }),
  createDocument({
    kind: 'risk-family',
    title: 'Misalignment',
    subtitle: 'AI risk family',
    keywords: ['learned objectives diverge from human intent']
  }),
  createDocument({
    kind: 'scenario',
    title: 'A Different Story',
    subtitle: 'Another source',
    keywords: ['The rating game appears only in the scene description']
  })
]

describe('searchDocuments', () => {
  it('ranks exact and prefix title matches ahead of subtitle and keyword matches', () => {
    expect(
      searchDocuments(documents, 'black').map(({ title }) => title)
    ).toEqual(['Black Mirror', 'The Rating Game'])
    expect(
      searchDocuments(documents, 'rating game').map(({ title }) => title)
    ).toEqual(['The Rating Game', 'A Different Story'])
  })

  it('normalizes punctuation, case, and diacritics', () => {
    expect(searchDocuments(documents, 'GOODHARTS')[0]?.title).toBe(
      "Goodhart's law"
    )
  })

  it('supports token matches distributed across document fields', () => {
    expect(searchDocuments(documents, 'rating black')).toEqual([
      expect.objectContaining({ title: 'The Rating Game' })
    ])
  })

  it('returns an empty result for blank queries and honors a finite limit', () => {
    expect(searchDocuments(documents, '   ')).toEqual([])
    expect(searchDocuments(documents, 'source', 1)).toHaveLength(1)
    expect(searchDocuments(documents, 'source', 0)).toEqual([])
  })

  it('orders groups by their best-ranked result', () => {
    expect(groupSearchResults(searchDocuments(documents, 'black'))).toEqual([
      expect.objectContaining({ kind: 'source', label: 'Sources' }),
      expect.objectContaining({ kind: 'scenario', label: 'Scenarios' })
    ])
  })

  it('reserves palette results for every matching resource kind', () => {
    const crowdedDocuments = [
      ...Array.from({ length: 60 }, (_, index) =>
        createDocument({
          kind: 'scenario',
          title: `Shared match scenario ${index}`,
          subtitle: 'Scenario'
        })
      ),
      createDocument({
        kind: 'risk-family',
        title: 'Shared match risk',
        subtitle: 'AI risk family'
      }),
      createDocument({
        kind: 'concept',
        title: 'Shared match concept',
        subtitle: 'AI safety concept'
      }),
      createDocument({
        kind: 'source',
        title: 'Shared match source',
        subtitle: 'Source'
      })
    ]

    const groups = searchDocumentGroups(crowdedDocuments, 'shared match', 3)

    expect(groups.map(({ kind }) => kind)).toEqual([
      'concept',
      'risk-family',
      'scenario',
      'source'
    ])
    expect(groups.map(({ documents }) => documents.length)).toEqual([
      1, 1, 3, 1
    ])
  })

  it('returns no grouped results for a zero cap', () => {
    expect(searchDocumentGroups(documents, 'source', 0)).toEqual([])
  })
})

describe('splitSearchTextMatches', () => {
  it('maps normalized punctuation and diacritics back to the original text', () => {
    expect(splitSearchTextMatches('Goodhart’s law', 'GOODHARTS')).toEqual([
      { start: 0, text: 'Goodhart’s', isMatch: true },
      { start: 10, text: ' law', isMatch: false }
    ])
    expect(splitSearchTextMatches('Café—rating', 'cafe rating')).toEqual([
      { start: 0, text: 'Café—rating', isMatch: true }
    ])
  })

  it('highlights the tokens present when a query spans multiple fields', () => {
    expect(splitSearchTextMatches('Black Mirror', 'rating black')).toEqual([
      { start: 0, text: 'Black', isMatch: true },
      { start: 5, text: ' Mirror', isMatch: false }
    ])
  })

  it('highlights every occurrence without changing unmatched content', () => {
    expect(splitSearchTextMatches('AI for AI', 'ai')).toEqual([
      { start: 0, text: 'AI', isMatch: true },
      { start: 2, text: ' for ', isMatch: false },
      { start: 7, text: 'AI', isMatch: true }
    ])
    expect(splitSearchTextMatches('<AI safety>', '')).toEqual([
      { start: 0, text: '<AI safety>', isMatch: false }
    ])
  })

  it('uses the same normalization as search ranking', () => {
    expect(normalizeSearchText('  Café—Goodhart’s  ')).toBe('cafe goodharts')
  })
})

function createDocument(
  input: Omit<SearchDocument, 'href' | 'keywords'> & {
    readonly href?: string
    readonly keywords?: readonly string[]
  }
): SearchDocument {
  return {
    ...input,
    keywords: input.keywords ?? [],
    href: input.href ?? `/${input.kind}/${input.title}`
  }
}
