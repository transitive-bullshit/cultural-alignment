import type { ContentSnapshot } from './schema'

export type SearchDocumentKind =
  | 'scenario'
  | 'source'
  | 'franchise'
  | 'risk-family'
  | 'concept'

export type SearchDocument = {
  readonly kind: SearchDocumentKind
  readonly title: string
  readonly subtitle: string
  readonly keywords: readonly string[]
  readonly supplementalKeywords?: readonly string[]
  readonly href: string
}

export function buildSearchDocuments(
  snapshot: ContentSnapshot
): readonly SearchDocument[] {
  const sourceById = new Map(
    snapshot.sources.map((source) => [source.id, source])
  )
  const franchiseById = new Map(
    snapshot.franchises.map((franchise) => [franchise.id, franchise])
  )
  const riskFamilyById = new Map(
    snapshot.riskFamilies.map((family) => [family.id, family])
  )
  const conceptById = new Map(
    snapshot.concepts.map((concept) => [concept.id, concept])
  )
  const documents: SearchDocument[] = [
    ...snapshot.scenarios.map((scenario) => {
      const source = getRequired(sourceById, scenario.sourceId)
      const franchises = source.franchiseIds.map((id) =>
        getRequired(franchiseById, id)
      )

      return {
        kind: 'scenario' as const,
        title: scenario.title,
        subtitle: source.title,
        keywords: uniqueStrings([
          source.title,
          ...franchises.map((franchise) => franchise.title),
          scenario.episode?.label,
          ...scenario.riskFamilyIds.map(
            (id) => getRequired(riskFamilyById, id).shortName
          ),
          ...scenario.riskFamilyIds.map(
            (id) => getRequired(riskFamilyById, id).fullName
          ),
          ...scenario.conceptIds.map(
            (id) => getRequired(conceptById, id).shortName
          ),
          ...scenario.conceptIds.map(
            (id) => getRequired(conceptById, id).longName
          ),
          scenario.scene,
          scenario.whyAnalogyWorks,
          scenario.caveats
        ]),
        ...optionalSupplementalKeywords([
          ...scenario.keywords,
          ...source.keywords,
          ...franchises.flatMap((franchise) => franchise.keywords)
        ]),
        href: `/scenarios/${scenario.slug}`
      }
    }),
    ...snapshot.sources.map((source) => {
      const franchises = source.franchiseIds.map((id) =>
        getRequired(franchiseById, id)
      )

      return {
        kind: 'source' as const,
        title: source.title,
        subtitle: source.sourceType === 'movie' ? 'Movie' : 'TV show',
        keywords: uniqueStrings([
          source.description,
          ...franchises.map((franchise) => franchise.title),
          source.imdbUrl ? 'IMDb' : null,
          source.rottenTomatoesUrl ? 'Rotten Tomatoes' : null,
          source.youtubeTrailerUrl ? 'YouTube trailer' : null
        ]),
        ...optionalSupplementalKeywords([
          ...source.keywords,
          ...franchises.flatMap((franchise) => franchise.keywords)
        ]),
        href: `/sources/${source.slug}`
      }
    }),
    ...snapshot.franchises.map((franchise) => ({
      kind: 'franchise' as const,
      title: franchise.title,
      subtitle: 'Media franchise',
      keywords: uniqueStrings([
        franchise.description,
        franchise.imdbUrl ? 'IMDb' : null,
        ...snapshot.sources
          .filter((source) => source.franchiseIds.includes(franchise.id))
          .map((source) => source.title)
      ]),
      ...optionalSupplementalKeywords(franchise.keywords),
      href: `/franchises/${franchise.slug}`
    })),
    ...snapshot.riskFamilies.map((family) => ({
      kind: 'risk-family' as const,
      title: family.shortName,
      subtitle: 'AI risk family',
      keywords: uniqueStrings([family.fullName, family.description]),
      href: `/risk-families/${family.slug}`
    })),
    ...snapshot.concepts.map((concept) => ({
      kind: 'concept' as const,
      title: concept.shortName,
      subtitle: 'AI safety concept',
      keywords: uniqueStrings([concept.longName, concept.description]),
      ...optionalSupplementalKeywords(concept.keywords),
      href: `/concepts/${concept.slug}`
    }))
  ]

  return documents.toSorted(
    (left, right) =>
      left.kind.localeCompare(right.kind) ||
      left.title.localeCompare(right.title, 'en', { sensitivity: 'base' })
  )
}

function uniqueStrings(values: readonly (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function optionalSupplementalKeywords(
  values: readonly (string | null | undefined)[]
) {
  const supplementalKeywords = uniqueStrings(values)

  return supplementalKeywords.length > 0 ? { supplementalKeywords } : {}
}

function getRequired<Key, Value>(values: ReadonlyMap<Key, Value>, key: Key) {
  const value = values.get(key)

  if (value === undefined) {
    throw new Error(`Search relation is missing for key ${String(key)}`)
  }

  return value
}
