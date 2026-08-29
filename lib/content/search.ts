import type { SearchDocument, StaticContentKind } from './catalog'

export type SearchResultGroup = {
  readonly kind: StaticContentKind
  readonly label: string
  readonly documents: readonly SearchDocument[]
}

export type SearchTextSegment = {
  readonly start: number
  readonly text: string
  readonly isMatch: boolean
}

const GROUP_LABELS = {
  scenario: 'Scenarios',
  'risk-family': 'Risk families',
  concept: 'AI safety concepts',
  source: 'Sources'
} as const satisfies Record<StaticContentKind, string>

export function searchDocuments(
  documents: readonly SearchDocument[],
  query: string,
  limit = 48
) {
  const normalizedQuery = normalizeSearchText(query)
  const normalizedLimit = Math.max(0, Math.floor(limit))

  if (!normalizedQuery || normalizedLimit === 0) return []

  const queryTokens = normalizedQuery.split(' ')

  return documents
    .map((document, index) => ({
      document,
      index,
      score: scoreDocument(document, normalizedQuery, queryTokens)
    }))
    .filter(
      (
        match
      ): match is typeof match & {
        readonly score: number
      } => match.score !== null
    )
    .toSorted(
      (left, right) =>
        left.score - right.score ||
        left.document.title.localeCompare(right.document.title, 'en', {
          sensitivity: 'base'
        }) ||
        left.index - right.index
    )
    .slice(0, normalizedLimit)
    .map(({ document }) => document)
}

export function groupSearchResults(
  documents: readonly SearchDocument[]
): readonly SearchResultGroup[] {
  const documentsByKind = new Map<StaticContentKind, SearchDocument[]>()

  for (const document of documents) {
    const group = documentsByKind.get(document.kind)

    if (group) group.push(document)
    else documentsByKind.set(document.kind, [document])
  }

  return [...documentsByKind].map(([kind, matchingDocuments]) => ({
    kind,
    label: GROUP_LABELS[kind],
    documents: matchingDocuments
  }))
}

export function searchDocumentGroups(
  documents: readonly SearchDocument[],
  query: string,
  limitPerGroup = 12
): readonly SearchResultGroup[] {
  const normalizedLimit = Math.max(0, Math.floor(limitPerGroup))

  if (normalizedLimit === 0) return []

  return groupSearchResults(
    searchDocuments(documents, query, documents.length)
  ).map((group) => ({
    ...group,
    documents: group.documents.slice(0, normalizedLimit)
  }))
}

export function splitSearchTextMatches(
  value: string,
  query: string
): readonly SearchTextSegment[] {
  if (!value) return []

  const normalizedValue = normalizeSearchTextWithSource(value)
  const normalizedQuery = normalizeSearchText(query)

  if (!normalizedValue.text || !normalizedQuery) {
    return [{ start: 0, text: value, isMatch: false }]
  }

  const needles = normalizedValue.text.includes(normalizedQuery)
    ? [normalizedQuery]
    : [...new Set(normalizedQuery.split(' '))]
  const matches = needles
    .flatMap((needle) => findOriginalMatchRanges(normalizedValue, needle))
    .toSorted((left, right) => left.start - right.start || left.end - right.end)
  const mergedMatches: MatchRange[] = []

  for (const match of matches) {
    const previous = mergedMatches.at(-1)

    if (previous && match.start <= previous.end) {
      previous.end = Math.max(previous.end, match.end)
    } else {
      mergedMatches.push({ ...match })
    }
  }

  if (mergedMatches.length === 0) {
    return [{ start: 0, text: value, isMatch: false }]
  }

  const segments: SearchTextSegment[] = []
  let cursor = 0

  for (const match of mergedMatches) {
    if (match.start > cursor) {
      segments.push({
        start: cursor,
        text: value.slice(cursor, match.start),
        isMatch: false
      })
    }

    segments.push({
      start: match.start,
      text: value.slice(match.start, match.end),
      isMatch: true
    })
    cursor = match.end
  }

  if (cursor < value.length) {
    segments.push({
      start: cursor,
      text: value.slice(cursor),
      isMatch: false
    })
  }

  return segments
}

function scoreDocument(
  document: SearchDocument,
  query: string,
  tokens: readonly string[]
) {
  const title = normalizeSearchText(document.title)
  const subtitle = normalizeSearchText(document.subtitle)
  const keywords = document.keywords.map(normalizeSearchText)
  const supplementalKeywords = (document.supplementalKeywords ?? []).map(
    normalizeSearchText
  )
  const titleScore = scoreField(title, query, tokens, 0)

  if (titleScore !== null) return titleScore

  const subtitleScore = scoreField(subtitle, query, tokens, 40)

  if (subtitleScore !== null) return subtitleScore

  let keywordScore: number | null = null

  for (const keyword of keywords) {
    const score = scoreField(keyword, query, tokens, 80)

    if (score !== null && (keywordScore === null || score < keywordScore)) {
      keywordScore = score
    }
  }

  if (keywordScore !== null) return keywordScore

  const combined = [title, subtitle, ...keywords].join(' ')

  if (tokens.every((token) => combined.includes(token))) return 120

  let supplementalKeywordScore: number | null = null

  for (const keyword of supplementalKeywords) {
    const score = scoreField(keyword, query, tokens, 160)

    if (
      score !== null &&
      (supplementalKeywordScore === null || score < supplementalKeywordScore)
    ) {
      supplementalKeywordScore = score
    }
  }

  if (supplementalKeywordScore !== null) return supplementalKeywordScore

  const expanded = [combined, ...supplementalKeywords].join(' ')

  return tokens.every((token) => expanded.includes(token)) ? 200 : null
}

function scoreField(
  field: string,
  query: string,
  tokens: readonly string[],
  base: number
) {
  if (field === query) return base
  if (field.startsWith(query)) return base + 1
  if (field.split(' ').some((word) => word.startsWith(query))) return base + 2
  if (field.includes(query)) return base + 3
  if (tokens.every((token) => field.includes(token))) return base + 4

  return null
}

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

type MatchRange = {
  start: number
  end: number
}

type NormalizedSearchText = {
  readonly text: string
  readonly characters: readonly {
    readonly start: number
    readonly end: number
  }[]
}

function normalizeSearchTextWithSource(value: string): NormalizedSearchText {
  const normalizedCharacters: string[] = []
  const sourceCharacters: { start: number; end: number }[] = []
  let sourceOffset = 0

  for (const sourceCharacter of value) {
    const start = sourceOffset
    sourceOffset += sourceCharacter.length
    const normalizedCharacter = sourceCharacter
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase('en')

    for (const character of normalizedCharacter) {
      if (/[a-z0-9]/.test(character)) {
        normalizedCharacters.push(character)
        sourceCharacters.push({ start, end: sourceOffset })
      } else if (
        character !== "'" &&
        character !== '’' &&
        normalizedCharacters.length > 0 &&
        normalizedCharacters.at(-1) !== ' '
      ) {
        normalizedCharacters.push(' ')
        sourceCharacters.push({ start, end: sourceOffset })
      }
    }
  }

  if (normalizedCharacters.at(-1) === ' ') {
    normalizedCharacters.pop()
    sourceCharacters.pop()
  }

  return {
    text: normalizedCharacters.join(''),
    characters: sourceCharacters
  }
}

function findOriginalMatchRanges(
  value: NormalizedSearchText,
  needle: string
): readonly MatchRange[] {
  const ranges: MatchRange[] = []
  let searchFrom = 0

  while (searchFrom < value.text.length) {
    const matchStart = value.text.indexOf(needle, searchFrom)

    if (matchStart < 0) break

    const matchEnd = matchStart + needle.length
    const firstCharacter = value.characters[matchStart]
    const lastCharacter = value.characters[matchEnd - 1]

    if (firstCharacter && lastCharacter) {
      ranges.push({ start: firstCharacter.start, end: lastCharacter.end })
    }

    searchFrom = matchEnd
  }

  return ranges
}
