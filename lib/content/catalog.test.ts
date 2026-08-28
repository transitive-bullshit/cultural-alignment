import { describe, expect, it } from 'vitest'

import { createContentCatalog, type ResourceKind } from './catalog'
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

  it('composes filters and keeps undated records last in stable order', () => {
    expect(slugs(catalog.listScenarioCards({ featuredOnly: true }))).toEqual([
      'old-a',
      'null-a',
      'old-b'
    ])
    expect(
      slugs(
        catalog.listScenarioCards({
          featuredOnly: true,
          riskFamilySlug: 'family-b'
        })
      )
    ).toEqual(['old-b'])
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

  it('joins scenario and resource relations without broken pivots', () => {
    const page = catalog.getScenarioPage('old-b')!

    expect(page.source.slug).toBe('shared-source')
    expect(page.source.scenarioCount).toBe(minimalSnapshot.scenarios.length)
    expect(new Set(page.riskFamilies.map(({ slug }) => slug))).toEqual(
      new Set(['family-a', 'family-b'])
    )
    expect(page.concepts.map(({ slug }) => slug)).toEqual(['concept-one'])
    expect(
      page.moreFromSource.every(
        (related) =>
          related.id !== page.id && related.source.id === page.source.id
      )
    ).toBe(true)

    const sourcePage = catalog.getResourcePage('source', 'shared-source')!
    expect(sourcePage.scenarios).toHaveLength(minimalSnapshot.scenarios.length)
    expect(
      new Set(
        sourcePage.relatedResources.map(({ kind, slug }) => `${kind}:${slug}`)
      )
    ).toEqual(
      new Set([
        'risk-family:family-a',
        'risk-family:family-b',
        'concept:concept-one'
      ])
    )

    for (const kind of [
      'source',
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

    expect(new Set(documents.map(({ kind }) => kind))).toEqual(
      new Set(['scenario', 'source', 'risk-family', 'concept'])
    )
    expect(
      documents.find(({ href }) => href === '/scenarios/old-a')?.keywords
    ).toEqual(
      expect.arrayContaining([
        'Scene copy.',
        'Why the analogy works.',
        'Where the analogy breaks.'
      ])
    )
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
