import { describe, expect, it } from 'vitest'

import { createContentCatalog, type ResourceKind } from './catalog'
import type { ContentSnapshot, ScenarioRecord } from './schema'

const minimalSnapshot = {
  schemaVersion: 3,
  scenarios: [
    createScenario({
      id: 'old-a',
      releaseDate: '2020-01-01',
      featured: true,
      riskFamilyIds: ['risk-a'],
      memes: [createMeme('first'), createMeme('second')]
    }),
    createScenario({
      id: 'null-a',
      releaseDate: null,
      featured: true,
      riskFamilyIds: ['risk-a']
    }),
    createScenario({
      id: 'new',
      releaseDate: '2022-01-01',
      riskFamilyIds: ['risk-b'],
      sourceId: 'source-2'
    }),
    createScenario({
      id: 'old-b',
      releaseDate: '2020-01-01',
      featured: true,
      riskFamilyIds: ['risk-a', 'risk-b']
    }),
    createScenario({
      id: 'null-b',
      releaseDate: null,
      riskFamilyIds: ['risk-b']
    })
  ],
  sources: [
    {
      id: 'source-1',
      slug: 'shared-source',
      title: 'Shared Source',
      keywords: ['source-only', 'shared keyword'],
      sourceType: 'movie',
      description: 'The source description.',
      releaseDate: '1999-03-31',
      poster: {
        gallerySrc:
          'https://assets.example.com/media/generated/sources/source1/gallery.webp',
        detailSrc:
          'https://assets.example.com/media/generated/sources/source1/detail.webp',
        width: 1200,
        height: 1800,
        blurDataURL:
          'data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAABwAQCdASoIAAUAA8BgJYwCdAF1AAD+73a5N2G+4IAAAA==',
        alt: 'Poster for Shared Source'
      },
      imdbUrl: 'https://www.imdb.com/title/tt0000001/',
      rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/shared_source',
      youtubeTrailerUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
      franchiseIds: ['franchise-b', 'franchise-a'],
      relatedSourceIds: ['source-2']
    },
    {
      id: 'source-2',
      slug: 'related-source',
      title: 'Related Source',
      keywords: [],
      sourceType: 'tv-show',
      description: null,
      releaseDate: null,
      poster: null,
      imdbUrl: null,
      rottenTomatoesUrl: null,
      youtubeTrailerUrl: null,
      franchiseIds: ['franchise-b'],
      relatedSourceIds: []
    }
  ],
  franchises: [
    createFranchise('franchise-a', 'Franchise A'),
    createFranchise('franchise-b', 'Franchise B')
  ],
  riskFamilies: [
    {
      id: 'risk-a',
      slug: 'family-a',
      shortName: 'Family A',
      fullName: 'The First Risk Family',
      description: 'The first family.',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Risk',
      citations: [
        {
          href: 'https://example.com/risk-a',
          title: 'A named risk publication',
          publisher: 'Example Research'
        },
        {
          href: 'https://example.com/example-research',
          title: 'Example Research',
          publisher: 'Example Research'
        }
      ]
    },
    {
      id: 'risk-b',
      slug: 'family-b',
      shortName: 'Family B',
      fullName: 'The Second Risk Family',
      description: 'The second family.',
      wikipediaUrl: null,
      citations: [
        {
          href: 'https://example.com/risk-b',
          title: 'Another risk publication',
          publisher: null
        }
      ]
    }
  ],
  concepts: [
    {
      id: 'concept-1',
      slug: 'concept-one',
      shortName: 'Concept One',
      longName: 'Concept One With a Descriptive Name',
      keywords: ['concept-only'],
      description: 'A concept description.',
      wikipediaUrl: null,
      citations: [
        {
          href: 'https://example.com/concept-one',
          title: 'A named concept publication',
          publisher: 'Example Institute'
        }
      ]
    }
  ]
} satisfies ContentSnapshot

describe('ContentCatalog', () => {
  const catalog = createContentCatalog(minimalSnapshot)

  it('projects scenario memes in their authored order', () => {
    const page = catalog.getScenarioPage('old-a')!

    expect(page.memes.map(({ detailSrc }) => detailSrc)).toEqual([
      'https://assets.example.com/media/generated/scenarios/old-a/first-detail.webp',
      'https://assets.example.com/media/generated/scenarios/old-a/second-detail.webp'
    ])
  })

  it('composes filters and keeps undated records last in stable order', () => {
    expect(
      slugs(
        catalog.listScenarioCards({
          riskFamilySlug: 'family-b'
        })
      )
    ).toEqual(['new', 'old-b', 'null-b'])
    expect(slugs(catalog.listScenarioCards({ sort: 'release-asc' }))).toEqual([
      'old-a',
      'old-b',
      'new',
      'null-a',
      'null-b'
    ])
    expect(slugs(catalog.listScenarioCards({ sort: 'release-desc' }))).toEqual([
      'new',
      'old-a',
      'old-b',
      'null-a',
      'null-b'
    ])
  })

  it('filters featured scenarios by their Notion tag, not the legacy flag', () => {
    const snapshot = structuredClone(minimalSnapshot)
    const taggedScenario = snapshot.scenarios.find(({ id }) => id === 'new')!

    taggedScenario.tags = ['featured']
    const featuredCatalog = createContentCatalog(snapshot)

    expect(
      slugs(featuredCatalog.listScenarioCards({ featuredOnly: true }))
    ).toEqual(['new'])
    expect(
      featuredCatalog
        .getResourcePage('risk-family', 'family-b')!
        .scenarios.map(({ featured, slug }) => ({ featured, slug }))
    ).toEqual([
      { featured: true, slug: 'new' },
      { featured: false, slug: 'old-b' },
      { featured: false, slug: 'null-b' }
    ])
    expect(
      slugs(
        featuredCatalog.listScenarioCards({
          featuredOnly: true,
          riskFamilySlug: 'family-a'
        })
      )
    ).toEqual([])
  })

  it('falls back to the current source when no franchise is assigned', () => {
    const snapshot = structuredClone(minimalSnapshot)
    snapshot.sources.find(({ id }) => id === 'source-1')!.franchiseIds = []
    const fallbackCatalog = createContentCatalog(snapshot)
    const page = fallbackCatalog.getScenarioPage('old-b')!

    expect(page.franchises).toEqual([])
    expect(page.continuation).toMatchObject({
      kind: 'source',
      id: page.source.id,
      href: page.source.href
    })
    expect(
      page.moreFromCollection.every(
        ({ source }) => source.id === page.source.id
      )
    ).toBe(true)
  })

  it('joins scenario and resource relations without broken pivots', () => {
    const page = catalog.getScenarioPage('old-b')!

    expect(page.source.slug).toBe('shared-source')
    expect(page.source.sourceType).toBe('movie')
    expect(page.source.scenarioCount).toBe(
      minimalSnapshot.scenarios.filter(
        ({ sourceId }) => sourceId === page.source.id
      ).length
    )
    expect(page.franchises.map(({ slug }) => slug)).toEqual([
      'franchise-b',
      'franchise-a'
    ])
    expect(page.continuation).toMatchObject({
      kind: 'franchise',
      slug: 'franchise-b'
    })
    expect(new Set(page.riskFamilies.map(({ slug }) => slug))).toEqual(
      new Set(['family-a', 'family-b'])
    )
    expect(page.concepts.map(({ slug }) => slug)).toEqual(['concept-one'])
    const descriptionsByTaxonomyId = new Map(
      [...minimalSnapshot.riskFamilies, ...minimalSnapshot.concepts].map(
        ({ description, id }) => [id, description]
      )
    )
    expect(
      [...page.riskFamilies, ...page.concepts].every(
        ({ description, id }) =>
          description === descriptionsByTaxonomyId.get(id)
      )
    ).toBe(true)
    expect(
      page.moreFromCollection.every((related) => related.id !== page.id)
    ).toBe(true)
    expect(
      page.moreFromCollection.some(({ source }) => source.id === 'source-2')
    ).toBe(true)

    const sourcePage = catalog.getResourcePage('source', 'shared-source')!
    expect(sourcePage.kind).toBe('source')
    if (sourcePage.kind !== 'source') throw new Error('Expected source page')
    expect(sourcePage.poster?.detailSrc).toBe(
      'https://assets.example.com/media/generated/sources/source1/detail.webp'
    )
    expect(sourcePage.sourceType).toBe('movie')
    expect(sourcePage.externalLinks.map(({ label }) => label)).toEqual([
      'IMDb',
      'Rotten Tomatoes',
      'YouTube trailer'
    ])
    expect(sourcePage.scenarios).toHaveLength(
      minimalSnapshot.scenarios.filter(
        ({ sourceId }) => sourceId === sourcePage.id
      ).length
    )
    expect(
      new Set(
        sourcePage.relatedResources.map(({ kind, slug }) => `${kind}:${slug}`)
      )
    ).toEqual(
      new Set([
        'risk-family:family-a',
        'risk-family:family-b',
        'concept:concept-one',
        'franchise:franchise-a',
        'franchise:franchise-b',
        'source:related-source'
      ])
    )

    expect(
      catalog.getResourcePage('risk-family', 'family-a')?.detailTitle
    ).toBe('The First Risk Family')
    const riskPage = catalog.getResourcePage('risk-family', 'family-a')!
    expect(riskPage.externalLinks).toEqual([
      {
        label: 'Wikipedia',
        href: 'https://en.wikipedia.org/wiki/Risk'
      },
      {
        label: 'A named risk publication',
        description: 'Example Research',
        href: 'https://example.com/risk-a'
      },
      {
        label: 'Example Research',
        href: 'https://example.com/example-research'
      }
    ])
    expect(
      riskPage.externalLinks.some(({ label }) =>
        /^canonical source/i.test(label)
      )
    ).toBe(false)
    expect(catalog.getResourcePage('concept', 'concept-one')?.detailTitle).toBe(
      'Concept One With a Descriptive Name'
    )
    const franchisePage = catalog.getResourcePage('franchise', 'franchise-b')!
    expect(franchisePage.kind).toBe('franchise')
    if (franchisePage.kind !== 'franchise') {
      throw new Error('Expected franchise page')
    }
    expect(franchisePage.sources.map(({ slug }) => slug)).toEqual([
      'related-source',
      'shared-source'
    ])
    expect(franchisePage.scenarios).toHaveLength(
      minimalSnapshot.scenarios.length
    )
    expect(franchisePage.externalLinks.map(({ label }) => label)).toEqual([
      'IMDb'
    ])

    const sourceDatesById = new Map(
      minimalSnapshot.sources.map(({ id, releaseDate }) => [id, releaseDate])
    )
    const sourceResources = catalog.listSourceResources()

    expect(
      sourceResources.every(
        ({ id, releaseDate }) => releaseDate === sourceDatesById.get(id)
      )
    ).toBe(true)
    expect(
      sourceResources.every(
        (resource, index) =>
          index === 0 ||
          sourceResources[index - 1]!.title.localeCompare(
            resource.title,
            'en',
            { sensitivity: 'base' }
          ) <= 0
      )
    ).toBe(true)

    for (const kind of [
      'source',
      'franchise',
      'risk-family',
      'concept'
    ] as const satisfies readonly ResourceKind[]) {
      for (const slug of catalog.getStaticSlugs(kind)) {
        expect(catalog.getResourcePage(kind, slug)).not.toBeNull()
      }
    }
    expect(catalog.getScenarioPage('missing')).toBeNull()
  })

  it('projects every searchable resource kind to a resolvable href', () => {
    const documents = catalog.getSearchDocuments()
    const scenarioDocument = documents.find(
      ({ href }) => href === '/scenarios/old-a'
    )

    expect(new Set(documents.map(({ kind }) => kind))).toEqual(
      new Set(['scenario', 'source', 'franchise', 'risk-family', 'concept'])
    )
    expect(scenarioDocument?.keywords).toEqual(
      expect.arrayContaining([
        'Scene copy.',
        'Why the analogy works.',
        'Where the analogy breaks.'
      ])
    )
    expect(scenarioDocument?.supplementalKeywords).toEqual(
      expect.arrayContaining(['scenario-only', 'source-only'])
    )
    expect(scenarioDocument?.supplementalKeywords).not.toContain('concept-only')
    expect(
      (scenarioDocument?.supplementalKeywords ?? []).filter(
        (keyword) => keyword === 'shared keyword'
      )
    ).toHaveLength(1)
    expect(
      documents.find(({ href }) => href === '/sources/shared-source')
        ?.supplementalKeywords
    ).toContain('source-only')
    expect(
      documents.find(({ href }) => href === '/concepts/concept-one')?.keywords
    ).toContain('Concept One With a Descriptive Name')
    expect(
      documents.find(({ href }) => href === '/concepts/concept-one')
        ?.supplementalKeywords
    ).toContain('concept-only')
    expect(documents.every(({ href }) => resolveDocument(catalog, href))).toBe(
      true
    )
  })
})

function resolveDocument(
  catalog: ReturnType<typeof createContentCatalog>,
  href: string
) {
  const [, segment, slug, trailing] = href.split('/')

  if (!segment || !slug || trailing) return false
  if (segment === 'scenarios') return catalog.getScenarioPage(slug) !== null
  if (segment === 'sources') {
    return catalog.getResourcePage('source', slug) !== null
  }
  if (segment === 'franchises') {
    return catalog.getResourcePage('franchise', slug) !== null
  }
  if (segment === 'risk-families') {
    return catalog.getResourcePage('risk-family', slug) !== null
  }
  if (segment === 'concepts') {
    return catalog.getResourcePage('concept', slug) !== null
  }

  return false
}

function createScenario(
  overrides: Pick<ScenarioRecord, 'id' | 'releaseDate' | 'riskFamilyIds'> &
    Partial<Pick<ScenarioRecord, 'featured' | 'memes' | 'sourceId' | 'tags'>>
): ScenarioRecord {
  return {
    id: overrides.id,
    slug: overrides.id,
    title: `Scenario ${overrides.id}`,
    keywords: ['scenario-only', 'shared keyword'],
    sourceId: overrides.sourceId ?? 'source-1',
    releaseDate: overrides.releaseDate,
    featured: overrides.featured ?? false,
    tags: overrides.tags ?? [],
    riskFamilyIds: overrides.riskFamilyIds,
    conceptIds: ['concept-1'],
    image: {
      gallerySrc: `https://assets.example.com/media/generated/scenarios/${overrides.id}/gallery.webp`,
      detailSrc: `https://assets.example.com/media/generated/scenarios/${overrides.id}/detail.webp`,
      width: 1600,
      height: 900,
      blurDataURL:
        'data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAABwAQCdASoIAAUAA8BgJYwCdAF1AAD+73a5N2G+4IAAAA==',
      alt: `Still from scenario ${overrides.id}`
    },
    memes: overrides.memes ?? [],
    video: null,
    scene: 'Scene copy.',
    whyAnalogyWorks: 'Why the analogy works.',
    caveats: 'Where the analogy breaks.'
  }
}

function createFranchise(id: string, title: string) {
  return {
    id,
    slug: id,
    title,
    keywords: [],
    description: `${title} description.`,
    image: {
      gallerySrc: `https://assets.example.com/media/generated/franchises/${id}/gallery.webp`,
      detailSrc: `https://assets.example.com/media/generated/franchises/${id}/detail.webp`,
      width: 1920,
      height: 1080,
      blurDataURL:
        'data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAABwAQCdASoIAAUAA8BgJYwCdAF1AAD+73a5N2G+4IAAAA==',
      alt: `Representative image for ${title}`
    },
    imdbUrl: `https://www.imdb.com/interest/${id}/`
  }
}

function createMeme(name: string): ScenarioRecord['memes'][number] {
  return {
    gallerySrc: `https://assets.example.com/media/generated/scenarios/old-a/${name}-gallery.webp`,
    detailSrc: `https://assets.example.com/media/generated/scenarios/old-a/${name}-detail.webp`,
    width: 1200,
    height: 1200,
    blurDataURL:
      'data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAABwAQCdASoIAAUAA8BgJYwCdAF1AAD+73a5N2G+4IAAAA==',
    alt: `Scenario meme ${name}`
  }
}

function slugs(items: readonly { readonly slug: string }[]) {
  return items.map((item) => item.slug)
}
