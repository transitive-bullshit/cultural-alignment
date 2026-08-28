import type { SearchDocument, StaticContentKind } from './catalog'

export type SearchResultGroup = {
  readonly kind: StaticContentKind
  readonly label: string
  readonly documents: readonly SearchDocument[]
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

function scoreDocument(
  document: SearchDocument,
  query: string,
  tokens: readonly string[]
) {
  const title = normalizeSearchText(document.title)
  const subtitle = normalizeSearchText(document.subtitle)
  const keywords = document.keywords.map(normalizeSearchText)
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

  return tokens.every((token) => combined.includes(token)) ? 120 : null
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

function normalizeSearchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}
