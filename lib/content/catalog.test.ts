import { describe, expect, it } from 'vitest'

import { createContentCatalog } from './catalog'
import type { ContentSnapshot, ScenarioRecord } from './schema'

const minimalSnapshot = {
  schemaVersion: 1,
  scenarios: [
    createScenario({
      id: 'old-a',
      releaseDate: '2020-01-01',
      featured: true,
      riskFamilyIds: ['risk-a']
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
      riskFamilyIds: ['risk-b']
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
      kind: 'film',
      description: 'The source description.',
      links: [{ label: 'Official site', href: 'https://example.com/source' }]
    }
  ],
  riskFamilies: [
    {
      id: 'risk-a',
      slug: 'family-a',
      title: 'Family A',
      description: 'The first family.'
    },
    {
      id: 'risk-b',
      slug: 'family-b',
      title: 'Family B',
      description: 'The second family.'
    }
  ],
  concepts: [
    {
      id: 'concept-1',
      slug: 'concept-one',
      title: 'Concept One',
      description: 'A concept description.'
    }
  ]
} satisfies ContentSnapshot

describe('ContentCatalog', () => {
  const catalog = createContentCatalog(minimalSnapshot)

  it('returns only manually featured cards without changing snapshot order', () => {
    expect(slugs(catalog.listScenarioCards({ featuredOnly: true }))).toEqual([
      'old-a',
      'null-a',
      'old-b'
    ])
  })

  it('filters risk families with relation-membership semantics', () => {
    expect(
      slugs(catalog.listScenarioCards({ riskFamilySlug: 'family-b' }))
    ).toEqual(['new', 'old-b', 'null-b'])
    expect(
      slugs(
        catalog.listScenarioCards({
          featuredOnly: true,
          riskFamilySlug: 'family-b'
        })
      )
    ).toEqual(['old-b'])
    expect(
      catalog.listScenarioCards({ riskFamilySlug: 'not-a-family' })
    ).toEqual([])
  })

  it('sorts dates stably and keeps null dates last in both directions', () => {
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

  it('returns a joined scenario-page model instead of relation ids', () => {
    const page = catalog.getScenarioPage('old-b')

    expect(page).toMatchObject({
      slug: 'old-b',
      source: {
        slug: 'shared-source',
        href: '/sources/shared-source',
        title: 'Shared Source',
        links: [{ label: 'Official site', href: 'https://example.com/source' }],
        scenarioCount: 5
      },
      riskFamilies: [
        { slug: 'family-a', href: '/risk-families/family-a' },
        { slug: 'family-b', href: '/risk-families/family-b' }
      ],
      concepts: [{ slug: 'concept-one', href: '/concepts/concept-one' }],
      moreFromSource: [{ slug: 'old-a' }, { slug: 'null-a' }],
      relatedScenarios: []
    })
    expect(catalog.getScenarioPage('missing')).toBeNull()
  })

  it('returns deterministic static slugs and resolves every scenario slug', () => {
    expect(catalog.getStaticSlugs('scenario')).toEqual([
      'old-a',
      'null-a',
      'new',
      'old-b',
      'null-b'
    ])
    expect(catalog.getStaticSlugs('source')).toEqual(['shared-source'])
    expect(catalog.getStaticSlugs('risk-family')).toEqual([
      'family-a',
      'family-b'
    ])
    expect(catalog.getStaticSlugs('concept')).toEqual(['concept-one'])

    for (const slug of catalog.getStaticSlugs('scenario')) {
      expect(catalog.getScenarioPage(slug)).not.toBeNull()
    }

    for (const kind of ['source', 'risk-family', 'concept'] as const) {
      for (const slug of catalog.getStaticSlugs(kind)) {
        expect(catalog.getResourcePage(kind, slug)).not.toBeNull()
      }
    }
  })

  it('projects alphabetized resource indices with joined scenario counts', () => {
    expect(catalog.listResources('risk-family')).toEqual([
      expect.objectContaining({
        kind: 'risk-family',
        slug: 'family-a',
        href: '/risk-families/family-a',
        scenarioCount: 3
      }),
      expect.objectContaining({
        kind: 'risk-family',
        slug: 'family-b',
        href: '/risk-families/family-b',
        scenarioCount: 3
      })
    ])
    expect(catalog.listResources('source')[0]).toMatchObject({
      slug: 'shared-source',
      href: '/sources/shared-source',
      scenarioCount: 5
    })
    expect(catalog.listResources('concept')[0]).toMatchObject({
      slug: 'concept-one',
      href: '/concepts/concept-one',
      scenarioCount: 5
    })
  })

  it('returns complete resource pivots with deduplicated related resources', () => {
    expect(catalog.getResourcePage('source', 'shared-source')).toMatchObject({
      kind: 'source',
      externalLinks: [
        { label: 'Official site', href: 'https://example.com/source' }
      ],
      scenarios: [
        { slug: 'old-a' },
        { slug: 'null-a' },
        { slug: 'new' },
        { slug: 'old-b' },
        { slug: 'null-b' }
      ],
      relatedResources: [
        { kind: 'risk-family', slug: 'family-a' },
        { kind: 'risk-family', slug: 'family-b' },
        { kind: 'concept', slug: 'concept-one' }
      ]
    })
    expect(
      catalog
        .getResourcePage('risk-family', 'family-a')
        ?.relatedResources.map(({ kind, slug }) => `${kind}:${slug}`)
    ).toEqual(['concept:concept-one', 'source:shared-source'])
    expect(
      catalog
        .getResourcePage('concept', 'concept-one')
        ?.relatedResources.map(({ kind, slug }) => `${kind}:${slug}`)
    ).toEqual([
      'risk-family:family-a',
      'risk-family:family-b',
      'source:shared-source'
    ])
    expect(catalog.getResourcePage('concept', 'missing')).toBeNull()
  })

  it('builds all four search kinds and every document resolves', () => {
    expect(catalog.getSearchDocuments()).toHaveLength(9)
    expect(
      catalog
        .getSearchDocuments()
        .find((document) => document.href === '/scenarios/old-a')
    ).toEqual({
      kind: 'scenario',
      title: 'Scenario old-a',
      subtitle: 'Shared Source',
      keywords: [
        'Shared Source',
        'Family A',
        'Concept One',
        'Scene copy.',
        'Why the analogy works.',
        'Where the analogy breaks.'
      ],
      href: '/scenarios/old-a'
    })
    expect(
      new Set(catalog.getSearchDocuments().map(({ kind }) => kind))
    ).toEqual(new Set(['scenario', 'source', 'risk-family', 'concept']))

    for (const document of catalog.getSearchDocuments()) {
      expect(resolveDocument(catalog, document.href)).toBe(true)
    }
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
    Partial<Pick<ScenarioRecord, 'featured'>>
): ScenarioRecord {
  return {
    id: overrides.id,
    slug: overrides.id,
    title: `Scenario ${overrides.id}`,
    sourceId: 'source-1',
    releaseDate: overrides.releaseDate,
    featured: overrides.featured ?? false,
    riskFamilyIds: overrides.riskFamilyIds,
    conceptIds: ['concept-1'],
    image: {
      gallerySrc: `/media/scenarios/${overrides.id}-gallery.webp`,
      detailSrc: `/media/scenarios/${overrides.id}-detail.webp`,
      width: 1600,
      height: 900,
      alt: `Still from scenario ${overrides.id}`
    },
    video: null,
    scene: 'Scene copy.',
    whyAnalogyWorks: 'Why the analogy works.',
    caveats: 'Where the analogy breaks.'
  }
}

function slugs(items: readonly { readonly slug: string }[]) {
  return items.map((item) => item.slug)
}
