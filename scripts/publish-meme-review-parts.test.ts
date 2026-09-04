import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
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
  prepareMemeReviewBatch,
  type MemeReviewPreparationMode
} from './prepare-meme-review-batch'
import {
  parsePublishMemeReviewArguments,
  publishMemeReviewParts
} from './publish-meme-review-parts'

const temporaryPaths: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  )
})

describe('meme review part publishing', () => {
  it('requires an explicit target round', () => {
    expect(() => parsePublishMemeReviewArguments(['--parts=01'])).toThrow(
      /explicit --round/
    )
  })

  it('serializes concurrent part publishes and permits carried finalizations in WIP scenarios', async () => {
    const roundsPath = await createPreparedRounds()
    await rewriteAllParts(roundsPath)

    await Promise.all([
      publishMemeReviewParts({
        roundName: 'round-03',
        requestedParts: ['01'],
        roundsPath
      }),
      publishMemeReviewParts({
        roundName: 'round-03',
        requestedParts: ['02'],
        roundsPath
      })
    ])

    const targetPath = join(roundsPath, 'round-03')
    const ideas = (await readJson(
      targetPath,
      'ideas.json'
    )) as ScenarioMemeIdeasV2[]
    const status = (await readJson(targetPath, 'status.json')) as {
      status: string
      reviewable_scenarios: string[]
    }
    expect(
      ideas
        .flatMap(({ ideas }) => ideas)
        .filter(({ id }) => id.startsWith('work-') && id !== 'work-01--01')
        .every(({ preview }) => preview.frame_mode === 'cover')
    ).toBe(true)
    expect(status.status).toBe('generating')
    expect(status.reviewable_scenarios).toEqual(
      expect.arrayContaining(['work-01', 'work-12', 'work-13', 'disabled'])
    )

    await publishMemeReviewParts({
      roundName: 'round-03',
      requestedParts: [],
      complete: true,
      roundsPath
    })
    await expect(readJson(targetPath, 'status.json')).resolves.toMatchObject({
      status: 'ready'
    })
  })

  it('does not complete until every enabled scenario is reviewable', async () => {
    const roundsPath = await createPreparedRounds()
    await rewriteAllParts(roundsPath)
    await publishMemeReviewParts({
      roundName: 'round-03',
      requestedParts: ['01'],
      roundsPath
    })

    await expect(
      publishMemeReviewParts({
        roundName: 'round-03',
        requestedParts: [],
        complete: true,
        roundsPath
      })
    ).rejects.toThrow(/work-13/)
  })

  it('rejects nonfinalized WIP feedback while leaving locked feedback intact', async () => {
    const roundsPath = await createPreparedRounds()
    await rewriteAllParts(roundsPath)
    const feedbackPath = join(roundsPath, 'round-03', 'feedback.json')
    const feedback = (await readJson(
      join(roundsPath, 'round-03'),
      'feedback.json'
    )) as MemeReviewStateDocument
    feedback.feedback['work-01--02'] = reviewed('like')
    await writeJson(feedbackPath, feedback)

    await expect(
      publishMemeReviewParts({
        roundName: 'round-03',
        requestedParts: ['01'],
        roundsPath
      })
    ).rejects.toThrow(/work-01--02 has nonfinalized feedback/)

    const persisted = (await readJson(
      join(roundsPath, 'round-03'),
      'feedback.json'
    )) as MemeReviewStateDocument
    expect(persisted.feedback['work-01--01']?.locked).toBe(true)
    expect(persisted.feedback['work-01--02']?.locked).toBe(false)
  })

  it('keeps already-reviewable payloads immutable and rejects unrequested editorial changes', async () => {
    const roundsPath = await createPreparedRounds()
    await rewriteAllParts(roundsPath)
    await publishMemeReviewParts({
      roundName: 'round-03',
      requestedParts: ['01'],
      roundsPath
    })

    const partPath = join(roundsPath, 'round-03', 'parts', 'part-01.json')
    const part = JSON.parse(
      await readFile(partPath, 'utf8')
    ) as ScenarioMemeIdeasV2[]
    const mutableIdea = part[0]!.ideas.find(({ id }) => id === 'work-01--02')!
    mutableIdea.preview.frame_mode = 'contain-black'
    await writeJson(partPath, part)

    await expect(
      publishMemeReviewParts({
        roundName: 'round-03',
        requestedParts: ['01'],
        roundsPath
      })
    ).rejects.toThrow(/already-reviewable scenario work-01/)

    mutableIdea.preview.frame_mode = 'cover'
    mutableIdea.caption_lines = ['CHANGED SETUP', 'PAYOFF']
    await writeJson(partPath, part)
    await expect(
      publishMemeReviewParts({
        roundName: 'round-03',
        requestedParts: ['01'],
        roundsPath
      })
    ).rejects.toThrow(/changed unrequested field caption_lines/)
  })

  it('publishes exact punctuation-only parts while preserving finalized and disabled copy', async () => {
    const roundsPath = await createPreparedRounds('punctuation-refinement')

    await publishMemeReviewParts({
      roundName: 'round-03',
      requestedParts: ['01'],
      roundsPath
    })

    const targetPath = join(roundsPath, 'round-03')
    const ideas = (await readJson(
      targetPath,
      'ideas.json'
    )) as ScenarioMemeIdeasV2[]
    const byId = new Map(
      ideas.flatMap(({ ideas }) =>
        ideas.map((memeIdea) => [memeIdea.id, memeIdea])
      )
    )
    expect(byId.get('work-01--01')?.caption_lines).toEqual([
      'SETUP.',
      'PAYOFF.'
    ])
    expect(byId.get('work-01--02')?.caption_lines).toEqual(['SETUP', 'PAYOFF'])
    expect(byId.get('disabled--01')?.caption_lines).toEqual([
      'SETUP.',
      'PAYOFF.'
    ])

    const partPath = join(targetPath, 'parts', 'part-02.json')
    const part = JSON.parse(
      await readFile(partPath, 'utf8')
    ) as ScenarioMemeIdeasV2[]
    part[0]!.ideas[0]!.caption_lines = ['ARBITRARY COPY', 'PAYOFF']
    await writeJson(partPath, part)

    await expect(
      publishMemeReviewParts({
        roundName: 'round-03',
        requestedParts: ['02'],
        roundsPath
      })
    ).rejects.toThrow(/non-canonical punctuation-only caption change/)
  })
})

async function createPreparedRounds(
  mode: MemeReviewPreparationMode = 'layout-refinement'
) {
  const roundsPath = await mkdtemp(join(tmpdir(), 'meme-publish-test-'))
  temporaryPaths.push(roundsPath)
  const sourcePath = join(roundsPath, 'round-02')
  await mkdir(sourcePath)

  const workScenarios = Array.from({ length: 13 }, (_, index) => {
    const slug = `work-${String(index + 1).padStart(2, '0')}`
    return scenario(
      slug,
      index === 0
        ? [idea(`${slug}--01`), idea(`${slug}--02`)]
        : [idea(`${slug}--01`)]
    )
  })
  const ideas = [...workScenarios, scenario('disabled', [idea('disabled--01')])]
  const feedbackEntries: Record<string, MemeFeedbackEntry> = Object.fromEntries(
    ideas.flatMap(({ ideas }) =>
      ideas.map(({ id }) => [id, reviewed('like')] as const)
    )
  )
  feedbackEntries['work-01--01'] = finalized()
  const feedback: MemeReviewStateDocument = {
    version: 2,
    round: 2,
    updatedAt: '2026-09-04T01:00:00.000Z',
    feedback: feedbackEntries,
    scenarios: { disabled: { disabled: true } }
  }
  const assets = ideas.map(({ scenario_slug }) => asset(scenario_slug))
  const status = {
    version: 1,
    batch: 2,
    status: 'ready',
    message: 'Ready for the next batch.',
    updatedAt: '2026-09-04T01:00:00.000Z',
    reviewable_scenarios: ideas.map(({ scenario_slug }) => scenario_slug)
  }

  await Promise.all([
    writeJson(join(sourcePath, 'ideas.json'), ideas),
    writeJson(join(sourcePath, 'assets.json'), assets),
    writeJson(join(sourcePath, 'feedback.json'), feedback),
    writeJson(join(sourcePath, 'status.json'), status)
  ])
  await prepareMemeReviewBatch({
    source: 'round-02',
    target: 'round-03',
    mode,
    roundsPath,
    now: new Date('2026-09-04T02:00:00.000Z')
  })
  return roundsPath
}

async function rewriteAllParts(roundsPath: string) {
  const roundPath = join(roundsPath, 'round-03')
  for (const partName of ['part-01', 'part-02']) {
    const path = join(roundPath, 'parts', `${partName}.json`)
    const scenarios = JSON.parse(
      await readFile(path, 'utf8')
    ) as ScenarioMemeIdeasV2[]
    for (const scenario of scenarios) {
      for (const memeIdea of scenario.ideas) {
        if (memeIdea.id === 'work-01--01') continue
        memeIdea.preview.frame_mode = 'cover'
      }
    }
    await writeJson(path, scenarios)
  }
}

function scenario(
  scenarioSlug: string,
  ideas: MemeIdeaV2[]
): ScenarioMemeIdeasV2 {
  return { scenario_slug: scenarioSlug, ideas }
}

function idea(id: string): MemeIdeaV2 {
  const scenarioSlug = id.replace(/--\d+$/, '')
  return {
    id,
    ai_concept: 'Control',
    display_context: 'standalone',
    source_anchor: 'The exact prop',
    caption_lines: ['SETUP.', 'PAYOFF.'],
    format: 'collision',
    frame_guidance: 'Keep the prop visible.',
    why_it_works: 'One hinge carries the mapping.',
    preview: {
      renderer: 2,
      template: 'overlay',
      frame_mode: 'contain-blur',
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

function reviewed(rating: 'like' | 'neutral' | 'dislike'): MemeFeedbackEntry {
  return { rating, notes: '', locked: false, lockRevision: 0 }
}

function finalized(): MemeFeedbackEntry {
  return {
    rating: 'like',
    notes: '',
    locked: true,
    lockRevision: 1,
    finalizedVersion: {
      revisionKey: 'round-02',
      payloadFingerprint: 'v1-0000000000000000-1'
    }
  }
}

async function readJson(path: string, name: string) {
  return JSON.parse(await readFile(join(path, name), 'utf8')) as unknown
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}
