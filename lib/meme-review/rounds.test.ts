import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MemeFeedbackEntry, MemeIdeaV2, MemeReviewAsset } from './schema'
import { loadMemeReviewWorkspace } from './rounds'

const temporaryPaths: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  )
})

describe('renderer-v2 batch activation', () => {
  it('falls back when a higher batch changes a finalized meme', async () => {
    const roundsPath = await createRoundsPath()
    await writeBatch(roundsPath, 2, { locked: true })
    await writeBatch(roundsPath, 3, {
      locked: true,
      caption: 'Changed after final approval'
    })
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const workspace = await loadMemeReviewWorkspace(roundsPath)

    expect(workspace.activeBatch.number).toBe(2)
    expect(workspace.batches.map(({ number }) => number)).toEqual([2])
    expect(workspace.feedbackPath).toBe(
      join(roundsPath, 'round-02', 'feedback.json')
    )
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Skipping invalid round-03'),
      expect.any(Error)
    )
  })

  it('allows an otherwise identical finalized meme to be explicitly unlocked', async () => {
    const roundsPath = await createRoundsPath()
    await writeBatch(roundsPath, 2, { locked: true })
    await writeBatch(roundsPath, 3, { locked: false, lockRevision: 2 })

    const workspace = await loadMemeReviewWorkspace(roundsPath)

    expect(workspace.activeBatch.number).toBe(3)
    expect(
      workspace.activeBatch.feedback.feedback['sample-scenario--01']
    ).toEqual({
      rating: 'like',
      notes: 'Final copy and composition.',
      locked: false,
      lockRevision: 2
    })
  })

  it('keeps an explicitly unlocked batch active as its feedback evolves', async () => {
    const roundsPath = await createRoundsPath()
    await writeBatch(roundsPath, 2, { locked: true })
    await writeBatch(roundsPath, 3, {
      locked: false,
      lockRevision: 2,
      notes: 'Changed during the unlock transition.'
    })
    const workspace = await loadMemeReviewWorkspace(roundsPath)

    expect(workspace.activeBatch.number).toBe(3)
  })

  it('rejects an unlock that also changes finalized meme content', async () => {
    const roundsPath = await createRoundsPath()
    await writeBatch(roundsPath, 2, { locked: true })
    await writeBatch(roundsPath, 3, {
      locked: false,
      lockRevision: 2,
      caption: 'Changed while crossing the locked boundary'
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const workspace = await loadMemeReviewWorkspace(roundsPath)

    expect(workspace.activeBatch.number).toBe(2)
  })

  it('does not leap past an invalid renderer-v2 batch', async () => {
    const roundsPath = await createRoundsPath()
    await writeBatch(roundsPath, 2, { locked: true })
    await writeBatch(roundsPath, 3, { malformedIdeas: true })
    await writeBatch(roundsPath, 4, { locked: false, lockRevision: 2 })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const workspace = await loadMemeReviewWorkspace(roundsPath)

    expect(workspace.activeBatch.number).toBe(2)
    expect(workspace.batches.map(({ number }) => number)).toEqual([2])
  })
})

async function createRoundsPath() {
  const path = await mkdtemp(join(tmpdir(), 'meme-review-rounds-'))
  temporaryPaths.push(path)
  return path
}

async function writeBatch(
  roundsPath: string,
  round: number,
  options: {
    readonly caption?: string
    readonly locked?: boolean
    readonly lockRevision?: number
    readonly notes?: string
    readonly malformedIdeas?: boolean
  }
) {
  const path = join(roundsPath, `round-${String(round).padStart(2, '0')}`)
  const idea = createIdea(options.caption)
  const feedback: MemeFeedbackEntry = {
    rating: 'like',
    notes: options.notes ?? 'Final copy and composition.',
    locked: options.locked ?? false,
    lockRevision: options.lockRevision ?? (options.locked ? 1 : 0)
  }

  await mkdir(path, { recursive: true })
  await Promise.all([
    writeJson(
      join(path, 'ideas.json'),
      options.malformedIdeas
        ? { malformed: true }
        : [{ scenario_slug: 'sample-scenario', ideas: [idea] }]
    ),
    writeJson(join(path, 'assets.json'), [createAsset()]),
    writeJson(join(path, 'feedback.json'), {
      version: 2,
      round,
      updatedAt: null,
      feedback: { [idea.id]: feedback },
      scenarios: {}
    }),
    writeJson(join(path, 'status.json'), {
      version: 1,
      batch: round,
      status: 'ready',
      message: 'Ready for review.',
      updatedAt: null,
      reviewable_scenarios: ['sample-scenario']
    })
  ])
}

function createIdea(caption = 'One clean beat'): MemeIdeaV2 {
  return {
    id: 'sample-scenario--01',
    ai_concept: 'Control',
    display_context: 'standalone',
    source_anchor: 'A canonical prop',
    caption_lines: [caption],
    format: 'relabel',
    frame_guidance: 'Keep the canonical prop visible.',
    why_it_works: 'The prop carries the source and analogy at once.',
    preview: {
      renderer: 2,
      template: 'overlay',
      frame_mode: 'cover',
      asset_ids: ['sample-scenario--curated'],
      zones: [
        {
          lines: [0],
          slot: 'top',
          style: 'impact',
          align: 'center',
          casing: 'uppercase',
          size: 'standard',
          indent_levels: [0]
        }
      ]
    },
    critic: {
      verdict: 'keep',
      predicted_rating: 'like',
      confidence: 0.9,
      expected_feedback: 'Specific enough to survive another pass.',
      strongest_quality: 'One clean recognition hinge.',
      main_risk: 'The wording may still be too literal.',
      glance_test: {
        source: true,
        analogy: true,
        meme: true,
        visual: true
      },
      scores: {
        scene_hinge: 5,
        ai_payoff: 4,
        parsing_ease: 4,
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

function createAsset(): MemeReviewAsset {
  return {
    id: 'sample-scenario--curated',
    scenario_slug: 'sample-scenario',
    src: 'https://example.com/frame.jpg',
    width: 1280,
    height: 720,
    alt: 'The canonical prop in frame',
    blur_data_url: 'data:image/jpeg;base64,AA==',
    content_hash: 'a'.repeat(64),
    protected_regions: [
      {
        id: 'canonical-prop',
        label: 'Canonical prop',
        kind: 'prop',
        priority: 'must',
        source_rect: [40, 30, 20, 20]
      }
    ]
  }
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}
