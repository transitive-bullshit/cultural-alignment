import type {
  ConceptRecord,
  RiskFamilyRecord,
  ScenarioImage,
  ScenarioRecord,
  ScenarioVideo,
  SourceRecord
} from './schema'
import {
  buildSearchDocuments,
  type SearchDocument,
  type SearchDocumentKind
} from './search-documents'
import { validateContentSnapshot } from './validate'

export type ScenarioListQuery = {
  readonly featuredOnly?: boolean
  readonly riskFamilySlug?: string
  readonly sort?: 'release-desc' | 'release-asc'
}

export type StaticContentKind = SearchDocumentKind

export type { SearchDocument } from './search-documents'

export type ResourceKind = Exclude<StaticContentKind, 'scenario'>

export type ContentImage = Readonly<ScenarioImage>

export type SourceIdentity = {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly kind: SourceRecord['kind']
}

export type TaxonomyLink = {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly href: string
}

export type GalleryScenario = {
  readonly id: string
  readonly slug: string
  readonly href: string
  readonly title: string
  readonly source: SourceIdentity
  readonly episode: ScenarioRecord['episode']
  readonly releaseDate: string | null
  readonly riskFamilies: readonly TaxonomyLink[]
  readonly image: ContentImage
}

export type ScenarioPage = {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly source: SourceIdentity & {
    readonly description?: string
    readonly links: readonly {
      readonly label: string
      readonly href: string
    }[]
  }
  readonly episode: ScenarioRecord['episode']
  readonly releaseDate: string | null
  readonly image: ContentImage
  readonly video: Readonly<ScenarioVideo> | null
  readonly scene: string
  readonly whyAnalogyWorks: string
  readonly caveats: string
  readonly riskFamilies: readonly TaxonomyLink[]
  readonly concepts: readonly TaxonomyLink[]
}

export type ResourceSummary = {
  readonly kind: ResourceKind
  readonly id: string
  readonly slug: string
  readonly href: string
  readonly title: string
  readonly description: string
  readonly scenarioCount: number
}

export type ResourcePage = ResourceSummary & {
  readonly artworkSrc: string | null
  readonly externalLinks: readonly {
    readonly label: string
    readonly href: string
  }[]
  readonly relatedResources: readonly ResourceSummary[]
  readonly scenarios: readonly GalleryScenario[]
}

export type ContentCatalog = {
  listScenarioCards(query?: ScenarioListQuery): readonly GalleryScenario[]
  getScenarioPage(slug: string): ScenarioPage | null
  listResources(kind: ResourceKind): readonly ResourceSummary[]
  getResourcePage(kind: ResourceKind, slug: string): ResourcePage | null
  getSearchDocuments(): readonly SearchDocument[]
  getStaticSlugs(kind: StaticContentKind): readonly string[]
}

export function createContentCatalog(input: unknown): ContentCatalog {
  const snapshot = validateContentSnapshot(input)
  const sourceById = new Map(
    snapshot.sources.map((source) => [source.id, source])
  )
  const riskFamilyById = new Map(
    snapshot.riskFamilies.map((family) => [family.id, family])
  )
  const conceptById = new Map(
    snapshot.concepts.map((concept) => [concept.id, concept])
  )
  const riskFamilyIdBySlug = new Map(
    snapshot.riskFamilies.map((family) => [family.slug, family.id])
  )
  const scenariosBySourceId = groupBy(
    snapshot.scenarios,
    (scenario) => scenario.sourceId
  )
  const scenariosByRiskFamilyId = groupRelations(
    snapshot.scenarios,
    (scenario) => scenario.riskFamilyIds
  )
  const scenariosByConceptId = groupRelations(
    snapshot.scenarios,
    (scenario) => scenario.conceptIds
  )

  const scenarioCards = snapshot.scenarios.map((scenario) => {
    const source = getRequired(sourceById, scenario.sourceId)

    return {
      id: scenario.id,
      slug: scenario.slug,
      href: `/scenarios/${scenario.slug}`,
      title: scenario.title,
      source: toSourceIdentity(source),
      episode: scenario.episode,
      releaseDate: scenario.releaseDate,
      riskFamilies: scenario.riskFamilyIds.map((id) => {
        const family = getRequired(riskFamilyById, id)

        return {
          id: family.id,
          slug: family.slug,
          title: family.title,
          href: `/risk-families/${family.slug}`
        }
      }),
      image: scenario.image
    } satisfies GalleryScenario
  })

  const scenarioPageBySlug = new Map(
    snapshot.scenarios.map((scenario) => {
      const source = getRequired(sourceById, scenario.sourceId)

      const page = {
        id: scenario.id,
        slug: scenario.slug,
        title: scenario.title,
        source: {
          ...toSourceIdentity(source),
          description: source.description,
          links: source.links ?? []
        },
        episode: scenario.episode,
        releaseDate: scenario.releaseDate,
        image: scenario.image,
        video: scenario.video,
        scene: scenario.scene,
        whyAnalogyWorks: scenario.whyAnalogyWorks,
        caveats: scenario.caveats,
        riskFamilies: scenario.riskFamilyIds.map((id) => {
          const family = getRequired(riskFamilyById, id)

          return {
            id: family.id,
            slug: family.slug,
            title: family.title,
            href: `/risk-families/${family.slug}`
          }
        }),
        concepts: scenario.conceptIds.map((id) => {
          const concept = getRequired(conceptById, id)

          return {
            id: concept.id,
            slug: concept.slug,
            title: concept.title,
            href: `/concepts/${concept.slug}`
          }
        })
      } satisfies ScenarioPage

      return [scenario.slug, page] as const
    })
  )

  const sourceSummaries = snapshot.sources.map((source) =>
    toSourceSummary(source, scenariosBySourceId.get(source.id)?.length ?? 0)
  )
  const riskFamilySummaries = snapshot.riskFamilies.map((family) =>
    toRiskFamilySummary(
      family,
      scenariosByRiskFamilyId.get(family.id)?.length ?? 0
    )
  )
  const conceptSummaries = snapshot.concepts.map((concept) =>
    toConceptSummary(concept, scenariosByConceptId.get(concept.id)?.length ?? 0)
  )
  const resourceSummaries = {
    source: sortResources(sourceSummaries),
    'risk-family': sortResources(riskFamilySummaries),
    concept: sortResources(conceptSummaries)
  } satisfies Record<ResourceKind, readonly ResourceSummary[]>
  const resourceSummaryById = new Map(
    Object.values(resourceSummaries)
      .flat()
      .map((resource) => [resourceKey(resource.kind, resource.id), resource])
  )
  const scenarioCardById = new Map(
    scenarioCards.map((scenario) => [scenario.id, scenario])
  )
  const resourcePageByKind = {
    source: new Map(
      snapshot.sources.map((source) => {
        const summary = getRequired(
          resourceSummaryById,
          resourceKey('source', source.id)
        )
        const scenarios = scenariosBySourceId.get(source.id) ?? []

        return [
          source.slug,
          {
            ...summary,
            artworkSrc: null,
            externalLinks: source.links ?? [],
            relatedResources: collectRelatedResources(
              scenarios,
              resourceSummaryById,
              ['risk-family', 'concept']
            ),
            scenarios: scenarios.map((scenario) =>
              getRequired(scenarioCardById, scenario.id)
            )
          } satisfies ResourcePage
        ] as const
      })
    ),
    'risk-family': new Map(
      snapshot.riskFamilies.map((family) => {
        const summary = getRequired(
          resourceSummaryById,
          resourceKey('risk-family', family.id)
        )
        const scenarios = scenariosByRiskFamilyId.get(family.id) ?? []

        return [
          family.slug,
          {
            ...summary,
            artworkSrc: family.artworkSrc ?? null,
            externalLinks: family.canonicalUrl
              ? [{ label: 'Reference', href: family.canonicalUrl }]
              : [],
            relatedResources: collectRelatedResources(
              scenarios,
              resourceSummaryById,
              ['concept', 'source']
            ),
            scenarios: scenarios.map((scenario) =>
              getRequired(scenarioCardById, scenario.id)
            )
          } satisfies ResourcePage
        ] as const
      })
    ),
    concept: new Map(
      snapshot.concepts.map((concept) => {
        const summary = getRequired(
          resourceSummaryById,
          resourceKey('concept', concept.id)
        )
        const scenarios = scenariosByConceptId.get(concept.id) ?? []

        return [
          concept.slug,
          {
            ...summary,
            artworkSrc: concept.artworkSrc ?? null,
            externalLinks: (concept.canonicalUrls ?? []).map((href, index) => ({
              label: `Reference ${String(index + 1).padStart(2, '0')}`,
              href
            })),
            relatedResources: collectRelatedResources(
              scenarios,
              resourceSummaryById,
              ['risk-family', 'source']
            ),
            scenarios: scenarios.map((scenario) =>
              getRequired(scenarioCardById, scenario.id)
            )
          } satisfies ResourcePage
        ] as const
      })
    )
  } satisfies Record<ResourceKind, ReadonlyMap<string, ResourcePage>>

  const searchDocuments = buildSearchDocuments(snapshot)

  const staticSlugs = {
    scenario: snapshot.scenarios.map((scenario) => scenario.slug),
    source: snapshot.sources.map((source) => source.slug),
    'risk-family': snapshot.riskFamilies.map((family) => family.slug),
    concept: snapshot.concepts.map((concept) => concept.slug)
  } satisfies Record<StaticContentKind, readonly string[]>

  return {
    listScenarioCards(query = {}) {
      const riskFamilyId = query.riskFamilySlug
        ? riskFamilyIdBySlug.get(query.riskFamilySlug)
        : undefined

      if (query.riskFamilySlug && riskFamilyId === undefined) return []

      const matchingScenarios = snapshot.scenarios
        .map((scenario, index) => ({
          card: scenarioCards[index]!,
          scenario,
          index
        }))
        .filter(({ scenario }) => !query.featuredOnly || scenario.featured)
        .filter(
          ({ scenario }) =>
            riskFamilyId === undefined ||
            scenario.riskFamilyIds.includes(riskFamilyId)
        )

      if (!query.sort) return matchingScenarios.map(({ card }) => card)

      return matchingScenarios
        .toSorted((left, right) =>
          compareReleaseDates(left, right, query.sort ?? 'release-desc')
        )
        .map(({ card }) => card)
    },

    getScenarioPage(slug) {
      return scenarioPageBySlug.get(slug) ?? null
    },

    listResources(kind) {
      return resourceSummaries[kind]
    },

    getResourcePage(kind, slug) {
      return resourcePageByKind[kind].get(slug) ?? null
    },

    getSearchDocuments() {
      return searchDocuments
    },

    getStaticSlugs(kind) {
      return staticSlugs[kind]
    }
  }
}

type SortableScenario = {
  readonly scenario: Pick<ScenarioRecord, 'releaseDate'>
  readonly index: number
}

function compareReleaseDates(
  left: SortableScenario,
  right: SortableScenario,
  sort: NonNullable<ScenarioListQuery['sort']>
) {
  const leftDate = left.scenario.releaseDate
  const rightDate = right.scenario.releaseDate

  if (leftDate === rightDate) return left.index - right.index
  if (leftDate === null) return 1
  if (rightDate === null) return -1

  const dateOrder = leftDate < rightDate ? -1 : 1

  return sort === 'release-asc' ? dateOrder : -dateOrder
}

function toSourceIdentity(source: SourceRecord): SourceIdentity {
  return {
    id: source.id,
    slug: source.slug,
    title: source.title,
    kind: source.kind
  }
}

function toSourceSummary(
  source: SourceRecord,
  scenarioCount: number
): ResourceSummary {
  return {
    kind: 'source',
    id: source.id,
    slug: source.slug,
    href: `/sources/${source.slug}`,
    title: source.title,
    description:
      source.description ??
      `${formatScenarioCount(scenarioCount)} drawn from ${source.title}.`,
    scenarioCount
  }
}

function toRiskFamilySummary(
  family: RiskFamilyRecord,
  scenarioCount: number
): ResourceSummary {
  return {
    kind: 'risk-family',
    id: family.id,
    slug: family.slug,
    href: `/risk-families/${family.slug}`,
    title: family.title,
    description: family.description,
    scenarioCount
  }
}

function toConceptSummary(
  concept: ConceptRecord,
  scenarioCount: number
): ResourceSummary {
  return {
    kind: 'concept',
    id: concept.id,
    slug: concept.slug,
    href: `/concepts/${concept.slug}`,
    title: concept.title,
    description: concept.description,
    scenarioCount
  }
}

function formatScenarioCount(count: number) {
  return `${count} ${count === 1 ? 'scenario' : 'scenarios'}`
}

function collectRelatedResources(
  scenarios: readonly ScenarioRecord[],
  resources: ReadonlyMap<string, ResourceSummary>,
  kinds: readonly ResourceKind[]
) {
  const related = new Map<string, ResourceSummary>()

  for (const scenario of scenarios) {
    const idsByKind = {
      source: [scenario.sourceId],
      'risk-family': scenario.riskFamilyIds,
      concept: scenario.conceptIds
    } satisfies Record<ResourceKind, readonly string[]>

    for (const kind of kinds) {
      for (const id of idsByKind[kind]) {
        const resource = getRequired(resources, resourceKey(kind, id))
        related.set(`${resource.kind}:${resource.id}`, resource)
      }
    }
  }

  return sortResources([...related.values()])
}

function resourceKey(kind: ResourceKind, id: string) {
  return `${kind}:${id}`
}

function sortResources<T extends ResourceSummary>(resources: readonly T[]) {
  return resources.toSorted(
    (left, right) =>
      resourceKindOrder(left.kind) - resourceKindOrder(right.kind) ||
      left.title.localeCompare(right.title, 'en', { sensitivity: 'base' })
  )
}

function resourceKindOrder(kind: ResourceKind) {
  switch (kind) {
    case 'risk-family':
      return 0
    case 'concept':
      return 1
    case 'source':
      return 2
  }
}

function groupBy<Item, Key>(
  items: readonly Item[],
  getKey: (item: Item) => Key
) {
  const groups = new Map<Key, Item[]>()

  for (const item of items) {
    const key = getKey(item)
    const group = groups.get(key)

    if (group) group.push(item)
    else groups.set(key, [item])
  }

  return groups
}

function groupRelations<Item, Key>(
  items: readonly Item[],
  getKeys: (item: Item) => readonly Key[]
) {
  const groups = new Map<Key, Item[]>()

  for (const item of items) {
    for (const key of getKeys(item)) {
      const group = groups.get(key)

      if (group) group.push(item)
      else groups.set(key, [item])
    }
  }

  return groups
}

function getRequired<Key, Value>(values: ReadonlyMap<Key, Value>, key: Key) {
  const value = values.get(key)

  if (value === undefined) {
    throw new Error(
      `Validated content relation disappeared for key ${String(key)}`
    )
  }

  return value
}
