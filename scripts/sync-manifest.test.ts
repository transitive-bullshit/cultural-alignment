import { describe, expect, it } from 'vitest'

import {
  parsePreviousSyncManifest,
  parseSyncManifest,
  validateCheckedSyncManifest,
  validateSyncManifest
} from './sync-manifest'

const scenarioId = '3c6edb27-f124-80cc-92d5-c8f2f2e3a7fa'
const sourceId = '3caedb27-f124-8031-9026-e39581c85c47'
const franchiseId = '3cdedb27-f124-80c3-850f-dadca165c684'

describe('parsePreviousSyncManifest', () => {
  it('ignores v1 slugs while retaining reusable scenario image history', () => {
    const result = parsePreviousSyncManifest({
      schemaVersion: 1,
      slugs: {
        scenarios: { 'scenario-1': 'old-scenario-url' },
        sources: { 'source-1': 'old-source-url' },
        riskFamilies: { 'risk-1': 'old-risk-url' },
        concepts: { 'concept-1': 'old-concept-url' }
      },
      entries: {
        'scenario-1': imageEntry(
          '/media/generated/scenarios/3c6edb27f12480cc92d5c8f2f2e3a7fa'
        )
      }
    })

    expect(result.slugs).toEqual({
      scenarios: {},
      sources: {},
      franchises: {},
      riskFamilies: {},
      concepts: {}
    })
    expect(Object.keys(result.entries.scenarios)).toEqual(['scenario-1'])
    expect(result.entries.sources).toEqual({})
    expect(result.entries.franchises).toEqual({})
  })

  it('preserves v2 slugs and image history for descriptor migration', () => {
    const scenarioEntry = imageEntry(
      '/media/generated/scenarios/3c6edb27f12480cc92d5c8f2f2e3a7fa'
    )
    const sourceEntry = imageEntry(
      '/media/generated/sources/3caedb27f12480319026e39581c85c47'
    )
    const slugs = historicalSlugs()

    expect(
      parsePreviousSyncManifest({
        schemaVersion: 2,
        slugs,
        entries: {
          scenarios: { [scenarioId]: scenarioEntry },
          sources: { [sourceId]: sourceEntry }
        }
      })
    ).toEqual({
      slugs: { ...slugs, franchises: {} },
      entries: {
        scenarios: { [scenarioId]: scenarioEntry },
        sources: { [sourceId]: sourceEntry },
        franchises: {}
      }
    })
  })

  it('migrates v3 slug history with an empty franchise map', () => {
    const manifest = previousManifest()

    expect(parsePreviousSyncManifest(manifest)).toEqual({
      slugs: { ...manifest.slugs, franchises: {} },
      entries: { scenarios: {}, sources: {}, franchises: {} }
    })
  })

  it('preserves v4 franchise slugs without inventing media history', () => {
    const manifest = currentManifest()

    expect(parsePreviousSyncManifest(manifest)).toEqual({
      slugs: manifest.slugs,
      entries: { scenarios: {}, sources: {}, franchises: {} }
    })
  })
})

describe('parseSyncManifest', () => {
  it('accepts the media-free v4 manifest contract', () => {
    const manifest = currentManifest()

    expect(parseSyncManifest(manifest)).toEqual(manifest)
  })

  it('rejects the previous v3 manifest contract', () => {
    expect(() => parseSyncManifest(previousManifest())).toThrow()
  })

  it('rejects media entries in the v4 manifest', () => {
    expect(() =>
      parseSyncManifest({
        ...currentManifest(),
        entries: { scenarios: {}, sources: {} }
      })
    ).toThrow()
  })
})

describe('validateSyncManifest', () => {
  it('validates counts, slugs, and fixture ownership against the snapshot', () => {
    const manifest = currentManifest()

    expect(validateSyncManifest(manifest, currentSnapshot())).toEqual(manifest)
  })

  it('rejects a collection count that diverges from the snapshot', () => {
    const manifest = currentManifest()
    manifest.counts.franchises = 2

    expect(() => validateSyncManifest(manifest, currentSnapshot())).toThrow(
      'Manifest franchises count 2 does not match snapshot count 1'
    )
  })

  it('rejects slugs that diverge from the snapshot', () => {
    const manifest = currentManifest()
    manifest.slugs.scenarios[scenarioId] = 'changed-scenario'

    expect(() => validateSyncManifest(manifest, currentSnapshot())).toThrow(
      'Manifest scenarios slugs do not match the snapshot'
    )
  })

  it('rejects fixtures that do not belong to a snapshot scenario', () => {
    const manifest = currentManifest()
    manifest.fixtureScenarioIds = ['missing-scenario']

    expect(() => validateSyncManifest(manifest, currentSnapshot())).toThrow(
      'Manifest fixture references unknown scenario missing-scenario'
    )
  })
})

describe('validateCheckedSyncManifest', () => {
  it('accepts the transitional checked v2 manifest with media entries', () => {
    const manifest = transitionalManifest()

    expect(validateCheckedSyncManifest(manifest, currentSnapshot())).toEqual(
      manifest
    )
  })

  it('retains v2 media ownership validation during descriptor migration', () => {
    const current = transitionalManifest()
    const manifest = {
      ...current,
      entries: { ...current.entries, sources: {} }
    }

    expect(() =>
      validateCheckedSyncManifest(manifest, currentSnapshot())
    ).toThrow('Manifest source image ownership does not match snapshot posters')
  })
})

function currentManifest() {
  return {
    schemaVersion: 4 as const,
    notion: {
      apiVersion: '2026-03-11',
      dataSources: {
        scenarios: { databaseId: 'database-1', dataSourceId: 'data-source-1' },
        sources: { databaseId: 'database-2', dataSourceId: 'data-source-2' },
        franchises: {
          databaseId: 'database-5',
          dataSourceId: 'data-source-5'
        },
        riskFamilies: {
          databaseId: 'database-3',
          dataSourceId: 'data-source-3'
        },
        concepts: { databaseId: 'database-4', dataSourceId: 'data-source-4' }
      }
    },
    counts: {
      scenarios: 1,
      sources: 1,
      franchises: 1,
      riskFamilies: 1,
      concepts: 1
    },
    fixtureScenarioIds: [scenarioId],
    slugs: stableSlugs()
  }
}

function previousManifest() {
  const current = currentManifest()
  const { franchises: _franchiseDataSource, ...dataSources } =
    current.notion.dataSources
  const { franchises: _franchiseCount, ...counts } = current.counts
  const { franchises: _franchiseSlugs, ...slugs } = current.slugs

  return {
    ...current,
    schemaVersion: 3 as const,
    notion: { ...current.notion, dataSources },
    counts,
    slugs
  }
}

function stableSlugs() {
  return {
    scenarios: { [scenarioId]: 'stable-scenario' },
    sources: { [sourceId]: 'stable-source' },
    franchises: { [franchiseId]: 'stable-franchise' },
    riskFamilies: { 'risk-1': 'stable-risk' },
    concepts: { 'concept-1': 'stable-concept' }
  }
}

function historicalSlugs() {
  const { franchises: _franchises, ...slugs } = stableSlugs()
  return slugs
}

function transitionalManifest() {
  const current = previousManifest()
  return {
    ...current,
    schemaVersion: 2 as const,
    entries: {
      scenarios: {
        [scenarioId]: remoteImageEntry('scenarios', scenarioId)
      },
      sources: {
        [sourceId]: remoteImageEntry('sources', sourceId)
      }
    }
  }
}

function currentSnapshot() {
  return {
    schemaVersion: 3 as const,
    scenarios: [
      {
        id: scenarioId,
        slug: 'stable-scenario',
        title: 'Keep Summer Safe',
        keywords: [],
        sourceId,
        releaseDate: '2015-08-02',
        featured: true,
        riskFamilyIds: ['risk-1'],
        conceptIds: ['concept-1'],
        image: {
          gallerySrc: `https://media.example.com/media/generated/scenarios/3c6edb27f12480cc92d5c8f2f2e3a7fa/gallery-${'b'.repeat(64)}.webp`,
          detailSrc: `https://media.example.com/media/generated/scenarios/3c6edb27f12480cc92d5c8f2f2e3a7fa/detail-${'c'.repeat(64)}.webp`,
          width: 1920,
          height: 1080,
          blurDataURL:
            'data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAABwAQCdASoIAAUAA8BgJYwCdAF1AAD+73a5N2G+4IAAAA==',
          alt: 'A still'
        },
        memes: [],
        video: null,
        scene: 'Scene',
        whyAnalogyWorks: 'Why',
        caveats: 'Caveat'
      }
    ],
    sources: [
      {
        id: sourceId,
        slug: 'stable-source',
        title: 'A.I. Artificial Intelligence',
        keywords: [],
        sourceType: 'movie' as const,
        description: null,
        releaseDate: '2001-06-29',
        poster: {
          gallerySrc: `https://media.example.com/media/generated/sources/3caedb27f12480319026e39581c85c47/gallery-${'b'.repeat(64)}.webp`,
          detailSrc: `https://media.example.com/media/generated/sources/3caedb27f12480319026e39581c85c47/detail-${'c'.repeat(64)}.webp`,
          width: 1920,
          height: 1080,
          blurDataURL:
            'data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAABwAQCdASoIAAUAA8BgJYwCdAF1AAD+73a5N2G+4IAAAA==',
          alt: 'Poster'
        },
        imdbUrl: null,
        rottenTomatoesUrl: null,
        youtubeTrailerUrl: null,
        franchiseIds: [franchiseId],
        relatedSourceIds: []
      }
    ],
    franchises: [
      {
        id: franchiseId,
        slug: 'stable-franchise',
        title: 'Stable Franchise',
        keywords: [],
        description: 'A stable media franchise.',
        image: {
          gallerySrc: `https://media.example.com/media/generated/franchises/3cdedb27f12480c3850fdadca165c684/gallery-${'b'.repeat(64)}.webp`,
          detailSrc: `https://media.example.com/media/generated/franchises/3cdedb27f12480c3850fdadca165c684/detail-${'c'.repeat(64)}.webp`,
          width: 1920,
          height: 1080,
          blurDataURL:
            'data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAABwAQCdASoIAAUAA8BgJYwCdAF1AAD+73a5N2G+4IAAAA==',
          alt: 'Representative image for Stable Franchise'
        },
        imdbUrl: 'https://www.imdb.com/list/ls000000000/'
      }
    ],
    riskFamilies: [
      {
        id: 'risk-1',
        slug: 'stable-risk',
        shortName: 'Risk',
        fullName: 'Risk',
        description: 'Risk description',
        wikipediaUrl: null,
        citations: [
          {
            href: 'https://example.com/risk',
            title: 'Risk publication',
            publisher: 'Example Research'
          }
        ]
      }
    ],
    concepts: [
      {
        id: 'concept-1',
        slug: 'stable-concept',
        shortName: 'Concept',
        longName: 'Concept',
        keywords: [],
        description: 'Concept description',
        wikipediaUrl: null,
        citations: [
          {
            href: 'https://example.com/concept',
            title: 'Concept publication',
            publisher: null
          }
        ]
      }
    ]
  }
}

function imageEntry(pathRoot: string) {
  return {
    pipelineVersion: 1,
    lastEditedTime: '2026-08-28T00:00:00.000Z',
    imageBlockId: 'image-1',
    additionalImageCount: 0,
    sourceHash: 'a'.repeat(64),
    galleryHash: 'b'.repeat(64),
    detailHash: 'c'.repeat(64),
    gallerySrc: `${pathRoot}/gallery.webp`,
    detailSrc: `${pathRoot}/detail.webp`,
    width: 1920,
    height: 1080,
    caption: 'A still'
  }
}

function remoteImageEntry(
  collection: 'franchises' | 'scenarios' | 'sources',
  id: string
) {
  const compactId = id.replaceAll('-', '')
  const galleryHash = 'b'.repeat(64)
  const detailHash = 'c'.repeat(64)
  const root = `media/generated/${collection}/${compactId}`

  return {
    pipelineVersion: 3 as const,
    lastEditedTime: '2026-08-28T00:00:00.000Z',
    imageBlockId: 'image-1',
    additionalImageCount: 0,
    sourceHash: 'a'.repeat(64),
    galleryHash,
    detailHash,
    galleryKey: `${root}/gallery-${galleryHash}.webp`,
    detailKey: `${root}/detail-${detailHash}.webp`,
    gallerySrc: `https://media.example.com/${root}/gallery-${galleryHash}.webp`,
    detailSrc: `https://media.example.com/${root}/detail-${detailHash}.webp`,
    width: 1920,
    height: 1080,
    blurDataURL:
      'data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAABwAQCdASoIAAUAA8BgJYwCdAF1AAD+73a5N2G+4IAAAA==',
    caption: 'A still'
  }
}
