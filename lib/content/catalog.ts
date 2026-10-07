import { summarizeAnalogy } from './analogy-summary'
import type {
  ConceptRecord,
  ContentImage as ContentImageRecord,
  FranchiseRecord,
  RiskFamilyRecord,
  ScenarioRecord,
  ScenarioVideo,
  SourceRecord
} from './schema'
import {
  buildSearchDocuments,
  type SearchDocument,
  type SearchDocumentKind
} from './search-documents'
import { discoverScenarios } from './scenario-discovery'
import { validateContentSnapshot } from './validate'

type ScenarioListQuery = {
  readonly featuredOnly?: boolean
  readonly riskFamilySlug?: string
}

const FEATURED_SCENARIO_TAG = 'featured'

export type StaticContentKind = SearchDocumentKind

export type { SearchDocument } from './search-documents'

export type ResourceKind = Exclude<StaticContentKind, 'scenario'>

export type ContentImage = Readonly<ContentImageRecord>

export type SourceIdentity = {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly sourceType: SourceRecord['sourceType']
}

export type TaxonomyLink = {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly href: string
}

export type DescribedTaxonomyLink = TaxonomyLink & {
  readonly description: string
}

export type GalleryScenario = {
  readonly id: string
  readonly slug: string
  readonly href: string
  readonly title: string
  readonly featured: boolean
  readonly source: SourceIdentity
  readonly episode: ScenarioRecord['episode']
  readonly releaseDate: string | null
  readonly riskFamilies: readonly TaxonomyLink[]
  readonly image: ContentImage
}

type RelatedScenario = GalleryScenario & {
  readonly sharedRiskFamilies: readonly TaxonomyLink[]
  readonly sharedConcepts: readonly TaxonomyLink[]
}

type ScenarioContinuation = {
  readonly kind: 'franchise' | 'source'
  readonly id: string
  readonly slug: string
  readonly href: string
  readonly title: string
  readonly scenarioCount: number
}

export type ScenarioPage = {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly source: SourceIdentity & {
    readonly href: string
    readonly description: string | null
    readonly links: readonly {
      readonly label: string
      readonly href: string
    }[]
    readonly scenarioCount: number
  }
  readonly episode: ScenarioRecord['episode']
  readonly releaseDate: string | null
  readonly image: ContentImage
  readonly memes: readonly ContentImage[]
  readonly video: Readonly<ScenarioVideo> | null
  readonly scene: string
  readonly whyAnalogyWorks: string
  readonly caveats: string
  readonly franchises: readonly TaxonomyLink[]
  readonly riskFamilies: readonly DescribedTaxonomyLink[]
  readonly concepts: readonly DescribedTaxonomyLink[]
  readonly continuation: ScenarioContinuation
  readonly moreFromCollection: readonly GalleryScenario[]
  readonly relatedScenarios: readonly RelatedScenario[]
}

export type ResourceSummary = {
  readonly kind: ResourceKind
  readonly id: string
  readonly slug: string
  readonly href: string
  readonly title: string
  readonly detailTitle: string
  readonly description: string | null
  readonly scenarioCount: number
}

/** The gallery-size image an index card needs; detail pages keep the full image. */
type ResourceCardImage = Pick<
  ContentImage,
  'gallerySrc' | 'width' | 'height' | 'alt' | 'blurDataURL' | 'focalPoint'
>

export type SourceResourceSummary = ResourceSummary & {
  readonly kind: 'source'
  readonly sourceType: SourceRecord['sourceType']
  readonly releaseDate: string | null
  readonly poster: ResourceCardImage | null
}

export type FranchiseResourceSummary = ResourceSummary & {
  readonly kind: 'franchise'
  readonly image: ResourceCardImage
  readonly sourceCount: number
}

type ExternalLink = {
  readonly label: string
  readonly href: string
  readonly description?: string
}

/** A scenario card on a resource page; concept pages add its analogy line. */
export type ResourceScenario = GalleryScenario & {
  readonly analogy?: string
}

/** A resource linked to a page, with how many of that page's scenes it shares. */
export type RelatedResource = ResourceSummary & {
  readonly sharedScenarioCount: number
}

/** How a source reaches viewers; anime is told apart by source keywords. */
export type MediaFormat = 'tv' | 'movie' | 'anime'

type ResourcePageBase = ResourceSummary & {
  readonly externalLinks: readonly {
    readonly label: string
    readonly href: string
    readonly description?: string
  }[]
  /** The formats of the page's scenes, in display order: TV, movies, anime. */
  readonly mediaFormats: readonly MediaFormat[]
  /** The primary (first-listed) concepts of the page's scenes, most common first. */
  readonly primaryConcepts: readonly TaxonomyLink[]
  /** Grouped by kind, most shared scenes first. */
  readonly relatedResources: readonly RelatedResource[]
  readonly scenarios: readonly ResourceScenario[]
}

type SourceResourcePage = ResourcePageBase & {
  readonly kind: 'source'
  readonly sourceType: SourceRecord['sourceType']
  readonly releaseDate: string | null
  readonly poster: ContentImage | null
}

type FranchiseResourcePage = ResourcePageBase & {
  readonly kind: 'franchise'
  readonly description: string
  readonly image: ContentImage
  readonly sources: readonly SourceResourceSummary[]
}

type TaxonomyResourcePage = ResourcePageBase & {
  readonly kind: 'risk-family' | 'concept'
}

export type ResourcePage =
  | SourceResourcePage
  | FranchiseResourcePage
  | TaxonomyResourcePage

export type ContentCatalog = {
  listScenarioCards(query?: ScenarioListQuery): readonly GalleryScenario[]
  getScenarioPage(slug: string): ScenarioPage | null
  listSourceResources(): readonly SourceResourceSummary[]
  listFranchiseResources(): readonly FranchiseResourceSummary[]
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
  const franchiseById = new Map(
    snapshot.franchises.map((franchise) => [franchise.id, franchise])
  )
  const riskFamilyById = new Map(
    snapshot.riskFamilies.map((family) => [family.id, family])
  )
  const conceptById = new Map(
    snapshot.concepts.map((concept) => [concept.id, concept])
  )
  const scenariosBySourceId = groupBy(
    snapshot.scenarios,
    (scenario) => scenario.sourceId
  )
  const sourcesByFranchiseId = groupRelations(
    snapshot.sources,
    (source) => source.franchiseIds
  )
  const scenariosByFranchiseId = new Map(
    snapshot.franchises.map((franchise) => {
      const sourceIds = new Set(
        (sourcesByFranchiseId.get(franchise.id) ?? []).map(
          (source) => source.id
        )
      )

      return [
        franchise.id,
        snapshot.scenarios.filter((scenario) =>
          sourceIds.has(scenario.sourceId)
        )
      ] as const
    })
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
      featured: scenario.tags.includes(FEATURED_SCENARIO_TAG),
      source: toSourceIdentity(source),
      episode: scenario.episode,
      releaseDate: scenario.releaseDate,
      riskFamilies: scenario.riskFamilyIds.map((id) => {
        const family = getRequired(riskFamilyById, id)

        return {
          id: family.id,
          slug: family.slug,
          title: family.shortName,
          href: `/risk-families/${family.slug}`
        }
      }),
      image: scenario.image
    } satisfies GalleryScenario
  })
  const scenarioCardById = new Map(
    scenarioCards.map((scenario) => [scenario.id, scenario])
  )

  const scenarioPageBySlug = new Map(
    snapshot.scenarios.map((scenario) => {
      const source = getRequired(sourceById, scenario.sourceId)
      const franchises = source.franchiseIds.map((id) => {
        const franchise = getRequired(franchiseById, id)

        return {
          id: franchise.id,
          slug: franchise.slug,
          title: franchise.title,
          href: `/franchises/${franchise.slug}`
        }
      })
      const primaryFranchise = franchises[0]
      const continuationSources = primaryFranchise
        ? (sourcesByFranchiseId.get(primaryFranchise.id) ?? []).map(
            (relatedSource) => relatedSource.id
          )
        : [source.id]
      const discovery = discoverScenarios(
        scenario,
        snapshot.scenarios,
        continuationSources
      )
      const continuation = primaryFranchise
        ? {
            kind: 'franchise' as const,
            ...primaryFranchise,
            scenarioCount:
              scenariosByFranchiseId.get(primaryFranchise.id)?.length ?? 0
          }
        : {
            kind: 'source' as const,
            id: source.id,
            slug: source.slug,
            href: `/sources/${source.slug}`,
            title: source.title,
            scenarioCount: scenariosBySourceId.get(source.id)?.length ?? 0
          }

      const page = {
        id: scenario.id,
        slug: scenario.slug,
        title: scenario.title,
        source: {
          ...toSourceIdentity(source),
          href: `/sources/${source.slug}`,
          description: source.description,
          links: sourceExternalLinks(source),
          scenarioCount: scenariosBySourceId.get(source.id)?.length ?? 0
        },
        episode: scenario.episode,
        releaseDate: scenario.releaseDate,
        image: scenario.image,
        memes: scenario.memes,
        video: scenario.video,
        scene: scenario.scene,
        whyAnalogyWorks: scenario.whyAnalogyWorks,
        caveats: scenario.caveats,
        franchises,
        riskFamilies: scenario.riskFamilyIds.map((id) => {
          const family = getRequired(riskFamilyById, id)

          return {
            id: family.id,
            slug: family.slug,
            title: family.shortName,
            href: `/risk-families/${family.slug}`,
            description: family.description
          }
        }),
        concepts: scenario.conceptIds.map((id) => {
          const concept = getRequired(conceptById, id)

          return {
            id: concept.id,
            slug: concept.slug,
            title: concept.shortName,
            href: `/concepts/${concept.slug}`,
            description: concept.description
          }
        }),
        continuation,
        moreFromCollection: discovery.moreFromCollection.map((related) =>
          getRequired(scenarioCardById, related.id)
        ),
        relatedScenarios: discovery.relatedScenarios.map(
          ({ scenario: related, sharedConceptIds, sharedRiskFamilyIds }) => ({
            ...getRequired(scenarioCardById, related.id),
            sharedRiskFamilies: sharedRiskFamilyIds.map((id) => {
              const family = getRequired(riskFamilyById, id)

              return {
                id: family.id,
                slug: family.slug,
                title: family.shortName,
                href: `/risk-families/${family.slug}`
              }
            }),
            sharedConcepts: sharedConceptIds.map((id) => {
              const concept = getRequired(conceptById, id)

              return {
                id: concept.id,
                slug: concept.slug,
                title: concept.shortName,
                href: `/concepts/${concept.slug}`
              }
            })
          })
        )
      } satisfies ScenarioPage

      return [scenario.slug, page] as const
    })
  )

  const sourceSummaries = snapshot.sources.map((source) =>
    toSourceSummary(source, scenariosBySourceId.get(source.id)?.length ?? 0)
  )
  const franchiseSummaries = snapshot.franchises.map((franchise) =>
    toFranchiseSummary(
      franchise,
      scenariosByFranchiseId.get(franchise.id)?.length ?? 0,
      sourcesByFranchiseId.get(franchise.id)?.length ?? 0
    )
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
    franchise: sortResources(franchiseSummaries),
    'risk-family': sortResources(riskFamilySummaries),
    concept: sortResources(conceptSummaries)
  } satisfies Record<ResourceKind, readonly ResourceSummary[]>
  const resourceSummaryById = new Map(
    Object.values(resourceSummaries)
      .flat()
      .map((resource) => [resourceKey(resource.kind, resource.id), resource])
  )
  const sourceSummaryById = new Map(
    resourceSummaries.source.map((source) => [source.id, source])
  )
  const describeScenes = (scenarios: readonly ScenarioRecord[]) => ({
    mediaFormats: getMediaFormats(
      scenarios.map(({ sourceId }) => getRequired(sourceById, sourceId))
    ),
    primaryConcepts: rankPrimaryConceptIds(scenarios).map((id) => {
      const { href, slug, title } = getRequired(
        resourceSummaryById,
        resourceKey('concept', id)
      )
      return { id, href, slug, title }
    })
  })
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
            kind: 'source',
            sourceType: source.sourceType,
            releaseDate: source.releaseDate,
            poster: source.poster,
            externalLinks: sourceExternalLinks(source),
            ...describeScenes(scenarios),
            relatedResources: mergeRelatedResources(
              source.franchiseIds.map((id) => ({
                ...getRequired(
                  resourceSummaryById,
                  resourceKey('franchise', id)
                ),
                sharedScenarioCount: scenarios.length
              })),
              source.relatedSourceIds.map((id) => ({
                ...getRequired(resourceSummaryById, resourceKey('source', id)),
                sharedScenarioCount: 0
              })),
              collectRelatedResources(
                scenarios,
                resourceSummaryById,
                sourceById,
                ['risk-family', 'concept']
              )
            ),
            scenarios: scenarios.map((scenario) =>
              getRequired(scenarioCardById, scenario.id)
            )
          } satisfies SourceResourcePage
        ] as const
      })
    ),
    franchise: new Map(
      snapshot.franchises.map((franchise) => {
        const summary = getRequired(
          resourceSummaryById,
          resourceKey('franchise', franchise.id)
        )
        const sources = sourcesByFranchiseId.get(franchise.id) ?? []
        const scenarios = scenariosByFranchiseId.get(franchise.id) ?? []

        return [
          franchise.slug,
          {
            ...summary,
            kind: 'franchise',
            description: franchise.description,
            image: franchise.image,
            sources: sortResources(
              sources.map((source) => getRequired(sourceSummaryById, source.id))
            ),
            externalLinks: franchiseExternalLinks(franchise),
            ...describeScenes(scenarios),
            relatedResources: collectRelatedResources(
              scenarios,
              resourceSummaryById,
              sourceById,
              ['risk-family', 'concept']
            ),
            scenarios: scenarios.map((scenario) =>
              getRequired(scenarioCardById, scenario.id)
            )
          } satisfies FranchiseResourcePage
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
            kind: 'risk-family',
            externalLinks: taxonomyExternalLinks(
              family.wikipediaUrl,
              family.citations
            ),
            ...describeScenes(scenarios),
            relatedResources: collectRelatedResources(
              scenarios,
              resourceSummaryById,
              sourceById,
              ['concept']
            ),
            scenarios: scenarios.map((scenario) =>
              getRequired(scenarioCardById, scenario.id)
            )
          } satisfies TaxonomyResourcePage
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
            kind: 'concept',
            externalLinks: taxonomyExternalLinks(
              concept.wikipediaUrl,
              concept.citations
            ),
            ...describeScenes(scenarios),
            relatedResources: collectRelatedResources(
              scenarios,
              resourceSummaryById,
              sourceById,
              ['risk-family', 'concept'],
              resourceKey('concept', concept.id)
            ),
            scenarios: scenarios.map((scenario) => ({
              ...getRequired(scenarioCardById, scenario.id),
              analogy: summarizeAnalogy(scenario.whyAnalogyWorks)
            }))
          } satisfies TaxonomyResourcePage
        ] as const
      })
    )
  } satisfies Record<ResourceKind, ReadonlyMap<string, ResourcePage>>

  const searchDocuments = buildSearchDocuments(snapshot)

  const staticSlugs = {
    scenario: snapshot.scenarios.map((scenario) => scenario.slug),
    source: snapshot.sources.map((source) => source.slug),
    franchise: snapshot.franchises.map((franchise) => franchise.slug),
    'risk-family': snapshot.riskFamilies.map((family) => family.slug),
    concept: snapshot.concepts.map((concept) => concept.slug)
  } satisfies Record<StaticContentKind, readonly string[]>

  return {
    listScenarioCards(query = {}) {
      return scenarioCards.filter(
        ({ featured, riskFamilies }) =>
          (!query.featuredOnly || featured) &&
          (!query.riskFamilySlug ||
            riskFamilies.some(({ slug }) => slug === query.riskFamilySlug))
      )
    },

    getScenarioPage(slug) {
      return scenarioPageBySlug.get(slug) ?? null
    },

    listSourceResources() {
      return resourceSummaries.source
    },

    listFranchiseResources() {
      return resourceSummaries.franchise
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

function toSourceIdentity(source: SourceRecord): SourceIdentity {
  return {
    id: source.id,
    slug: source.slug,
    title: source.title,
    sourceType: source.sourceType
  }
}

function toSourceSummary(
  source: SourceRecord,
  scenarioCount: number
): SourceResourceSummary {
  return {
    kind: 'source',
    id: source.id,
    slug: source.slug,
    href: `/sources/${source.slug}`,
    title: source.title,
    detailTitle: source.title,
    description: source.description,
    sourceType: source.sourceType,
    releaseDate: source.releaseDate,
    poster: source.poster ? toCardImage(source.poster) : null,
    scenarioCount
  }
}

function toFranchiseSummary(
  franchise: FranchiseRecord,
  scenarioCount: number,
  sourceCount: number
): FranchiseResourceSummary {
  return {
    kind: 'franchise',
    id: franchise.id,
    slug: franchise.slug,
    href: `/franchises/${franchise.slug}`,
    title: franchise.title,
    detailTitle: franchise.title,
    description: franchise.description,
    image: toCardImage(franchise.image),
    sourceCount,
    scenarioCount
  }
}

function toCardImage(image: ContentImage): ResourceCardImage {
  const { alt, blurDataURL, focalPoint, gallerySrc, height, width } = image

  return focalPoint
    ? { gallerySrc, width, height, alt, blurDataURL, focalPoint }
    : { gallerySrc, width, height, alt, blurDataURL }
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
    title: family.shortName,
    detailTitle: family.fullName,
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
    title: concept.shortName,
    detailTitle: concept.longName,
    description: concept.description,
    scenarioCount
  }
}

const MEDIA_FORMAT_ORDER = ['tv', 'movie', 'anime'] as const
const ANIME_KEYWORD = /\banime\b/iu

function getMediaFormats(sources: readonly SourceRecord[]): MediaFormat[] {
  const formats = new Set<MediaFormat>(
    sources.map((source) =>
      source.keywords.some((keyword) => ANIME_KEYWORD.test(keyword))
        ? 'anime'
        : source.sourceType === 'movie'
          ? 'movie'
          : 'tv'
    )
  )

  return MEDIA_FORMAT_ORDER.filter((format) => formats.has(format))
}

/** Counts each scene's first concept; ties keep scene order. */
function rankPrimaryConceptIds(scenarios: readonly ScenarioRecord[]) {
  const counts = new Map<string, number>()

  for (const { conceptIds } of scenarios) {
    const [primary] = conceptIds
    if (primary) counts.set(primary, (counts.get(primary) ?? 0) + 1)
  }

  return [...counts.keys()].toSorted(
    (left, right) => (counts.get(right) ?? 0) - (counts.get(left) ?? 0)
  )
}

function collectRelatedResources(
  scenarios: readonly ScenarioRecord[],
  resources: ReadonlyMap<string, ResourceSummary>,
  sources: ReadonlyMap<string, SourceRecord>,
  kinds: readonly ResourceKind[],
  excludeKey?: string
): RelatedResource[] {
  const related = new Map<string, RelatedResource>()

  for (const scenario of scenarios) {
    const source = getRequired(sources, scenario.sourceId)
    const idsByKind = {
      source: [scenario.sourceId],
      franchise: source.franchiseIds,
      'risk-family': scenario.riskFamilyIds,
      concept: scenario.conceptIds
    } satisfies Record<ResourceKind, readonly string[]>

    for (const kind of kinds) {
      for (const id of new Set(idsByKind[kind])) {
        const key = resourceKey(kind, id)
        if (key === excludeKey) continue
        const resource = getRequired(resources, key)
        related.set(key, {
          ...resource,
          sharedScenarioCount: (related.get(key)?.sharedScenarioCount ?? 0) + 1
        })
      }
    }
  }

  return sortRelatedResources([...related.values()])
}

function mergeRelatedResources(
  ...groups: readonly (readonly RelatedResource[])[]
) {
  const resources = new Map<string, RelatedResource>()

  for (const resource of groups.flat()) {
    resources.set(resourceKey(resource.kind, resource.id), resource)
  }

  return sortRelatedResources([...resources.values()])
}

function sortRelatedResources(resources: readonly RelatedResource[]) {
  return resources.toSorted(
    (left, right) =>
      resourceKindOrder(left.kind) - resourceKindOrder(right.kind) ||
      right.sharedScenarioCount - left.sharedScenarioCount ||
      left.title.localeCompare(right.title, 'en', { sensitivity: 'base' })
  )
}

function sourceExternalLinks(source: SourceRecord): readonly ExternalLink[] {
  return [
    source.imdbUrl ? { label: 'IMDb', href: source.imdbUrl } : null,
    source.rottenTomatoesUrl
      ? { label: 'Rotten Tomatoes', href: source.rottenTomatoesUrl }
      : null,
    source.youtubeTrailerUrl
      ? { label: 'YouTube trailer', href: source.youtubeTrailerUrl }
      : null
  ].filter((link): link is ExternalLink => link !== null)
}

function franchiseExternalLinks(
  franchise: FranchiseRecord
): readonly ExternalLink[] {
  return franchise.imdbUrl ? [{ label: 'IMDb', href: franchise.imdbUrl }] : []
}

function taxonomyExternalLinks(
  wikipediaUrl: string | null,
  citations: RiskFamilyRecord['citations']
): readonly ExternalLink[] {
  return [
    wikipediaUrl ? { label: 'Wikipedia', href: wikipediaUrl } : null,
    ...citations.map((citation) => {
      const description = distinctCitationPublisher(
        citation.title,
        citation.publisher
      )
      return description
        ? {
            label: citation.title,
            href: citation.href,
            description
          }
        : { label: citation.title, href: citation.href }
    })
  ].filter((link): link is ExternalLink => link !== null)
}

function distinctCitationPublisher(title: string, publisher: string | null) {
  if (!publisher) return null
  const normalizedTitle = normalizeCitationLabel(title)
  const normalizedPublisher = normalizeCitationLabel(publisher)
  if (!normalizedTitle || !normalizedPublisher) return publisher

  return normalizedTitle.includes(normalizedPublisher) ||
    normalizedPublisher.includes(normalizedTitle)
    ? null
    : publisher
}

function normalizeCitationLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
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
    case 'franchise':
      return 2
    case 'source':
      return 3
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
