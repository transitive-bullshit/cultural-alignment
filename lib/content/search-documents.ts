import type { ContentSnapshot } from './schema'

export type SearchDocumentKind =
  | 'scenario'
  | 'source'
  | 'risk-family'
  | 'concept'

export type SearchDocument = {
  readonly kind: SearchDocumentKind
  readonly title: string
  readonly subtitle: string
  readonly keywords: readonly string[]
  readonly href: string
}

export function buildSearchDocuments(
  snapshot: ContentSnapshot
): readonly SearchDocument[] {
  const sourceById = new Map(
    snapshot.sources.map((source) => [source.id, source])
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

      return {
        kind: 'scenario' as const,
        title: scenario.title,
        subtitle: source.title,
        keywords: uniqueStrings([
          source.title,
          scenario.episode?.label,
          ...scenario.riskFamilyIds.map(
            (id) => getRequired(riskFamilyById, id).title
          ),
          ...scenario.conceptIds.map(
            (id) => getRequired(conceptById, id).title
          ),
          scenario.scene,
          scenario.whyAnalogyWorks,
          scenario.caveats
        ]),
        href: `/scenarios/${scenario.slug}`
      }
    }),
    ...snapshot.sources.map((source) => ({
      kind: 'source' as const,
      title: source.title,
      subtitle: 'Source',
      keywords: uniqueStrings([
        source.description,
        ...(source.links ?? []).map((link) => link.label)
      ]),
      href: `/sources/${source.slug}`
    })),
    ...snapshot.riskFamilies.map((family) => ({
      kind: 'risk-family' as const,
      title: family.title,
      subtitle: 'AI risk family',
      keywords: [family.description],
      href: `/risk-families/${family.slug}`
    })),
    ...snapshot.concepts.map((concept) => ({
      kind: 'concept' as const,
      title: concept.title,
      subtitle: 'AI safety concept',
      keywords: [concept.description],
      href: `/concepts/${concept.slug}`
    }))
  ]

  return documents.toSorted(
    (left, right) =>
      left.kind.localeCompare(right.kind) ||
      left.title.localeCompare(right.title, 'en', { sensitivity: 'base' })
  )
}

function uniqueStrings(values: readonly (string | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function getRequired<Key, Value>(values: ReadonlyMap<Key, Value>, key: Key) {
  const value = values.get(key)

  if (value === undefined) {
    throw new Error(`Search relation is missing for key ${String(key)}`)
  }

  return value
}
