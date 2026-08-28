import { describe, expect, it } from 'vitest'

import type { SearchDocument } from './catalog'
import {
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
  it('ranks normalized matches across title, subtitle, and keyword fields', () => {
    expect(
      searchDocuments(documents, 'black').map(({ title }) => title)
    ).toEqual(['Black Mirror', 'The Rating Game'])
    expect(
      searchDocuments(documents, 'rating game').map(({ title }) => title)
    ).toEqual(['The Rating Game', 'A Different Story'])
    expect(searchDocuments(documents, 'GOODHARTS')[0]?.title).toBe(
      "Goodhart's law"
    )
    expect(searchDocuments(documents, 'rating black')).toEqual([
      expect.objectContaining({ title: 'The Rating Game' })
    ])
  })

  it('reserves capped results for every matching resource kind', () => {
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
    expect(searchDocumentGroups(documents, 'source', 0)).toEqual([])
    expect(searchDocuments(documents, '   ')).toEqual([])
  })
})

describe('splitSearchTextMatches', () => {
  it('maps normalized matches back to punctuation, diacritics, and repeats', () => {
    expect(splitSearchTextMatches('Goodhart’s law', 'GOODHARTS')).toEqual([
      { start: 0, text: 'Goodhart’s', isMatch: true },
      { start: 10, text: ' law', isMatch: false }
    ])
    expect(splitSearchTextMatches('Café—rating', 'cafe rating')).toEqual([
      { start: 0, text: 'Café—rating', isMatch: true }
    ])
    expect(splitSearchTextMatches('AI for AI', 'ai')).toEqual([
      { start: 0, text: 'AI', isMatch: true },
      { start: 2, text: ' for ', isMatch: false },
      { start: 7, text: 'AI', isMatch: true }
    ])
  })

  it('uses the same normalization contract as ranking', () => {
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
