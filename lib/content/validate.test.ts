import { describe, expect, it } from 'vitest'

import type { ContentSnapshot } from './schema'
import { ContentValidationError, validateContentSnapshot } from './validate'

const minimalSnapshot = {
  schemaVersion: 1,
  scenarios: [
    {
      id: 'scenario-1',
      slug: 'keep-summer-safe',
      title: 'Keep Summer Safe',
      sourceId: 'source-1',
      releaseDate: '2015-08-02',
      featured: true,
      riskFamilyIds: ['risk-1'],
      conceptIds: ['concept-1'],
      image: {
        gallerySrc: '/media/scenarios/scenario-1-gallery.webp',
        detailSrc: '/media/scenarios/scenario-1-detail.webp',
        width: 1600,
        height: 900,
        alt: 'Summer stands beside the car'
      },
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
      kind: 'television'
    }
  ],
  riskFamilies: [
    {
      id: 'risk-1',
      slug: 'misalignment',
      title: 'Misalignment',
      description: 'Goals that diverge from their operator’s intent.'
    }
  ],
  concepts: [
    {
      id: 'concept-1',
      slug: 'specification-gaming',
      title: 'Specification gaming',
      description: 'Meeting the stated objective while missing its purpose.'
    }
  ]
} satisfies ContentSnapshot

describe('validateContentSnapshot', () => {
  it('parses a valid snapshot through the schema', () => {
    const input = structuredClone(minimalSnapshot)
    input.scenarios[0]!.title = '  Keep Summer Safe  '

    const result = validateContentSnapshot(input)

    expect(result.scenarios[0]!.title).toBe('Keep Summer Safe')
  })

  it('reports schema failures with an exact record path', () => {
    const input = structuredClone(minimalSnapshot)
    input.scenarios[0]!.image.width = -1

    const error = captureValidationError(() => validateContentSnapshot(input))

    expect(error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid-schema',
        path: 'scenarios[0].image.width'
      })
    ])
    expect(error.message).toContain('- scenarios[0].image.width:')
  })

  it('rejects media paths that escape the local media root', () => {
    const input = structuredClone(minimalSnapshot)
    input.scenarios[0]!.image.gallerySrc = '/media/generated/../../app/page.tsx'

    const error = captureValidationError(() => validateContentSnapshot(input))

    expect(error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid-schema',
        path: 'scenarios[0].image.gallerySrc'
      })
    ])
  })

  it('reports every duplicate id and slug with its first declaration', () => {
    const input = structuredClone(minimalSnapshot)
    input.scenarios.push(structuredClone(input.scenarios[0]!))

    const error = captureValidationError(() => validateContentSnapshot(input))

    expect(error.issues).toEqual([
      {
        code: 'duplicate-id',
        path: 'scenarios[1].id',
        message: 'Duplicate id "scenario-1"; first declared at scenarios[0].id'
      },
      {
        code: 'duplicate-slug',
        path: 'scenarios[1].slug',
        message:
          'Duplicate slug "keep-summer-safe"; first declared at scenarios[0].slug'
      }
    ])
  })

  it('aggregates orphaned source, family, and concept relations', () => {
    const input = structuredClone(minimalSnapshot)
    const scenario = input.scenarios[0]!
    scenario.sourceId = 'missing-source'
    scenario.riskFamilyIds = ['missing-family']
    scenario.conceptIds = ['missing-concept']

    const error = captureValidationError(() => validateContentSnapshot(input))

    expect(error.issues).toEqual([
      {
        code: 'missing-relation',
        path: 'scenarios[0].sourceId',
        message: 'Unknown source id "missing-source"'
      },
      {
        code: 'missing-relation',
        path: 'scenarios[0].riskFamilyIds[0]',
        message: 'Unknown risk-family id "missing-family"'
      },
      {
        code: 'missing-relation',
        path: 'scenarios[0].conceptIds[0]',
        message: 'Unknown concept id "missing-concept"'
      }
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
