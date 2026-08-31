import { describe, expect, it } from 'vitest'

import type { ContentSnapshot } from './schema'
import { ContentValidationError, validateContentSnapshot } from './validate'

const minimalSnapshot: ContentSnapshot = {
  schemaVersion: 3,
  scenarios: [
    {
      id: 'scenario-1',
      slug: 'keep-summer-safe',
      title: 'Keep Summer Safe',
      keywords: [],
      sourceId: 'source-1',
      releaseDate: '2015-08-02',
      featured: true,
      riskFamilyIds: ['risk-1'],
      conceptIds: ['concept-1'],
      image: {
        gallerySrc:
          'https://assets.example.com/media/generated/scenarios/scenario-1/gallery-abc.webp',
        detailSrc:
          'https://assets.example.com/media/generated/scenarios/scenario-1/detail-def.webp',
        width: 1600,
        height: 900,
        blurDataURL:
          'data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAABwAQCdASoIAAUAA8BgJYwCdAF1AAD+73a5N2G+4IAAAA==',
        alt: 'Summer stands beside the car'
      },
      memes: [],
      video: null,
      scene: 'The car follows a literal command.',
      whyAnalogyWorks:
        'It shows how a goal can be satisfied in an unwanted way.',
      caveats: 'The car is fictional and deliberately malicious.'
    }
  ],
  sources: [
    {
      id: 'source-1',
      slug: 'rick-and-morty',
      title: 'Rick and Morty',
      keywords: [],
      sourceType: 'tv-show',
      description: 'An animated science-fiction comedy.',
      releaseDate: '2013-12-02',
      poster: null,
      imdbUrl: 'https://www.imdb.com/title/tt2861424/',
      rottenTomatoesUrl: null,
      youtubeTrailerUrl: null,
      franchiseIds: ['franchise-1'],
      relatedSourceIds: []
    }
  ],
  franchises: [
    {
      id: 'franchise-1',
      slug: 'rick-and-morty-franchise',
      title: 'Rick and Morty',
      keywords: [],
      description: 'An animated science-fiction franchise.',
      image: {
        gallerySrc:
          'https://assets.example.com/media/generated/franchises/franchise-1/gallery-abc.webp',
        detailSrc:
          'https://assets.example.com/media/generated/franchises/franchise-1/detail-def.webp',
        width: 1600,
        height: 900,
        blurDataURL:
          'data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAABwAQCdASoIAAUAA8BgJYwCdAF1AAD+73a5N2G+4IAAAA==',
        alt: 'Representative image for Rick and Morty'
      },
      imdbUrl: 'https://www.imdb.com/title/tt2861424/'
    }
  ],
  riskFamilies: [
    {
      id: 'risk-1',
      slug: 'misalignment',
      shortName: 'Misalignment',
      fullName: 'Misalignment',
      description: 'Goals that diverge from their operator’s intent.',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/AI_alignment',
      citations: [
        {
          href: 'https://example.com/misalignment',
          title: 'A publication about misalignment',
          publisher: 'Example Research'
        }
      ]
    }
  ],
  concepts: [
    {
      id: 'concept-1',
      slug: 'specification-gaming',
      shortName: 'Specification Gaming',
      longName: 'Specification Gaming and Reward Hacking',
      keywords: [],
      description: 'Meeting the stated objective while missing its purpose.',
      wikipediaUrl: null,
      citations: [
        {
          href: 'https://example.com/specification-gaming',
          title: 'A publication about specification gaming',
          publisher: null
        }
      ]
    }
  ]
}

describe('validateContentSnapshot', () => {
  it('normalizes scenarios without meme attachments to an empty collection', () => {
    const input = structuredClone(minimalSnapshot)
    delete (input.scenarios[0] as { memes?: unknown }).memes
    const snapshot = validateContentSnapshot(input)

    expect(snapshot.scenarios[0]!.memes).toEqual([])
  })

  it('reports schema failures with an exact record path', () => {
    const input = structuredClone(minimalSnapshot)
    input.scenarios[0]!.image.width = -1

    const error = captureValidationError(() => validateContentSnapshot(input))

    expect(error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid-schema',
        path: 'scenarios[0].image.width',
        message: expect.stringContaining(
          'scenario "Keep Summer Safe" (ID: scenario-1)'
        )
      })
    ])
  })

  it('rejects local generated-media paths', () => {
    const input = structuredClone(minimalSnapshot)
    input.scenarios[0]!.image.gallerySrc =
      '/media/generated/scenarios/scenario-1/gallery.webp'

    const error = captureValidationError(() => validateContentSnapshot(input))

    expect(error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-schema',
          path: 'scenarios[0].image.gallerySrc'
        })
      ])
    )
  })

  it('accepts immutable HTTPS media URLs and rejects unsafe remote URLs', () => {
    const remote = structuredClone(minimalSnapshot)
    remote.scenarios[0]!.image.gallerySrc =
      'https://assets.example.com/media/generated/scenarios/example/gallery-abc.webp'
    remote.scenarios[0]!.image.detailSrc =
      'https://assets.example.com/media/generated/scenarios/example/detail-def.webp'

    expect(validateContentSnapshot(remote).scenarios[0]!.image).toEqual(
      remote.scenarios[0]!.image
    )

    const unsafe = structuredClone(remote)
    unsafe.scenarios[0]!.image.gallerySrc =
      'http://assets.example.com/gallery.webp?mutable=true'

    const error = captureValidationError(() => validateContentSnapshot(unsafe))
    expect(error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid-schema',
        path: 'scenarios[0].image.gallerySrc'
      })
    ])
  })

  it('requires a succinct WebP blur placeholder', () => {
    const input = structuredClone(minimalSnapshot)
    input.scenarios[0]!.image.blurDataURL =
      'data:image/png;base64,i-am-not-a-webp'

    const error = captureValidationError(() => validateContentSnapshot(input))

    expect(error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid-schema',
        path: 'scenarios[0].image.blurDataURL'
      })
    ])
  })

  it('rejects implementation-only canonical-source labels as citation titles', () => {
    const input = structuredClone(minimalSnapshot)
    input.riskFamilies[0]!.citations[0]!.title = 'Canonical source 01'

    const error = captureValidationError(() => validateContentSnapshot(input))

    expect(error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid-schema',
        path: 'riskFamilies[0].citations[0].title'
      })
    ])
  })

  it('reports every duplicate id and slug with its first declaration', () => {
    const input = structuredClone(minimalSnapshot)
    input.scenarios.push(structuredClone(input.scenarios[0]!))

    const error = captureValidationError(() => validateContentSnapshot(input))

    expect(error.issues.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: 'duplicate-id', path: 'scenarios[1].id' },
      { code: 'duplicate-slug', path: 'scenarios[1].slug' }
    ])
  })

  it('aggregates orphaned source, family, and concept relations', () => {
    const input = structuredClone(minimalSnapshot)
    const scenario = input.scenarios[0]!
    scenario.sourceId = 'missing-source'
    scenario.riskFamilyIds = ['missing-family']
    scenario.conceptIds = ['missing-concept']

    const error = captureValidationError(() => validateContentSnapshot(input))

    expect(error.issues.map(({ code, path }) => ({ code, path }))).toEqual([
      {
        code: 'missing-relation',
        path: 'scenarios[0].sourceId'
      },
      {
        code: 'missing-relation',
        path: 'scenarios[0].riskFamilyIds[0]'
      },
      {
        code: 'missing-relation',
        path: 'scenarios[0].conceptIds[0]'
      }
    ])
    expect(error.issues.map(({ message }) => message)).toEqual([
      expect.stringContaining('scenario "Keep Summer Safe" (ID: scenario-1)'),
      expect.stringContaining('scenario "Keep Summer Safe" (ID: scenario-1)'),
      expect.stringContaining('scenario "Keep Summer Safe" (ID: scenario-1)')
    ])
  })

  it('rejects orphaned directly related media sources', () => {
    const input = structuredClone(minimalSnapshot)
    input.sources[0]!.relatedSourceIds = ['missing-source']

    const error = captureValidationError(() => validateContentSnapshot(input))

    expect(error.issues.map(({ code, path }) => ({ code, path }))).toEqual([
      {
        code: 'missing-relation',
        path: 'sources[0].relatedSourceIds[0]'
      }
    ])
    expect(error.issues[0]!.message).toContain(
      'source "Rick and Morty" (ID: source-1)'
    )
  })

  it('rejects orphaned media franchise relations', () => {
    const input = structuredClone(minimalSnapshot)
    input.sources[0]!.franchiseIds = ['missing-franchise']

    const error = captureValidationError(() => validateContentSnapshot(input))

    expect(error.issues.map(({ code, path }) => ({ code, path }))).toEqual([
      {
        code: 'missing-relation',
        path: 'sources[0].franchiseIds[0]'
      }
    ])
    expect(error.issues[0]!.message).toContain(
      'source "Rick and Morty" (ID: source-1)'
    )
  })

  it('validates required franchise representative images', () => {
    const input = structuredClone(minimalSnapshot)
    input.franchises[0]!.image.width = 0

    const error = captureValidationError(() => validateContentSnapshot(input))

    expect(error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid-schema',
        path: 'franchises[0].image.width',
        message: expect.stringContaining(
          'franchise "Rick and Morty" (ID: franchise-1)'
        )
      })
    ])
  })

  it('only permits episode metadata for television sources', () => {
    const input = structuredClone(minimalSnapshot)
    input.sources[0]!.sourceType = 'movie'
    input.scenarios[0]!.episode = { label: 'Pilot' }

    const error = captureValidationError(() => validateContentSnapshot(input))

    expect(error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid-source-episode',
        path: 'scenarios[0].episode',
        message: expect.stringMatching(
          /scenario "Keep Summer Safe" \(ID: scenario-1\).*source "Rick and Morty" \(ID: source-1\)/
        )
      })
    ])
  })
})

function captureValidationError(run: () => unknown) {
  try {
    run()
  } catch (err) {
    if (err instanceof ContentValidationError) return err

    throw err
  }

  throw new Error('Expected content validation to fail')
}
