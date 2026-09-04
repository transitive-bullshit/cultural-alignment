import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type {
  MemeFeedbackEntry,
  MemeIdeaV2,
  MemeReviewAsset,
  MemeReviewStateDocument,
  ScenarioMemeIdeasV2
} from '../lib/meme-review/schema'
import {
  planLayoutRefinementBatch,
  planPunctuationRefinementBatch,
  prepareMemeReviewBatch,
  type MemeReviewPreparationSourceBatch
} from './prepare-meme-review-batch'

const temporaryPaths: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  )
})

describe('layout-refinement batch planning', () => {
  it('preserves finalized and disabled payloads while routing only requested mutable survivors', () => {
    const source = createMixedSource()
    const prepared = planLayoutRefinementBatch({
      source,
      targetBatch: 3,
      createdAt: '2026-09-04T02:00:00.000Z'
    })
    const ideasBySlug = new Map(
      prepared.ideas.map((scenario) => [scenario.scenario_slug, scenario.ideas])
    )
    const actions = new Map(
      prepared.generationPlan.ideas.map(({ id, action }) => [id, action])
    )

    expect(ideasBySlug.get('work')?.map(({ id }) => id)).toEqual([
      'work--01',
      'work--02',
      'work--03',
      'work--04'
    ])
    expect(actions.get('work--01')).toBe('finalized')
    expect(actions.get('work--02')).toBe('layout-only')
    expect(actions.get('work--03')).toBe('layout-only')
    expect(actions.get('work--04')).toBe('bounded-revision')
    expect(actions.get('ava-games-the-test--05')).toBe('bounded-revision')
    expect(actions.get('rust-spots-the-evaluation--08')).toBe(
      'bounded-revision'
    )
    expect(actions.has('rust-spots-the-evaluation--09')).toBe(false)
    expect(ideasBySlug.get('disabled')?.map(({ id }) => id)).toEqual([
      'disabled--01'
    ])
    expect(actions.get('disabled--01')).toBe('disabled-unchanged')
    expect(actions.has('disabled--02')).toBe(false)
    expect(ideasBySlug.has('all-disliked')).toBe(false)
    expect(prepared.generationPlan.dropped_ideas.map(({ id }) => id)).toEqual([
      'work--05',
      'disabled--02',
      'all-disliked--01',
      'rust-spots-the-evaluation--09'
    ])

    const sourceFinalized = source.feedback.feedback['work--01']
    expect(prepared.feedback.feedback).toEqual({
      'work--01': sourceFinalized,
      'finalized-only--01': source.feedback.feedback['finalized-only--01']
    })
    expect(prepared.feedback.feedback['work--01']).toEqual(sourceFinalized)
    expect(prepared.feedback.feedback['work--01']).not.toBe(sourceFinalized)
    expect(prepared.feedback.scenarios).toEqual({
      disabled: { disabled: true }
    })

    expect(prepared.status.status).toBe('generating')
    expect(prepared.status.reviewable_scenarios).toEqual([
      'finalized-only',
      'disabled'
    ])
    expect(
      prepared.parts
        .flatMap(({ ideas }) => ideas)
        .map(({ scenario_slug }) => scenario_slug)
    ).toEqual(['work', 'ava-games-the-test', 'rust-spots-the-evaluation'])
    expect(
      prepared.parts
        .flatMap(({ ideas }) => ideas)
        .some(
          ({ scenario_slug }) =>
            scenario_slug === 'disabled' || scenario_slug === 'finalized-only'
        )
    ).toBe(false)
  })

  it('requires a ready source and carries an unreviewed enabled idea as mutable', () => {
    const source = createMixedSource()

    expect(() =>
      planLayoutRefinementBatch({
        source: {
          ...source,
          status: { ...source.status, status: 'generating' }
        },
        targetBatch: 3,
        createdAt: '2026-09-04T02:00:00.000Z'
      })
    ).toThrow(/finish it before preparing another batch/)

    const prepared = planLayoutRefinementBatch({
      source: {
        ...source,
        feedback: {
          ...source.feedback,
          feedback: {
            ...source.feedback.feedback,
            'work--02': {
              ...source.feedback.feedback['work--02']!,
              rating: null
            }
          }
        }
      },
      targetBatch: 3,
      createdAt: '2026-09-04T02:00:00.000Z'
    })
    expect(
      prepared.generationPlan.ideas.find(({ id }) => id === 'work--02')?.action
    ).toBe('layout-only')
  })
})

describe('punctuation-refinement batch planning', () => {
  it('prepares exact caption-only edits while leaving core ideas pending publication', () => {
    const source = createMixedSource()
    const punctuatedIdeas = source.ideas.map((scenario) => ({
      ...scenario,
      ideas: scenario.ideas.map((memeIdea) => ({
        ...memeIdea,
        caption_lines: ['SETUP.', 'PAYOFF.”']
      }))
    }))
    const prepared = planPunctuationRefinementBatch({
      source: {
        ...source,
        ideas: punctuatedIdeas,
        feedback: {
          ...source.feedback,
          feedback: {
            ...source.feedback.feedback,
            'work--02': reviewed('like', 'remove the periods'),
            'work--04': reviewed(
              'neutral',
              'remove the periods and make the setup wider'
            )
          }
        }
      },
      targetBatch: 3,
      createdAt: '2026-09-04T02:00:00.000Z'
    })
    const actions = new Map(
      prepared.generationPlan.ideas.map(({ id, action }) => [id, action])
    )
    const sourceIdeasById = new Map(
      punctuatedIdeas.flatMap(({ ideas }) =>
        ideas.map((idea) => [idea.id, idea])
      )
    )
    const coreIdeasById = new Map(
      prepared.ideas.flatMap(({ ideas }) =>
        ideas.map((idea) => [idea.id, idea])
      )
    )
    const partIdeasById = new Map(
      prepared.parts.flatMap(({ ideas: scenarios }) =>
        scenarios.flatMap(({ ideas }) => ideas.map((idea) => [idea.id, idea]))
      )
    )

    expect(actions.get('work--01')).toBe('finalized')
    expect(actions.get('work--02')).toBe('punctuation-only')
    expect(actions.get('work--03')).toBe('punctuation-only')
    expect(actions.get('work--04')).toBe('bounded-revision')
    expect(actions.has('work--05')).toBe(false)
    expect(actions.get('disabled--01')).toBe('disabled-unchanged')
    expect(actions.has('disabled--02')).toBe(false)
    expect(
      prepared.generationPlan.ideas.find(({ id }) => id === 'work--02')
        ?.allowed_changed_fields
    ).toEqual(['caption_lines'])

    expect(coreIdeasById.get('work--02')).toEqual(
      sourceIdeasById.get('work--02')
    )
    expect(partIdeasById.get('work--02')?.caption_lines).toEqual([
      'SETUP',
      'PAYOFF”'
    ])
    expect(partIdeasById.get('work--04')?.caption_lines).toEqual([
      'SETUP',
      'PAYOFF”'
    ])
    expect(partIdeasById.get('work--01')).toEqual(
      sourceIdeasById.get('work--01')
    )
    expect(coreIdeasById.get('disabled--01')).toEqual(
      sourceIdeasById.get('disabled--01')
    )
    expect(prepared.generationPlan.asset_revision_idea_ids).toEqual(
      prepared.generationPlan.ideas
        .filter(({ allowed_changed_fields }) =>
          allowed_changed_fields.includes('assets')
        )
        .map(({ id }) => id)
    )
    expect(prepared.status.message).toContain('punctuation-refinement')
  })

  it('atomically writes punctuation parts without changing source or target core copy', async () => {
    const roundsPath = await createRoundsPath()
    const baseSource = createMixedSource()
    const source = {
      ...baseSource,
      ideas: baseSource.ideas.map((scenario) => ({
        ...scenario,
        ideas: scenario.ideas.map((memeIdea) => ({
          ...memeIdea,
          caption_lines: ['SETUP.', 'PAYOFF.']
        }))
      }))
    }
    const sourcePath = join(roundsPath, 'round-02')
    await writeSourceBatch(sourcePath, source)
    const sourceBefore = await readCoreFiles(sourcePath)

    await prepareMemeReviewBatch({
      source: 'round-02',
      target: 'round-03',
      mode: 'punctuation-refinement',
      roundsPath,
      now: new Date('2026-09-04T02:00:00.000Z')
    })

    const targetPath = join(roundsPath, 'round-03')
    expect(await readCoreFiles(sourcePath)).toEqual(sourceBefore)
    await expect(readJson(targetPath, 'ideas.json')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scenario_slug: 'work',
          ideas: expect.arrayContaining([
            expect.objectContaining({
              id: 'work--02',
              caption_lines: ['SETUP.', 'PAYOFF.']
            })
          ])
        })
      ])
    )
    await expect(
      readJson(join(targetPath, 'parts'), 'part-01.json')
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scenario_slug: 'work',
          ideas: expect.arrayContaining([
            expect.objectContaining({
              id: 'work--02',
              caption_lines: ['SETUP', 'PAYOFF']
            })
          ])
        })
      ])
    )
  })
})

describe('atomic batch initialization', () => {
  it('publishes a complete valid directory without changing its source', async () => {
    const roundsPath = await createRoundsPath()
    const source = createMixedSource()
    const sourcePath = join(roundsPath, 'round-02')
    await writeSourceBatch(sourcePath, source)
    const sourceBefore = await readCoreFiles(sourcePath)

    const result = await prepareMemeReviewBatch({
      source: 'round-02',
      target: 'round-03',
      mode: 'layout-refinement',
      roundsPath,
      now: new Date('2026-09-04T02:00:00.000Z')
    })

    const targetPath = join(roundsPath, 'round-03')
    expect(result.targetPath).toBe(targetPath)
    expect(await readCoreFiles(sourcePath)).toEqual(sourceBefore)
    await expect(
      readFile(join(targetPath, 'ideas.json'), 'utf8')
    ).resolves.toBeTruthy()
    await expect(
      readFile(join(targetPath, 'assets.json'), 'utf8')
    ).resolves.toBeTruthy()
    await expect(
      readFile(join(targetPath, 'feedback.json'), 'utf8')
    ).resolves.toBeTruthy()
    await expect(
      readFile(join(targetPath, 'status.json'), 'utf8')
    ).resolves.toBeTruthy()
    await expect(
      readFile(join(targetPath, 'generation-plan.json'), 'utf8')
    ).resolves.toContain('"source_batch": 2')
    expect(
      (await readdir(roundsPath)).filter((name) => name.includes('.staging-'))
    ).toEqual([])

    await expect(
      prepareMemeReviewBatch({
        source: 'round-02',
        target: 'round-03',
        mode: 'layout-refinement',
        roundsPath
      })
    ).rejects.toThrow(/Refusing to overwrite existing meme review batch/)
  })

  it('does not expose a target directory when source validation fails', async () => {
    const roundsPath = await createRoundsPath()
    const source = createMixedSource()
    await writeSourceBatch(join(roundsPath, 'round-02'), {
      ...source,
      status: { ...source.status, status: 'generating' }
    })

    await expect(
      prepareMemeReviewBatch({
        source: 'round-02',
        target: 'round-03',
        mode: 'layout-refinement',
        roundsPath
      })
    ).rejects.toThrow(/finish it before preparing another batch/)
    expect(await readdir(roundsPath)).toEqual(['round-02'])
  })
})

function createMixedSource(): MemeReviewPreparationSourceBatch {
  const ideas: ScenarioMemeIdeasV2[] = [
    scenario('work', [
      idea('work--01'),
      idea('work--02'),
      idea('work--03'),
      idea('work--04'),
      idea('work--05')
    ]),
    scenario('finalized-only', [idea('finalized-only--01')]),
    scenario('disabled', [idea('disabled--01'), idea('disabled--02')]),
    scenario('all-disliked', [idea('all-disliked--01')]),
    scenario('ava-games-the-test', [idea('ava-games-the-test--05')]),
    scenario('rust-spots-the-evaluation', [
      idea('rust-spots-the-evaluation--08'),
      idea('rust-spots-the-evaluation--09')
    ])
  ]
  const feedback: MemeReviewStateDocument = {
    version: 2,
    round: 2,
    updatedAt: '2026-09-04T01:00:00.000Z',
    feedback: {
      'work--01': finalized('round-01'),
      'work--02': reviewed('like'),
      'work--03': reviewed('neutral'),
      'work--04': reviewed('neutral', 'Use the supplied replacement copy.'),
      'work--05': reviewed('dislike'),
      'finalized-only--01': finalized('round-02'),
      'disabled--01': reviewed('like'),
      'disabled--02': reviewed('dislike'),
      'all-disliked--01': reviewed('dislike'),
      'ava-games-the-test--05': reviewed('like', 'LOVE THIS'),
      'rust-spots-the-evaluation--08': reviewed('like', 'i love it'),
      'rust-spots-the-evaluation--09': reviewed(
        'dislike',
        'first line is strong. second line needs rework'
      )
    },
    scenarios: { disabled: { disabled: true } }
  }
  const assets = ideas.map(({ scenario_slug }) => asset(scenario_slug))
  const files = Object.fromEntries(
    ['ideas.json', 'assets.json', 'feedback.json', 'status.json'].map(
      (name) => [name, { bytes: 1, sha256: 'a'.repeat(64) }]
    )
  ) as MemeReviewPreparationSourceBatch['files']

  return {
    number: 2,
    ideas,
    assets,
    feedback,
    status: {
      version: 1,
      batch: 2,
      status: 'ready',
      message: 'Ready for review.',
      updatedAt: '2026-09-04T01:00:00.000Z',
      reviewable_scenarios: ideas.map(({ scenario_slug }) => scenario_slug)
    },
    files
  }
}

function reviewed(
  rating: 'dislike' | 'neutral' | 'like',
  notes = ''
): MemeFeedbackEntry {
  return { rating, notes, locked: false, lockRevision: 0 }
}

function finalized(revisionKey: string): MemeFeedbackEntry {
  return {
    rating: 'like',
    notes: 'Final.',
    locked: true,
    lockRevision: 1,
    finalizedVersion: {
      revisionKey,
      payloadFingerprint: 'v1-0000000000000000-1'
    }
  }
}

function scenario(
  scenario_slug: string,
  ideas: MemeIdeaV2[]
): ScenarioMemeIdeasV2 {
  return { scenario_slug, ideas }
}

function idea(id: string): MemeIdeaV2 {
  const scenarioSlug = id.replace(/--\d+$/, '')

  return {
    id,
    ai_concept: 'Control',
    display_context: 'standalone',
    source_anchor: 'The exact prop',
    caption_lines: ['SETUP', 'PAYOFF'],
    format: 'collision',
    frame_guidance: 'Keep the prop visible.',
    why_it_works: 'One hinge carries the mapping.',
    preview: {
      renderer: 2,
      template: 'overlay',
      frame_mode: 'cover',
      asset_ids: [`${scenarioSlug}--curated`],
      zones: [
        {
          lines: [0],
          slot: 'top',
          style: 'impact',
          align: 'center',
          casing: 'uppercase',
          size: 'hero',
          indent_levels: [0]
        },
        {
          lines: [1],
          slot: 'bottom',
          style: 'impact',
          align: 'center',
          casing: 'uppercase',
          size: 'hero',
          indent_levels: [0]
        }
      ]
    },
    critic: {
      verdict: 'keep',
      predicted_rating: 'like',
      confidence: 0.9,
      expected_feedback: 'Likely to work.',
      strongest_quality: 'Exact hinge.',
      main_risk: 'Could be too literal.',
      glance_test: {
        source: true,
        analogy: true,
        meme: true,
        visual: true
      },
      scores: {
        scene_hinge: 5,
        ai_payoff: 5,
        parsing_ease: 5,
        visual_proof: 5,
        source_accuracy: 5
      },
      calibration: {
        closest_liked_id: null,
        contrast_disliked_id: null
      }
    }
  }
}

function asset(scenarioSlug: string): MemeReviewAsset {
  return {
    id: `${scenarioSlug}--curated`,
    scenario_slug: scenarioSlug,
    src: `https://example.com/${scenarioSlug}.jpg`,
    width: 1280,
    height: 720,
    alt: 'The exact scene',
    blur_data_url: 'data:image/jpeg;base64,AA==',
    content_hash: 'a'.repeat(64),
    protected_regions: [
      {
        id: `${scenarioSlug}-prop`,
        label: 'Recognition prop',
        kind: 'prop',
        priority: 'must',
        source_rect: [40, 30, 20, 20]
      }
    ]
  }
}

async function createRoundsPath() {
  const path = await mkdtemp(join(tmpdir(), 'meme-review-prepare-'))
  temporaryPaths.push(path)
  return path
}

async function writeSourceBatch(
  sourcePath: string,
  source: MemeReviewPreparationSourceBatch
) {
  await mkdir(sourcePath)
  await Promise.all([
    writeJson(join(sourcePath, 'ideas.json'), source.ideas),
    writeJson(join(sourcePath, 'assets.json'), source.assets),
    writeJson(join(sourcePath, 'feedback.json'), source.feedback),
    writeJson(join(sourcePath, 'status.json'), source.status)
  ])
}

async function readCoreFiles(sourcePath: string) {
  return Promise.all(
    ['ideas.json', 'assets.json', 'feedback.json', 'status.json'].map((name) =>
      readFile(join(sourcePath, name), 'utf8')
    )
  )
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJson(path: string, name: string) {
  return JSON.parse(await readFile(join(path, name), 'utf8')) as unknown
}
